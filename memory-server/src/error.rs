//! 统一应用错误类型：机器可读错误码、HTTP 状态码与 JSON 错误响应。
//!
//! 响应形状约定：`{"error": {"code": "...", "message": "..."}}`。

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// 应用统一错误类型
///
/// Display 仅输出内部消息本体，保证错误响应中的 message 干净可读。
#[derive(Debug, Error)]
pub enum AppError {
    /// 请求参数错误（400）
    #[error("{0}")]
    BadRequest(String),
    /// 未授权（401）
    #[error("{0}")]
    Unauthorized(String),
    /// 资源不存在（404）
    #[error("{0}")]
    NotFound(String),
    /// 请求体过大（413）
    #[error("{0}")]
    PayloadTooLarge(String),
    /// 内部错误（500）
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    /// 机器可读错误码，与接口规范枚举一一对应
    pub fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "bad_request",
            Self::Unauthorized(_) => "unauthorized",
            Self::NotFound(_) => "not_found",
            Self::PayloadTooLarge(_) => "payload_too_large",
            Self::Internal(_) => "internal",
        }
    }

    /// 对应的 HTTP 状态码
    pub fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    /// 统一序列化为 `{"error": {"code", "message"}}` 的 JSON 错误响应
    fn into_response(self) -> Response {
        let body = Json(json!({
            "error": {
                "code": self.code(),
                "message": self.to_string(),
            }
        }));
        (self.status(), body).into_response()
    }
}

/// 数据库错误统一归为内部错误，避免向调用方泄漏实现细节之外的语义
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self::Internal(err.to_string())
    }
}

/// JSON 反序列化失败统一归为请求参数错误
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::BadRequest(err.to_string())
    }
}

/// 统一返回类型别名，业务处理器签名使用 `AppResult<T>`
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// 校验各变体的错误码与状态码映射
    #[test]
    fn code与status映射() {
        let cases = [
            (AppError::BadRequest("参数缺失".into()), "bad_request", StatusCode::BAD_REQUEST),
            (AppError::Unauthorized("令牌无效".into()), "unauthorized", StatusCode::UNAUTHORIZED),
            (AppError::NotFound("角色不存在".into()), "not_found", StatusCode::NOT_FOUND),
            (AppError::PayloadTooLarge("超出 10MB".into()), "payload_too_large", StatusCode::PAYLOAD_TOO_LARGE),
            (AppError::Internal("数据库异常".into()), "internal", StatusCode::INTERNAL_SERVER_ERROR),
        ];
        for (err, expect_code, expect_status) in cases {
            assert_eq!(err.code(), expect_code);
            assert_eq!(err.status(), expect_status);
        }
    }

    /// 校验错误响应的 HTTP 状态与 JSON body 形状
    #[tokio::test]
    async fn json错误响应形状() {
        let resp = AppError::NotFound("记忆条目不存在".into()).into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .expect("读取响应体失败");
        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("响应体不是合法 JSON");
        assert_eq!(
            value,
            serde_json::json!({
                "error": {
                    "code": "not_found",
                    "message": "记忆条目不存在"
                }
            })
        );
    }

    /// 校验外部错误转换：sqlx → Internal，serde_json → BadRequest
    #[test]
    fn from转换() {
        let serde_err = serde_json::from_str::<serde_json::Value>("{非法 json")
            .expect_err("应当解析失败");
        let app_err = AppError::from(serde_err);
        assert_eq!(app_err.code(), "bad_request");

        let app_err = AppError::from(sqlx::Error::RowNotFound);
        assert_eq!(app_err.code(), "internal");
        assert_eq!(app_err.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
