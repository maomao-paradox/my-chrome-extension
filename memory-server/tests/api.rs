//! HTTP API 集成测试：基于内存 SQLite + tower oneshot，覆盖全部端点与横切行为。

use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, Response, StatusCode},
    Router,
};
use memory_server::{
    config::AppConfig,
    routes::{build_router, AppState},
    service::MemoryService,
    store::SqliteMemoryStore,
};
use serde_json::{json, Value};
use sqlx::sqlite::SqlitePoolOptions;
use tower::ServiceExt; // oneshot

// ─── 测试辅助 ─── //

/// 构造测试配置：无鉴权、默认 CORS、10MB 请求体上限
fn test_config() -> AppConfig {
    AppConfig {
        server_host: "127.0.0.1".into(),
        server_port: 8790,
        database_url: "sqlite::memory:".into(),
        api_token: None,
        cors_allowed_origins: None,
        max_request_bytes: 10 * 1024 * 1024,
    }
}

/// 基于内存库构建完整路由（含迁移）
async fn test_app_with(config: AppConfig) -> Router {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("内存库连接失败");
    SqliteMemoryStore::run_migrations(&pool)
        .await
        .expect("迁移执行失败");
    let service = MemoryService::new(SqliteMemoryStore::new(pool));
    build_router(AppState {
        config,
        service: Arc::new(service),
    })
}

async fn test_app() -> Router {
    test_app_with(test_config()).await
}

/// 构造 JSON 请求（body 为 None 时发空体）
fn req(method: &str, uri: &str, body: Option<Value>) -> Request<Body> {
    let builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json");
    match body {
        Some(v) => builder
            .body(Body::from(serde_json::to_vec(&v).unwrap()))
            .unwrap(),
        None => builder.body(Body::empty()).unwrap(),
    }
}

/// 读取响应体为 JSON
async fn body_json(resp: Response<Body>) -> Value {
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .expect("读取响应体失败");
    serde_json::from_slice(&bytes).expect("响应体不是合法 JSON")
}

/// 便捷请求：返回 (状态码, JSON body)
async fn call(app: &Router, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let resp = app
        .clone()
        .oneshot(req(method, uri, body))
        .await
        .expect("路由处理失败");
    let status = resp.status();
    let value = body_json(resp).await;
    (status, value)
}

// ─── 1. 探针 ─── //

#[tokio::test]
async fn health与readyz返回200() {
    let app = test_app().await;

    let (status, body) = call(&app, "GET", "/health", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "status": "ok" }));

    let (status, body) = call(&app, "GET", "/readyz", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "status": "ready" }));
}

// ─── 2. 条目全流程 ─── //

