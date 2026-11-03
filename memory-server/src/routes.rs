//! HTTP 路由装配：健康探针 + `/api/v1` 业务端点 + 鉴权 / CORS / 请求体上限 / 访问日志中间件。
//!
//! 统一约定：
//! - 错误形状：`{"error": {"code", "message"}}`（见 [`AppError`]）；
//! - JSON 请求体经自定义 [`JsonBody`] 提取器解析，JSON 语法错误 → 400 bad_request，
//!   超出 `max_request_bytes` → 413 payload_too_large；
//! - 鉴权为可选项：`config.api_token` 设置后，仅 `/api/*` 受保护，`/health`、`/readyz` 放行。

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, FromRequest, Path, Query, Request, State},
    http::{header, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::models::{
    EntryPatch, ImportMode, MemoryCategory, MemoryDecayState, MemoryExportPayload,
    MemoryImportance, ShortTermInput,
};
use crate::service::MemoryService;

/// 检索条数默认值与上限（对齐扩展端 retrieve 语义）
const DEFAULT_RETRIEVE_LIMIT: usize = 15;
const MAX_RETRIEVE_LIMIT: usize = 100;

/// 共享应用状态：配置 + 业务服务（MemoryService 含 Mutex 缓存，以 Arc 共享）
#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub service: Arc<MemoryService>,
}

/// 自定义 JSON 请求体提取器：将解析失败统一映射为应用错误形状
///
/// - 语法 / 形状错误 → 400 bad_request
/// - 超出 DefaultBodyLimit 限制的读取错误 → 413 payload_too_large
pub struct JsonBody<T>(pub T);

impl<S, T> FromRequest<S> for JsonBody<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = AppError;

    async fn from_request(req: Request, _state: &S) -> Result<Self, Self::Rejection> {
        let bytes = axum::body::to_bytes(req.into_body(), usize::MAX)
            .await
            .map_err(|err| {
                AppError::PayloadTooLarge(format!("请求体读取失败或超出大小限制: {err}"))
            })?;
        let value = serde_json::from_slice::<T>(&bytes)
            .map_err(|err| AppError::BadRequest(format!("请求体 JSON 解析失败: {err}")))?;
        Ok(JsonBody(value))
    }
}

/// 组装完整 HTTP 路由树
pub fn build_router(state: AppState) -> Router {
    // /api/v1 业务路由：受可选鉴权保护
    let api = Router::new()
        .route("/api/v1/roles", get(list_roles))
        .route("/api/v1/roles/{role}/stats", get(role_stats))
        .route("/api/v1/roles/{role}", delete(forget_role))
        .route(
            "/api/v1/roles/{role}/identity",
            put(upsert_identity).get(get_identity),
        )
        .route(
            "/api/v1/roles/{role}/entries",
            post(create_entry).get(list_entries),
        )
        .route(
            "/api/v1/entries/{id}",
            patch(update_entry).delete(delete_entry),
        )
        .route("/api/v1/entries/{id}/recall", post(recall_entry))
        .route("/api/v1/roles/{role}/retrieve", post(retrieve))
        .route("/api/v1/roles/{role}/context", post(build_context))
        .route("/api/v1/roles/{role}/observe", post(observe))
        .route(
            "/api/v1/roles/{role}/short-term",
            put(put_short_term).get(get_short_term),
        )
        .route("/api/v1/export", get(export_memories))
        .route("/api/v1/import", post(import_memories))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    Router::new()
        .route("/health", get(health_check))
        .route("/readyz", get(readyz_check))
        .merge(api)
        .fallback(not_found_fallback)
        // 外层中间件（后注册者更靠外）：CORS 需包裹鉴权以便预检 OPTIONS 直接放行
        .layer(build_cors_layer(&state.config))
        .layer(DefaultBodyLimit::max(state.config.max_request_bytes))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// 构造 CORS 层：
/// - 显式配置列表：含 `*` 放行任意源，否则按精确 Origin 匹配；
/// - 未配置：放行 `chrome-extension://` 前缀与本地 Vite 开发端口。
fn build_cors_layer(config: &AppConfig) -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::HeaderName::from_static("x-api-key"),
        ]);

    match &config.cors_allowed_origins {
        Some(origins) if origins.iter().any(|o| o == "*") => layer.allow_origin(tower_http::cors::Any),
        Some(origins) => {
            let parsed: Vec<HeaderValue> = origins
                .iter()
                .filter_map(|o| match o.parse::<HeaderValue>() {
                    Ok(v) => Some(v),
                    Err(err) => {
                        tracing::warn!("忽略非法 CORS 源配置 {o:?}: {err}");
                        None
                    }
                })
                .collect();
            layer.allow_origin(parsed)
        }
        None => layer.allow_origin(tower_http::cors::AllowOrigin::predicate(
            |origin: &HeaderValue, _parts: &axum::http::request::Parts| {
                origin.to_str().is_ok_and(|o| {
                    o.starts_with("chrome-extension://")
                        || o == "http://localhost:5173"
                        || o == "http://127.0.0.1:5173"
                })
            },
        )),
    }
}

