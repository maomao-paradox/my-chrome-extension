# memory-server

KIRA:NOVE 记忆系统的 Rust 后端：axum + SQLite（sqlx，WAL 模式），为浏览器扩展提供分层记忆的 REST API，承接扩展端全部记忆领域模型与算法。

## 架构概览

分层结构：`routes`（HTTP / 鉴权 / CORS / 请求体上限）→ `service`（业务编排）→ `store`（sqlx 查询）→ `SQLite`（WAL 模式、外键开启，启动时自动执行 `migrations/` 下迁移）。

核心算法（与扩展端 `services/memory/` 逐一对应）：

- **艾宾浩斯遗忘曲线三态与豁免**：保留率 `R(t)=exp(-Δt/S)`，初始稳定性 S 按重要度为 critical 8760h / high 720h / medium 168h / low 24h；`R≥0.55` 为 active、`0.2≤R<0.55` 为 fading、`R<0.2` 为 forgotten；critical 重要度或 identity 类目保留率下限 0.6，永不 forgotten；被真正想起时 `S ← min(S×growth, 17520h)`（growth 分档 2.2 / 1.5 / 1.2）。
- **BM25 CJK bigram**：CJK 字符输出字符 bigram（单字保留），其他语言输出整词，统一小写；`k1=1.2`、`b=0.75`；按 role 建内存倒排索引，以「条数:总字符:最大createdAt」签名判断重建，结果归一化到 [0,1]。
- **0.5/0.3/0.2 混合排序**：综合分 `= 0.5×RAG + 0.3×保留率 + 0.2×重要度权重`（critical 1 / high 0.7 / medium 0.4 / low 0.15）；forgotten 仅当归一化 RAG ≥ 0.15 才复活带回，且只有最终入选条目才写回 reactivation（`lastReactivatedAt` 刷新、`accessCount+1`），避免检索刷屏破坏遗忘曲线。
- **observe 三规则**：规则 1 用户明示（记住/我喜欢/我讨厌/我叫…）→ preference（high），一轮一条；规则 2 具体事实（项目/框架/版本/操作系统/URL）→ fact（medium），一轮一条；规则 3 整轮对话切块（用户 150 字符 + AI 250 字符）入 conversation 语料，含寒暄过滤、合计 <12 字符过滤、与最近 8 条 Jaccard ≥ 0.85 去重。
- **1500 条容量淘汰**：单角色软上限 1500 条，超出时按「保留率 × 重要度」淘汰最低者，critical / identity 类目豁免。

上下文装配：预算 2000 字符，依次放入 `[角色身份]` → `[近期对话摘要]` → `[你记得的关于用户的事]`（最多 8 条，行首标注入库时间 `[YYYY/MM/DD HH:mm:ss]`，fading 标注「（印象模糊）」）；纯工具角色（`graph_extractor` / `textarea_ai_autofill` / `table_data_generator` / `translator_*`）返回空 `assembledContext`，identity 仍返回。

## 与扩展端的关系

导入/导出载荷与扩展端 `MemoryExportPayload` **完全互通**：`schemaVersion: 1`、camelCase 字段、毫秒时间戳。扩展端生成的备份 JSON 可直接 `POST /api/v1/import`；本服务导出的文件也可被扩展端直接导入。

## 配置

全部通过环境变量配置，缺省均有合理默认值：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_HOST` | `127.0.0.1` | 监听主机 |
| `SERVER_PORT` | `8790` | 监听端口 |
| `DATABASE_URL` | `sqlite://data/memory.db` | 数据库连接串，启动时自动建库 |
| `API_TOKEN` | （未设置） | 设置后 `/api/*` 要求 `Authorization: Bearer <token>` 或 `X-API-Key`；空串视为未设置 |
| `CORS_ALLOWED_ORIGINS` | （未设置） | 逗号分隔的允许源列表，含 `*` 放行任意源；未设置时默认放行 `chrome-extension://*` 与本地 Vite 端口（5173） |
| `MAX_REQUEST_BYTES` | `10485760`（10MB） | 请求体上限，覆盖导入备份的大 JSON 场景 |
| `RUST_LOG` | `info` | 日志级别（tracing EnvFilter 语法） |

## 本地运行

```bash
cargo run
```

## 测试

```bash
cargo test
```

## Docker 运行

```bash
docker compose up --build
```

服务在 8790 端口可用；数据持久化在命名卷 `memory-data`，重启容器数据保留。

## API 一览

