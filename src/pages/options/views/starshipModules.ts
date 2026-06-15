export type StarshipPanelId =
  | 'main'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom'
  | 'bottom-right';

export type StarshipStatus = 'online' | 'warning' | 'standby';

export interface ModuleTelemetry {
  status: StarshipStatus;
  headline: string;
  detail: string;
  metric: string;
}

export interface OverviewNode {
  anchor: {
    x: number;
    y: number;
  };
  lineEnd: {
    x: number;
    y: number;
  };
  card: {
    x: number;
    y: number;
    align: 'left' | 'center' | 'right';
  };
}

export interface StarshipModuleMeta {
  id: StarshipPanelId;
  glyph: string;
  title: string;
  code: string;
  section: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  defaultTelemetry: ModuleTelemetry;
  overview?: OverviewNode;
}

export interface StarshipModuleState extends StarshipModuleMeta {
  telemetry: ModuleTelemetry;
}

export const STARSHIP_STATUS_TEXT: Record<StarshipStatus, string> = {
  online: '在线',
  warning: '警戒',
  standby: '待命',
};

export const STARSHIP_STATUS_TINT: Record<StarshipStatus, string> = {
  online: '#69b7ff',
  warning: '#ff6262',
  standby: '#7af7d0',
};

export const STARSHIP_MODULES: StarshipModuleMeta[] = [
  {
    id: 'main',
    glyph: 'CMD',
    title: '指挥中心',
    code: 'Bridge Core',
    section: 'Deck-00',
    description: '汇总全舰模块状态，并作为星舰终端的统一调度入口。',
    position: { x: 0, y: 0 },
    defaultTelemetry: {
      status: 'online',
      headline: '舰桥链路稳定',
      detail: '等待各舱段回传状态数据',
      metric: '07/07',
    },
  },
  {
    id: 'top',
    glyph: 'MON',
    title: '哨兵监控',
    code: 'Sentinel Watch',
    section: 'Deck-01',
    description: '异常监控、告警节流与白黑名单控制舱。',
    position: { x: 0, y: 1 },
    defaultTelemetry: {
      status: 'standby',
      headline: '异常监控待命',
      detail: '尚未加载 WebSocket 回传参数',
      metric: 'OFF',
    },
    overview: {
      anchor: { x: 500, y: 238 },
      lineEnd: { x: 500, y: 132 },
      card: { x: 500, y: 52, align: 'center' },
    },
  },
  {
    id: 'top-left',
    glyph: 'XHR',
    title: '拦截矩阵',
    code: 'Interceptor Bay',
    section: 'Deck-02',
    description: '管理 XHR 规则、域名白名单与测试链路。',
    position: { x: -1, y: 1 },
    defaultTelemetry: {
      status: 'standby',
      headline: '暂无拦截规则',
      detail: '可为接口响应建立定向篡改矩阵',
      metric: '00',
    },
    overview: {
      anchor: { x: 398, y: 286 },
      lineEnd: { x: 274, y: 186 },
      card: { x: 90, y: 116, align: 'left' },
    },
  },
  {
    id: 'top-right',
    glyph: 'VAR',
    title: '观测台',
    code: 'Telemetry Lab',
    section: 'Deck-03',
    description: '读取当前页面变量并执行定向修改的观测舱。',
    position: { x: 1, y: 1 },
    defaultTelemetry: {
      status: 'online',
      headline: '浏览器遥测正常',
      detail: '可直接连通当前活动标签页',
      metric: 'LIVE',
    },
    overview: {
      anchor: { x: 602, y: 286 },
      lineEnd: { x: 726, y: 186 },
      card: { x: 910, y: 116, align: 'right' },
    },
  },
  {
    id: 'left',
    glyph: 'CFG',
    title: '舰体设置',
    code: 'Hull Config',
    section: 'Deck-04',
    description: '基础设置、界面主题与配置导入导出。',
    position: { x: -1, y: 0 },
    defaultTelemetry: {
      status: 'online',
      headline: '扩展设置已加载',
      detail: '等待同步主题与调试模式状态',
      metric: 'AUTO',
    },
    overview: {
      anchor: { x: 334, y: 350 },
      lineEnd: { x: 188, y: 350 },
      card: { x: 40, y: 288, align: 'left' },
    },
  },
  {
    id: 'right',
    glyph: 'USR',
    title: '船员档案',
    code: 'Crew Registry',
    section: 'Deck-05',
    description: '维护用户身份、角色与启用状态。',
    position: { x: 1, y: 0 },
    defaultTelemetry: {
      status: 'standby',
      headline: '暂无船员档案',
      detail: '可在此维护自动登录用户列表',
      metric: '00',
    },
    overview: {
      anchor: { x: 666, y: 350 },
      lineEnd: { x: 812, y: 350 },
      card: { x: 960, y: 288, align: 'right' },
    },
  },
  {
    id: 'bottom',
    glyph: 'DNS',
    title: '航域许可',
    code: 'Route Permissions',
    section: 'Deck-06',
    description: '管理内容脚本的启用范围与域名航线。',
    position: { x: 0, y: -1 },
    defaultTelemetry: {
      status: 'online',
      headline: '域名航线可用',
      detail: '等待统计当前已启用的脚本模块',
      metric: '00/00',
    },
    overview: {
      anchor: { x: 500, y: 462 },
      lineEnd: { x: 500, y: 586 },
      card: { x: 500, y: 604, align: 'center' },
    },
  },
  {
    id: 'bottom-right',
    glyph: 'AIX',
    title: 'AI 终端',
    code: 'Aegis Terminal',
    section: 'Deck-07',
    description: '挂接模型链路、舰桥角色协议与实时智能对话的指挥终端。',
    position: { x: 1, y: -1 },
    defaultTelemetry: {
      status: 'standby',
      headline: '等待接入 AI 链路',
      detail: '配置模型与舰桥协议后可启动智能协同',
      metric: 'OFF',
    },
    overview: {
      anchor: { x: 614, y: 432 },
      lineEnd: { x: 814, y: 536 },
      card: { x: 954, y: 468, align: 'right' },
    },
  },
];

export const STARSHIP_MODULE_MAP = STARSHIP_MODULES.reduce((acc, module) => {
  acc[module.id] = module;
  return acc;
}, {} as Record<StarshipPanelId, StarshipModuleMeta>);

export const buildDefaultTelemetry = (): Record<StarshipPanelId, ModuleTelemetry> => {
  return STARSHIP_MODULES.reduce((acc, module) => {
    acc[module.id] = { ...module.defaultTelemetry };
    return acc;
  }, {} as Record<StarshipPanelId, ModuleTelemetry>);
};
