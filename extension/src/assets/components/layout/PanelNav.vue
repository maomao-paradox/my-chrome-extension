<template>
    <div class="panel-nav-shell">
        <Transition name="overview-fade">
            <TacticalOverview v-if="showTacticalOverview" :modules="moduleStates" :active-panel-key="activePanelKey"
                @close="showTacticalOverview = false" @select-panel="focusPanel" />
        </Transition>

        <div ref="siteWrap" class="site-wrap" :class="{
            'blur-active': showTacticalOverview,
            'site-wrap--bridge': isBridgeView,
            'site-wrap--module': !isBridgeView,
        }" :style="layoutVars">
            <div class="screen-scanlines"></div>
            <div class="screen-glitch" :class="{ 'screen-glitch--active': glitchActive }"></div>
            <div class="panel-stage">
                <nav class="edge-nav " v-show="showNav">
                    <GlowingArrow aria-label="向上" direction="top" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--top panel__nav" @click="moveUp" />
                    <GlowingArrow aria-label="右上" direction="right-top" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--right-top panel__nav" @click="moveUpRight" />
                    <GlowingArrow aria-label="向右" direction="right" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--right panel__nav" @click="moveRight" />
                    <GlowingArrow aria-label="右下" direction="right-bottom" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--right-bottom panel__nav" @click="moveDownRight" />
                    <GlowingArrow aria-label="向下" direction="bottom" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--bottom panel__nav" @click="moveDown" />
                    <GlowingArrow aria-label="左下" direction="left-bottom" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--left-bottom panel__nav" @click="moveDownLeft" />
                    <GlowingArrow aria-label="向左" direction="left" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--left panel__nav" @click="moveLeft" />
                    <GlowingArrow aria-label="左上" direction="left-top" size="36px" color="#FFFFFF"
                        class="nav-arrow panel__nav--left-top panel__nav" @click="moveUpLeft" />
                </nav>

                <div ref="panelWrap" class="panel-wrap" :class="{ 'is-transitioning': isAnimating }"
                    :style="panelWrapStyle">
                    <article v-for="([key, panel]) in panelEntries" :key="key" class="panel"
                        :class="{ 'is-active': key === activePanelKey }" :style="getPanelStyle(panel)">
                        <div class="panel-content" :class="{ 'panel-content--module': key !== 'main' }">
                            <HeroSection v-if="key === 'main' && shouldRenderPanel(key)" :modules="moduleStates"
                                :active-panel-key="activePanelKey" @open-overview="openTacticalOverview"
                                @navigate-panel="focusPanel" />
                            <section v-else-if="shouldRenderPanel(key)" class="module-shell"
                                :class="{ 'module-shell--ai': key === 'downRight' }"
                                :data-status="resolvePanelState(key).telemetry.status">
                                <header class="module-shell__header">
                                    <div class="module-shell__title">
                                        <span class="module-shell__eyebrow">{{ resolvePanelState(key).glyph }} / {{
                                            resolvePanelState(key).section }}</span>
                                        <h1>{{ resolvePanelState(key).title }}</h1>
                                        <p>{{ resolvePanelState(key).description }}</p>
                                    </div>

                                    <div class="module-shell__status">
                                        <span>{{ resolvePanelState(key).code }}</span>
                                        <strong>{{ statusText(resolvePanelState(key).telemetry.status) }}</strong>
                                        <span>{{ resolvePanelState(key).telemetry.metric }}</span>
                                    </div>

                                    <div class="module-shell__actions">
                                        <button type="button" class="module-shell__btn"
                                            @click="focusPanel('main')">返回指挥中心</button>
                                        <button type="button" class="module-shell__btn module-shell__btn--accent"
                                            @click="openTacticalOverview">总览</button>
                                    </div>
                                </header>

                                <div class="module-shell__body">
                                    <component :is="panel.page" />
                                </div>
                            </section>
                        </div>
                    </article>
                </div>
            </div>

            <footer class="bridge-footer" :class="{ 'bridge-footer--module': !isBridgeView }">
                <template v-if="isBridgeView">
                    <span>EDGE NAV ACTIVE</span>
                    <span>{{ activeModuleState.code }} / {{ activeModuleState.section }}</span>
                    <span>模块 {{ moduleStates.length - 1 }} 个</span>
                    <span>`O` 打开总览</span>
                </template>
                <template v-else>
                    <span>{{ activeModuleState.code }} / {{ activeModuleState.section }}</span>
                    <span>{{ activeModuleState.telemetry.headline }}</span>
                    <span>`O` 总览</span>
                    <span>返回指挥中心可用</span>
                </template>
            </footer>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, markRaw, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { Component, CSSProperties } from 'vue';
