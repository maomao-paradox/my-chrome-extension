---
name: utils
description: Utils module
---

- 所有的文件都使用具名导出（使用 export const 或者 export function，不要使用 export default），方便index统一导出
- 避免直接在utils模块中访问window 或者 document，会在不同运行环境中出错