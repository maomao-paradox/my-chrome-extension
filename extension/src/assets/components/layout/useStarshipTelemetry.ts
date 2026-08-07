/**
 * @file src/assets/components/layout/useStarshipTelemetry.ts
 * @description React 版 PanelNav 的星舰遥测状态加载。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  buildDefaultTelemetry,
  STARSHIP_MODULES,
  type ModuleTelemetry,
  type StarshipModuleState,
  type StarshipPanelId,
} from '@/pages/options/views/starshipModules';

const canUseChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('[PanelNav] Failed to parse localStorage payload:', error);
    return fallback;
  }
};

const buildModuleStates = (telemetry: Record<StarshipPanelId, ModuleTelemetry>): StarshipModuleState[] => {
  const peripheralStates = STARSHIP_MODULES.filter((module) => module.id !== 'main').map((module) => ({
    ...module,
    telemetry: telemetry[module.id] || module.defaultTelemetry,
  }));

  const onlineCount = peripheralStates.filter((module) => module.telemetry.status === 'online').length;
  const warningCount = peripheralStates.filter((module) => module.telemetry.status === 'warning').length;
  const standbyCount = peripheralStates.filter((module) => module.telemetry.status === 'standby').length;

  return STARSHIP_MODULES.map((module) => ({
    ...module,
    telemetry:
      module.id === 'main'
        ? {
            status: warningCount > 0 ? 'warning' : standbyCount > 0 ? 'standby' : 'online',
            metric: `${onlineCount}/${peripheralStates.length}`,
            headline: warningCount > 0 ? `${warningCount} 个舱段需要复核` : '全舰链路稳定',
            detail: `待命舱段 ${standbyCount} 个 / React PanelNav 已接管`,
          }
        : telemetry[module.id] || module.defaultTelemetry,
  }));
};

const loadTelemetry = async (): Promise<Record<StarshipPanelId, ModuleTelemetry>> => {
  const next = buildDefaultTelemetry();

  try {
    const snapshot = canUseChromeStorage()
      ? await chrome.storage.local.get(['userInfo', 'domainConfigs', 'extensionSettings', 'themeColor', 'language'])
      : {};

    const extensionSettings = (snapshot.extensionSettings || {}) as Record<string, unknown>;
    const themeColor = typeof snapshot.themeColor === 'string' ? snapshot.themeColor : '#409EFF';
    const language = typeof snapshot.language === 'string' ? snapshot.language : navigator.language || 'zh-CN';
    const debugMode = Boolean(extensionSettings.debugMode);
    next.left = {
      status: debugMode ? 'warning' : 'online',
      metric: extensionSettings.autoCheckUpdate === false ? 'MANUAL' : 'AUTO',
      headline: debugMode ? '调试模式已开启' : '基础设置稳定',
      detail: `主题 ${themeColor.toUpperCase()} / 语言 ${language.toUpperCase()}`,
    };

    const users = (snapshot.userInfo || {}) as Record<string, { enabled?: boolean }>;
    const totalUsers = Object.keys(users).length;
    const enabledUsers = Object.values(users).filter((user) => user?.enabled !== false).length;
    next.right = {
      status: totalUsers === 0 ? 'standby' : enabledUsers === totalUsers ? 'online' : 'warning',
      metric: String(totalUsers).padStart(2, '0'),
      headline: totalUsers === 0 ? '暂无船员档案' : `${enabledUsers} 名船员处于启用态`,
      detail: totalUsers === 0 ? '进入模块创建首个自动登录用户' : `已备案 ${totalUsers} / 禁用 ${totalUsers - enabledUsers}`,
    };

    const domainConfigs = (snapshot.domainConfigs || {}) as Record<string, { enabled?: boolean } | string>;
    const domainEntries = Object.values(domainConfigs);
    const enabledRoutes = domainEntries.filter((config) => typeof config === 'string' || config?.enabled !== false).length;
    next.bottom = {
      status: enabledRoutes > 0 ? 'online' : 'standby',
      metric: `${enabledRoutes}/${domainEntries.length}`,
      headline: domainEntries.length === 0 ? '尚未建立域名航线' : `${enabledRoutes} 条航线保持开放`,
      detail: domainEntries.length === 0 ? '首次打开后会自动生成默认域名矩阵' : `总脚本模块 ${domainEntries.length} 个`,
    };

    const rules = safeJsonParse<unknown[]>(window.localStorage.getItem('mria_xhr_rules'), []);
    const enabledRules = rules.filter((rule) => {
      return typeof rule === 'object' && rule !== null && (rule as { enabled?: boolean }).enabled !== false;
    }).length;
    next['top-left'] = {
      status: enabledRules > 0 ? 'online' : 'standby',
      metric: `${enabledRules}/${rules.length}`,
      headline: enabledRules > 0 ? '拦截矩阵已部署' : '拦截矩阵空载',
      detail: 'XHR 规则模块等待 React 业务面板接入',
    };
  } catch (error) {
    console.error('[PanelNav] Failed to load starship telemetry:', error);
  }

  return next;
};

export const useStarshipTelemetry = () => {
  const [telemetry, setTelemetry] = useState<Record<StarshipPanelId, ModuleTelemetry>>(() => buildDefaultTelemetry());

  useEffect(() => {
    const refreshTelemetry = () => {
      void loadTelemetry().then(setTelemetry);
    };

    refreshTelemetry();
    const timer = window.setInterval(refreshTelemetry, 15000);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener(refreshTelemetry);
    }

    return () => {
      window.clearInterval(timer);
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.removeListener) {
        chrome.storage.onChanged.removeListener(refreshTelemetry);
      }
    };
  }, []);

  return useMemo(() => buildModuleStates(telemetry), [telemetry]);
};
