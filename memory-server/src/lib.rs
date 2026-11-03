//! 记忆系统后端服务 crate 根模块。
//!
//! 声明全部功能模块，为后续并行开发做好准备：
//! - `config`：环境变量配置加载（本骨架已实现）
//! - `error`：统一错误类型与 JSON 错误响应（本骨架已实现）
//! - `routes`：HTTP 路由（本骨架仅含 /health，业务端点由后续任务挂载）
//! - `models` / `decay` / `rag` / `store` / `service`：由后续任务实现

pub mod config;
pub mod error;
pub mod models;
pub mod decay;
pub mod rag;
pub mod store;
pub mod service;
pub mod routes;
