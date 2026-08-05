<template>
  <div ref="overviewRoot" class="tactical-overview" :style="parallaxStyle" @click.self="emit('close')"
    @pointermove="handlePointerMove" @pointerleave="resetPointer">
    <div class="overview-scanlines"></div>
    <div class="tactical-shell">
      <header class="tactical-header">
        <div>
          <p class="tactical-header__eyebrow">Starship Tactical Overview</p>
          <h2>星舰总览</h2>
          <!-- <p class="tactical-header__subtitle">点击任意模块标注框，舰桥会立即切换到对应舱段。</p> -->
        </div>

        <div class="tactical-header__actions">
          <div class="tactical-summary">
            <span>ACTIVE</span>
            <strong>{{ activeModule.title }}</strong>
          </div>
          <div class="tactical-summary close-btn" @click="emit('close')">
            <span>CLOSE</span>
            <strong>关闭总览</strong>
          </div>
          <!-- <button type="button" class="close-btn" @click="emit('select-panel', 'main')">关闭</button> -->
        </div>
      </header>

      <div class="overview-stage">
        <svg class="overview-svg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="overviewLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#4bcaff" stop-opacity="0.15" />
              <stop offset="50%" stop-color="#8bf8ff" stop-opacity="0.92" />
              <stop offset="100%" stop-color="#4bcaff" stop-opacity="0.15" />
            </linearGradient>
            <radialGradient id="coreGlow">
              <stop offset="0%" stop-color="#7af7d0" stop-opacity="0.42" />
              <stop offset="100%" stop-color="#7af7d0" stop-opacity="0" />
            </radialGradient>
          </defs>

          <g class="overview-grid">
            <path d="M80 92 H920" />
            <path d="M80 608 H920" />
            <path d="M160 44 V656" />
            <path d="M840 44 V656" />
          </g>

          <circle cx="500" cy="350" r="210" class="overview-ring overview-ring--outer" />
          <circle cx="500" cy="350" r="154" class="overview-ring overview-ring--inner" />
          <circle cx="500" cy="350" r="92" fill="url(#coreGlow)" class="overview-core-glow" />

          <g class="ship-projection">
            <image href="/static/img/starship.png" x="150" y="126" width="720" height="405.6"
              class="ship-projection__glow" preserveAspectRatio="xMidYMid meet" />
            <image href="/static/img/starship.png" x="150" y="126" width="720" height="405.6"
              class="ship-projection__asset" preserveAspectRatio="xMidYMid meet" />
            <circle cx="458" cy="350" r="18" class="ship-core-dot" />
          </g>

          <g class="connector-group">
            <path v-for="module in overviewModules" :key="`${module.id}-path`" :d="getConnectorPath(module)"
              class="connector-line" :class="{ 'connector-line--active': module.id === activePanelKey }"
              :style="{ '--line-color': statusColor(module.telemetry.status) }" />

            <circle v-for="module in overviewModules" :key="`${module.id}-flow`" r="4.4" class="connector-flow"
              :style="{ '--flow-color': statusColor(module.telemetry.status) }">
              <animateMotion :path="getConnectorPath(module)" :dur="flowDuration(module)" repeatCount="indefinite" />
            </circle>

            <circle v-for="module in overviewModules" :key="`${module.id}-anchor`" :cx="module.overview?.anchor.x"
              :cy="module.overview?.anchor.y" r="6" class="anchor-dot"
              :class="{ 'anchor-dot--active': module.id === activePanelKey }"
              :style="{ '--anchor-color': statusColor(module.telemetry.status) }" />
          </g>
        </svg>

        <div class="overview-core-card">
          <span class="overview-core-card__label">Bridge Core</span>
          <strong>{{ activeModule.telemetry.metric }}</strong>
          <p>{{ activeModule.telemetry.headline }}</p>
        </div>

        <button v-for="module in overviewModules" :key="module.id" type="button" class="callout-card"
          :class="{ 'callout-card--active': module.id === activePanelKey }" :data-status="module.telemetry.status"
          :style="getCalloutStyle(module)" @click="emit('select-panel', module.id)">
          <div class="callout-card__strip">
            <span v-for="cell in 10" :key="`${module.id}-cell-${cell}`" class="callout-card__cell"
              :style="getStripCellStyle(module, cell)"></span>
          </div>
          <div class="callout-card__top">
            <span>{{ module.glyph }}</span>
            <strong>{{ module.title }}</strong>
            <em>{{ module.section }}</em>
            <small>{{ serialFor(module) }}</small>
          </div>
          <div class="callout-card__body">
            <!-- <p>{{ module.telemetry.headline }}</p> -->
            <small>{{ module.telemetry.detail }}</small>
          </div>
          <div class="callout-card__footer">
            <span>{{ statusText(module.telemetry.status) }}</span>
            <strong>{{ module.telemetry.metric }}</strong>
          </div>
        </button>
      </div>

      <div class="mobile-module-list">
        <button type="button" class="mobile-module-card mobile-module-card--return"
          @click="emit('select-panel', 'main')">
          <div>
            <span>RET</span>
            <strong>返回指挥中心</strong>
          </div>
          <small>BRIDGE</small>
        </button>

        <button v-for="module in overviewModules" :key="`${module.id}-mobile`" type="button" class="mobile-module-card"
          :class="{ 'mobile-module-card--active': module.id === activePanelKey }"
          @click="emit('select-panel', module.id)">
          <div>
            <span>{{ module.glyph }}</span>
            <strong>{{ module.title }}</strong>
          </div>
          <small>{{ module.telemetry.metric }}</small>
        </button>
      </div>

      <div class="overview-actions">
        <button type="button" class="overview-actions__btn" @click="emit('select-panel', 'main')">
          返回指挥中心
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { STARSHIP_STATUS_TEXT, STARSHIP_STATUS_TINT, type StarshipModuleState, type StarshipPanelId, type StarshipStatus } from './starshipModules';