#[tokio::test]
async fn 条目全流程_创建列表更新唤醒删除() {
    let app = test_app().await;

    // 创建：201，stability 已按 importance 补全
    let (status, entry) = call(
        &app,
        "POST",
        "/api/v1/roles/miku/entries",
        Some(json!({
            "content": "主人喜欢猫",
            "category": "preference",
            "importance": "high"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let id = entry["id"].as_str().unwrap().to_string();
    assert_eq!(entry["category"], "preference");
    assert!(entry["stability"].as_f64().unwrap() > 0.0);
    assert_eq!(entry["accessCount"], 1);

    // 列表：含运行时 decayState / retention
    let (status, list) = call(&app, "GET", "/api/v1/roles/miku/entries", None).await;
    assert_eq!(status, StatusCode::OK);
    let entries = list["entries"].as_array().unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0]["decayState"], "active");
    assert!(entries[0]["retention"].is_number());

    // 局部更新
    let (status, updated) = call(
        &app,
        "PATCH",
        &format!("/api/v1/entries/{id}"),
        Some(json!({ "content": "主人喜欢布偶猫" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["content"], "主人喜欢布偶猫");

    // 手动唤醒
    let (status, recalled) = call(&app, "POST", &format!("/api/v1/entries/{id}/recall"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(recalled["decayState"].as_str().is_some() || recalled["stability"].is_number(), true);

    // 删除：204；再删 404；列表为空
    let resp = app
        .clone()
        .oneshot(req("DELETE", &format!("/api/v1/entries/{id}"), None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let (status, err) = call(&app, "DELETE", &format!("/api/v1/entries/{id}"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(err["error"]["code"], "not_found");

    let (_, list) = call(&app, "GET", "/api/v1/roles/miku/entries", None).await;
    assert_eq!(list["entries"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn 创建条目_空content返回400() {
    let app = test_app().await;
    let (status, err) = call(
        &app,
        "POST",
        "/api/v1/roles/miku/entries",
        Some(json!({ "content": "   " })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(err["error"]["code"], "bad_request");
}

// ─── 3. 身份记忆 ─── //

#[tokio::test]
async fn identity_两次PUT版本递增_无身份404() {
    let app = test_app().await;
    let body = || {
        json!({
            "displayName": "初音未来",
            "systemPromptTemplate": "你是初音未来"
        })
    };

    let (status, id1) = call(&app, "PUT", "/api/v1/roles/miku/identity", Some(body())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(id1["version"], 1);

    let (status, id2) = call(&app, "PUT", "/api/v1/roles/miku/identity", Some(body())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(id2["version"], 2);
    assert!(id2["updatedAt"].as_i64().unwrap() >= id1["updatedAt"].as_i64().unwrap());

    let (status, got) = call(&app, "GET", "/api/v1/roles/miku/identity", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(got["displayName"], "初音未来");

    let (status, err) = call(&app, "GET", "/api/v1/roles/nobody/identity", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(err["error"]["code"], "not_found");
}

// ─── 4. 检索 ─── //

#[tokio::test]
async fn retrieve_带query命中相关条目() {
    let app = test_app().await;
    for content in ["主人养了一只叫薇薇的布偶猫", "今天天气很好适合写代码"] {
        let (status, _) = call(
            &app,
            "POST",
            "/api/v1/roles/miku/entries",
            Some(json!({ "content": content })),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
    }

    let (status, result) = call(
        &app,
        "POST",
        "/api/v1/roles/miku/retrieve",
        Some(json!({ "query": "布偶猫" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let entries = result["entries"].as_array().unwrap();
    assert!(!entries.is_empty(), "query「布偶猫」应命中条目");
    assert!(entries[0]["content"].as_str().unwrap().contains("布偶猫"));
}

// ─── 5. 上下文装配 ─── //

#[tokio::test]
async fn context_普通角色非空_工具角色为空() {
    let app = test_app().await;
    call(
        &app,
        "PUT",
        "/api/v1/roles/miku/identity",
        Some(json!({ "displayName": "初音未来", "systemPromptTemplate": "你是初音未来" })),
    )
    .await;
    call(
        &app,
        "POST",
        "/api/v1/roles/miku/entries",
        Some(json!({ "content": "主人喜欢猫" })),
    )
    .await;

    let (status, result) = call(
        &app,
        "POST",
        "/api/v1/roles/miku/context",
        Some(json!({ "query": "猫" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        !result["assembledContext"].as_str().unwrap().is_empty(),
        "普通角色 assembledContext 应非空"
    );

    // 纯工具角色：不注入记忆上下文
    let (status, result) = call(
        &app,
        "POST",
        "/api/v1/roles/graph_extractor/context",
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["assembledContext"], "");
    assert_eq!(result["entries"].as_array().unwrap().len(), 0);
}

// ─── 6. observe 自动提取 ─── //

#[tokio::test]
async fn observe_自动捕获用户偏好() {
    let app = test_app().await;
    let (status, ok) = call(
        &app,
        "POST",
        "/api/v1/roles/miku/observe",
        Some(json!({
            "userMessage": "记住：我喜欢喝美式咖啡",
            "aiResponse": "好的主人，我记住了喵"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ok, json!({ "ok": true }));

    let (_, list) = call(
        &app,
        "GET",
        "/api/v1/roles/miku/entries?category=preference",
        None,
    )
    .await;
    let entries = list["entries"].as_array().unwrap();
    assert_eq!(entries.len(), 1, "应捕获一条 preference 条目");
    assert!(entries[0]["content"].as_str().unwrap().contains("美式咖啡"));
    assert_eq!(entries[0]["importance"], "high");
}

// ─── 7. 短期记忆 ─── //

#[tokio::test]
async fn shortterm_两种写入形态与读取() {
    let app = test_app().await;

    // 无快照 → 404
    let (status, err) = call(&app, "GET", "/api/v1/roles/miku/short-term", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(err["error"]["code"], "not_found");

    // Direct 形态
    let (status, snap) = call(
        &app,
        "PUT",
        "/api/v1/roles/miku/short-term",
        Some(json!({ "summary": "聊了猫", "coveredMessageCount": 4 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(snap["summary"], "聊了猫");
    assert_eq!(snap["coveredMessageCount"], 4);

    // GET 读取
    let (status, got) = call(&app, "GET", "/api/v1/roles/miku/short-term", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(got["summary"], "聊了猫");

    // Messages 形态：自动生成摘要
    let (status, snap) = call(
        &app,
        "PUT",
        "/api/v1/roles/miku/short-term",
        Some(json!({
            "messages": [
                { "role": "user", "content": "你好" },
                { "role": "assistant", "content": "你好喵" }
            ]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(snap["coveredMessageCount"], 2);
    assert!(snap["summary"].as_str().unwrap().contains("你好"));
}

// ─── 8. 导入导出 ─── //

#[tokio::test]
async fn 导出后删除角色再merge导入可恢复() {
    let app = test_app().await;
    call(
        &app,
        "PUT",
        "/api/v1/roles/miku/identity",
        Some(json!({ "displayName": "初音未来", "systemPromptTemplate": "你是初音未来" })),
    )
    .await;
    call(
        &app,
        "POST",
        "/api/v1/roles/miku/entries",
        Some(json!({ "content": "主人喜欢猫", "category": "preference" })),
    )
    .await;

    // 导出
    let (status, payload) = call(&app, "GET", "/api/v1/export?role=miku", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["schemaVersion"], 1);
    assert_eq!(payload["identities"].as_array().unwrap().len(), 1);
    assert_eq!(payload["entries"].as_array().unwrap().len(), 1);

    // 删除角色
    let resp = app
        .clone()
        .oneshot(req("DELETE", "/api/v1/roles/miku", None))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    let (_, list) = call(&app, "GET", "/api/v1/roles/miku/entries", None).await;
    assert_eq!(list["entries"].as_array().unwrap().len(), 0);

    // merge 导入恢复
    let (status, result) = call(&app, "POST", "/api/v1/import?mode=merge", Some(payload)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["entriesImported"], 1);
    assert_eq!(result["identitiesImported"], 1);

    let (_, list) = call(&app, "GET", "/api/v1/roles/miku/entries", None).await;
    assert_eq!(list["entries"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn 导入_schemaVersion非1返回400_mode非法返回400() {
    let app = test_app().await;
    let payload = json!({
        "schemaVersion": 2,
        "exportedAt": "2026-11-03T00:00:00.000Z",
        "identities": [],
        "entries": [],
        "shortTerm": {}
    });
    let (status, err) = call(&app, "POST", "/api/v1/import?mode=merge", Some(payload)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(err["error"]["code"], "bad_request");

    let valid = json!({
        "schemaVersion": 1,
        "exportedAt": "2026-11-03T00:00:00.000Z",
        "identities": [],
        "entries": [],
        "shortTerm": {}
    });
    let (status, err) = call(&app, "POST", "/api/v1/import?mode=bad", Some(valid)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(err["error"]["code"], "bad_request");
}

// ─── 9. 鉴权 ─── //

#[tokio::test]
async fn 鉴权_无凭证401_带XApiKey放行_探针豁免() {
    let mut config = test_config();
    config.api_token = Some("t".into());
    let app = test_app_with(config).await;

    // 无凭证 → 401，错误形状正确
    let (status, err) = call(&app, "GET", "/api/v1/roles", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(err["error"]["code"], "unauthorized");
    assert!(err["error"]["message"].is_string());

    // X-API-Key → 200
    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/roles")
                .header("x-api-key", "t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Authorization: Bearer → 200
    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/roles")
                .header("authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // /health、/readyz 不受鉴权影响
    let (status, _) = call(&app, "GET", "/health", None).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = call(&app, "GET", "/readyz", None).await;
    assert_eq!(status, StatusCode::OK);
}

// ─── 10. 未知路由与坏 JSON ─── //

#[tokio::test]
async fn 未知路由404_坏JSON400() {
    let app = test_app().await;

    let (status, err) = call(&app, "GET", "/no-such-route", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(err["error"]["code"], "not_found");

    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/roles/miku/entries")
                .header("content-type", "application/json")
                .body(Body::from("{非法 json"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = body_json(resp).await;
    assert_eq!(body["error"]["code"], "bad_request");
}

// ─── 11. CORS ─── //

#[tokio::test]
async fn cors_放行chrome扩展源预检() {
    let app = test_app().await;

    let resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/api/v1/roles/miku/entries")
                .header("origin", "chrome-extension://abc")
                .header("access-control-request-method", "POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let allow_origin = resp
        .headers()
        .get("access-control-allow-origin")
        .expect("预检响应缺少 access-control-allow-origin");
    assert_eq!(allow_origin, "chrome-extension://abc");
    assert!(
        resp.headers()
            .get("access-control-allow-methods")
            .is_some(),
        "预检响应应包含 access-control-allow-methods"
    );
}

// ─── 附加：角色列表与统计 ─── //

#[tokio::test]
async fn roles列表chatOnly过滤与stats计数() {
    let app = test_app().await;
    for (role, content) in [
        ("miku", "主人喜欢猫"),
        ("graph_extractor", "提取图谱"),
    ] {
        call(
            &app,
            "POST",
            &format!("/api/v1/roles/{role}/entries"),
            Some(json!({ "content": content })),
        )
        .await;
    }

    let (_, all) = call(&app, "GET", "/api/v1/roles", None).await;
    assert_eq!(all["roles"].as_array().unwrap().len(), 2);

    let (_, chat) = call(&app, "GET", "/api/v1/roles?chatOnly=true", None).await;
    let roles: Vec<&str> = chat["roles"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r.as_str().unwrap())
        .collect();
    assert_eq!(roles, vec!["miku"], "chatOnly 应过滤纯工具角色");

    let (_, stats) = call(&app, "GET", "/api/v1/roles/miku/stats", None).await;
    assert_eq!(stats["role"], "miku");
    assert_eq!(stats["count"], 1);
}
