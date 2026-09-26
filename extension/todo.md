## 需求描述

### 现状

执行的AI请求的auth_token和cookies都是使用的默认参数（@/shared/deepseek-core.ts 文件顶部的默认参数 DEFAULT_DEEPSEEK_AUTH_TOKEN、DEFAULT_DEEPSEEK_COOKIES、DEFAULT_DEEPSEEK_SESSION_COOKIE）

### 变更

我希望修改为安装用户可以使用自己的auth_token 和 cookies，将这几个参数变成可配置，而是不是使用默认值

## Q&A

- Q: 初始化是在 Service Worker 启动时执行，还是首次 AI 请求且凭证为空时执行？ A: 首次 AI 请求且凭证为空时
- Q: auth_token 是否取 localStorage.userToken.value，并原样使用还是补 Bearer ？ A: 补 Bearer
- Q: Cookies 是否用 chrome.cookies.getAll() 获取全部（包括 HttpOnly），再拼成 name=value; ...？ A: 是的
- Q: 配置是否写入 ai_assistant_config 的 deepseekAuthToken、deepseekCookies 等字段？ A: 可以，但是读取配置的位置时后台脚本吧，应该写在 chrome.storge.local
- Q: 获取成功后是否自动关闭 chat.deepseek.com 标签页？等待登录是否需要超时？ A: 是的，获取成功后自动关闭；需要超时，可以设置为5min