const props = defineProps<{
  modules: StarshipModuleState[];
  activePanelKey: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select-panel', panelKey: StarshipPanelId): void;
}>();

const overviewRoot = ref<HTMLElement | null>(null);
const pointer = ref({ x: 0, y: 0 });

const overviewModules = computed(() => {
  return props.modules.filter((module) => module.id !== 'main' && module.overview);
});

const activeModule = computed(() => {
  return props.modules.find((module) => module.id === props.activePanelKey) || props.modules[0];
});

const statusText = (status: StarshipStatus) => STARSHIP_STATUS_TEXT[status];
const statusColor = (status: StarshipStatus) => STARSHIP_STATUS_TINT[status];

const parallaxStyle = computed(() => ({
  '--overview-px': pointer.value.x.toFixed(4),
  '--overview-py': pointer.value.y.toFixed(4)
}));

const getConnectorPath = (module: StarshipModuleState) => {
  const anchor = module.overview?.anchor;
  const lineEnd = module.overview?.lineEnd;

  if (!anchor || !lineEnd) {
    return '';
  }

  const midX = anchor.x + (lineEnd.x - anchor.x) * 0.58;
  return `M ${anchor.x} ${anchor.y} L ${midX} ${anchor.y} L ${midX} ${lineEnd.y} L ${lineEnd.x} ${lineEnd.y}`;
};

const getCalloutStyle = (module: StarshipModuleState) => {
  const card = module.overview?.card;

  if (!card) {
    return {};
  }

  let transform = 'translate(0, 0)';

  if (card.align === 'center') {
    transform = module.id === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
  } else if (card.align === 'right') {
    transform = 'translate(-100%, 0)';
  }

  return {
    left: `${(card.x / 1000) * 100}%`,
    top: `${(card.y / 700) * 100}%`,
    transform
  };
};

const getStripCellStyle = (module: StarshipModuleState, cell: number) => {
  const seed = module.id.charCodeAt(0) + cell * 19;
  return {
    '--cell-scale': `${0.8 + ((seed % 4) * 0.05)}`,
    animationDelay: `${cell * 0.14}s`
  };
};