import HeroSection from '@/pages/options/views/HeroSection.vue';
import ContentScriptDomainConfig from '@/pages/options/views/ContentScriptDomainConfig.vue';
import UserOption from '@/pages/options/views/UserOption.vue';
import ExtensionSettings from '@/pages/options/views/ExtensionSettings.vue';
import ErrorMonitorConfig from '@/pages/options/views/ErrorMonitorConfig.vue';
import BrowserVarView from '@/pages/options/views/BrowserVarView.vue';
import XHRuleOption from '@/pages/options/views/XHRuleOption.vue';
import AITerminalView from '@/pages/options/views/AITerminalView.vue';
import KnowledgeGraphView from '@/pages/options/views/KnowledgeGraphView.vue';
import TacticalOverview from '@/pages/options/views/TacticalOverview.vue';
import GlowingArrow from '@icons/GlowingArrow.vue';
import {
    buildDefaultTelemetry,
    STARSHIP_MODULES,
    STARSHIP_STATUS_TEXT,
    type ModuleTelemetry,
    type StarshipModuleMeta,
    type StarshipModuleState,
    type StarshipPanelId,
    type StarshipStatus,
} from '@/pages/options/views/starshipModules';
import {
    normalizeOptionsPerformanceLevel,
    useOptionsPerformance,
} from '@/pages/options/composables/useOptionsPerformance';

interface PanelNavs {
    top: boolean;
    "top-right": boolean;
    "top-left": boolean;
    left: boolean;
    right: boolean;
    "bottom-right": boolean;
    "bottom-left": boolean;
    bottom: boolean;
}

interface Panel {
    xPos: number;
    yPos: number;
    page: Component;
    title: string;
    meta: StarshipModuleMeta;
    navs: PanelNavs;
}

interface PanelBase extends Omit<Panel, 'navs'> { }

const DIRECTION_OFFSETS: Record<keyof PanelNavs, { x: number; y: number }> = {
    top: { x: 0, y: 1 },
    "top-right": { x: 1, y: 1 },
    "top-left": { x: -1, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    "bottom-right": { x: 1, y: -1 },
    "bottom-left": { x: -1, y: -1 },
    bottom: { x: 0, y: -1 },
};

const componentMap: Record<StarshipPanelId, Component> = {
    main: HeroSection,
    top: ErrorMonitorConfig,
    "top-left": XHRuleOption,
    "top-right": BrowserVarView,
    left: ExtensionSettings,
    right: UserOption,
    bottom: ContentScriptDomainConfig,
    "bottom-left": KnowledgeGraphView,
    "bottom-right": AITerminalView,
};

const createBasePanels = (): Record<StarshipPanelId, PanelBase> => {
    return STARSHIP_MODULES.reduce((acc, module) => {
        acc[module.id] = {
            xPos: module.position.x,
            yPos: module.position.y,
            page: markRaw(componentMap[module.id]),
            title: module.title,
            meta: module,
        };
        return acc;
    }, {} as Record<StarshipPanelId, PanelBase>);
};

const buildPanels = (): Record<string, Panel> => {
    const basePanels = createBasePanels();
    const entries = Object.entries(basePanels) as [string, PanelBase][];

    return entries.reduce((acc, [key, panel]) => {
        const navs = Object.entries(DIRECTION_OFFSETS).reduce((navAcc, [direction, offset]) => {
            navAcc[direction as keyof PanelNavs] = entries.some(([, candidate]) => {
                return candidate.xPos === panel.xPos + offset.x && candidate.yPos === panel.yPos + offset.y;
            });
            return navAcc;
        }, {} as PanelNavs);

        acc[key] = {
            ...panel,
            navs,
        };
        return acc;
    }, {} as Record<string, Panel>);
};

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch (error) {
        maLogger.warn('[PanelNav] Failed to parse localStorage payload:', error);
        return fallback;
    }
};

const statusText = (status: StarshipStatus) => STARSHIP_STATUS_TEXT[status];
const { performanceLevel, isLowPerformance, isHighPerformance } = useOptionsPerformance();

const siteWrap = ref<HTMLElement | null>(null);
const bridgeHud = ref<HTMLElement | null>(null);
const panelWrap = ref<HTMLElement | null>(null);
const panels = shallowRef<Record<string, Panel>>(buildPanels());
const telemetry = ref<Record<StarshipPanelId, ModuleTelemetry>>(buildDefaultTelemetry());
const posX = ref(0);
const posY = ref(0);
const showTacticalOverview = ref(false);
const showNav = ref(false);
const isAnimating = ref(false);
const glitchActive = ref(false);
const renderedPanelKeys = ref<Set<string>>(new Set(['main']));
const hudHeight = ref(108);

const panelEntries = computed<[string, Panel][]>(() => Object.entries(panels.value));
const activePanelKey = computed(() => {
    return panelEntries.value.find(([, panel]) => panel.xPos === -posX.value && panel.yPos === posY.value)?.[0] || 'main';
});
const isBridgeView = computed(() => activePanelKey.value === 'main');

const activePanel = computed(() => {
    return panels.value[activePanelKey.value] || panelEntries.value[0]?.[1];
});

