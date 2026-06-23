# findAndReplaceDOMText.js 使用手册

## 一、概述

`findAndReplaceDOMText.js` 是一个强大的 DOM 文本查找与替换库，能够在不破坏页面结构和事件绑定的前提下，精准地查找并替换网页中的文本内容。

### 核心特性

- ✅ **跨节点匹配**：支持跨多个 DOM 节点的文本匹配
- ✅ **精确位置控制**：通过字符偏移量精确定位匹配位置
- ✅ **上下文分段**：智能处理块级元素边界，避免跨元素匹配
- ✅ **完整撤销机制**：支持恢复原始 DOM 结构
- ✅ **元素过滤**：可排除特定元素（如 `<script>`、`<style>`）
- ✅ **UMD 模块化**：兼容浏览器全局、CommonJS、AMD 等多种环境

---

## 二、快速开始

### 2.1 引入方式

**方式一：浏览器全局引入**

```html
<script src="js/findAndReplaceDOMText.js"></script>
<script>
  const instance = findAndReplaceDOMText(document.body, {
    find: /需要替换的文本/g,
    replace: '新文本'
  });
</script>
```

**方式二：CommonJS 模块**

```javascript
const findAndReplaceDOMText = require('./findAndReplaceDOMText');

const instance = findAndReplaceDOMText(document.body, {
  find: /pattern/g,
  replace: 'replacement'
});
```

**方式三：ES6 模块**

```javascript
import findAndReplaceDOMText from './findAndReplaceDOMText';

const instance = findAndReplaceDOMText(document.body, {
  find: /pattern/g,
  replace: 'replacement'
});
```

---

## 三、API 参考

### 3.1 主函数

```javascript
findAndReplaceDOMText(node, options) → Finder实例
```

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `node` | Node | 是 | 要搜索的目标 DOM 节点 |
| `options` | Object | 是 | 配置选项对象 |

### 3.2 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `find` | RegExp \| String | - | 要查找的模式（正则表达式或字符串） |
| `replace` | String \| Function | `'$&'` | 替换内容或函数 |
| `wrap` | String \| Element | - | 包装元素名（如 `'span'`）或节点 |
| `wrapClass` | String | - | 包装元素的 CSS 类名 |
| `filterElements` | Function | - | 元素过滤函数，返回 `true` 处理，`false` 跳过 |
| `forceContext` | Boolean \| Function | - | 强制上下文分段，避免跨元素匹配 |
| `portionMode` | String | `'retain'` | 分段模式：`'retain'` 保留全部，`'first'` 仅保留首段 |
| `prepMatch` | Function | - | 自定义匹配预处理函数 |
| `preset` | String | - | 预设配置（如 `'prose'`） |

### 3.3 替换字符串特殊符号

| 符号 | 含义 | 示例 |
|------|------|------|
| `$&` | 匹配的完整文本 | `'$&'` → 保持原匹配 |
| `$1-$9` | 捕获组内容 | `'$1'` → 第一个捕获组 |
| `` ` `` | 匹配前的文本 | - |
| `'` | 匹配后的文本 | - |

### 3.4 返回值（Finder 实例）

| 属性/方法 | 说明 |
|-----------|------|
| `matches` | 匹配结果数组 |
| `reverts` | 撤销操作数组 |
| `revert()` | 执行撤销，恢复原始 DOM |

---

## 四、使用示例

### 4.1 基础替换

```javascript
// 将所有 "旧文本" 替换为 "新文本"
const instance = findAndReplaceDOMText(document.body, {
  find: /旧文本/g,
  replace: '新文本'
});

// 如需撤销
// instance.revert();
```

### 4.2 使用包装元素

```javascript
// 将匹配文本用 <span class="highlight"> 包裹
const instance = findAndReplaceDOMText(document.body, {
  find: /关键词/g,
  wrap: 'span',
  wrapClass: 'highlight'
});
```

### 4.3 自定义替换函数

```javascript
// 根据匹配内容动态生成替换文本
const instance = findAndReplaceDOMText(document.body, {
  find: /(\d+)元/g,
  replace: function(portion, match) {
    const amount = parseInt(match[1]);
    return (amount * 0.8).toFixed(2) + '元'; // 打8折
  }
});
```

