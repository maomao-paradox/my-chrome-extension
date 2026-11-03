//! memory-server 二进制入口：加载配置、初始化日志、连接数据库、执行迁移并启动 HTTP 服务。

use std::sync::Arc;

use anyhow::Context;
use memory_server::{
    config::AppConfig,
    routes::{build_router, AppState},
    service::MemoryService,
    store::SqliteMemoryStore,
};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志：优先采用 RUST_LOG 环境变量，缺省 info 级别
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // 加载配置（全部项带默认值，永不因缺省配置失败）
    let config = AppConfig::from_env();
    let addr = config.addr();

    // 建立 SQLite 连接池（自动建库、WAL 模式、开启外键）
    let pool = SqliteMemoryStore::connect(&config.database_url)
        .await
        .with_context(|| format!("数据库连接失败: {}", config.database_url))?;

    // 执行嵌入式迁移：新库从零建表，已有库幂等跳过
    SqliteMemoryStore::run_migrations(&pool)
        .await
        .context("数据库迁移执行失败")?;

    // 组装应用状态与完整路由树（含鉴权 / CORS / 请求体上限 / 访问日志中间件）
    let state = AppState {
        config,
        service: Arc::new(MemoryService::new(SqliteMemoryStore::new(pool))),
    };
    let app = build_router(state);

    // 绑定监听地址，失败时给出带上下文的错误
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("绑定监听地址失败: {addr}"))?;

    tracing::info!("memory-server 已启动，监听地址 http://{addr}");

    // 启动服务（阻塞运行直至进程退出）
    axum::serve(listener, app)
        .await
        .context("HTTP 服务运行异常退出")?;

    Ok(())
}
