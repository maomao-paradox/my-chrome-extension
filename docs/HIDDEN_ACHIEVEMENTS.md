# KIRA:NOVE 隐藏成就设计

## 1. 目标与边界

隐藏成就用于奖励用户探索插件已有能力，增加一点发现感，但不应把正常工作流程变成“刷任务”。第一版建议遵循以下原则：

- 成就条件尽量来自已有操作，不要求用户额外填写资料或授权新的权限。
- 触发逻辑只记录事件类型、次数和必要的匿名上下文，不记录网页正文、AI 提示词、Cookie、密码或完整 URL。
- 成就奖励以视觉反馈和轻量个性化为主，不影响业务功能，不给自动化、脚本执行或网络拦截增加隐性权限。
- 可能造成误操作的功能只统计用户明确确认后的成功结果；自动化成就只接受 `dry-run` 或用户确认过的 `real-run`。
- 成就一旦解锁默认永久保留；版本升级不重复弹出，条件变化时通过版本号迁移。

## 2. 成就分层

| 层级 | 数量建议 | 体验定位 | 解锁反馈 |
| --- | ---: | --- | --- |
| 发现 | 5 | 第一次接触功能，几分钟内可完成 | 小型 toast + 图标亮起 |
| 探索 | 8 | 鼓励跨模块组合使用 | toast + 成就详情中的短彩蛋 |
| 精通 | 5 | 奖励稳定使用和多入口协作 | 详情页徽章、主题点缀 |
| 荒诞 | 2 | 低频、无业务价值的趣味彩蛋 | 特殊音效或一次性动画，可关闭 |

“隐藏”只隐藏条件，不隐藏成就名称。用户打开成就面板后看到名称、稀有度和模糊提示；解锁前不展示精确数值，避免变成清单式打卡。

## 3. 首批成就清单

以下条件是建议版本，具体阈值可以在埋点完成后根据实际使用频率调整。`event` 表示统一事件总线中的事件名，避免组件之间直接互相依赖。

| ID | 名称 | 稀有度 | 隐藏提示 | 解锁条件 | 反馈/奖励 | 主要事件 |
| --- | --- | --- | --- | --- | --- | --- |
| `first-contact` | 初次接触 | 发现 | “先找到一个能跟着你走的东西。” | 首次打开并拖动浮动球超过 80px | 解锁基础徽章 | `floatingball.open`, `floatingball.drag` |
| `spectrum-collector` | 频谱收藏家 | 探索 | “四种颜色，缺一不可。” | 在同一安装周期内预览四种光谱效果 | 成就卡片显示四枚色片 | `spectrum.preview` |
| `theme-hopper` | 换肤不眨眼 | 探索 | “今天的舰桥是哪种材质？” | 使用过四种 Popup 主题中的至少三种 | 解锁主题切换快捷入口 | `theme.changed` |
| `text-alchemist` | 文本炼金术 | 探索 | “复制只是开始。” | 对选中文本完成复制、搜索、翻译、书签、AI 分析中的四种 | 工具栏成就图标短暂闪烁 | `selection.action.completed` |
| `bookmark-archaeologist` | 书签考古学家 | 探索 | “让未来的你找得到今天的线索。” | 创建 10 条片段书签，且来自至少 3 个不同站点 | 书签页显示小型考古印章 | `bookmark.created` |
| `image-quartermaster` | 图片军需官 | 发现 | “把页面上的图像整齐带走。” | 成功完成一次包含 5 张以上图片的打包下载 | 解锁一次下载完成彩带动画 | `image.download.batch.completed` |
| `dom-cartographer` | DOM 制图师 | 探索 | “页面还有一层地图。” | 使用 DOM 结构提取器两次，并成功复制或导出结果一次 | 显示地图网格徽章 | `dom.extract.completed`, `dom.extract.exported` |
| `ai-echo` | AI 回声室 | 精通 | “问一个问题，再追问五次。” | 同一会话完成 6 轮有效对话；不统计失败请求 | 会话页显示回声环 | `ai.message.completed` |
| `workflow-director` | 流程导演 | 精通 | “把一次操作排成一条可重播的线。” | 录制至少 5 个步骤，保存任务，并成功完成一次 dry-run | 自动化页显示导演场记板 | `automation.recording.saved`, `automation.run.completed` |
| `cross-deck` | 跨甲板协同 | 精通 | “同一艘船，不止一个入口。” | 在 24 小时内使用 Popup、Side Panel、Options、DevTools 中的三个入口 | 解锁跨入口导航提示 | `surface.opened` |
| `settings-time-machine` | 设置时光机 | 探索 | “先留下备份，再大胆试验。” | 完成一次设置导出，再成功导入同一份有效文件 | 显示回滚箭头徽章 | `settings.exported`, `settings.imported` |
| `quiet-operator` | 静默操作员 | 精通 | “最好的动效，是知道何时退场。” | 开启低动效偏好后，连续使用三个支持降级的界面 | 成就反馈强制使用低动效 | `accessibility.reduced-motion`, `surface.action.completed` |
| `hidden-door` | 暗门发现者 | 荒诞 | “有些路径只在你不找它时出现。” | 在隐藏路径扫描器中发现一个有效结果，并打开详情 | 解锁一次随机暗门提示 | `hidden-path.result.opened` |
| `midnight-watch` | 午夜值班 | 荒诞 | “舰桥在夜里也亮着。” | 本地时间 00:00–04:00 完成一次非破坏性工具操作 | 只显示一次低亮度夜班徽章 | `safe.action.completed` + 本地时间判断 |
| `signal-hunter` | 信号猎手 | 发现 | “先观察，再改变。” | 查看一次 XHR 补丁状态并导出规则，不要求启用拦截 | 成就详情显示信号波形 | `xhr.status.viewed`, `xhr.rules.exported` |