const serialFor = (module: StarshipModuleState) => {
  const suffix = module.id.toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').slice(0, 3);
  return `BLK-${module.section.slice(-2)}-${suffix}`;
};

const flowDuration = (module: StarshipModuleState) => {
  if (module.telemetry.status === 'warning') {
    return '1.2s';
  }

  if (module.telemetry.status === 'standby') {
    return '3.2s';
  }

  return '2s';
};

const handlePointerMove = (event: PointerEvent) => {
  const bounds = overviewRoot.value?.getBoundingClientRect();
  if (!bounds) {
    return;
  }

  pointer.value = {
    x: (((event.clientX - bounds.left) / bounds.width) - 0.5) * 2,
    y: (((event.clientY - bounds.top) / bounds.height) - 0.5) * 2
  };
};

const resetPointer = () => {
  pointer.value = { x: 0, y: 0 };
};
</script>

<style scoped>
.tactical-overview {
  position: fixed;
  inset: 0;
  z-index: 120;
  padding: 18px;
  background:
    radial-gradient(circle at top, rgba(42, 114, 184, 0.22), transparent 24%),
    rgba(2, 6, 12, 0.78);
  backdrop-filter: blur(20px);
}

.overview-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.14;
  background: repeating-linear-gradient(180deg,
      rgba(255, 255, 255, 0.024) 0 1px,
      transparent 1px 4px);
  mix-blend-mode: screen;
}

.tactical-shell {
  height: 100%;
  border: 1px solid rgba(88, 168, 232, 0.18);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(5, 14, 28, 0.95), rgba(3, 8, 17, 0.88)),
    radial-gradient(circle at center, rgba(55, 150, 255, 0.08), transparent 45%);
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(190, 233, 255, 0.06);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
}

.tactical-header,
.tactical-summary,
.close-btn,
.callout-card,
.overview-core-card,
.mobile-module-card {
  border: 1px solid rgba(91, 168, 228, 0.18);
  background: linear-gradient(180deg, rgba(6, 16, 31, 0.88), rgba(3, 9, 18, 0.72));
  box-shadow:
    0 16px 42px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(181, 231, 255, 0.05);
}

.tactical-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 26px 18px;
  border-width: 0 0 1px;
  border-radius: 0;
}

.tactical-header__eyebrow,
.tactical-summary span,
.callout-card__footer span,
.overview-core-card__label,
.callout-card__top em {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tactical-header__eyebrow {
  margin: 0 0 8px;
  color: rgba(131, 195, 233, 0.72);
  font-size: 11px;
}

.tactical-header h2 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  color: #edf9ff;
}

.tactical-header__subtitle {
  margin: 10px 0 0;
  color: rgba(191, 223, 241, 0.78);
}

.tactical-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tactical-summary {
  padding: 12px 16px;
  border-radius: 18px;
  color: #f2fbff;
}

.tactical-summary span {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  color: rgba(131, 195, 233, 0.72);
}

.tactical-summary strong {
  font-size: 15px;
}

.close-btn {
  border-radius: 999px;
  padding: 12px 20px;
  color: #def7ff;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.close-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(122, 247, 208, 0.42);
}

.overview-stage {
  position: relative;
  flex: 1 0 620px;
  min-height: 620px;
  margin: 18px;
  border-radius: 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(22, 114, 255, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(4, 11, 22, 0.92), rgba(2, 6, 12, 0.96));
}

.overview-stage::before,
.overview-stage::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.overview-stage::before {
  inset: 18% 8% -26% 8%;
  transform:
    perspective(900px) rotateX(76deg) translate3d(calc(var(--overview-px) * 14px), calc(var(--overview-py) * 12px), 0);
  transform-origin: center 40%;
  background:
    linear-gradient(transparent 95%, rgba(76, 157, 214, 0.12) 100%),
    linear-gradient(90deg, transparent 95%, rgba(76, 157, 214, 0.12) 100%);
  background-size: 100% 28px, 28px 100%;
  opacity: 0.32;
}

