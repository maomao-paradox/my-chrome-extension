/**
 * @description XHR 补丁管理类型定义
 */

/** 子规则指令 */
export interface RuleInstruction {
  type: string;
  params?: {
    path?: string;
    value?: any;
    search?: string;
    statusCode?: number;
    [key: string]: any;
  };
}

/** XHR 规则 */
export interface XhrRule {
  api?: string;
  openRules?: RuleInstruction[];
  sendRules?: RuleInstruction[];
  responseRules?: RuleInstruction[];
}

/** XHR 规则数组 */
export type XhrRulesArray = XhrRule[];

/** 处理器类型 */
export type HandlerType = 'open' | 'send' | 'response';

/** 规则编辑模式 */
export type RuleEditMode = 'add' | 'edit';

/** 处理器类型标题映射 */
export const HANDLER_TYPE_TITLES: Record<HandlerType, string> = {
  open: 'Open处理器 (修改请求参数)',
  send: 'Send处理器 (修改请求体)',
  response: '响应拦截器 (修改响应数据)',
};

/** 子规则类型选项 */
export const SUB_RULE_TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '替换URL', value: 'replaceUrl' },
  { label: '设置参数', value: 'setParam' },
  { label: '删除参数', value: 'deleteParam' },
  { label: '设置字段', value: 'setField' },
  { label: '删除字段', value: 'deleteField' },
  { label: '追加数组', value: 'appendArray' },
  { label: '设置状态码', value: 'setStatus' },
];
