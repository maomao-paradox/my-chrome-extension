---
name: dom-api
description: DOM API module
---

- 所有的文件都使用具名导出（使用 export const 或者 export function，不要使用 export default），方便index统一导出
- 所有访问window 或者 document 的操作都封装在当前模块下