.overview-stage::after {
  background: radial-gradient(circle at center, rgba(122, 247, 208, 0.08), transparent 40%);
  transform: translate3d(calc(var(--overview-px) * -14px), calc(var(--overview-py) * -12px), 0);
}

.overview-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: translate3d(calc(var(--overview-px) * 12px), calc(var(--overview-py) * 10px), 0);
}

.overview-grid path {
  fill: none;
  stroke: rgba(118, 187, 236, 0.08);
  stroke-width: 1;
}

.overview-ring {
  fill: none;
  stroke: rgba(118, 187, 236, 0.12);
}

.overview-ring--outer {
  stroke-width: 1.2;
}

.overview-ring--inner {
  stroke-width: 1;
}

.overview-core-glow {
  animation: corePulse 3s ease-in-out infinite;
}

.ship-projection {
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(1.2);
}

.ship-projection__glow,
.ship-projection__asset {
  transform-origin: 500px 350px;
}

.ship-projection__glow {
  opacity: 0.32;
  filter:
    brightness(1.1) saturate(0.9) drop-shadow(0 0 22px rgba(105, 183, 255, 0.22)) drop-shadow(0 0 48px rgba(122, 247, 208, 0.14));
}

.ship-projection__asset {
  opacity: 0.96;
  filter:
    drop-shadow(0 10px 24px rgba(0, 0, 0, 0.36)) drop-shadow(0 0 18px rgba(105, 183, 255, 0.12));
}

.ship-core-dot {
  fill: rgba(122, 247, 208, 0.92) !important;
  stroke: none !important;
  filter: drop-shadow(0 0 20px rgba(122, 247, 208, 0.72));
}

.connector-line {
  fill: none;
  stroke: var(--line-color);
  stroke-width: 1.8;
  opacity: 0.72;
  stroke-dasharray: 8 10;
  animation: lineFlow 6s linear infinite;
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--line-color) 36%, transparent));
}

.connector-line--active {
  opacity: 1;
  stroke-width: 2.4;
}

.connector-flow {
  fill: var(--flow-color);
  filter: drop-shadow(0 0 12px var(--flow-color));
}

.anchor-dot {
  fill: var(--anchor-color);
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--anchor-color) 56%, transparent));
}

.anchor-dot--active {
  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--anchor-color) 72%, transparent));
}

.overview-core-card {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(calc(-50% + var(--overview-px) * 10px), calc(-50% + var(--overview-py) * 8px));
  width: min(240px, calc(100% - 48px));
  border-radius: 24px;
  padding: 20px 22px;
  text-align: center;
  color: #edf9ff;
  backdrop-filter: blur(16px);
  clip-path: polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
}

.overview-core-card__label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  color: rgba(131, 195, 233, 0.76);
}

.overview-core-card strong {
  display: block;
  margin-bottom: 8px;
  font-size: 26px;
}

.overview-core-card p {
  margin: 0;
  color: rgba(191, 223, 241, 0.76);
  line-height: 1.5;
}

.callout-card {
  position: absolute;
  width: 230px;
  padding: 14px 16px 14px 28px;
  color: #edf9ff;
  text-align: left;
  backdrop-filter: blur(16px);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
  clip-path: polygon(0 14px, 14px 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
}

.callout-card:hover,
.callout-card--active {
  border-color: rgba(122, 247, 208, 0.42);
  box-shadow: 0 0 34px rgba(122, 247, 208, 0.14);
}

.callout-card[data-status='warning'] {
  border-color: rgba(255, 179, 71, 0.28);
}

.callout-card[data-status='standby'] {
  border-color: rgba(124, 166, 201, 0.2);
}

.callout-card__top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 10px;
  align-items: center;
}

.callout-card__top span {
  grid-row: span 2;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #8bf8ff, #62a9ff);
  color: #05111f;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-weight: 700;
  font-size: 12px;
}

