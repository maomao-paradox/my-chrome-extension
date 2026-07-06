<template>
  <section ref="bridgeRoot" class="bridge-console" :style="parallaxStyle" @pointermove="handlePointerMove"
    @pointerleave="resetPointer">
    <header class="bridge-header">
      <div class="bridge-header__title">
        <div class="hud-rail hud-rail--left">
          <span class="hud-rail__line"></span>
          <span class="hud-rail__text">{{ hudCoordinates }}</span>
        </div>

        <div class="bridge-header__copy">
          <p class="bridge-header__eyebrow">Command Bridge / MRIA-07</p>
          <h1>星舰指挥中心</h1>
          <p class="bridge-header__subtitle">
            用舰桥视角统一调度所有模块状态。全息投影、链路流向和舱段参数都集中于此。
          </p>
        </div>

        <div class="hud-rail hud-rail--right">
          <span class="hud-rail__text">{{ activeModule.code }} / {{ activeModule.section }}</span>
          <span class="hud-rail__line"></span>
        </div>
      </div>

      <div class="bridge-header__meta">
        <div class="meta-chip">
          <span class="meta-chip__label">FOCUS</span>
          <strong>{{ activeModule.title }}</strong>
        </div>
        <div class="meta-chip">
          <span class="meta-chip__label">CLOCK</span>
          <strong>{{ currentTime }}</strong>
        </div>
        <div class="meta-chip meta-chip--status" :data-status="activeModule.telemetry.status">
          <span class="meta-chip__label">LINK</span>
          <strong>{{ statusText(activeModule.telemetry.status) }}</strong>
        </div>
      </div>
    </header>

    <div ref="bridgeLayout" class="bridge-layout">
      <svg v-if="enableHoverGuide && hoverGuide && layoutSize.width > 0 && layoutSize.height > 0"
        class="bridge-layout__overlay" :viewBox="`0 0 ${layoutSize.width} ${layoutSize.height}`" aria-hidden="true">
        <path class="bridge-guide bridge-guide--glow" :d="hoverGuide.path"
          :style="{ '--guide-color': hoverGuide.color }" />
        <path class="bridge-guide" :d="hoverGuide.path" :style="{ '--guide-color': hoverGuide.color }" />
        <circle class="bridge-guide__pulse" :cx="hoverGuide.startX" :cy="hoverGuide.startY" r="4.2"
          :style="{ '--guide-color': hoverGuide.color }" />
        <circle class="bridge-guide__node" :cx="hoverGuide.endX" :cy="hoverGuide.endY" r="4.8"
          :style="{ '--guide-color': hoverGuide.color }" />
      </svg>

      <aside class="bridge-sidebar bridge-sidebar--left">
        <section class="bridge-card compact-card">
          <div class="card-heading">
            <span>CORE STATUS</span>
            <strong>{{ syncPercent }}%</strong>
          </div>

          <div class="metric-stack">
            <div v-for="metric in coreMetrics" :key="metric.label" class="metric-row">
              <div class="metric-row__top">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
              <div class="metric-row__track">
                <div class="metric-row__fill" :class="`metric-row__fill--${metric.tone}`"
                  :style="{ width: `${metric.fill}%` }"></div>
              </div>
            </div>
          </div>

          <div class="core-footer">
            <span>ACTIVE {{ onlineCount }}</span>
            <span>ALERT {{ warningCount }}</span>
            <span>STANDBY {{ standbyCount }}</span>
          </div>
        </section>

        <section class="bridge-card compact-card radar-card">
          <div class="card-heading">
            <span>RADAR</span>
            <strong>{{ peripheralModules.length }} CONTACTS</strong>
          </div>

          <div class="radar-shell">
            <div class="radar-shell__hud">
              <span>RNG {{ radarTelemetry.range }}</span>
              <span>BRG {{ radarTelemetry.bearing }}</span>
            </div>

            <div class="radar-wrap">
              <svg ref="radarSvg" viewBox="0 0 220 220" class="radar-svg">
                <defs>
                  <radialGradient id="radarGlow">
                    <stop offset="0%" stop-color="#7af7d0" stop-opacity="0.62" />
                    <stop offset="100%" stop-color="#7af7d0" stop-opacity="0" />
                  </radialGradient>
                  <linearGradient id="radarSweepLead" x1="110" y1="110" x2="198" y2="62" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#7af7d0" stop-opacity="0" />
                    <stop offset="78%" stop-color="#7af7d0" stop-opacity="0.08" />
                    <stop offset="100%" stop-color="#7af7d0" stop-opacity="0.52" />
                  </linearGradient>
                  <linearGradient id="radarSweepTrail" x1="110" y1="110" x2="196" y2="72"
                    gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#69b7ff" stop-opacity="0" />
                    <stop offset="100%" stop-color="#69b7ff" stop-opacity="0.22" />
                  </linearGradient>
                  <filter id="radarBlur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4.6" />
                  </filter>
                </defs>

                <g class="radar-grid">
                  <circle cx="110" cy="110" r="96" />
                  <circle cx="110" cy="110" r="72" />
                  <circle cx="110" cy="110" r="48" />
                  <circle cx="110" cy="110" r="24" />
                  <line x1="110" y1="14" x2="110" y2="206" />
                  <line x1="14" y1="110" x2="206" y2="110" />
                  <line x1="42" y1="42" x2="178" y2="178" />
                  <line x1="42" y1="178" x2="178" y2="42" />
                  <line v-for="tick in radarTicks" :key="tick.id" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2"
                    :y2="tick.y2" class="radar-grid__tick" />
                </g>

                <g class="radar-labels">
                  <text v-for="label in radarBearingLabels" :key="label.id" :x="label.x" :y="label.y"
                    :text-anchor="label.anchor">
                    {{ label.label }}
                  </text>
                </g>

                <g class="radar-sweep">
                  <path class="radar-sweep__trail" d="M110 110 L110 14 A96 96 0 0 1 194 74 Z"
                    fill="url(#radarSweepTrail)" filter="url(#radarBlur)" />
                  <path class="radar-sweep__mid" d="M110 110 L110 14 A96 96 0 0 1 198 62 Z" fill="url(#radarGlow)" />
                  <path class="radar-sweep__lead" d="M110 110 L110 14 A96 96 0 0 1 198 62 Z"
                    fill="url(#radarSweepLead)" />
                  <line x1="110" y1="110" x2="110" y2="14" class="radar-sweep__line" />
                </g>

                <circle cx="110" cy="110" r="10" class="radar-core-halo" />
                <circle cx="110" cy="110" r="6" class="radar-core" />

                <g v-for="target in radarTargets" :key="target.id" class="radar-target-unit" :class="{
                  'radar-target-unit--hovered': hoveredRadarId === target.id,
                  'radar-target-unit--active': activePanelKey === target.id,
                }" :style="{ '--target-color': target.color }" @pointerenter="setHoveredRadar(target.id)"
                  @pointerleave="clearHoveredRadar" @click="emit('navigate-panel', target.id)">
                  <circle :cx="target.x" :cy="target.y" r="12" class="radar-target-hit" />
                  <circle :cx="target.x" :cy="target.y" r="7.4" class="radar-target-echo" />
                  <path :d="getRadarTargetBracketPath(target)" class="radar-target-lock" />
                  <circle :cx="target.x" :cy="target.y" r="2.6" class="radar-target-dot" />
                </g>
              </svg>
            </div>

            <div class="radar-shell__footer">
              <span>LOCK {{ radarTelemetry.lock }}</span>
              <span>{{ radarTelemetry.title }}</span>
              <span>SIG {{ radarTelemetry.signal }}</span>
            </div>
          </div>

          <!-- <div class="radar-legend">
            <button v-for="module in peripheralModules" :key="module.id" type="button" class="radar-legend__item"
              :class="{ 'radar-legend__item--active': hoveredRadarId === module.id || activePanelKey === module.id }"
              @pointerenter="setHoveredRadar(module.id)" @pointerleave="clearHoveredRadar"
              @click="emit('navigate-panel', module.id)">
              <span class="legend-dot" :style="{ background: statusColor(module.telemetry.status) }"></span>
              <span>{{ module.glyph }}</span>
              <strong>{{ statusText(module.telemetry.status) }}</strong>
            </button>
          </div> -->
        </section>
      </aside>

      <main class="bridge-center">
        <section class="bridge-card ship-card">
          <div class="card-heading card-heading--tight">
            <span>HOLOGRAPHIC PROJECTION</span>
            <strong>{{ activeModule.telemetry.metric }}</strong>
          </div>

          <div class="ship-stage">
            <div class="ship-stage__floor"></div>
            <div class="ship-stage__glow"></div>
            <Rotation3DShowcase class="ship-stage__rotation" projection :items="projectionItems" />

            <svg viewBox="0 0 1000 700" class="ship-scene">
              <g class="ship-grid">
                <path d="M80 86 H920" />
                <path d="M110 130 H890" />
                <path d="M146 176 H854" />
                <path d="M182 228 H818" />
                <path d="M218 286 H782" />
                <path d="M254 350 H746" />
                <path d="M290 420 H710" />
                <path d="M326 498 H674" />
                <path d="M362 582 H638" />
              </g>

              <g class="ship-projection">
                <image href="/static/img/starship.png" x="160" y="134" width="700" height="394.3"
                  class="ship-projection__glow" preserveAspectRatio="xMidYMid meet" />
                <image href="/static/img/starship.png" x="160" y="134" width="700" height="394.3"
                  class="ship-projection__asset" preserveAspectRatio="xMidYMid meet" />
                <!-- <circle cx="458" cy="350" r="14" class="ship-core-dot" /> -->
              </g>

              <g class="link-architecture">
                <path v-for="module in peripheralModules" :key="`${module.id}-link`" :d="getConnectorPath(module)"
                  class="connector-line" :class="`connector-line--${module.telemetry.status}`" />

                <template v-if="enableLinkMotion">
                  <circle v-for="module in peripheralModules" :key="`${module.id}-flow`" r="4.4" class="flow-particle"
                    :style="{ '--flow-color': statusColor(module.telemetry.status) }">
                    <animateMotion :path="getConnectorPath(module)" :dur="flowDuration(module)"
                      repeatCount="indefinite" />
                  </circle>
                </template>
              </g>
            </svg>

            <button v-for="module in peripheralModules" :key="module.id" type="button" class="module-pod" :class="{
              'module-pod--active': module.id === activePanelKey,
              'module-pod--tracking': module.id === hoveredRadarId,
            }" :data-status="module.telemetry.status" :style="getPodStyle(module)"
              :ref="(el) => setPodRefForModule(module, el as Element)" @click="emit('navigate-panel', module.id)">
              <div class="module-pod__strip">
                <span v-for="cell in 6" :key="`${module.id}-${cell}`" class="module-pod__cell"
                  :style="getStripCellStyle(module, cell)"></span>
              </div>

              <div class="module-pod__content">
                <div class="module-pod__meta">
                  <span>{{ module.glyph }}</span>
                  <small>{{ serialFor(module) }}</small>
                </div>
                <strong>{{ module.title }}</strong>
                <p>{{ module.telemetry.headline }}</p>
                <div class="module-pod__footer">
                  <em>{{ statusText(module.telemetry.status) }}</em>
                  <span>{{ module.telemetry.metric }}</span>
                </div>
              </div>
            </button>

            <!-- <div class="ship-focus">
              <span class="ship-focus__label">ACTIVE LOCK</span>
              <strong>{{ activeModule.title }}</strong>
              <p>{{ activeModule.description }}</p>
              <small>{{ activeModule.telemetry.detail }}</small>
            </div> -->
          </div>
        </section>
      </main>

      <aside class="bridge-sidebar bridge-sidebar--right">
        <section class="bridge-card detail-card">
          <div class="card-heading">
            <span>SELECTED MODULE</span>
            <strong>{{ activeModule.glyph }}</strong>
          </div>

          <div class="detail-card__header" :data-status="activeModule.telemetry.status">
            <div>
              <small>{{ activeModule.code }}</small>
              <h2>{{ activeModule.title }}</h2>
            </div>
            <div class="detail-card__metric">
              <span>{{ statusText(activeModule.telemetry.status) }}</span>
              <strong>{{ activeModule.telemetry.metric }}</strong>
            </div>
          </div>

          <!-- <p class="detail-card__description">{{ activeModule.description }}</p> -->

          <div class="detail-metrics">
            <div v-for="metric in activeDiagnostics" :key="metric.label" class="detail-metric">
              <div class="detail-metric__top">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}%</strong>
              </div>
              <div class="detail-metric__track">
                <div class="detail-metric__fill" :style="{ width: `${metric.value}%`, '--metric-color': metric.color }">
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="bridge-card feed-card">
          <div class="card-heading">
            <span>LIVE FEED</span>
            <strong>PROTOCOL STREAM</strong>
          </div>

          <div class="feed-list">
            <div v-for="entry in liveFeed" :key="entry.id" class="feed-line" :data-status="entry.status">
              <span class="feed-line__time">{{ entry.time }}</span>
              <span class="feed-line__prompt">></span>
              <span class="feed-line__text">{{ entry.text }}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import Rotation3DShowcase, { type RotationItemInput } from '@/pages/index/App.vue';
