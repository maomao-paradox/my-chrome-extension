//! 应用配置：从环境变量加载，所有项均有合理默认值。

use std::env;

/// 默认监听主机
const DEFAULT_SERVER_HOST: &str = "127.0.0.1";
/// 默认监听端口
const DEFAULT_SERVER_PORT: u16 = 8790;
/// 默认数据库连接串（相对路径，便于容器内挂载数据目录）
const DEFAULT_DATABASE_URL: &str = "sqlite://data/memory.db";
/// 默认请求体上限：10MB（覆盖导入备份的大 JSON 场景）
const DEFAULT_MAX_REQUEST_BYTES: usize = 10 * 1024 * 1024; // 10_485_760

/// 应用配置
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppConfig {
    /// 服务监听主机（环境变量 `SERVER_HOST`）
    pub server_host: String,
    /// 服务监听端口（环境变量 `SERVER_PORT`）
    pub server_port: u16,
    /// 数据库连接串（环境变量 `DATABASE_URL`）
    pub database_url: String,
    /// 可选 API 令牌（环境变量 `API_TOKEN`，空串视为未设置）
    pub api_token: Option<String>,
    /// 允许的 CORS 源列表（环境变量 `CORS_ALLOWED_ORIGINS`，逗号分隔，空则视为未设置）
    pub cors_allowed_origins: Option<Vec<String>>,
    /// 请求体最大字节数（环境变量 `MAX_REQUEST_BYTES`）
    pub max_request_bytes: usize,
}

impl AppConfig {
    /// 从环境变量加载配置，缺省或解析失败的项回落到默认值
    pub fn from_env() -> Self {
        let server_host =
            env::var("SERVER_HOST").unwrap_or_else(|_| DEFAULT_SERVER_HOST.to_string());

        let server_port = env::var("SERVER_PORT")
            .ok()
            .and_then(|raw| raw.parse::<u16>().ok())
            .unwrap_or(DEFAULT_SERVER_PORT);

        let database_url =
            env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());

        // 空串视为未设置令牌
        let api_token = env::var("API_TOKEN").ok().filter(|raw| !raw.is_empty());

        // 逗号分隔源列表；逐项去空白并丢弃空项，整体为空则视为未设置
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS").ok().and_then(|raw| {
            let origins: Vec<String> = raw
                .split(',')
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect();
            if origins.is_empty() {
                None
            } else {
                Some(origins)
            }
        });

        let max_request_bytes = env::var("MAX_REQUEST_BYTES")
            .ok()
            .and_then(|raw| raw.parse::<usize>().ok())
            .unwrap_or(DEFAULT_MAX_REQUEST_BYTES);

        Self {
            server_host,
            server_port,
            database_url,
            api_token,
            cors_allowed_origins,
            max_request_bytes,
        }
    }

    /// 返回 `host:port` 形式的监听地址，供 TcpListener 绑定使用
    pub fn addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 说明：环境变量是进程级共享状态，并行测试会互相污染，
    /// 因此将「默认值 / 自定义覆盖 / 空串边界」全部收敛在单个测试函数中串行断言。
    #[test]
    fn from_env_默认值与自定义覆盖() {
        // —— 场景一：清理全部相关变量，验证默认值 ——
        env::remove_var("SERVER_HOST");
        env::remove_var("SERVER_PORT");
        env::remove_var("DATABASE_URL");
        env::remove_var("API_TOKEN");
        env::remove_var("CORS_ALLOWED_ORIGINS");
        env::remove_var("MAX_REQUEST_BYTES");

        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_host, "127.0.0.1");
        assert_eq!(cfg.server_port, 8790);
        assert_eq!(cfg.database_url, "sqlite://data/memory.db");
        assert_eq!(cfg.api_token, None);
        assert_eq!(cfg.cors_allowed_origins, None);
        assert_eq!(cfg.max_request_bytes, 10_485_760);
        assert_eq!(cfg.addr(), "127.0.0.1:8790");

        // —— 场景二：全部变量自定义覆盖 ——
        env::set_var("SERVER_HOST", "0.0.0.0");
        env::set_var("SERVER_PORT", "9000");
        env::set_var("DATABASE_URL", "sqlite:///tmp/test.db");
        env::set_var("API_TOKEN", "secret-token");
        env::set_var("CORS_ALLOWED_ORIGINS", "https://a.com, https://b.com ,,");
        env::set_var("MAX_REQUEST_BYTES", "2048");

        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_host, "0.0.0.0");
        assert_eq!(cfg.server_port, 9000);
        assert_eq!(cfg.database_url, "sqlite:///tmp/test.db");
        assert_eq!(cfg.api_token, Some("secret-token".to_string()));
        assert_eq!(
            cfg.cors_allowed_origins,
            Some(vec!["https://a.com".to_string(), "https://b.com".to_string()])
        );
        assert_eq!(cfg.max_request_bytes, 2048);
        assert_eq!(cfg.addr(), "0.0.0.0:9000");

        // —— 场景三：空串边界（API_TOKEN 空串视为 None，CORS 空串视为 None）——
        env::set_var("API_TOKEN", "");
        env::set_var("CORS_ALLOWED_ORIGINS", "");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.api_token, None);
        assert_eq!(cfg.cors_allowed_origins, None);

        // —— 场景四：非法数值回落默认值 ——
        env::set_var("SERVER_PORT", "not-a-number");
        env::set_var("MAX_REQUEST_BYTES", "-1");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_port, 8790);
        assert_eq!(cfg.max_request_bytes, 10_485_760);

        // 收尾清理，避免影响同进程其他测试
        env::remove_var("SERVER_HOST");
        env::remove_var("SERVER_PORT");
        env::remove_var("DATABASE_URL");
        env::remove_var("API_TOKEN");
        env::remove_var("CORS_ALLOWED_ORIGINS");
        env::remove_var("MAX_REQUEST_BYTES");
    }
}