### 4.4 元素过滤

```javascript
// 排除特定元素
const instance = findAndReplaceDOMText(document.body, {
  find: /敏感词/g,
  replace: '***',
  filterElements: function(el) {
    // 不处理 script、style、textarea 元素
    const exclude = ['script', 'style', 'textarea'];
    return !exclude.includes(el.nodeName.toLowerCase());
  }
});
```

### 4.5 使用预设配置

```javascript
// 使用 prose 预设，自动处理块级元素边界
const instance = findAndReplaceDOMText(document.body, {
  find: /需要替换的文本/g,
  replace: '替换后的文本',
  preset: 'prose'  // 等价于设置 forceContext 和 filterElements
});
```

### 4.6 跨节点匹配

```javascript
// 匹配可能跨越多个 DOM 节点的文本
const instance = findAndReplaceDOMText(document.body, {
  find: /跨越多个元素的文本/g,
  replace: '已替换',
  forceContext: findAndReplaceDOMText.NON_INLINE_PROSE
});
```

---

## 五、核心工作原理

### 5.1 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│  阶段1: 文本聚合 (getAggregateText)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  遍历 DOM 树，将所有文本节点聚合成结构化数组       │    │
│  │  同时记录元素边界信息                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  阶段2: 正则匹配 (search)                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  在聚合文本上执行正则匹配                          │    │
│  │  记录每个匹配的位置信息 (startIndex, endIndex)     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  阶段3: 定位替换 (processMatches)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  双指针遍历 DOM，定位匹配位置                      │    │
│  │  处理跨节点匹配的情况                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  阶段4: 执行替换 (replaceMatch)                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  创建新节点，插入 DOM，保存撤销操作                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 文本聚合机制

库会将 DOM 树转换为嵌套数组结构：

```javascript
// 原始 HTML
<div>Hello <b>World</b>!</div>

// 聚合结果
['Hello ', ['World'], '!']
```

这种结构既能保留完整文本信息，又能识别元素边界。

### 5.3 位置计算

每个匹配会记录精确的位置信息：

```javascript
{
  startIndex: 0,   // 匹配在完整文本中的起始位置
  endIndex: 10,    // 匹配在完整文本中的结束位置
  index: 0,        // 匹配序号
  0: '匹配文本',    // 匹配的完整内容
  1: '捕获组1',    // 第一个捕获组（如有）
  // ...
}
```

---

## 六、预设配置

### 6.1 prose 预设

```javascript
exposed.PRESETS = {
  prose: {
    forceContext: exposed.NON_INLINE_PROSE,
    filterElements: function(el) {
      return !hasOwn.call(exposed.NON_PROSE_ELEMENTS, el.nodeName.toLowerCase());
    }
  }
};
```

**NON_PROSE_ELEMENTS**（不处理的元素）：
- `script`, `style`, `img`, `video`, `audio`, `canvas`, `svg`
- `input`, `textarea`, `select`, `option`, `button`
- `br`, `hr`

**NON_CONTIGUOUS_PROSE_ELEMENTS**（边界元素）：
- 块级元素：`div`, `p`, `h1-h6`, `ul`, `ol`, `li`, `table` 等
- 媒体元素：`img`, `video`, `audio` 等
- 表单元素：`input`, `textarea`, `button` 等

---

## 七、撤销机制

### 7.1 撤销操作

```javascript
const instance = findAndReplaceDOMText(document.body, {
  find: /文本/g,
  replace: '替换'
});

// 执行替换后，调用 revert() 恢复原始状态
instance.revert();
```

### 7.2 撤销原理

每次替换操作会将逆操作保存到 `reverts` 数组中：

```javascript
this.reverts.push(function() {
  // 移除新增的前后文本节点
  if (precedingTextNode) precedingTextNode.parentNode.removeChild(precedingTextNode);
  if (followingTextNode) followingTextNode.parentNode.removeChild(followingTextNode);
  // 恢复原节点
  newNode.parentNode.replaceChild(originalNode, newNode);
});
```