import {
  STARSHIP_STATUS_TEXT,
  STARSHIP_STATUS_TINT,
  type StarshipModuleState,
  type StarshipPanelId,
  type StarshipStatus,
} from './starshipModules';
import { useOptionsPerformance } from '../composables/useOptionsPerformance';

const props = defineProps<{
  modules: StarshipModuleState[];
  activePanelKey: string;
}>();

const emit = defineEmits<{
  (e: 'open-overview'): void;
  (e: 'navigate-panel', panelKey: StarshipPanelId): void;
}>();

interface FlowLogEntry {
  id: string;
  time: string;
  text: string;
  status: StarshipStatus;
}

interface DiagnosticMetric {
  label: string;
  value: number;
  color: string;
}

interface PodLayout {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

type PeripheralPanelId = Exclude<StarshipPanelId, 'main'>;

interface RadarTick {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RadarBearingLabel {
  id: string;
  label: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

interface RadarTarget {
  id: PeripheralPanelId;
  x: number;
  y: number;
  color: string;
  module: StarshipModuleState;
  bearing: string;
  range: string;
  signal: string;
}

interface HoverGuide {
  path: string;
  color: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const POD_LAYOUT: Record<PeripheralPanelId, PodLayout> = {
  top: { x: 500, y: 96, anchorX: 500, anchorY: 248 },
  'top-left': { x: 220, y: 178, anchorX: 392, anchorY: 292 },
  'top-right': { x: 780, y: 178, anchorX: 608, anchorY: 292 },
  left: { x: 146, y: 350, anchorX: 322, anchorY: 350 },
  right: { x: 854, y: 350, anchorX: 680, anchorY: 350 },
  bottom: { x: 500, y: 574, anchorX: 500, anchorY: 454 },
  'bottom-left': { x: 214, y: 560, anchorX: 376, anchorY: 430 },
  'bottom-right': { x: 786, y: 560, anchorX: 624, anchorY: 430 },
};

const bridgeRoot = ref<HTMLElement | null>(null);
const bridgeLayout = ref<HTMLElement | null>(null);
const radarSvg = ref<SVGSVGElement | null>(null);
const currentTime = ref('');
const pointer = ref({ x: 0, y: 0 });
const liveFeed = ref<FlowLogEntry[]>([]);
const hoveredRadarId = ref<PeripheralPanelId | null>(null);
const hoverGuide = ref<HoverGuide | null>(null);
const layoutSize = ref({ width: 0, height: 0 });
const podRefs = ref<Partial<Record<PeripheralPanelId, HTMLButtonElement | null>>>({});

let clockTimer: ReturnType<typeof setInterval> | null = null;
let feedTimer: ReturnType<typeof setInterval> | null = null;
let guideFrame: number | null = null;
let guideObserver: ResizeObserver | null = null;

const { performanceLevel, isLowPerformance, isHighPerformance } = useOptionsPerformance();

const peripheralModules = computed(() => {
  return props.modules.filter((module) => module.id !== 'main');
});

const projectionItemType = (status: StarshipStatus) => {
  if (status === 'warning') {
    return 'yellow';
  }

  if (status === 'standby') {
    return 'green';
  }

  return 'blue';
};

const projectionItems = computed(() => {
  return peripheralModules.value.map((module) => ({
    name: module.title,
    type: projectionItemType(module.telemetry.status),
    fallbackIcon: module.glyph,
  }));
});

const activeModule = computed(() => {
  return props.modules.find((module) => module.id === props.activePanelKey) || props.modules[0];
});

const onlineCount = computed(() => peripheralModules.value.filter((module) => module.telemetry.status === 'online').length);
const warningCount = computed(() => peripheralModules.value.filter((module) => module.telemetry.status === 'warning').length);
const standbyCount = computed(() => peripheralModules.value.filter((module) => module.telemetry.status === 'standby').length);

const syncPercent = computed(() => {
  return Math.round((onlineCount.value / Math.max(peripheralModules.value.length, 1)) * 100);
});

const readinessPercent = computed(() => {
  const total = Math.max(peripheralModules.value.length, 1);
  return Math.round(((onlineCount.value + standbyCount.value * 0.7) / total) * 100);
});

const alertPercent = computed(() => {
  return Math.min(100, warningCount.value * 28);
});

const coreMetrics = computed(() => [
  { label: 'SYNC', value: `${syncPercent.value}%`, fill: syncPercent.value, tone: 'blue' },
  { label: 'ALERT', value: `${warningCount.value}`, fill: alertPercent.value, tone: 'red' },
  { label: 'STANDBY', value: `${readinessPercent.value}%`, fill: readinessPercent.value, tone: 'green' },
]);

const parallaxStyle = computed(() => ({
  '--parallax-x': pointer.value.x.toFixed(4),
  '--parallax-y': pointer.value.y.toFixed(4),
}));
const enableHoverGuide = computed(() => isHighPerformance.value);
const enableLinkMotion = computed(() => isHighPerformance.value);
const liveFeedInterval = computed(() => {
  if (performanceLevel.value === 'high') {
    return 820;
  }

  if (performanceLevel.value === 'medium') {
    return 2400;
  }

  return 0;
});

const hudCoordinates = computed(() => {
  const x = (31.2200 + pointer.value.x * 0.084).toFixed(4);
  const y = (121.4300 + pointer.value.y * 0.096).toFixed(4);
  return `N${x} / E${y}`;
});

const radarTicks = computed<RadarTick[]>(() => {
  return Array.from({ length: 24 }, (_, index) => {
    const angle = ((index * 15) - 90) * (Math.PI / 180);
    const innerRadius = index % 2 === 0 ? 83 : 88;
    const outerRadius = 96;

    return {
      id: `tick-${index}`,
      x1: 110 + Math.cos(angle) * innerRadius,
      y1: 110 + Math.sin(angle) * innerRadius,
      x2: 110 + Math.cos(angle) * outerRadius,
      y2: 110 + Math.sin(angle) * outerRadius,
    };
  });
});

const radarBearingLabels: RadarBearingLabel[] = [
  { id: 'north', label: '000°', x: 110, y: 22, anchor: 'middle' },
  { id: 'east', label: '090°', x: 194, y: 114, anchor: 'end' },
  { id: 'south', label: '180°', x: 110, y: 204, anchor: 'middle' },
  { id: 'west', label: '270°', x: 26, y: 114, anchor: 'start' },
];

const radarTargets = computed<RadarTarget[]>(() => {
  return peripheralModules.value.map((module) => {
    const panelId = module.id as PeripheralPanelId;
    const layout = POD_LAYOUT[panelId];
    const x = ((layout.x - 500) / 6.6) + 110;
    const y = ((layout.y - 350) / 6.6) + 110;
    const dx = x - 110;
    const dy = 110 - y;
    const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const range = 3.4 + (Math.hypot(dx, dy) / 96) * 12.8;
    const baseSignal = module.telemetry.status === 'online' ? 92 : module.telemetry.status === 'standby' ? 71 : 33;
    const signal = Math.max(12, Math.min(99, baseSignal + ((layout.x + layout.y) % 13) - 6));

    return {
      id: panelId,
      x,
      y,
      color: statusColor(module.telemetry.status),
      module,
      bearing: `${Math.round(bearing).toString().padStart(3, '0')}°`,
      range: `${range.toFixed(1)}km`,
      signal: `${signal}%`,
    };
  });
});

const focusedRadarTarget = computed(() => {
  if (hoveredRadarId.value) {
    return radarTargets.value.find((target) => target.id === hoveredRadarId.value) ?? null;
  }

  if (props.activePanelKey !== 'main') {
    return radarTargets.value.find((target) => target.id === props.activePanelKey) ?? null;
  }

  return radarTargets.value[0] ?? null;
});

const radarTelemetry = computed(() => {
  const target = focusedRadarTarget.value;
  if (!target) {
    return {
      range: '--.-km',
      bearing: '---°',
      lock: 'NO-LOCK',
      title: 'Awaiting Contact',
      signal: '--%',
    };
  }

  return {
    range: target.range,
    bearing: target.bearing,
    lock: `${target.module.glyph}-${target.module.code.split(' ')[0].toUpperCase()}`,
    title: target.module.title,
    signal: target.signal,
  };
});

const activeDiagnostics = computed<DiagnosticMetric[]>(() => {
  const module = activeModule.value;
  const base = module.id.charCodeAt(0) + module.title.length * 7;
  const integrity = module.telemetry.status === 'warning' ? 34 : module.telemetry.status === 'standby' ? 68 : 91;
  const throughput = Math.min(96, integrity + ((base * 3) % 18) - 6);
  const latency = Math.max(18, 100 - integrity + (base % 12));

  return [
    { label: 'LINK INTEGRITY', value: integrity, color: statusColor(module.telemetry.status) },
    { label: 'DATA THROUGHPUT', value: throughput, color: '#7ad8ff' },
    { label: 'LATENCY BUFFER', value: latency, color: '#9b8bff' },
  ];
});

const statusText = (status: StarshipStatus) => STARSHIP_STATUS_TEXT[status];
const statusColor = (status: StarshipStatus) => STARSHIP_STATUS_TINT[status];

const formatTime = () => {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
};

const updateClock = () => {
  currentTime.value = formatTime();
};

const serialFor = (module: StarshipModuleState) => {
  const suffix = module.id.toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3);
  const index = peripheralModules.value.findIndex((item) => item.id === module.id) + 1;
  return `BLK-${String(index).padStart(3, '0')}-${suffix}`;
};

const getPodStyle = (module: StarshipModuleState) => {
  const layout = POD_LAYOUT[module.id as PeripheralPanelId];
  return {
    left: `${(layout.x / 1000) * 100}%`,
    top: `${(layout.y / 700) * 100}%`,
    '--pod-color': statusColor(module.telemetry.status),
  };
};

const getConnectorPath = (module: StarshipModuleState) => {
  const layout = POD_LAYOUT[module.id as PeripheralPanelId];
  const endX = layout.x < 500 ? layout.x + 86 : layout.x > 500 ? layout.x - 86 : layout.x;
  const endY = layout.y;
  const midX = layout.anchorX + (endX - layout.anchorX) * 0.46;
  return `M ${layout.anchorX} ${layout.anchorY} L ${midX} ${layout.anchorY} L ${midX} ${endY} L ${endX} ${endY}`;
};

const getRadarTargetBracketPath = (target: RadarTarget) => {
  const size = hoveredRadarId.value === target.id || props.activePanelKey === target.id ? 8.8 : 7.2;
  const inset = size - 2.8;

  return [
    `M ${target.x - size} ${target.y - inset} L ${target.x - size} ${target.y - size} L ${target.x - inset} ${target.y - size}`,
    `M ${target.x + inset} ${target.y - size} L ${target.x + size} ${target.y - size} L ${target.x + size} ${target.y - inset}`,
    `M ${target.x - size} ${target.y + inset} L ${target.x - size} ${target.y + size} L ${target.x - inset} ${target.y + size}`,
    `M ${target.x + inset} ${target.y + size} L ${target.x + size} ${target.y + size} L ${target.x + size} ${target.y + inset}`,
  ].join(' ');
};

const getStripCellStyle = (module: StarshipModuleState, cell: number) => {
  const seed = module.id.charCodeAt(0) + cell * 17;
  return {
    '--cell-scale': `${0.5 + ((seed % 4) * 0.05)}`,
    animationDelay: `${cell * 0.12}s`,
  };
};

const flowDuration = (module: StarshipModuleState) => {
  if (module.telemetry.status === 'warning') {
    return '1.25s';
  }

  if (module.telemetry.status === 'standby') {
    return '3.4s';
  }

  return '2.1s';
};

const buildFeedMessage = (): FlowLogEntry => {
  const pool = peripheralModules.value.length > 0 ? peripheralModules.value : props.modules;
  const module = pool[Math.floor(Math.random() * pool.length)];
  const phrases = [
    '链接回波同步完成',
    '端口握手重新校准',
    '舱段状态写入主矩阵',
    '协议缓存进入轮转',
    '权限航线完成映射',
    '监控帧序列已刷新',
  ];
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  return {
    id: `${module.id}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    time: formatTime(),
    text: `${module.glyph} / ${module.title} -> ${phrase}`,
    status: module.telemetry.status,
  };
};

const seedFeed = () => {
  liveFeed.value = Array.from({ length: 6 }, () => buildFeedMessage()).reverse();
};

const pushFeedMessage = () => {
  liveFeed.value = [buildFeedMessage(), ...liveFeed.value].slice(0, 7);
};

const clearFeedTimer = () => {
  if (!feedTimer) {
    return;
  }

  clearInterval(feedTimer);
  feedTimer = null;
};

const syncFeedLoop = () => {
  clearFeedTimer();

  if (liveFeedInterval.value <= 0) {
    return;
  }

  feedTimer = setInterval(pushFeedMessage, liveFeedInterval.value);
};

const syncHoverGuide = () => {
  guideFrame = null;

  const layoutBounds = bridgeLayout.value?.getBoundingClientRect();
  if (!layoutBounds) {
    return;
  }

  layoutSize.value = {
    width: layoutBounds.width,
    height: layoutBounds.height,
  };

  if (!enableHoverGuide.value) {
    hoverGuide.value = null;
    return;
  }

  if (!hoveredRadarId.value) {
    hoverGuide.value = null;
    return;
  }

  const radarBounds = radarSvg.value?.getBoundingClientRect();
  const target = radarTargets.value.find((item) => item.id === hoveredRadarId.value);
  const podElement = target ? podRefs.value[target.id] : null;

  if (!radarBounds || !target || !podElement) {
    hoverGuide.value = null;
    return;
  }

  const podBounds = podElement.getBoundingClientRect();
  const startX = radarBounds.left - layoutBounds.left + (target.x / 220) * radarBounds.width;
  const startY = radarBounds.top - layoutBounds.top + (target.y / 220) * radarBounds.height;
  const endX = podBounds.left - layoutBounds.left + podBounds.width / 2;
  const endY = podBounds.top - layoutBounds.top + podBounds.height / 2;
  const direction = endX >= startX ? 1 : -1;
  const horizontalSpan = Math.abs(endX - startX);
  const elbow1X = startX + direction * Math.min(90, Math.max(40, horizontalSpan * 0.28));
  const elbow2X = endX - direction * Math.min(92, Math.max(42, horizontalSpan * 0.22));
  const midY = startY + (endY - startY) * 0.22;

  hoverGuide.value = {
    path: [
      `M ${startX} ${startY}`,
      `L ${elbow1X} ${startY}`,
      `L ${elbow1X} ${midY}`,
      `L ${elbow2X} ${midY}`,
      `L ${elbow2X} ${endY}`,
      `L ${endX} ${endY}`,
    ].join(' '),
    color: target.color,
    startX,
    startY,
    endX,
    endY,
  };
};

const queueGuideSync = () => {
  if (!enableHoverGuide.value) {
    if (guideFrame && typeof window !== 'undefined') {
      window.cancelAnimationFrame(guideFrame);
      guideFrame = null;
    }
    hoverGuide.value = null;
    return;
  }

  if (typeof window === 'undefined') {
    syncHoverGuide();
    return;
  }

  if (guideFrame) {
    window.cancelAnimationFrame(guideFrame);
  }

  guideFrame = window.requestAnimationFrame(syncHoverGuide);
};

const setHoveredRadar = (id: StarshipPanelId) => {
  if (isLowPerformance.value) {
    return;
  }

  if (id === 'main') {
    clearHoveredRadar();
    return;
  }

  hoveredRadarId.value = id;
  queueGuideSync();
};

const clearHoveredRadar = () => {
  hoveredRadarId.value = null;
  hoverGuide.value = null;
};

const setPodRefForModule = (module: StarshipModuleState, element: Element | null) => {
  if (module.id === 'main') {
    return;
  }

  const panelId = module.id as PeripheralPanelId;
  podRefs.value[panelId] = element as HTMLButtonElement | null;

  if (hoveredRadarId.value === panelId) {
    queueGuideSync();
  }
};

const handlePointerMove = (event: PointerEvent) => {
  if (!isHighPerformance.value) {
    return;
  }

  const bounds = bridgeRoot.value?.getBoundingClientRect();
  if (!bounds) {
    return;
  }

  const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  pointer.value = {
    x: Math.max(-1, Math.min(1, normalizedX)),
    y: Math.max(-1, Math.min(1, normalizedY)),
  };
};

const resetPointer = () => {
  pointer.value = { x: 0, y: 0 };
};

watch(() => props.activePanelKey, () => {
  if (!isLowPerformance.value) {
    pushFeedMessage();
  }
});

watch(hoveredRadarId, () => {
  nextTick(queueGuideSync);
});

watch(radarTargets, () => {
  nextTick(queueGuideSync);
}, { deep: true });

watch(performanceLevel, () => {
  if (!isHighPerformance.value) {
    resetPointer();
  }

  if (isLowPerformance.value) {
    clearHoveredRadar();
  }

  syncFeedLoop();
  nextTick(queueGuideSync);
});

onMounted(() => {
  updateClock();
  seedFeed();
  clockTimer = setInterval(updateClock, 1000);
  syncFeedLoop();

  if (typeof ResizeObserver !== 'undefined') {
    guideObserver = new ResizeObserver(() => {
      queueGuideSync();
    });

    if (bridgeLayout.value) {
      guideObserver.observe(bridgeLayout.value);
    }

    if (radarSvg.value) {
      guideObserver.observe(radarSvg.value);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', queueGuideSync);
  }

  nextTick(queueGuideSync);
});

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  if (feedTimer) {
    clearFeedTimer();
  }

  if (guideObserver) {
    guideObserver.disconnect();
    guideObserver = null;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', queueGuideSync);
  }

  if (guideFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(guideFrame);
    guideFrame = null;
  }
});
</script>

<style lang="scss" scoped>
.bridge-console {
  min-height: calc(100vh - 134px);
  color: #eaf9ff;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.bridge-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.bridge-header__title {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(110px, 1fr) auto minmax(110px, 1fr);
  align-items: center;
  gap: 18px;
}

.bridge-header__copy {
  text-align: center;
}

.bridge-header__eyebrow,
.hud-rail__text,
.meta-chip__label,
.card-heading span,
.core-footer,
.feed-line__time,
.feed-line__prompt,
.module-pod__meta,
.module-pod__footer em,
.ship-focus__label,
.quick-dock__btn,
.detail-card__header small {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.bridge-header__eyebrow {
  margin: 0 0 10px;
  color: rgba(137, 203, 239, 0.78);
  font-size: 11px;
}

.bridge-header h1 {
  margin: 0;
  font-size: clamp(34px, 4.2vw, 46px);
  line-height: 1;
  text-shadow: 0 0 22px rgba(107, 189, 255, 0.22);
}

.bridge-header__subtitle {
  max-width: 720px;
  margin: 12px auto 0;
  color: rgba(197, 225, 241, 0.78);
  line-height: 1.6;
}

.hud-rail {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hud-rail__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(122, 198, 255, 0.72), transparent);
  box-shadow: 0 0 12px rgba(105, 183, 255, 0.32);
}

.hud-rail__text {
  color: rgba(139, 205, 241, 0.72);
  font-size: 10px;
  white-space: nowrap;
  text-shadow: 0 0 16px rgba(105, 183, 255, 0.24);
}

.bridge-header__meta {
  display: flex;
  gap: 12px;
}

.meta-chip,
.bridge-card,
.quick-dock {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(6, 15, 29, 0.94), rgba(3, 8, 16, 0.78)),
    radial-gradient(circle at top, rgba(40, 112, 255, 0.14), transparent 42%);
  border: 1px solid rgba(90, 169, 228, 0.18);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.28),
    0 0 34px rgba(85, 174, 255, 0.07),
    inset 0 1px 0 rgba(183, 231, 255, 0.06);
}

.meta-chip {
  min-width: 158px;
  padding: 14px 16px;
  clip-path: polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}

.meta-chip__label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  color: rgba(127, 186, 220, 0.72);
}

.meta-chip strong {
  color: #f3fbff;
  font-size: 15px;
  text-shadow: 0 0 16px rgba(105, 183, 255, 0.18);
}

.meta-chip--status[data-status='online'] {
  border-color: rgba(105, 183, 255, 0.34);
}

.meta-chip--status[data-status='warning'] {
  border-color: rgba(255, 98, 98, 0.34);
}

.meta-chip--status[data-status='standby'] {
  border-color: rgba(122, 247, 208, 0.34);
}

.bridge-layout {
  position: relative;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: stretch;
}

.bridge-layout__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 4;
  pointer-events: none;
  overflow: visible;
}

.bridge-guide,
.bridge-guide__node,
.bridge-guide__pulse {
  --guide-color: #69b7ff;
}

.bridge-guide {
  fill: none;
  stroke: var(--guide-color);
  stroke-width: 1.45;
  stroke-dasharray: 8 8;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.88;
  animation: bridgeGuideShift 3.2s linear infinite;
}

.bridge-guide--glow {
  stroke-width: 4.8;
  opacity: 0.2;
  filter: blur(4px);
}

.bridge-guide__node,
.bridge-guide__pulse {
  fill: var(--guide-color);
  filter: drop-shadow(0 0 10px var(--guide-color));
}

.bridge-guide__node {
  fill: rgba(6, 14, 28, 0.92);
  stroke: var(--guide-color);
  stroke-width: 1.4;
}

.bridge-guide__pulse {
  animation: bridgeGuidePulse 1.2s ease-out infinite;
}

.bridge-sidebar,
.bridge-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.bridge-card {
  padding: 18px;
  clip-path: polygon(0 16px, 16px 0, calc(100% - 30px) 0, 100% 18px, 100% 100%, 26px 100%, 0 calc(100% - 26px));
}

.bridge-card::before,
.bridge-card::after,
.meta-chip::before,
.quick-dock::before {
  content: '';
  position: absolute;
  pointer-events: none;
}

.bridge-card::before,
.meta-chip::before,
.quick-dock::before {
  inset: 0;
  background:
    linear-gradient(transparent 96%, rgba(84, 154, 212, 0.05) 100%),
    linear-gradient(90deg, transparent 96%, rgba(84, 154, 212, 0.04) 100%);
  background-size: 100% 18px, 18px 100%;
  opacity: 0.18;
}

.bridge-card::after {
  top: 12px;
  right: 14px;
  width: 88px;
  height: 14px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(138, 197, 235, 0.24), rgba(255, 255, 255, 0));
  opacity: 0.4;
}

.card-heading {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.card-heading--tight {
  margin-bottom: 10px;
}

.card-heading span {
  color: rgba(129, 190, 223, 0.7);
  font-size: 10px;
}

.card-heading strong {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  color: rgba(237, 248, 255, 0.92);
  text-shadow: 0 0 12px rgba(105, 183, 255, 0.16);
}

.compact-card {
  min-height: 250px;
}

.metric-stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric-row__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  color: rgba(208, 238, 255, 0.88);
}

.metric-row__top span {
  font-size: 12px;
}

.metric-row__top strong {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
}

.metric-row__track,
.detail-metric__track {
  height: 9px;
  background: rgba(17, 44, 70, 0.86);
  overflow: hidden;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%);
}

.metric-row__fill,
.detail-metric__fill {
  height: 100%;
  box-shadow: 0 0 20px currentColor;
}

.metric-row__fill--blue {
  background: linear-gradient(90deg, #4883ff, #7ad8ff);
  color: #69b7ff;
}

.metric-row__fill--red {
  background: linear-gradient(90deg, #ff5a5a, #ff8e8e);
  color: #ff6262;
}

.metric-row__fill--green {
  background: linear-gradient(90deg, #23d0a3, #7af7d0);
  color: #7af7d0;
}

.core-footer {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin-top: 18px;
  font-size: 10px;
  color: rgba(127, 191, 221, 0.7);
}

.radar-shell {
  position: relative;
  z-index: 1;
  padding: 10px 10px 12px;
  clip-path: polygon(0 10px, 10px 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
  border: 1px solid rgba(103, 194, 248, 0.2);
  background:
    linear-gradient(180deg, rgba(2, 18, 29, 0.82), rgba(2, 10, 18, 0.96)),
    radial-gradient(circle at center, rgba(64, 178, 255, 0.08), transparent 58%);
  box-shadow:
    inset 0 0 0 1px rgba(145, 220, 255, 0.04),
    inset 0 18px 28px rgba(89, 195, 255, 0.04),
    0 0 24px rgba(55, 145, 255, 0.06);
}

.radar-shell::before,
.radar-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.radar-shell::before {
  background:
    linear-gradient(transparent 94%, rgba(114, 202, 248, 0.05) 100%),
    linear-gradient(90deg, transparent 94%, rgba(114, 202, 248, 0.04) 100%);
  background-size: 100% 20px, 20px 100%;
  opacity: 0.18;
}

.radar-shell::after {
  inset: auto 10px 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(122, 247, 208, 0.42), transparent);
  box-shadow: 0 0 14px rgba(122, 247, 208, 0.2);
}

.radar-shell__hud,
.radar-shell__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(132, 201, 236, 0.78);
}

.radar-shell__hud span,
.radar-shell__footer span {
  white-space: nowrap;
}

.radar-shell__footer {
  color: rgba(147, 219, 241, 0.7);
}

.radar-shell__footer span:nth-child(2) {
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.radar-wrap {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  margin: 10px 0 12px;
  padding: 12px;
  clip-path: polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
  border: 1px solid rgba(101, 186, 240, 0.14);
  background:
    radial-gradient(circle at center, rgba(24, 149, 255, 0.08), transparent 58%),
    linear-gradient(180deg, rgba(2, 12, 20, 0.96), rgba(2, 8, 14, 0.88));
}

.radar-wrap::before,
.radar-wrap::after {
  content: '';
  position: absolute;
  inset: 12px;
  pointer-events: none;
  border-radius: 50%;
}

.radar-wrap::before {
  background:
    radial-gradient(circle, rgba(122, 247, 208, 0.08) 0 1px, transparent 1px),
    radial-gradient(circle at center, rgba(122, 247, 208, 0.05), transparent 68%);
  background-size: 18px 18px, 100% 100%;
  opacity: 0.28;
}

.radar-wrap::after {
  border: 1px solid rgba(114, 202, 248, 0.12);
  box-shadow: inset 0 0 22px rgba(105, 183, 255, 0.05);
}

.radar-svg {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 214px;
  aspect-ratio: 1;
}

.radar-grid circle,
.radar-grid line {
  fill: none;
  stroke: rgba(121, 207, 255, 0.18);
  stroke-width: 1;
}

.radar-grid__tick {
  stroke: rgba(132, 214, 252, 0.26);
  stroke-width: 0.92;
}

.radar-labels text {
  fill: rgba(137, 210, 240, 0.62);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 7.8px;
  letter-spacing: 0.16em;
}

.radar-sweep {
  transform-origin: 110px 110px;
  animation: radarSpinContinuous 5.8s linear infinite;
  will-change: transform;
}

.radar-sweep__trail {
  opacity: 0.76;
}

.radar-sweep__mid {
  opacity: 0.82;
}

.radar-sweep__lead {
  opacity: 0.98;
}

.radar-sweep__line {
  fill: none;
  stroke: rgba(122, 247, 208, 0.72);
  stroke-width: 1.7;
  filter: drop-shadow(0 0 10px rgba(122, 247, 208, 0.52));
  animation: radarLinePulse 1.8s ease-in-out infinite;
}

.radar-core-halo {
  fill: rgba(122, 247, 208, 0.22);
  stroke: none;
  filter: blur(2px);
}

.radar-core {
  fill: rgba(232, 253, 255, 0.96);
  stroke: none;
  filter: drop-shadow(0 0 10px rgba(122, 247, 208, 0.72));
}

.radar-target-unit {
  cursor: pointer;
}

.radar-target-hit {
  fill: transparent;
  stroke: none;
}

.radar-target-echo {
  fill: color-mix(in srgb, var(--target-color) 14%, transparent);
  stroke: color-mix(in srgb, var(--target-color) 48%, rgba(255, 255, 255, 0));
  stroke-width: 1;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--target-color) 28%, transparent));
  animation: radarEchoPulse 1.8s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

.radar-target-lock {
  fill: none;
  stroke: var(--target-color);
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--target-color) 46%, transparent));
}

.radar-target-dot {
  fill: var(--target-color);
  stroke: none;
  filter: drop-shadow(0 0 12px var(--target-color));
}

.radar-target-unit--hovered .radar-target-echo,
.radar-target-unit--active .radar-target-echo {
  opacity: 1;
  animation-duration: 1.05s;
}

.radar-target-unit--hovered .radar-target-lock,
.radar-target-unit--active .radar-target-lock {
  stroke-width: 1.4;
}

.radar-target-unit--hovered .radar-target-dot,
.radar-target-unit--active .radar-target-dot {
  filter: drop-shadow(0 0 14px var(--target-color));
}

.radar-legend {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
}

.radar-legend__item {
  appearance: none;
  width: 100%;
  border: 1px solid rgba(96, 181, 239, 0.12);
  background: rgba(5, 14, 24, 0.64);
  padding: 8px 10px;
  text-align: left;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(202, 228, 241, 0.84);
  clip-path: polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;
}

.radar-legend__item:hover,
.radar-legend__item--active {
  transform: translateX(2px);
  border-color: rgba(122, 247, 208, 0.3);
  box-shadow: 0 0 18px rgba(122, 247, 208, 0.08);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 14px rgba(122, 247, 208, 0.34);
}

.ship-card {
  min-height: 580px;
}

.ship-stage {
  position: relative;
  z-index: 1;
  min-height: 490px;
  overflow: hidden;
  clip-path: polygon(0 18px, 18px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%);
  background:
    radial-gradient(circle at center, rgba(25, 112, 255, 0.18), transparent 36%),
    linear-gradient(180deg, rgba(3, 11, 22, 0.84), rgba(2, 7, 13, 0.98));
}

.ship-stage__floor,
.ship-stage__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ship-stage__floor {
  transform:
    perspective(900px) rotateX(72deg) translate3d(calc(var(--parallax-x) * 14px), calc(var(--parallax-y) * 12px), 0);
  transform-origin: center 72%;
  background:
    linear-gradient(transparent 95%, rgba(104, 182, 255, 0.12) 100%),
    linear-gradient(90deg, transparent 95%, rgba(104, 182, 255, 0.12) 100%);
  background-size: 100% 28px, 28px 100%;
  opacity: 0.36;
}

.ship-stage__glow {
  inset: 10% 10% 18%;
  background: radial-gradient(circle at center, rgba(105, 183, 255, 0.18), transparent 50%);
  filter: blur(16px);
  transform: translate3d(calc(var(--parallax-x) * -20px), calc(var(--parallax-y) * -16px), 0);
}

.ship-stage__rotation {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: auto;
}

.ship-scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  transform:
    translate3d(calc(var(--parallax-x) * 18px), calc(var(--parallax-y) * 12px), 0) scale(1.015);
}

.ship-grid path {
  fill: none;
  stroke: rgba(116, 190, 241, 0.08);
  stroke-width: 1;
}

.ship-projection__glow,
.ship-projection__asset {
  transform-origin: 500px 350px;
}

.ship-projection__glow {
  opacity: 0.34;
  filter:
    brightness(1.08) saturate(0.82) drop-shadow(0 0 26px rgba(105, 183, 255, 0.24)) drop-shadow(0 0 54px rgba(122, 247, 208, 0.14));
}

.ship-projection__asset {
  opacity: 0.94;
  filter:
    saturate(0.84) contrast(1.06) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.34)) drop-shadow(0 0 18px rgba(105, 183, 255, 0.12));
}

.ship-core-dot {
  fill: rgba(195, 247, 255, 0.94);
  stroke: none !important;
  filter: drop-shadow(0 0 22px rgba(122, 247, 208, 0.75));
}

.connector-line {
  fill: none;
  stroke-width: 1.9;
  stroke-dasharray: 7 11;
  animation: linkDrift 5.6s linear infinite;
  filter: drop-shadow(0 0 10px rgba(105, 183, 255, 0.16));
}

.connector-line--online {
  stroke: rgba(105, 183, 255, 0.86);
}

.connector-line--warning {
  stroke: rgba(255, 98, 98, 0.86);
  animation-duration: 2.3s;
}

.connector-line--standby {
  stroke: rgba(122, 247, 208, 0.88);
  animation-duration: 7.2s;
}

.flow-particle {
  fill: var(--flow-color);
  filter: drop-shadow(0 0 12px var(--flow-color));
}

.module-pod {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -50%);
  width: 160px;
  min-height: 80px;
  padding: 7px 12px 7px 24px;
  color: #eefaff;
  border: 1px solid color-mix(in srgb, var(--pod-color) 42%, rgba(102, 164, 219, 0.2));
  background:
    linear-gradient(180deg, rgba(6, 15, 29, 0.95), rgba(3, 8, 16, 0.72)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--pod-color) 16%, transparent), transparent 55%);
  clip-path: polygon(0 14px, 14px 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.28),
    0 0 22px color-mix(in srgb, var(--pod-color) 20%, transparent),
    inset 0 1px 0 rgba(188, 233, 255, 0.06);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
  cursor: pointer;
}

.module-pod:hover,
.module-pod--active,
.module-pod--tracking {
  transform: translate(-50%, -52%);
  box-shadow:
    0 22px 48px rgba(0, 0, 0, 0.3),
    0 0 28px color-mix(in srgb, var(--pod-color) 28%, transparent),
    inset 0 1px 0 rgba(188, 233, 255, 0.1);
}

.module-pod--tracking {
  border-color: color-mix(in srgb, var(--pod-color) 62%, rgba(150, 218, 255, 0.22));
}

.module-pod__strip {
  position: absolute;
  top: 14px;
  left: 10px;
  bottom: 14px;
  width: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.module-pod__cell {
  display: block;
  width: 100%;
  height: 10px;
  background: var(--pod-color);
  box-shadow: 0 0 8px var(--pod-color);
  transform-origin: bottom;
  animation: stripPulse 1.2s ease-in-out infinite alternate;
  transform: scaleY(var(--cell-scale));
}

.module-pod__content {
  position: relative;
  z-index: 1;
}

.module-pod__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  color: rgba(138, 201, 238, 0.72);
  font-size: 9px;
}

.module-pod__meta span {
  font-size: 11px;
  color: var(--pod-color);
  text-shadow: 0 0 12px color-mix(in srgb, var(--pod-color) 50%, transparent);
}

.module-pod strong {
  display: block;
  margin-bottom: 6px;
  font-size: 15px;
  text-shadow: 0 0 18px rgba(105, 183, 255, 0.18);
}

.module-pod p {
  margin: 0;
  /* min-height: 34px; */
  color: rgba(196, 227, 243, 0.76);
  font-size: 12px;
  line-height: 1.45;
}

.module-pod__footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 10px;
}

.module-pod__footer em {
  font-style: normal;
  color: rgba(137, 201, 238, 0.74);
  font-size: 9px;
}

.module-pod__footer span {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
  color: #f0fbff;
}

.ship-focus {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  width: min(300px, calc(100% - 36px));
  padding: 18px 20px;
  text-align: center;
  clip-path: polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  border: 1px solid rgba(100, 184, 242, 0.2);
  background: rgba(4, 11, 21, 0.76);
  backdrop-filter: blur(16px);
  box-shadow: 0 0 28px rgba(105, 183, 255, 0.12);
}

.ship-focus__label {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  color: rgba(137, 201, 238, 0.72);
}

.ship-focus strong {
  display: block;
  margin-bottom: 8px;
  font-size: 22px;
  text-shadow: 0 0 20px rgba(105, 183, 255, 0.16);
}

.ship-focus p,
.ship-focus small {
  display: block;
  margin: 0;
  line-height: 1.55;
}

.ship-focus p {
  color: rgba(196, 227, 243, 0.82);
}

.ship-focus small {
  margin-top: 6px;
  color: rgba(154, 205, 234, 0.64);
}

.detail-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  padding: 14px 16px;
  margin-bottom: 14px;
  clip-path: polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
  border: 1px solid rgba(101, 183, 241, 0.18);
  background: rgba(5, 13, 24, 0.76);
}

.detail-card__header[data-status='online'] {
  border-color: rgba(105, 183, 255, 0.3);
}

.detail-card__header[data-status='warning'] {
  border-color: rgba(255, 98, 98, 0.3);
}

.detail-card__header[data-status='standby'] {
  border-color: rgba(122, 247, 208, 0.3);
}

.detail-card__header small {
  display: block;
  margin-bottom: 4px;
  color: rgba(132, 196, 233, 0.72);
  font-size: 9px;
}

.detail-card__header h2 {
  margin: 0;
  font-size: 26px;
}

.detail-card__metric {
  text-align: right;
}

.detail-card__metric span {
  display: block;
  margin-bottom: 4px;
  color: rgba(141, 204, 239, 0.72);
  font-size: 10px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.detail-card__metric strong {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 16px;
}

.detail-card__description {
  margin: 0 0 18px;
  color: rgba(193, 223, 240, 0.8);
  line-height: 1.6;
}

.detail-metrics {
  display: grid;
  gap: 14px;
}

.detail-metric__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  color: rgba(208, 238, 255, 0.86);
}

.detail-metric__top span {
  font-size: 12px;
}

.detail-metric__top strong {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
}

.detail-metric__fill {
  background: linear-gradient(90deg, var(--metric-color), color-mix(in srgb, var(--metric-color) 20%, #ffffff));
  color: var(--metric-color);
}

.feed-card {
  flex: 1;
  min-height: 280px;
}

.feed-list {
  display: grid;
  gap: 10px;
  max-height: 250px;
  overflow-y: hidden;
}

.feed-line {
  display: grid;
  grid-template-columns: 72px 16px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(84, 154, 212, 0.08);
  color: rgba(196, 227, 243, 0.8);
}

.feed-line:last-child {
  border-bottom: 0;
}

.feed-line__time,
.feed-line__prompt {
  font-size: 10px;
}

.feed-line__time {
  color: rgba(133, 197, 232, 0.68);
}

.feed-line__prompt {
  color: rgba(105, 183, 255, 0.84);
}

.feed-line[data-status='warning'] .feed-line__prompt {
  color: rgba(255, 98, 98, 0.9);
}

.feed-line[data-status='standby'] .feed-line__prompt {
  color: rgba(122, 247, 208, 0.92);
}

.feed-line__text {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.6;
}

.quick-dock {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  clip-path: polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
}

.quick-dock__btn {
  border: 1px solid rgba(95, 176, 236, 0.2);
  background: rgba(5, 13, 24, 0.72);
  color: #def7ff;
  padding: 12px 16px;
  clip-path: polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.quick-dock__btn:hover {
  transform: translateY(-1px);
  border-color: rgba(122, 247, 208, 0.4);
  box-shadow: 0 0 20px rgba(122, 247, 208, 0.1);
}

.quick-dock__btn--primary {
  background: linear-gradient(135deg, rgba(61, 129, 255, 0.72), rgba(56, 204, 214, 0.28));
  border-color: rgba(118, 220, 255, 0.38);
}

@keyframes radarSpinContinuous {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes radarLinePulse {

  0%,
  100% {
    opacity: 0.68;
  }

  50% {
    opacity: 1;
  }
}

@keyframes radarEchoPulse {

  0%,
  100% {
    opacity: 0.54;
    transform: scale(0.92);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes linkDrift {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: -72;
  }
}

@keyframes stripPulse {
  0% {
    transform: scaleY(calc(var(--cell-scale) * 0.72));
    opacity: 0.4;
  }

  100% {
    transform: scaleY(calc(var(--cell-scale) * 1.18));
    opacity: 1;
  }
}

@keyframes bridgeGuideShift {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: -64;
  }
}

@keyframes bridgeGuidePulse {
  0% {
    opacity: 0.18;
    transform: scale(0.9);
  }

  55% {
    opacity: 0.88;
    transform: scale(1.2);
  }

  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}

@media (max-width: 1360px) {
  .bridge-layout {
    grid-template-columns: 250px minmax(0, 1fr) 300px;
  }

  .module-pod {
    width: 174px;
  }
}

@media (max-width: 1180px) {

  .bridge-header,
  .bridge-header__title {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .bridge-header__copy {
    text-align: left;
  }

  .bridge-header__subtitle {
    margin-left: 0;
  }

  .hud-rail--right {
    justify-content: flex-end;
  }

  .bridge-layout {
    grid-template-columns: 1fr;
  }

  .bridge-sidebar--left,
  .bridge-sidebar--right {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 860px) {

  .bridge-header__meta,
  .bridge-sidebar--left,
  .bridge-sidebar--right {
    grid-template-columns: 1fr;
    display: grid;
  }

  .ship-card {
    min-height: 760px;
  }

  .ship-stage {
    min-height: 680px;
  }

  .module-pod {
    width: 172px;
  }
}

@media (max-width: 720px) {
  .bridge-console {
    min-height: auto;
  }

  .bridge-header h1 {
    font-size: 32px;
  }

  .ship-card {
    min-height: 880px;
  }

  .ship-stage {
    min-height: 800px;
  }

  .module-pod {
    width: 150px;
    min-height: 98px;
    padding-right: 12px;
  }

  .module-pod p {
    /* min-height: 44px; */
    font-size: 11px;
  }

  .quick-dock__btn {
    width: calc(50% - 6px);
  }
}

@media (max-width: 560px) {
  .bridge-header__meta {
    display: flex;
    flex-direction: column;
  }

  .quick-dock__btn {
    width: 100%;
  }

  .module-pod {
    width: 138px;
  }
}
</style>