const moduleStates = computed<StarshipModuleState[]>(() => {
    const peripheralStates = STARSHIP_MODULES.filter((module) => module.id !== 'main').map((module) => ({
        ...module,
        telemetry: telemetry.value[module.id] || module.defaultTelemetry,
    }));

    const onlineCount = peripheralStates.filter((module) => module.telemetry.status === 'online').length;
    const warningCount = peripheralStates.filter((module) => module.telemetry.status === 'warning').length;
    const standbyCount = peripheralStates.filter((module) => module.telemetry.status === 'standby').length;

    const mainTelemetry: ModuleTelemetry = {
        status: warningCount > 0 ? 'warning' : standbyCount > 0 ? 'standby' : 'online',
        metric: `${onlineCount}/${peripheralStates.length}`,
        headline: warningCount > 0 ? `${warningCount} 个舱段需要复核` : '全舰链路稳定',
        detail: `待命舱段 ${standbyCount} 个 / 当前焦点 ${activePanel.value.meta.code}`,
    };

    return STARSHIP_MODULES.map((module) => ({
        ...module,
        telemetry: module.id === 'main' ? mainTelemetry : telemetry.value[module.id] || module.defaultTelemetry,
    }));
});

const activeModuleState = computed(() => {
    return moduleStates.value.find((module) => module.id === activePanelKey.value) || moduleStates.value[0];
});

const resolvePanelState = (key: string) => {
    return moduleStates.value.find((module) => module.id === key) || moduleStates.value[0];
};

const hudVector = computed(() => {
    const x = String(-posX.value + 4).padStart(2, '0');
    const y = String(posY.value + 4).padStart(2, '0');
    return `GRID X-${x} / Y-${y} / ${activeModuleState.value.code.toUpperCase()}`;
});

const layoutVars = computed(() => ({
    '--bridge-hud-height': `${hudHeight.value}px`,
}));

const panelWrapStyle = computed(() => ({
    transform: `translate3d(${posX.value * 100}%, ${posY.value * 100}%, 0)`,
}));

const getPanelStyle = (panel: Panel): CSSProperties => ({
    '--panel-x': `${panel.xPos * 100}%`,
    '--panel-y': `${panel.yPos * -100}%`,
} as CSSProperties);

const shouldRenderPanel = (key: string) => renderedPanelKeys.value.has(key);

