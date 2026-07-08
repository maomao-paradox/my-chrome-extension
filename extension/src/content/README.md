# 内容脚本开发规范

## 概述
内容脚本（Content Script）是 Chrome 扩展的重要组成部分，用于在网页上下文中执行 JavaScript 代码，实现对网页的操作和增强。

## 已有脚本

### content-textarea-ai

`content-textarea-ai.ts` 会扫描页面上的 `textarea[placeholder]`，并根据 `placeholder`、关联 label、页面标题和 URL 调用扩展内置 AI 生成可直接填入的正文。

- 仅处理可见的、非 `disabled`、非 `readonly` textarea。
- 页面初次扫描和 textarea 获得焦点时只会在输入框右下角显示小圆点，不会自动填充。
- 点击小圆点后才会请求 AI 并填入生成内容，用户可以自行决定是否触发填入。
- 如果 textarea 已有内容，点击小圆点会先清空当前内容，再重新填入 AI 生成内容；如果生成失败且用户期间没有输入，会恢复原内容。
- 如果用户在 AI 返回前已经输入内容，脚本会跳过写入，不覆盖用户输入。
- 填入前会合并流式返回中的重叠内容，并去掉明显重复的段落或行。
- 手动填入会派发 `input` 和 `change` 事件，兼容 Vue、React 等受控表单。
- 默认域名配置为 `*:*`，可在内容脚本域名配置中使用 `contentTextareaAiDomains` 禁用或限定域名。

## 文件结构
每个内容脚本应该遵循以下文件结构：

```
src/content/
├── content-{domain}.ts    # 特定域名的内容脚本
├── index.ts                # 内容脚本入口文件
└── README.md              # 开发规范文档
```

## 开发规范

### 1. 文件命名
- 文件名格式：`content-{domain}.ts`，其中 `{domain}` 是目标网站的域名（如 `content-zentao.ts`、`content-lanhuapp.ts`）
- 文件名应该使用小写字母，单词之间用连字符 `-` 分隔

### 2. 代码结构
每个内容脚本应该包含以下部分：

#### 2.1 文件头部注释
```typescript
/**
 * @author 作者名称
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-{domain}.ts
 * @date YYYY-MM-DDTHH:MM:SS.sssZ
 */
```

#### 2.2 导入语句
```typescript
import { addElementToDom, injectScriptToActivateTab, waitForSelector } from '@/utils/element-control'
import messenger from "@/message"
import { ExtMessage, Tool, TextTool } from "@/types"
```

#### 2.3 主函数
```typescript
export default (context: AppContext, config = {}) => {
    // 实现具体功能
    return {};
};
```

#### 2.4 辅助函数
根据需要实现具体功能的辅助函数，如：
- DOM 操作函数
- 数据处理函数
- 事件处理函数

#### 2.5 消息处理器
```typescript
const messageHandlers = {
    default: (...args: any) => {
        console.error("未定义的消息类型", args);
    },
    // 其他消息处理方法
};
```

#### 2.6 消息监听器初始化
```typescript
const initMessageListener = () => {
    messenger.ext.listen((message: ExtMessage, sender, sendResponse: Function) => {
        console.log("Received message:", message, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
        const { type, payload: data, target } = message;
        if (target !== 'content-{domain}') return true;
        console.info(`Received request: ${type}`, data, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
        if (!type) return false;
        const steps = [type];
        let step = steps.shift();

        while (step) {
            const handler = messageHandlers[step as keyof typeof messageHandlers];
            if (handler) {
                handler(data);
            }
            step = steps.shift();
        }
    });
};
```

#### 2.7 页面加载事件
```typescript
window.onload = () => {
    console.log("{domain}页面加载完成,开始监听消息");
    // 实现页面加载后的操作
};
```

### 3. 最佳实践

#### 3.1 DOM 操作
- 使用 `waitForSelector` 来等待元素加载
- 使用 `addElementToDom` 来添加元素
- 使用 `injectScriptToActivateTab` 来注入脚本

#### 3.2 消息通信
- 使用 `messenger.ext.send` 发送消息
- 使用 `messenger.ext.listen` 接收消息
- 确保消息目标（target）正确设置为 `content-{domain}`