### 不建议放入首批的条件

- 连续点击、持续刷新、故意制造页面异常：容易诱导用户做无意义或有风险的操作。
- 上传二维码、填写密码、读取 Cookie、执行任意网络脚本：隐私风险高，也不适合作为奖励条件。
- 依赖固定网站 DOM、特定域名或具体 AI 回复文本：页面改版后会导致成就失效。
- 摄像头、麦克风、通知等额外权限：除非对应功能本身已获得用户明确授权。

## 4. 触发与数据模型

建议增加一个轻量的 `AchievementService`，由各入口发布标准事件，服务统一判断条件并持久化状态。

```typescript
type AchievementEvent = {
  name: string;
  at: number;
  source: 'popup' | 'content' | 'floatingball' | 'sidepanel' | 'options' | 'devtools';
  meta?: Record<string, string | number | boolean>;
};

type AchievementState = {
  version: 1;
  unlocked: Record<string, { unlockedAt: number }>;
  counters: Record<string, number>;
  sets: Record<string, string[]>;
  recent: Array<{ name: string; at: number }>;
};
```

建议存储键：`kria-nove:achievements:v1`，使用现有 `storage.ext.local` 封装。`meta` 只允许白名单字段，例如 `effectId`、`actionId`、`surface`、`siteBucket`；站点只存不可逆的短哈希或一级分类，不保存完整域名。事件处理要具备以下特性：

1. 先做事件白名单校验，再更新计数器，避免任意脚本伪造内部事件。
2. 通过 `eventId` 或短时间窗口去重，防止 React/Vue 重渲染造成重复计数。
3. 按成就 ID 做一次性解锁；解锁成功后再发送 `achievement.unlocked`，避免重复 toast。
4. `chrome.storage.local` 不可用时允许降级到当前扩展页面的 `localStorage`，但不应因为存储失败阻断原功能。
5. 跨上下文只发送“事件名称 + 白名单 meta”，不发送页面内容和会话内容。

## 5. 用户体验

### 解锁反馈

- 默认显示 2.5 秒轻量通知：成就名称、稀有度和一句彩蛋文案。
- 低动效偏好下改为静态徽章，不播放粒子、音效或连续动画。
- 同一会话最多弹出 3 次成就通知，剩余成就进入待查看队列，避免打断工作。
- 通知不显示触发数据，例如不展示完整 URL、AI 文本或自动化步骤内容。

### 成就面板

建议放在 Options 的“舰桥总览”或 Popup 的次级入口：

- 顶部显示 `已解锁 / 总数` 和最近解锁时间。
- 未解锁项显示名称、稀有度、模糊提示和进度范围（如“已收集数：少量 / 过半 / 就差一点”），不显示完整条件。
- 已解锁项显示触发日期、使用过的模块和奖励说明。
- 提供“关闭成就通知”和“重置本机成就”两个独立设置；重置必须二次确认。

## 6. 分阶段实现

### MVP

先实现 `first-contact`、`spectrum-collector`、`text-alchemist`、`bookmark-archaeologist`、`image-quartermaster` 五项，覆盖浮动球、工具抽屉、文本工具和书签/下载流程。MVP 不新增权限，不依赖后端，不需要改动现有业务数据结构。

建议代码拆分：

```text
src/services/achievements/
├── types.ts       # 事件、定义、状态类型
├── catalog.ts     # 成就定义与文案
├── service.ts     # 事件校验、计数、解锁、持久化
├── events.ts      # 各模块可调用的发布函数
└── index.ts
```

第一轮只接入明确的成功回调，不要在组件 mounted、按钮点击开始时记账；例如图片成就应在 ZIP 下载完成后触发，自动化成就应在 run 返回成功后触发。

### 第二阶段

接入 AI、自动化、DOM 提取、设置导入导出和跨入口检测；增加成就面板、通知队列、低动效适配和单元测试。测试重点包括：重复事件去重、并发解锁、存储失败降级、版本迁移和跨页面同步。

### 第三阶段

根据匿名聚合数据调整阈值，增加节日或版本限定成就。限定成就必须有过期策略和离线可用文案，不能让用户因为服务端不可用而丢失已完成状态。

## 7. 验收标准

- 成就模块不改变任何已有工具的成功/失败结果。
- 关闭通知后仍正常记录并可在面板查看解锁状态。
- 同一操作重复触发不会多次增加计数或重复弹窗。
- 清除扩展缓存、升级版本和页面刷新不会意外清空成就；用户主动重置除外。
- 单元测试覆盖至少：首个解锁、阈值边界、集合去重、时间窗口、事件去重、存储异常。
- 成就数据导出时默认不包含网页正文、AI 会话、Cookie、密码和完整 URL。

## 8. 推荐落地顺序

1. 先实现事件类型和 `AchievementService`，用内存事件写测试。
2. 接入五个 MVP 成就，确认事件命名和存储迁移策略。
3. 加入统一通知和 Options 成就面板，再扩展第二阶段成就。
4. 收集一段时间的匿名计数后调整阈值，最后再加入荒诞彩蛋。