Base：`http://127.0.0.1:8790`，统一 JSON，camelCase 字段。完整机器可读规范见 [openapi.yaml](./openapi.yaml)（可用 Swagger UI / Redoc / `openapi-generator` 直接消费）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 存活探针（不依赖 DB） |
| GET | `/readyz` | 就绪探针（含 DB ping） |
| GET | `/api/v1/roles?chatOnly=` | 列出全部角色；`chatOnly=true` 过滤纯工具角色 |
| GET | `/api/v1/roles/{role}/stats` | 角色记忆条目计数 |
| DELETE | `/api/v1/roles/{role}` | 忘记该角色一切（entries / identity / short_term），返回 204 |
| PUT | `/api/v1/roles/{role}/identity` | 注册/更新身份（version 自动 +1） |
| GET | `/api/v1/roles/{role}/identity` | 读取身份，无则 404 |
| POST | `/api/v1/roles/{role}/entries` | 新增条目（自动补全稳定性字段 + 容量淘汰），返回 201 |
| GET | `/api/v1/roles/{role}/entries?category=&state=&limit=&offset=` | 列出条目，附运行时计算的 `decayState` / `retention` |
| PATCH | `/api/v1/entries/{id}` | 局部更新（content / importance / category / tags） |
| DELETE | `/api/v1/entries/{id}` | 删除条目，成功 204 |
| POST | `/api/v1/entries/{id}/recall` | 手动唤醒（S×2.2，回到 active） |
| POST | `/api/v1/roles/{role}/retrieve` | `{query?, limit?}` → 混合排序条目（含复活写回），limit 缺省 15、上限 100 |
| POST | `/api/v1/roles/{role}/context` | `{query?}` → `{entries, identity?, shortTerm?, assembledContext}` |
| POST | `/api/v1/roles/{role}/observe` | `{userMessage, aiResponse}` → 自动提取 + 对话入库 |
| GET | `/api/v1/roles/{role}/short-term` | 读取短期快照，无则 404 |
| PUT | `/api/v1/roles/{role}/short-term` | `{summary, coveredMessageCount}` 直接写入，或 `{messages[]}` 自动摘要（取最近 6 条、每条截断 100 字符） |
| GET | `/api/v1/export?role=` | 导出 `schemaVersion:1` 备份（缺省全量，可单角色） |
| POST | `/api/v1/import?mode=merge\|replace` | 导入备份；`replace` 先清涉及角色；无身份角色自动补默认身份 |

### curl 示例

创建条目：

```bash
curl -X POST http://127.0.0.1:8790/api/v1/roles/miku/entries \
  -H 'Content-Type: application/json' \
  -d '{"content": "主人喜欢猫", "category": "preference", "importance": "high"}'
```

混合排序检索：

```bash
curl -X POST http://127.0.0.1:8790/api/v1/roles/miku/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query": "主人的喜好", "limit": 15}'
```

上下文装配（可直接注入 system prompt）：

```bash
curl -X POST http://127.0.0.1:8790/api/v1/roles/miku/context \
  -H 'Content-Type: application/json' \
  -d '{"query": "今天想聊点什么"}'
```

观察一轮对话（自动提取记忆）：

```bash
curl -X POST http://127.0.0.1:8790/api/v1/roles/miku/observe \
  -H 'Content-Type: application/json' \
  -d '{"userMessage": "记住：我喜欢喝美式咖啡", "aiResponse": "好的，我记住了"}'
```

导出备份（缺省全量，`?role=miku` 可单角色）：

```bash
curl http://127.0.0.1:8790/api/v1/export -o backup.json
```

导入备份（merge 缺省；replace 先清空涉及角色）：

```bash
curl -X POST 'http://127.0.0.1:8790/api/v1/import?mode=merge' \
  -H 'Content-Type: application/json' \
  -d @backup.json

curl -X POST 'http://127.0.0.1:8790/api/v1/import?mode=replace' \
  -H 'Content-Type: application/json' \
  -d @backup.json
```

设置了 `API_TOKEN` 时的调用（`/health`、`/readyz` 不受保护）：

```bash
curl http://127.0.0.1:8790/api/v1/roles \
  -H 'Authorization: Bearer <token>'
# 或
curl http://127.0.0.1:8790/api/v1/roles \
  -H 'X-API-Key: <token>'
```

## 错误格式

所有错误统一为：

```json
{"error": {"code": "bad_request", "message": "content 不能为空"}}
```

| code | HTTP 状态 | 含义 |
| --- | --- | --- |
| `bad_request` | 400 | 请求参数 / JSON 形状错误（含 schemaVersion 不支持、非法枚举值） |
| `unauthorized` | 401 | 缺少或无效的 API 凭证 |
| `not_found` | 404 | 资源或路由不存在 |
| `payload_too_large` | 413 | 请求体超出 `MAX_REQUEST_BYTES` |
| `internal` | 500 | 内部错误（含数据库异常） |

## 数据库迁移

`migrations/` 下的 SQL 迁移（如 `0001_init.sql`）以 sqlx 嵌入式迁移方式在**启动时自动执行**：新库从零建表（`identities` / `entries` / `short_term`），已有库幂等跳过，无需手动干预。
