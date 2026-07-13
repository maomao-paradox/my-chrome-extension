// 应用目录

## textSelectionToolbar

- 文本翻译使用当前页面 `hostname` 生成独立的 AI session role，例如 `translator_example.com`。
- 不同域名的翻译上下文互相隔离，避免跨站点翻译历史污染当前页面的解释结果。
- 启用后会在可见、可编辑且带 `placeholder` 的 `textarea` 右上角显示 AI 小圆点；点击小圆点后调用 textarea AI 填入能力，并在生成、成功或失败时更新小圆点状态。
- 可通过 `textSelectionToolbar.options.textareaAI = false` 关闭 textarea AI 小圆点，保留原文本选择工具栏能力。

## popup

- 设置页的鼠标拖尾支持独立开关和预设选择。
- 内置拖尾预设包括 `星星`、`雪花`、`音符`，配置会同步到当前内容页并写入本地存储。