const rememberPanel = (key: string) => {
    if (renderedPanelKeys.value.has(key)) {
        return;
    }

    renderedPanelKeys.value = new Set(renderedPanelKeys.value).add(key);
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let animationTimer: ReturnType<typeof setTimeout> | null = null;
let mouseFrame: number | null = null;
let pendingPointerPosition = { x: 0, y: 0 };
let telemetryTimer: ReturnType<typeof setInterval> | null = null;
let glitchTimer: ReturnType<typeof setTimeout> | null = null;
let isCoarsePointer = false;
let hudResizeObserver: ResizeObserver | null = null;

const EDGE_THRESHOLD = 56;
const HIDE_DELAY = 1100;
const ANIMATION_DURATION = 480;

const clearHideTimer = () => {
    if (!hideTimer) {
        return;
    }

    clearTimeout(hideTimer);
    hideTimer = null;
};

const clearMouseFrame = () => {
    if (mouseFrame === null) {
        return;
    }

    cancelAnimationFrame(mouseFrame);
    mouseFrame = null;
};

const detachPointerTracking = () => {
    siteWrap.value?.removeEventListener('pointermove', handlePointerMove);
};

const attachPointerTracking = () => {
    if (isLowPerformance.value || !siteWrap.value) {
        return;
    }

    siteWrap.value.addEventListener('pointermove', handlePointerMove, { passive: true });
};

const syncPerformanceMode = () => {
    if (isLowPerformance.value) {
        clearHideTimer();
        clearMouseFrame();
        detachPointerTracking();
        showNav.value = true;
        isAnimating.value = false;
        glitchActive.value = false;
        return;
    }

    attachPointerTracking();
    showNav.value = isCoarsePointer;
};

const updateNavVisibility = (x: number, y: number) => {
    if (isCoarsePointer) {
        showNav.value = true;
        return;
    }

    const nearEdge =
        x < EDGE_THRESHOLD ||
        x > window.innerWidth - EDGE_THRESHOLD ||
        y < EDGE_THRESHOLD ||
        y > window.innerHeight - EDGE_THRESHOLD;

    if (nearEdge) {
        showNav.value = true;
        clearHideTimer();
        return;
    }

    if (showNav.value && !hideTimer) {
        hideTimer = setTimeout(() => {
            showNav.value = false;
            hideTimer = null;
        }, HIDE_DELAY);
    }
};

const handlePointerMove = (event: PointerEvent) => {
    if (isLowPerformance.value) {
        return;
    }

    pendingPointerPosition = { x: event.clientX, y: event.clientY };

    if (mouseFrame !== null) {
        return;
    }

    mouseFrame = window.requestAnimationFrame(() => {
        mouseFrame = null;
        updateNavVisibility(pendingPointerPosition.x, pendingPointerPosition.y);
    });
};

const triggerAnimation = () => {
    if (isLowPerformance.value) {
        isAnimating.value = false;
        if (animationTimer) {
            clearTimeout(animationTimer);
            animationTimer = null;
        }
        return;
    }

    isAnimating.value = true;

    if (animationTimer) {
        clearTimeout(animationTimer);
    }

    animationTimer = setTimeout(() => {
        isAnimating.value = false;
        animationTimer = null;
    }, ANIMATION_DURATION);
};

const pulseGlitch = () => {
    if (!isHighPerformance.value) {
        glitchActive.value = false;
        if (glitchTimer) {
            clearTimeout(glitchTimer);
            glitchTimer = null;
        }
        return;
    }

    glitchActive.value = false;

    if (glitchTimer) {
        clearTimeout(glitchTimer);
    }

    requestAnimationFrame(() => {
        glitchActive.value = true;
        glitchTimer = setTimeout(() => {
            glitchActive.value = false;
            glitchTimer = null;
        }, 140);
    });
};

const syncHudHeight = () => {
    const nextHeight = Math.ceil(bridgeHud.value?.getBoundingClientRect().height || 108);
    hudHeight.value = Math.max(92, nextHeight);
};

const focusPanel = (panelKey: string) => {
    const panel = panels.value[panelKey];
    if (!panel) {
        return;
    }

    posX.value = -panel.xPos;
    posY.value = panel.yPos;
    rememberPanel(panelKey);
    triggerAnimation();
    pulseGlitch();
    showTacticalOverview.value = false;
};

const navigate = (direction: keyof PanelNavs) => {
    const panel = activePanel.value;
    const offset = DIRECTION_OFFSETS[direction];

    if (!panel || !offset) {
        return;
    }

    const targetKey = panelEntries.value.find(([, candidate]) => {
        return candidate.xPos === panel.xPos + offset.x && candidate.yPos === panel.yPos + offset.y;
    })?.[0];

    if (targetKey) {
        focusPanel(targetKey);
    }
};

const moveUp = () => navigate('top');
const moveUpRight = () => navigate('top-right');
const moveUpLeft = () => navigate('top-left');
const moveLeft = () => navigate('left');
const moveRight = () => navigate('right');
const moveDown = () => navigate('bottom');
const moveDownRight = () => navigate('bottom-right');
const moveDownLeft = () => navigate('bottom-left');

const openTacticalOverview = () => {
    pulseGlitch();
    showTacticalOverview.value = true;
};

const loadTelemetry = async () => {
    const next = buildDefaultTelemetry();

    try {
        const canUseChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;
        const snapshot = canUseChromeStorage
            ? await chrome.storage.local.get([
                'userInfo',
                'domainConfigs',
                'extensionSettings',
                'themeColor',
                'language',
                'errorMonitorConfig',
            ])
            : {};

        const extensionSettings = (snapshot.extensionSettings || {}) as Record<string, unknown>;
        const themeColor = typeof snapshot.themeColor === 'string' ? snapshot.themeColor : '#409EFF';
        const language = typeof snapshot.language === 'string' ? snapshot.language : navigator.language || 'zh-CN';
        const debugMode = Boolean(extensionSettings.debugMode);
        const autoUpdate = extensionSettings.autoCheckUpdate !== false;
        const performanceMode = normalizeOptionsPerformanceLevel(extensionSettings.performanceMode);
        next.left = {
            status: debugMode ? 'warning' : 'online',
            metric: autoUpdate ? 'AUTO' : 'MANUAL',
            headline: debugMode ? '调试模式已开启' : '基础设置稳定',
            detail: `主题 ${themeColor.toUpperCase()} / 语言 ${language.toUpperCase()} / 性能 ${performanceMode.toUpperCase()}`,
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
        const enabledRoutes = domainEntries.filter((config) => {
            if (typeof config === 'string') {
                return true;
            }
            return config?.enabled !== false;
        }).length;
        next.bottom = {
            status: enabledRoutes > 0 ? 'online' : 'standby',
            metric: `${enabledRoutes}/${domainEntries.length}`,
            headline: domainEntries.length === 0 ? '尚未建立域名航线' : `${enabledRoutes} 条航线保持开放`,
            detail: domainEntries.length === 0 ? '首次打开后会自动生成默认域名矩阵' : `总脚本模块 ${domainEntries.length} 个`,
        };

        const knowledgeNodes = safeJsonParse<any[]>(window.localStorage.getItem('mria_knowledge_graph_nodes'), []);
        const masteredNodes = knowledgeNodes.filter((node) => node?.status === 'mastered').length;
        const activeNodes = knowledgeNodes.filter((node) => node?.status === 'active').length;
        next['bottom-left'] = {
            status: knowledgeNodes.length === 0 ? 'standby' : masteredNodes > 0 ? 'online' : 'standby',
            metric: knowledgeNodes.length > 0 ? String(knowledgeNodes.length).padStart(2, '0') : 'SEED',
            headline: knowledgeNodes.length === 0 ? '等待生成技能图谱' : `${activeNodes} 个节点处于实践中`,
            detail: knowledgeNodes.length === 0
                ? '首次进入后会加载内置技能书模板'
                : `已掌握 ${masteredNodes} / 总节点 ${knowledgeNodes.length}`,
        };

        const monitorConfig = (snapshot.errorMonitorConfig || {}) as Record<string, any>;
        const monitorEnabled = Boolean(monitorConfig.enabled);
        const callbackUrl = typeof monitorConfig.webhookUrl === 'string'
            ? monitorConfig.webhookUrl
            : typeof monitorConfig.wsUrl === 'string'
                ? monitorConfig.wsUrl
                : '';
        const whitelistCount = Array.isArray(monitorConfig.domainWhitelist) ? monitorConfig.domainWhitelist.length : 0;
        const blacklistCount = Array.isArray(monitorConfig.domainBlacklist) ? monitorConfig.domainBlacklist.length : 0;
        next.top = {
            status: !monitorEnabled ? 'standby' : callbackUrl ? 'online' : 'warning',
            metric: monitorEnabled ? `${monitorConfig.throttleInterval || 0}s` : 'OFF',
            headline: !monitorEnabled ? '异常监控关闭' : callbackUrl ? '监控回传已就绪' : '缺少 Webhook 地址',
            detail: `白名单 ${whitelistCount} / 黑名单 ${blacklistCount}`,
        };

        const rules = safeJsonParse<any[]>(window.localStorage.getItem('mria_xhr_rules'), []);
        const xhrWhitelist = safeJsonParse<string[]>(window.localStorage.getItem('mria_xhr_whitelist'), []);
        const enabledRules = rules.filter((rule) => rule?.enabled !== false).length;
        next['top-left'] = {
            status: enabledRules > 0 ? 'online' : 'standby',
            metric: `${enabledRules}/${rules.length}`,
            headline: enabledRules > 0 ? '拦截矩阵已部署' : '拦截矩阵空载',
            detail: `白名单 ${xhrWhitelist.length} 个域名入口`,
        };
        //@ts-ignore
        const platformLabel = navigator.userAgentData?.platform || navigator.platform || 'runtime';
        next['top-right'] = {
            status: navigator.onLine ? 'online' : 'warning',
            metric: (navigator.language || 'N/A').toUpperCase(),
            headline: navigator.onLine ? '页面遥测在线' : '浏览器离线',
            detail: `${platformLabel} / Cookie ${navigator.cookieEnabled ? 'ON' : 'OFF'}`,
        };

        const aiConfig = safeJsonParse<Record<string, string>>(window.localStorage.getItem('ai_assistant_config'), {});
        const rawProvider = typeof aiConfig.provider === 'string' ? aiConfig.provider.trim() : '';
        const customProvider = typeof aiConfig.customProvider === 'string' ? aiConfig.customProvider.trim() : '';
        const aiProvider = rawProvider || customProvider || 'deepseek';
        const aiModel = typeof aiConfig.modelId === 'string' ? aiConfig.modelId.trim() : '';
        const aiApiKey = typeof aiConfig.apiKey === 'string' ? aiConfig.apiKey.trim() : '';
        const aiApiBaseUrl = typeof aiConfig.apiBaseUrl === 'string' ? aiConfig.apiBaseUrl.trim() : '';
        const standardProviders = ['openai', 'anthropic', 'google', 'deepseek'];
        const isCustomProvider = aiProvider !== 'deepseek' && !standardProviders.includes(aiProvider);
        const aiReady = aiProvider === 'deepseek'
            ? true
            : Boolean(aiModel && aiApiKey && (!isCustomProvider || aiApiBaseUrl));
        const aiPartial = Boolean(rawProvider || customProvider || aiModel || aiApiKey || aiApiBaseUrl);

        next['bottom-right'] = {
            status: aiReady ? 'online' : aiPartial ? 'warning' : 'standby',
            metric: aiModel ? aiModel.slice(0, 8).toUpperCase() : aiReady ? aiProvider.slice(0, 8).toUpperCase() : 'OFF',
            headline: aiReady ? '舰桥 AI 链路已挂接' : aiPartial ? 'AI 链路参数未完整' : '等待绑定 AI 模型链路',
            detail: aiReady
                ? `${aiProvider.toUpperCase()} / ${aiModel || 'DEEPSEEK-CHAT'}`
                : '填写 Provider、Model 与鉴权信息后即可启用',
        };
    } catch (error) {
        maLogger.error('[PanelNav] Failed to load starship telemetry:', error);
    }

    telemetry.value = next;
};

const handleStorageChange = () => {
    void loadTelemetry();
};

const handleKeydown = (event: KeyboardEvent) => {
    if (showTacticalOverview.value && event.key === 'Escape') {
        showTacticalOverview.value = false;
        return;
    }

    if ((event.key === 'o' || event.key === 'O') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        openTacticalOverview();
        return;
    }

    if (showTacticalOverview.value) {
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveUp();
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveDown();
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveLeft();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveRight();
    }
};

watch(performanceLevel, () => {
    syncPerformanceMode();
});

onMounted(() => {
    isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    showNav.value = isLowPerformance.value || isCoarsePointer;

    syncPerformanceMode();
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', syncHudHeight);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener(handleStorageChange);
    }

    if (typeof ResizeObserver !== 'undefined' && bridgeHud.value) {
        hudResizeObserver = new ResizeObserver(() => {
            syncHudHeight();
        });
        hudResizeObserver.observe(bridgeHud.value);
    }

    syncHudHeight();
    void loadTelemetry();
    telemetryTimer = setInterval(() => {
        void loadTelemetry();
    }, 15000);
});

onUnmounted(() => {
    clearHideTimer();

    if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
    }

    if (glitchTimer) {
        clearTimeout(glitchTimer);
        glitchTimer = null;
    }

    if (telemetryTimer) {
        clearInterval(telemetryTimer);
        telemetryTimer = null;
    }

    if (mouseFrame !== null) {
        clearMouseFrame();
    }

    detachPointerTracking();
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', syncHudHeight);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged?.removeListener) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
    }

    if (hudResizeObserver) {
        hudResizeObserver.disconnect();
        hudResizeObserver = null;
    }
});
</script>

