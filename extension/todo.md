## 需求描述

AI聊天发送表情包

聊天组件路径：extension/src/modules/sidebar/components/AIConversation.tsx

### 接口
获取数据列表
    - https://memecub.com/zh/search?q={{描述}}（描述：用户输入的描述，例如“生气”“大肥鱼吃米饭”等）
    - 响应参数：html文档（你需要从中正则表达式提取 https://gpic.code-nav.cn/memecub/public/{{图片id}}.{{gif|webp}} 这样的图片链接）

### 交互
制作为一个MCP工具，并显示的提供给AI；
收到工具调用指令后，后台脚本调用接口获取一张随机的表情包，返回给AI，最终由AI展示在聊天框中；
表情包本身不计入记忆，但是会将用户输入的描述和表情包的链接存储起来，后续用户可以基于之前存储的描述也展示在聊天框中。
