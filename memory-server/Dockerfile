# syntax=docker/dockerfile:1
# memory-server 多阶段构建：构建期编译 release 二进制，运行期最小化镜像 + 非 root 运行

# ==================== 构建阶段 ====================
FROM rust:1-slim-bookworm AS builder

WORKDIR /app

# 先拷贝清单文件，最大化利用 Docker 层缓存
# （迁移已用 sqlx::migrate! 编译进二进制，但 migrations/ 目录需存在供宏读取）
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

# 锁定依赖版本构建 release 二进制
RUN cargo build --release --locked

# ==================== 运行阶段 ====================
FROM debian:bookworm-slim

# ca-certificates：TLS 根证书；curl：健康检查用；装完清理 apt 缓存
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户（uid 10001）
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser

# SQLite 数据目录（挂载 volume 的挂载点），归属 appuser
RUN mkdir -p /data && chown appuser:appuser /data

# 拷贝二进制并归属 appuser
COPY --from=builder /app/target/release/memory-server /app/memory-server
RUN chown appuser:appuser /app/memory-server

# 容器内默认配置：监听所有网卡、数据库落 /data 卷（sqlite 绝对路径三个斜杠）
ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8790 \
    DATABASE_URL=sqlite:///data/memory.db \
    RUST_LOG=info

# 数据持久化卷
VOLUME ["/data"]

# 以非 root 用户运行
USER appuser

EXPOSE 8790

# 存活探针
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD curl -fsS http://127.0.0.1:8790/health || exit 1

CMD ["/app/memory-server"]