<style scoped>
.panel-nav-shell {
    position: relative;
    min-height: 100vh;
}

.site-wrap {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background:
        radial-gradient(circle at top, rgba(54, 92, 166, 0.24), transparent 35%),
        radial-gradient(circle at 20% 25%, rgba(26, 214, 214, 0.08), transparent 22%),
        linear-gradient(180deg, #040812 0%, #07111f 45%, #03060d 100%);
}

.site-wrap--module {
    background:
        radial-gradient(circle at top right, rgba(53, 114, 184, 0.14), transparent 28%),
        radial-gradient(circle at 18% 16%, rgba(44, 210, 198, 0.05), transparent 20%),
        linear-gradient(180deg, #08111d 0%, #0b1421 48%, #050a12 100%);
}

.site-wrap::before,
.site-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.site-wrap::before {
    background-image:
        radial-gradient(circle at 12% 18%, rgba(122, 247, 208, 0.7) 0 1px, transparent 1.5px),
        radial-gradient(circle at 32% 64%, rgba(255, 255, 255, 0.6) 0 1.2px, transparent 1.8px),
        radial-gradient(circle at 84% 34%, rgba(122, 198, 255, 0.7) 0 1px, transparent 1.5px),
        radial-gradient(circle at 74% 78%, rgba(255, 179, 71, 0.55) 0 1px, transparent 1.8px);
    opacity: 0.8;
}

.site-wrap::after {
    background:
        linear-gradient(transparent 96%, rgba(76, 157, 214, 0.06) 100%),
        linear-gradient(90deg, transparent 96%, rgba(76, 157, 214, 0.05) 100%);
    background-size: 100% 28px, 28px 100%;
    mix-blend-mode: screen;
    opacity: 0.18;
}

.screen-scanlines,
.screen-glitch {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 12;
}

.screen-scanlines {
    opacity: 0.13;
    background: repeating-linear-gradient(180deg,
            rgba(255, 255, 255, 0.02) 0 1px,
            transparent 1px 4px);
    mix-blend-mode: screen;
}

.site-wrap--module .screen-scanlines {
    opacity: 0.08;
}

.screen-glitch {
    opacity: 0;
}

.screen-glitch--active {
    animation: bridge-glitch 0.14s steps(2, end);
}

.site-wrap.blur-active {
    filter: blur(8px);
    pointer-events: none;
    user-select: none;
}

.bridge-hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 16px;
    padding: 18px 22px 0;
    pointer-events: none;
}

.bridge-hud>* {
    pointer-events: auto;
}

.module-hud {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr) 180px;
    gap: 16px;
    width: 100%;
    pointer-events: auto;
}

