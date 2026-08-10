// CSS模块类型声明
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// 普通CSS文件类型声明
declare module "*.css" {
  const content: string;
  export default content;
}

// 带?raw查询参数的CSS文件类型声明
declare module "*.css?raw" {
  const content: string;
  export default content;
}

declare module "*.scss" {
  const content: string;
  export default content;
}

declare module "*.scss?raw" {
  const content: string;
  export default content;
}

// 图片资源类型声明
declare module "*.svg?react" {
  import { FC, SVGProps } from "react";
  const SVGComponent: FC<SVGProps<SVGSVGElement>>;
  export default SVGComponent;
}

declare module "*.svg?url" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

// 处理图片资源
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}
