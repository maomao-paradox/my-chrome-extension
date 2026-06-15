import type { Logger } from '@/utils/logger';

// 确保文件被视为模块
export { };
// 全局类型声明
declare global {
  var maLogger: Logger;

  interface Window {
    maLogger: Logger;
  }

  interface AppContext extends Window {
    gmod: (...args: any[]) => any;
    message: {
      success: (message: string, options?: any) => void;
      error: (message: string, options?: any) => void;
      warning: (message: string, options?: any) => void;
      info: (message: string, options?: any) => void;
    };
    requester?: Requester;
    globalConfig?: GlobalConfig;
  }

  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production' | 'test';
      readonly API_BASE_URL: string;
    }
  }
}

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
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  import React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

// Vue组件类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.svg?url' {
  const src: string
  export default src
}

declare module '*.svg?component' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