.bridge-hud__overview,
.bridge-hud__panel,
.bridge-hud__status,
.module-hud__action,
.module-hud__panel,
.bridge-footer {
    border: 1px solid rgba(82, 177, 255, 0.22);
    background: linear-gradient(180deg, rgba(4, 14, 26, 0.88), rgba(2, 8, 18, 0.68));
    box-shadow:
        0 14px 50px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(159, 220, 255, 0.08);
    backdrop-filter: blur(16px);
}

.bridge-hud__overview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-width: 146px;
    border-radius: 18px;
    padding: 12px 16px;
    color: #d8f4ff;
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.module-hud__action {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 12px 16px;
    color: #d8f4ff;
    border-radius: 18px;
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.module-hud__action span,
.module-hud__action small {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.1em;
}

.module-hud__action span {
    font-size: 13px;
    font-weight: 700;
}

.module-hud__action small {
    margin-top: 4px;
    font-size: 10px;
    color: rgba(147, 212, 255, 0.74);
}

.module-hud__action:hover,
.module-hud__action--ghost:hover {
    transform: translateY(-1px);
    border-color: rgba(122, 247, 208, 0.42);
    box-shadow:
        0 18px 42px rgba(4, 223, 255, 0.12),
        inset 0 1px 0 rgba(159, 220, 255, 0.12);
}

.module-hud__panel {
    min-width: 0;
    border-radius: 22px;
    padding: 14px 18px;
}

.module-hud__panel[data-status='online'] {
    border-color: rgba(105, 183, 255, 0.28);
}

.module-hud__panel[data-status='warning'] {
    border-color: rgba(255, 179, 71, 0.34);
}

.module-hud__panel[data-status='standby'] {
    border-color: rgba(122, 247, 208, 0.28);
}

.module-hud__meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: rgba(137, 205, 241, 0.78);
}

.module-hud__panel strong {
    display: block;
    margin-bottom: 6px;
    font-size: 18px;
    color: #f3fbff;
}

