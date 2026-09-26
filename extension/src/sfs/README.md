### 单文件脚本（SFS）

不依赖于其他模块或第三方库，使用纯净的js实现

### 新增脚本
- `deepseek-auth-popup.js`：在页面中心弹出第三方登录授权窗口，仅保留 `DeepSeek` 登录入口，点击逻辑留空，方便你自行补充
- `deepseek-cookie-capture.js`：仅在 `chat.deepseek.com` 页面读取并返回 `document.cookie`，可通过 `CREATE_TAB_WITH_SCRIPT` 注入；无法读取 HttpOnly Cookie。