撤销时**逆序**执行所有保存的操作，确保节点引用有效。

---

## 八、最佳实践

### 8.1 性能优化

1. **缩小搜索范围**：尽量指定具体的容器节点而非 `document.body`
   ```javascript
   // 推荐
   findAndReplaceDOMText(document.getElementById('content'), options);
   
   // 不推荐（搜索范围太大）
   findAndReplaceDOMText(document.body, options);
   ```

2. **使用全局正则**：确保正则表达式带有 `g` 标志
   ```javascript
   findAndReplaceDOMText(node, {
     find: /pattern/g,  // ✅ 全局匹配
     replace: 'replacement'
   });
   ```

### 8.2 避免常见问题

1. **零长度匹配**：库不支持零长度匹配，会抛出错误
   ```javascript
   // ❌ 错误：会抛出异常
   findAndReplaceDOMText(node, { find: /^/g });
   ```

2. **特殊字符转义**：字符串模式会自动转义正则特殊字符
   ```javascript
   // 字符串会自动转义
   findAndReplaceDOMText(node, { find: '*.js', replace: 'script' });
   // 等价于 /\*\.js/g
   ```

3. **事件绑定保留**：使用 DOM 操作而非 `innerHTML`，保留事件绑定
   ```javascript
   // ✅ 正确：保留事件
   findAndReplaceDOMText(node, { find: /text/g, replace: 'new' });
   
   // ❌ 错误：丢失事件绑定
   node.innerHTML = node.innerHTML.replace(/text/g, 'new');
   ```

### 8.3 复杂场景处理

**场景：替换后保持样式**

```javascript
// 使用包装元素保持样式
findAndReplaceDOMText(document.body, {
  find: /重要内容/g,
  wrap: 'mark',  // 使用 <mark> 标签高亮
  wrapClass: 'custom-highlight'
});
```

**场景：动态生成替换内容**

```javascript
// 根据匹配上下文动态生成内容
findAndReplaceDOMText(document.body, {
  find: /(@\w+)/g,
  replace: function(portion, match) {
    // 创建带链接的用户名
    var link = document.createElement('a');
    link.href = '/user/' + match[1].substring(1);
    link.textContent = match[1];
    return link;  // 可返回 DOM 节点
  }
});
```

---

## 九、兼容性

| 环境 | 支持 |
|------|------|
| Chrome | ✅ |
| Firefox | ✅ |
| Safari | ✅ |
| Edge | ✅ |
| IE 11 | ✅ |
| Node.js | ✅（需 jsdom 等 DOM 环境） |

---

## 十、在 Chrome 插件中的应用

该库最初是为 Chrome 插件设计的，在 `content-script.js` 中的典型用法：

```javascript
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  const cmd = request.cmd;
  const replaceData = request.replaceData;
  const regex = RegExp(replaceData, 'gi');
  
  if (cmd === 'replace_cmd') {
    const targetData = request.targetData;
    const instance = findAndReplaceDOMText(document.body, {
      find: regex,
      replace: function(portion) {
        return targetData;
      },
      forceContext: findAndReplaceDOMText.NON_INLINE_PROSE
    });
    sendResponse({ result: true, length: instance.reverts.length });
  }
});
```

---

## 附录：内置常量

```javascript
// 分段模式
findAndReplaceDOMText.PORTION_MODE_RETAIN  // 'retain'
findAndReplaceDOMText.PORTION_MODE_FIRST   // 'first'

// 元素分类
findAndReplaceDOMText.NON_PROSE_ELEMENTS           // 不处理的元素
findAndReplaceDOMText.NON_CONTIGUOUS_PROSE_ELEMENTS // 边界元素
findAndReplaceDOMText.NON_INLINE_PROSE              // 边界检测函数

// 预设配置
findAndReplaceDOMText.PRESETS  // { prose: {...} }

// Finder 类（可自定义扩展）
findAndReplaceDOMText.Finder
```

---

## 更新日志

### v1.0.0
- 初始版本
- 支持基本的查找替换功能
- 支持跨节点匹配
- 支持撤销机制
- 支持预设配置