/// 可选鉴权中间件：设置了 api_token 时校验 Bearer / X-API-Key，否则全部放行
async fn auth_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let Some(expected) = &state.config.api_token else {
        return next.run(req).await;
    };

    let headers = req.headers();
    let bearer_ok = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .is_some_and(|token| token == expected);
    let api_key_ok = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|token| token == expected);

    if bearer_ok || api_key_ok {
        next.run(req).await
    } else {
        AppError::Unauthorized("缺少或无效的 API 凭证".into()).into_response()
    }
}

/// 未知路由兜底：统一返回 404 not_found 错误 JSON
async fn not_found_fallback() -> AppError {
    AppError::NotFound("路由不存在".into())
}

// ─── 探针 ─── //

/// 存活探针：进程可达即 ok（不依赖 DB）
async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

/// 就绪探针：SELECT 1 ping 数据库，失败返回 503
async fn readyz_check(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    match sqlx::query("SELECT 1")
        .execute(state.service.store().pool())
        .await
    {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "ready" }))),
        Err(err) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": { "code": "internal", "message": err.to_string() }
            })),
        ),
    }
}

// ─── 角色 ─── //

/// GET /api/v1/roles?chatOnly=true —— 列出角色，chatOnly 时过滤纯工具角色
async fn list_roles(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let chat_only = params.get("chatOnly").is_some_and(|v| v == "true");
    let roles = state.service.list_roles(chat_only).await?;
    Ok(Json(json!({ "roles": roles })))
}

/// GET /api/v1/roles/{role}/stats —— 角色记忆条目计数
async fn role_stats(
    State(state): State<AppState>,
    Path(role): Path<String>,
) -> AppResult<Json<Value>> {
    let count = state.service.store().count(&role).await?;
    Ok(Json(json!({ "role": role, "count": count })))
}

/// DELETE /api/v1/roles/{role} —— 忘记该角色一切，返回 204
async fn forget_role(
    State(state): State<AppState>,
    Path(role): Path<String>,
) -> AppResult<StatusCode> {
    state.service.forget_all(&role).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── 身份记忆 ─── //

/// PUT identity 请求体
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdentityBody {
    display_name: String,
    system_prompt_template: String,
    persona_description: Option<String>,
}

/// PUT /api/v1/roles/{role}/identity —— 注册/更新身份（version 自动 +1）
async fn upsert_identity(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(body): JsonBody<IdentityBody>,
) -> AppResult<Json<Value>> {
    let identity = state
        .service
        .upsert_identity(
            &role,
            body.display_name,
            body.system_prompt_template,
            body.persona_description,
        )
        .await?;
    Ok(Json(json!(identity)))
}

/// GET /api/v1/roles/{role}/identity —— 无身份返回 404
async fn get_identity(
    State(state): State<AppState>,
    Path(role): Path<String>,
) -> AppResult<Json<Value>> {
    let identity = state
        .service
        .get_identity(&role)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("角色 {role} 不存在身份记忆")))?;
    Ok(Json(json!(identity)))
}

// ─── 记忆条目 ─── //

/// POST entries 请求体
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateEntryBody {
    content: String,
    category: Option<MemoryCategory>,
    importance: Option<MemoryImportance>,
    source: Option<String>,
    tags: Option<Vec<String>>,
}

/// POST /api/v1/roles/{role}/entries —— 新增条目（空 content → 400），返回 201
async fn create_entry(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(body): JsonBody<CreateEntryBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.content.trim().is_empty() {
        return Err(AppError::BadRequest("content 不能为空".into()));
    }
    let entry = state
        .service
        .add_entry(
            &role,
            &body.content,
            body.category,
            body.importance,
            body.source,
            body.tags,
        )
        .await?;
    Ok((StatusCode::CREATED, Json(json!(entry))))
}

/// GET /api/v1/roles/{role}/entries?category=&state=&limit=&offset=
///
/// category / state 非法值返回 400；返回条目带运行时 decayState / retention
async fn list_entries(
    State(state): State<AppState>,
    Path(role): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let category = params
        .get("category")
        .map(|raw| {
            MemoryCategory::from_str(raw)
                .ok_or_else(|| AppError::BadRequest(format!("未知的 category: {raw}")))
        })
        .transpose()?;
    let decay_state = params
        .get("state")
        .map(|raw| match raw.as_str() {
            "active" => Ok(MemoryDecayState::Active),
            "fading" => Ok(MemoryDecayState::Fading),
            "forgotten" => Ok(MemoryDecayState::Forgotten),
            _ => Err(AppError::BadRequest(format!("未知的 state: {raw}"))),
        })
        .transpose()?;
    let limit = params
        .get("limit")
        .map(|raw| {
            raw.parse::<usize>()
                .map_err(|_| AppError::BadRequest(format!("非法的 limit: {raw}")))
        })
        .transpose()?;
    let offset = params
        .get("offset")
        .map(|raw| {
            raw.parse::<usize>()
                .map_err(|_| AppError::BadRequest(format!("非法的 offset: {raw}")))
        })
        .transpose()?;

    let entries = state
        .service
        .list_entries(&role, category, decay_state, limit, offset)
        .await?;
    Ok(Json(json!({ "entries": entries })))
}