.module-hud__panel p {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(186, 223, 244, 0.8);
}

.bridge-hud__overview:hover {
    transform: translateY(-1px);
    border-color: rgba(122, 247, 208, 0.5);
    box-shadow:
        0 18px 42px rgba(4, 223, 255, 0.15),
        inset 0 1px 0 rgba(159, 220, 255, 0.12);
}

.bridge-hud__overview-label {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.08em;
}

.bridge-hud__overview-code,
.bridge-hud__eyebrow,
.bridge-footer {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.12em;
}

.bridge-hud__overview-code {
    font-size: 10px;
    color: rgba(147, 212, 255, 0.74);
}

.bridge-hud__panel {
    min-width: 0;
    border-radius: 22px;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.bridge-hud__axis {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}

.bridge-hud__axis-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(123, 204, 255, 0.7), transparent);
    box-shadow: 0 0 12px rgba(105, 183, 255, 0.2);
}

.bridge-hud__axis-code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: rgba(139, 205, 241, 0.74);
    white-space: nowrap;
}

.bridge-hud__eyebrow {
    font-size: 10px;
    color: rgba(127, 187, 235, 0.72);
}

.bridge-hud__title {
    font-size: 18px;
    color: #f3fbff;
    font-weight: 700;
}

.bridge-hud__detail {
    font-size: 12px;
    color: rgba(186, 223, 244, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bridge-hud__status {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    border-radius: 18px;
    padding: 12px 16px;
    color: #cdeeff;
}

.bridge-hud__status[data-status='online'] {
    border-color: rgba(122, 247, 208, 0.32);
}

.bridge-hud__status[data-status='warning'] {
    border-color: rgba(255, 179, 71, 0.38);
}

.bridge-hud__status[data-status='standby'] {
    border-color: rgba(140, 176, 207, 0.32);
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #7af7d0;
    box-shadow: 0 0 14px rgba(122, 247, 208, 0.7);
}

.bridge-hud__status[data-status='warning'] .status-dot {
    background: #ffb347;
    box-shadow: 0 0 14px rgba(255, 179, 71, 0.7);
}

.bridge-hud__status[data-status='standby'] .status-dot {
    background: #7aa6c9;
    box-shadow: 0 0 14px rgba(122, 166, 201, 0.45);
}

.bridge-hud__status-text {
    font-size: 13px;
    font-weight: 600;
}

.bridge-hud__metric {
    padding-left: 12px;
    border-left: 1px solid rgba(138, 189, 225, 0.2);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
    color: rgba(145, 208, 245, 0.88);
}

.panel-stage {
    position: absolute;
    inset: 0;
}

.panel-wrap {
    position: absolute;
    inset: 0;
    transition: transform 0.55s cubic-bezier(0.55, 0, 0.1, 1);
    will-change: transform;
}

.panel-wrap.is-transitioning {
    filter: drop-shadow(0 0 22px rgba(39, 165, 255, 0.16));
}

.panel {
    position: absolute;
    inset: 0;
    width: 100vw;
    height: 100vh;
    transform: translate3d(var(--panel-x), var(--panel-y), 0);
    background: transparent;
}

.panel.is-active {
    z-index: 2;
}

.panel-content {
    height: 100%;
    padding: 46px;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
}

.panel-content::-webkit-scrollbar {
    display: none;
}

.panel-content--module {
    min-height: 100%;
}

.module-shell {
    /* max-width: 1280px; */
    height: 100%;
    padding-bottom: 20px;
    margin: 0 auto;
    padding: 20px;
    border: 1px solid rgba(86, 170, 235, 0.16);
    border-radius: 28px;
    background:
        linear-gradient(180deg, rgba(7, 16, 29, 0.94), rgba(4, 10, 18, 0.9)),
        radial-gradient(circle at top right, rgba(60, 146, 255, 0.08), transparent 42%);
    box-shadow:
        0 18px 60px rgba(0, 0, 0, 0.32),
        0 0 28px rgba(68, 165, 255, 0.06),
        inset 0 1px 0 rgba(183, 231, 255, 0.05);
}

.module-shell--ai {
    height: auto;
    min-height: 100%;
}

.module-shell[data-status='online'] {
    border-color: rgba(105, 183, 255, 0.2);
}

.module-shell[data-status='warning'] {
    border-color: rgba(255, 179, 71, 0.24);
}

.module-shell[data-status='standby'] {
    border-color: rgba(122, 247, 208, 0.18);
}

.module-shell__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 16px;
}

.module-shell__title {
    min-width: 0;
}

.module-shell__eyebrow,
.module-shell__status span,
.module-shell__status strong,
.module-shell__btn {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    letter-spacing: 0.12em;
}

.module-shell__eyebrow {
    display: block;
    margin-bottom: 10px;
    font-size: 10px;
    text-transform: uppercase;
    color: rgba(137, 205, 241, 0.76);
}

.module-shell__title h1 {
    margin: 0 0 10px;
    font-size: 32px;
    line-height: 1.05;
    color: #f2fbff;
}

.module-shell__title p {
    margin: 0;
    max-width: 780px;
    color: rgba(197, 225, 241, 0.8);
    line-height: 1.6;
}

.module-shell__actions {
    display: flex;
    gap: 10px;
}

.module-shell__btn {
    border: 1px solid rgba(94, 177, 237, 0.18);
    border-radius: 14px;
    padding: 10px 14px;
    background: rgba(5, 14, 24, 0.7);
    color: #def7ff;
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.module-shell__btn:hover {
    transform: translateY(-1px);
    border-color: rgba(122, 247, 208, 0.34);
    box-shadow: 0 0 18px rgba(122, 247, 208, 0.08);
}

.module-shell__btn--accent {
    background: linear-gradient(135deg, rgba(61, 129, 255, 0.64), rgba(56, 204, 214, 0.24));
    border-color: rgba(118, 220, 255, 0.3);
}

.module-shell__status {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    margin-top: 50px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(94, 177, 237, 0.14);
    background: rgba(4, 11, 21, 0.72);
    color: rgba(163, 216, 243, 0.8);
}

.module-shell__status strong {
    color: #f3fbff;
    font-size: 12px;
}

.module-shell__status span {
    font-size: 11px;
}

.module-shell__status span:last-child {
    margin-left: auto;
}

.module-shell__body {
    position: relative;
}

.module-shell__body :deep(.el-card) {
    border-radius: 18px !important;
}

.edge-nav {
    position: absolute;
    inset: 0;
    z-index: 35;
    pointer-events: none;
    justify-content: center;
    display: flex;
}

.panel__nav {
    position: absolute;
    border: 0;
    background: transparent;
    opacity: 0.3;
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: auto;
}

.panel__nav:hover {
    opacity: 1;
}

.panel__nav--top {
    top: 10px;
    left: 50%;
    /* transform: translateX(-50%) rotate(-90deg); */
}

.panel__nav--left {
    left: 12px;
    top: 50%;
}

.panel__nav--left-top {
    left: 12px;
    top: 10px;
}

.panel__nav--left-bottom {
    left: 12px;
    bottom: 56px;
}

.panel__nav--right {
    right: 12px;
    top: 50%;
}

.panel__nav--right-top {
    right: 12px;
    top: 10px;
}

.panel__nav--right-bottom {
    right: 12px;
    bottom: 56px;
}

.panel__nav--bottom {
    left: 50%;
    bottom: 56px;
}

.nav-arrow {
    display: block;
    filter:
        drop-shadow(0 0 12px rgba(120, 215, 255, 0.8)) drop-shadow(0 0 24px rgba(120, 215, 255, 0.45));
}

.panel__nav:hover .nav-arrow {
    transform: scale(1.08);
}

.bridge-footer {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 14px;
    z-index: 25;
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 11px;
    color: rgba(151, 207, 240, 0.8);
}

.bridge-footer--module {
    justify-content: flex-start;
    background: rgba(4, 12, 22, 0.76);
}

.overview-fade-enter-active,
.overview-fade-leave-active {
    transition: opacity 0.3s ease;
}

.overview-fade-enter-from,
.overview-fade-leave-to {
    opacity: 0;
}

@keyframes bridge-glitch {
    0% {
        opacity: 0;
        transform: translateX(0);
        filter: hue-rotate(0deg);
    }

    20% {
        opacity: 0.22;
        transform: translateX(-6px);
        background:
            linear-gradient(90deg, rgba(255, 0, 84, 0.12), transparent 26%),
            linear-gradient(180deg, transparent 68%, rgba(105, 183, 255, 0.16) 100%);
        filter: hue-rotate(12deg);
    }

    60% {
        opacity: 0.14;
        transform: translateX(4px);
        background:
            linear-gradient(90deg, transparent 30%, rgba(0, 255, 209, 0.12) 55%, transparent 100%);
    }

    100% {
        opacity: 0;
        transform: translateX(0);
        filter: hue-rotate(0deg);
    }
}

@media (max-width: 1100px) {
    .bridge-hud {
        grid-template-columns: 1fr;
    }

    .module-hud {
        grid-template-columns: 1fr;
    }

    .bridge-hud__status {
        justify-content: space-between;
    }

    .bridge-footer {
        flex-wrap: wrap;
    }

    .module-shell__header {
        flex-direction: column;
    }

    .module-shell__actions {
        width: 100%;
    }
}

@media (max-width: 768px) {
    .panel-content {
        padding: calc(var(--bridge-hud-height, 108px) + 16px) 12px 74px;
    }

    .bridge-hud {
        padding: 12px 12px 0;
    }

    .bridge-hud__overview,
    .bridge-hud__panel,
    .bridge-hud__status {
        border-radius: 16px;
    }

    .bridge-footer {
        left: 12px;
        right: 12px;
        bottom: 10px;
    }

    .panel__nav--left,
    .panel__nav--left-top,
    .panel__nav--left-down {
        left: 2px;
    }

    .panel__nav--right,
    .panel__nav--right-top,
    .panel__nav--right-down {
        right: 2px;
    }
}

@media (prefers-reduced-motion: reduce) {

    .panel-wrap,
    .panel__nav,
    .bridge-hud__overview {
        transition-duration: 0.01ms !important;
    }
}
</style>
