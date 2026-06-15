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
  id: string
  label: string
  icon?: any
  image?: string
  details?: string
  color?: string
  children?: Tool[]
  onClick?: () => void
}

export interface TextTool extends Tool {
  handler: (text?: string) => void
}

export interface ConfigItem {
  id?: string;
  value: boolean;
  desc: string;
  type?: 'dialog' | 'sidepanel';
  [key: string]: any;
}

export interface PluginConfigs {
  [key: string]: ConfigItem
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
}