#### 3.3 错误处理
- 对异步操作使用 try-catch
- 合理处理可能的错误情况
- 使用 console.error 记录错误信息

#### 3.4 性能优化
- 避免频繁的 DOM 操作
- 使用事件委托减少事件监听器数量
- 合理使用 setTimeout 和 setInterval

### 4. 注册内容脚本
要使内容脚本生效，需要在 `src/content/index.ts` 中注册：

```typescript
const contentModules: Map<string, ModuleOption> = new Map([
    // 其他内容脚本
    ["{domain}", {
        domainKey: 'content{Domain}Domains',
        flag: '__CONTENT_SCRIPT_{DOMAIN}',
        path: getContentScriptUrl('{domain}')
    }]
]);
```

### 5. 域名配置
在 `src/pages/options/views/ContentScriptDomainConfig.vue` 中添加域名配置：

```typescript
const scripts: ScriptConfig[] = [
    // 其他脚本配置
    { name: 'content-{domain}', storageKey: 'content{Domain}Domains' }
];
```

## 模板文件

下面是一个内容脚本模板，供开发者参考：

```typescript
/**
 * @author 作者名称
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/content/content-{domain}.ts
 * @date YYYY-MM-DDTHH:MM:SS.sssZ
 */

import { addElementToDom, injectScriptToActivateTab, waitForSelector } from '@/utils/element-control'
import messenger from "@/message"
import { ExtMessage, Tool, TextTool } from "@/types"

export default (context: AppContext, config = {}) => {

    // 辅助函数
    function helperFunction() {
        // 实现辅助功能
    }

    // 消息处理器
    const messageHandlers = {
        default: (...args: any) => {
            console.error("未定义的消息类型", args);
        },
        // 可以添加更多消息处理方法
    };

    // 初始化消息监听器
    const initMessageListener = () => {
        messenger.ext.listen((message: ExtMessage, sender, sendResponse: Function) => {
            console.log("Received message:", message, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
            const { type, payload: data, target } = message;
            if (target !== 'content-{domain}') return true;
            console.info(`Received request: ${type}`, data, "from", sender.tab ? `tab ${sender.tab.id}` : "background");
            if (!type) return false;
            const steps = [type];
            let step = steps.shift();

            while (step) {
                const handler = messageHandlers[step as keyof typeof messageHandlers];
                if (handler) {
                    handler(data);
                }
                step = steps.shift();
            }
        });
    };

    // 事件监听器
    initMessageListener();
    
    // 页面加载完成后执行
    window.onload = () => {
        console.log("{domain}页面加载完成,开始监听消息");
        
        // 在这里添加页面特定的功能
        // 例如：添加自定义按钮、修改页面元素等
    };

    return {};
};
```

## 示例

### 示例1：添加自定义按钮

```typescript
window.onload = () => {
    waitForSelector({
        selector: "#some-element",
        callback: addElementToDom({
            tag: "button",
            attrs: { id: "custom-button", innerText: "自定义按钮" },
            style: { "margin": "10px" },
            eventlistener: {
                "click": () => {
                    console.log("自定义按钮被点击");
                    // 实现按钮点击后的功能
                }
            }
        })
    });
};
```

### 示例2：修改页面元素

```typescript
window.onload = () => {
    waitForSelector({
        selector: ".some-class",
        callback: (el: HTMLElement) => {
            el.style.backgroundColor = "#f0f0f0";
            el.textContent = "修改后的内容";
        }
    });
};
```

### 示例3：注入脚本

```typescript
window.onload = () => {
    waitForSelector({
        selector: "#app",
        callback: (el: HTMLElement) => {
            injectScriptToActivateTab("file", "js/web-components/custom-component", el);
        }
    });
};
```

## 注意事项

1. **权限控制**：内容脚本只能访问其声明的权限范围内的资源
2. **安全性**：避免在内容脚本中执行未经验证的代码
3. **性能**：注意内容脚本的执行性能，避免影响页面加载速度
4. **兼容性**：考虑不同浏览器和页面版本的兼容性
5. **调试**：使用 `console.log` 和 Chrome 开发者工具进行调试

## 总结

内容脚本是 Chrome 扩展中实现网页增强功能的重要手段。通过遵循本规范，开发者可以创建结构清晰、功能强大的内容脚本，为用户提供更好的浏览体验。
