/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/components/index.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export interface Rule {
  id: number;
  urlPattern: string;
  responseData: string;
  responseType: string;
  enabled: boolean;
}

export interface Tool {
  id: string;
  label: string;
  icon?: any;
  image?: string;
  details?: string;
  color?: string;
  children?: Tool[];
  onClick?: () => void;
}

export interface TextTool extends Tool {
  handler: (text?: string) => void;
}

export interface ConfigItem {
  id?: string;
  value: boolean;
  desc: string;
  type?: "dialog" | "sidepanel";
  [key: string]: any;
}

// 1. 定义插件类型枚举
type PluginType = "sidebar" | "toolbar" | "effect" | "menu" | "floating";

// 2. 基础配置
interface BasePluginConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: PluginType;
  options?: any;
}

// 3. 各插件特有配置
interface ToolbarPluginConfig extends BasePluginConfig {
  type: "toolbar";
  options: {
    brandColor: string;
  };
}

// 4. 联合类型
export type PluginConfig = ToolbarPluginConfig | BasePluginConfig; // 默认配置

// 5. 配置映射
export type PluginConfigMap = {
  [key: string]: PluginConfig;
};

export interface BookmarkComment {
  id: string;
  comment: string;
  timestamp: number;
}

export interface Bookmark {
  id: string;
  text: string;
  url: string;
  scrollPosition: {
    x: number;
    y: number;
  };
  timestamp: number;
  title?: string;
  comments?: BookmarkComment[];
}