.callout-card[data-status='warning'] .callout-card__top span {
  background: linear-gradient(135deg, #ffd26f, #ff9347);
}

.callout-card[data-status='standby'] .callout-card__top span {
  background: linear-gradient(135deg, #9ab9d5, #6f8fac);
}

.callout-card__top strong {
  font-size: 14px;
}

.callout-card__top em {
  font-style: normal;
  font-size: 9px;
  color: rgba(131, 195, 233, 0.72);
}

.callout-card__top small {
  grid-column: 2;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: rgba(131, 195, 233, 0.58);
}

.callout-card__body {
  margin-top: 12px;
}

.callout-card__body p,
.callout-card__body small {
  display: block;
  margin: 0;
}

.callout-card__body p {
  margin-bottom: 6px;
  color: rgba(230, 246, 255, 0.9);
  line-height: 1.5;
}

.callout-card__body small {
  color: rgba(191, 223, 241, 0.72);
  line-height: 1.5;
}

.callout-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 12px;
}

.callout-card__footer span {
  font-size: 10px;
  color: rgba(131, 195, 233, 0.72);
}

.callout-card__footer strong {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
}

.callout-card__strip {
  position: absolute;
  top: 14px;
  left: 10px;
  bottom: 14px;
  width: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.callout-card__cell {
  display: block;
  width: 100%;
  height: 10px;
  background: currentColor;
  box-shadow: 0 0 10px currentColor;
  transform-origin: bottom;
  animation: stripPulse 1.2s ease-in-out infinite alternate;
  transform: scaleY(var(--cell-scale));
}

.callout-card[data-status='warning'] .callout-card__cell {
  color: #ff6262;
}

.callout-card[data-status='standby'] .callout-card__cell {
  color: #7af7d0;
}

.callout-card[data-status='online'] .callout-card__cell {
  color: #69b7ff;
}

.mobile-module-list {
  display: none;
  padding: 0 18px 18px;
  gap: 10px;
}

.mobile-module-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 18px;
  padding: 14px;
  color: #edf9ff;
}

.mobile-module-card div span {
  display: inline-block;
  width: 38px;
  margin-right: 10px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.mobile-module-card strong,
.mobile-module-card small {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.mobile-module-card--active {
  border-color: rgba(122, 247, 208, 0.42);
}

.mobile-module-card--return,
.overview-actions__btn {
  border-color: rgba(105, 183, 255, 0.34);
  background: linear-gradient(135deg, rgba(61, 129, 255, 0.72), rgba(56, 204, 214, 0.28));
}

.overview-actions {
  display: flex;
  justify-content: center;
  padding: 0 18px 18px;
}

.overview-actions__btn {
  min-width: 220px;
  border-radius: 999px;
  padding: 12px 20px;
  color: #edf9ff;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.overview-actions__btn:hover {
  transform: translateY(-1px);
  border-color: rgba(122, 247, 208, 0.42);
  box-shadow: 0 0 24px rgba(105, 183, 255, 0.16);
}

@keyframes lineFlow {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: -72;
  }
}

@keyframes corePulse {

  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }

  50% {
    opacity: 0.9;
    transform: scale(1.06);
  }
}

@keyframes stripPulse {
  0% {
    transform: scaleY(calc(var(--cell-scale) * 0.74));
    opacity: 0.45;
  }

  100% {
    transform: scaleY(calc(var(--cell-scale) * 1.18));
    opacity: 1;
  }
}

@media (max-width: 1180px) {
  .callout-card {
    width: 200px;
  }
}

@media (max-width: 920px) {
  .overview-stage {
    min-height: 520px;
  }

  .callout-card {
    display: none;
  }

  .mobile-module-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .tactical-overview {
    padding: 10px;
  }

  .tactical-shell {
    border-radius: 24px;
  }

  .tactical-header {
    flex-direction: column;
    padding: 18px 18px 14px;
  }

  .tactical-header__actions {
    width: 100%;
    justify-content: space-between;
  }

  .overview-stage {
    margin: 12px;
    min-height: 440px;
  }

  .overview-core-card {
    width: min(220px, calc(100% - 32px));
  }

  .mobile-module-list {
    padding: 0 12px 12px;
    grid-template-columns: 1fr;
  }

  .overview-actions {
    padding: 0 12px 12px;
  }
}
</style>
