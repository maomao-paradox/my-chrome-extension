// CSS模块类型声明
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// 普通CSS文件类型声明
declare module '*.css' {
  const content: string;
  export default content;
}

// 带?raw查询参数的CSS文件类型声明
declare module '*.css?raw' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

declare module '*.scss?raw' {
  const content: string;
  export default content;
}

// 图片资源类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // ✅ 修复：使用具体类型替代 {} 和 any
  const component: DefineComponent<object, object, unknown>;
  // 或者更精确：
  // const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

// 处理所有带 ?component 的导入
declare module '*?component' {
  import type { DefineComponent } from 'vue';
  // ✅ 修复
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// 特别处理 SVG
declare module '*.svg' {
  import type { DefineComponent } from 'vue';
  // ✅ 修复
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module '*.svg?component' {
  import type { DefineComponent } from 'vue';
  // ✅ 修复
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// 处理图片资源
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}