/// PATCH /api/v1/entries/{id} —— 局部更新，不存在返回 404
async fn update_entry(
    State(state): State<AppState>,
    Path(id): Path<String>,
    JsonBody(patch): JsonBody<EntryPatch>,
) -> AppResult<Json<Value>> {
    let entry = state
        .service
        .update_entry(&id, &patch)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("记忆条目不存在: {id}")))?;
    Ok(Json(json!(entry)))
}

/// DELETE /api/v1/entries/{id} —— 成功 204，不存在 404
async fn delete_entry(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<StatusCode> {
    let deleted = state.service.remove_entry(&id).await?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(format!("记忆条目不存在: {id}")))
    }
}

/// POST /api/v1/entries/{id}/recall —— 手动唤醒，不存在 404
async fn recall_entry(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let entry = state
        .service
        .recall_entry(&id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("记忆条目不存在: {id}")))?;
    Ok(Json(json!(entry)))
}

// ─── 检索与上下文 ─── //

/// POST retrieve 请求体：limit 缺省 15、上限 100
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RetrieveBody {
    query: Option<String>,
    limit: Option<usize>,
}

/// POST /api/v1/roles/{role}/retrieve —— 混合排序检索
async fn retrieve(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(body): JsonBody<RetrieveBody>,
) -> AppResult<Json<Value>> {
    let limit = body
        .limit
        .unwrap_or(DEFAULT_RETRIEVE_LIMIT)
        .min(MAX_RETRIEVE_LIMIT);
    let entries = state
        .service
        .retrieve(&role, body.query.as_deref(), limit)
        .await?;
    Ok(Json(json!({ "entries": entries })))
}

/// POST context 请求体
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContextBody {
    query: Option<String>,
}

/// POST /api/v1/roles/{role}/context —— 装配可直接注入 system prompt 的上下文
async fn build_context(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(body): JsonBody<ContextBody>,
) -> AppResult<Json<Value>> {
    let result = state
        .service
        .build_context(&role, body.query.as_deref())
        .await?;
    Ok(Json(json!(result)))
}

/// POST observe 请求体
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObserveBody {
    user_message: String,
    ai_response: String,
}

/// POST /api/v1/roles/{role}/observe —— 观察一轮对话并自动提取记忆
async fn observe(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(body): JsonBody<ObserveBody>,
) -> AppResult<Json<Value>> {
    state
        .service
        .observe(&role, &body.user_message, &body.ai_response)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

// ─── 短期记忆 ─── //

/// GET /api/v1/roles/{role}/short-term —— 无快照返回 404
async fn get_short_term(
    State(state): State<AppState>,
    Path(role): Path<String>,
) -> AppResult<Json<Value>> {
    let snapshot = state
        .service
        .get_short_term(&role)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("角色 {role} 不存在短期记忆")))?;
    Ok(Json(json!(snapshot)))
}

/// PUT /api/v1/roles/{role}/short-term —— 支持 Direct（摘要）与 Messages（自动摘要）两种形态
async fn put_short_term(
    State(state): State<AppState>,
    Path(role): Path<String>,
    JsonBody(input): JsonBody<ShortTermInput>,
) -> AppResult<Json<Value>> {
    let snapshot = match input {
        ShortTermInput::Direct {
            summary,
            covered_message_count,
        } => {
            state
                .service
                .save_short_term_direct(&role, summary, covered_message_count)
                .await?
        }
        ShortTermInput::Messages { messages } => state
            .service
            .update_short_term_from_messages(&role, &messages)
            .await?
            .ok_or_else(|| AppError::BadRequest("messages 不能为空".into()))?,
    };
    Ok(Json(json!(snapshot)))
}

// ─── 导入导出 ─── //

/// GET /api/v1/export?role= —— 导出备份（缺省全量，可单角色）
async fn export_memories(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let payload = state
        .service
        .export_memories(params.get("role").map(String::as_str))
        .await?;
    Ok(Json(json!(payload)))
}

/// POST /api/v1/import?mode=merge|replace —— 导入备份；mode 非法返回 400
async fn import_memories(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    JsonBody(payload): JsonBody<MemoryExportPayload>,
) -> AppResult<Json<Value>> {
    let mode = match params.get("mode").map(String::as_str) {
        None | Some("merge") => ImportMode::Merge,
        Some("replace") => ImportMode::Replace,
        Some(other) => return Err(AppError::BadRequest(format!("非法的导入模式: {other}"))),
    };
    let result = state.service.import_memories(payload, mode).await?;
    Ok(Json(json!(result)))
}
