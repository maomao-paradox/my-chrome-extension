<template>
  <component :is="rootTag" class="rotation3d-page" :class="{
    'rotation3d-page--embedded': embedded,
    'rotation3d-page--projection': projection,
  }">
    <section class="rotation3d-stage" aria-label="3D 功能模块展示">
      <div class="rotation3D-baseMap" aria-hidden="true"></div>

      <div id="rotation3D" ref="rotationRoot" class="rotation3D">
        <button class="center" type="button">中心</button>

        <div class="itemList">
          <button v-for="item in itemList" :key="item.name" class="rotation3D__item" :class="item.type" type="button">
            <span class="scale">
              <span class="cont">
                <span class="fallback-icon" aria-hidden="true">{{ item.fallbackIcon }}</span>
                <span class="item-name">{{ item.name }}</span>
              </span>
              <span class="baseImg" aria-hidden="true"></span>
            </span>
          </button>
        </div>

        <div class="lineList" aria-hidden="true">
          <div v-for="item in itemList" :key="`${item.name}-line`" class="rotation3D__line" :class="item.type">
            <div v-if="item.type === 'blue'" class="pos">
              <svg width="10" height="400">
                <path id="path1" d="M0 400, 0 0" stroke-dasharray="5,10" />
              </svg>
              <div class="dot dot1 dot-caret"></div>
            </div>

            <div v-if="item.type === 'yellow'" class="pos">
              <svg width="10" height="400">
                <path id="path2" d="M0 400, 0 0" stroke-dasharray="5,10" />
              </svg>
              <div class="dot dot2 dot-close"></div>
            </div>

            <div v-if="item.type === 'green'" class="pos pos--wide">
              <svg width="50" height="400">
                <path id="path3" d="M20 400 S 0 200, 20 0" stroke-dasharray="5,10" />
                <path id="path4" d="M20 400 S 40 200, 20 0" stroke-dasharray="5,10" />
              </svg>
              <div class="dot dot3 dot-caret"></div>
              <div class="dot dot4 dot-caret"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </component>
</template>

<script setup lang="ts">
import $ from 'jquery';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

type RotationItemType = 'blue' | 'green' | 'yellow';

interface RotationItem {
  name: string;
  type: RotationItemType;
  icon: string;
  fallbackIcon: string;
}

export interface RotationItemInput {
  name: string;
  type: RotationItemType;
  icon?: string;
  fallbackIcon?: string;
}

interface Rotation3DOptions {
  id: string;
  farScale?: number;
  xRadius?: number;
  yRadius?: number;
  autoPlay?: boolean;
  autoPlayDelay?: number;
}

interface Rotation3DInstance {
  timer?: number;
  autoPlayTimer?: number;
}

declare global {
  interface Window {
    Rotation3D?: new (options: Rotation3DOptions) => Rotation3DInstance;
  }
}

const defaultItemList: RotationItem[] = [
  { name: '人员管理', type: 'blue', icon: 'icon-renyuanguanli', fallbackIcon: '人' },
  { name: 'GPS服务', type: 'green', icon: 'icon-GPS', fallbackIcon: 'GPS' },
  { name: '路基施工', type: 'yellow', icon: 'icon-a-lujishigong2x', fallbackIcon: '基' },
  { name: '数据服务中心', type: 'blue', icon: 'icon-shujufuwuzhongxin', fallbackIcon: '数' },
  { name: '智慧梁场', type: 'blue', icon: 'icon-liangchang', fallbackIcon: '梁' }
];

const props = defineProps<{
  embedded?: boolean;
  projection?: boolean;
  items?: RotationItemInput[];
}>();

const embedded = computed(() => props.embedded ?? false);
const projection = computed(() => props.projection ?? false);
const rootTag = computed(() => (embedded.value || projection.value ? 'div' : 'main'));
const itemList = computed<RotationItem[]>(() => {
  if (!props.items?.length) {
    return defaultItemList;
  }

  return props.items.map((item) => ({
    name: item.name,
    type: item.type,
    icon: item.icon ?? '',
    fallbackIcon: item.fallbackIcon ?? item.name.slice(0, 1)
  }));
});

const rotationRoot = ref<HTMLElement | null>(null);
let rotation3D: Rotation3DInstance | null = null;
let pluginLoadPromise: Promise<void> | null = null;

function loadScriptOnce(src: string, id: string) {
  const existingScript = document.getElementById(id) as HTMLScriptElement | null;

  if (existingScript) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureRotationPluginLoaded() {
  if (!pluginLoadPromise) {

    //@ts-ignore
    const legacyWindow = window as Window & { $: typeof $; jQuery: typeof $ };
    legacyWindow.$ = $;
    legacyWindow.jQuery = $;

    const rotation3DScriptUrl = new URL('../js/rotation3D/rotation3D.js', import.meta.url).href;
    pluginLoadPromise = loadScriptOnce(rotation3DScriptUrl, 'rotation3d-legacy-plugin');
  }

  await pluginLoadPromise;
}

async function initRotation3D() {
  await nextTick();
  await ensureRotationPluginLoaded();

  if (!rotationRoot.value || !window.Rotation3D) {
    return;
  }

  rotation3D = new window.Rotation3D({
    id: '#rotation3D',
    farScale: 0.6,
    xRadius: 0,
    yRadius: 220
  });
}

onMounted(() => {
  void initRotation3D();
});

onBeforeUnmount(() => {
  if (rotation3D?.autoPlayTimer) {
    window.clearInterval(rotation3D.autoPlayTimer);
  }

  if (rotation3D?.timer) {
    window.cancelAnimationFrame(rotation3D.timer);
    window.clearTimeout(rotation3D.timer);
  }
});
</script>
<style scoped lang="scss">
.rotation3d-page {
  min-width: 320px;
  min-height: 100vh;
  overflow: hidden;
  color: #f8fbff;
  background:
    radial-gradient(circle at 50% 36%, rgba(7, 178, 249, 0.16), transparent 34rem),
    linear-gradient(180deg, #292a38 0%, #171927 100%);
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;

  &--embedded {
    min-height: 100%;
    border: 1px solid rgba(86, 170, 235, 0.12);
    border-radius: 28px;
    background:
      radial-gradient(circle at 50% 36%, rgba(7, 178, 249, 0.12), transparent 34rem),
      linear-gradient(180deg, rgba(6, 16, 30, 0.36), rgba(3, 8, 18, 0.24));
    box-shadow:
      inset 0 1px 0 rgba(183, 231, 255, 0.05),
      0 18px 60px rgba(0, 0, 0, 0.16);

    .rotation3d-stage {
      min-height: calc(100vh - 92px);
      padding: 0;
    }
  }

  &--projection {
    position: absolute;
    inset: 0;
    min-height: 100%;
    overflow: visible;
    background: transparent;

    .rotation3d-stage {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1312px;
      height: 720px;
      min-height: 0;
      padding: 0;
      transform: translate(-50%, -50%) scale(0.52);
      transform-origin: center;
    }
  }
}

.rotation3d-stage {
  position: relative;
  min-height: 100vh;
  padding: 50px;
}

.rotation3D-baseMap {
  position: absolute;
  top: 160px;
  right: 0;
  left: 10px;
  width: 1312px;
  height: 516px;
  margin: auto;
  pointer-events: none;
  background: url("/static/img/baseMap.png") center / contain no-repeat;

  &::before {
    position: absolute;
    z-index: 99;
    top: 0;
    right: 0;
    left: -12px;
    width: 342px;
    height: 318px;
    margin: auto;
    content: "";
    background: url("/static/img/baseLogo.png") center / contain no-repeat;
    animation: rotation3d-bounce-up-down 10s ease-in-out infinite;
  }
}

.rotation3D {
  position: relative;
  width: 800px;
  height: 800px;
  margin: -100px auto 0;
  cursor: move;
  user-select: none;

  .center {
    display: none;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  .itemList,
  .lineList {
    position: absolute;
    width: 100%;
    height: 100%;
  }

  .itemList {
    z-index: 20;
  }

  .lineList {
    z-index: 10;
    transform-style: preserve-3d;
  }
}

.rotation3D__item {
  position: absolute;
  display: block;
  width: 161px;
  height: 188px;
  text-align: center;
  line-height: 30px;
  font-size: 16px;
  color: white;
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;

  .scale,
  .baseImg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .cont {
    position: absolute;
    z-index: 2;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;

    .iconfont {
      display: none;
      font-size: 28px;
      margin-top: 30px;
      margin-bottom: 60px;
    }

    p {
      color: #fff;
    }
  }

  .item-name {
    display: block;
    color: #fff;
  }

  &.blue {
    color: #01e9fc;

    .baseImg {
      background: url("/static/img/蓝底.png");
    }
  }

  &.green {
    color: #02e943;

    .baseImg {
      background: url("/static/img/绿底.png");
    }
  }

  &.yellow {
    color: #ffd200;

    .baseImg {
      background: url("/static/img/黄底.png");
    }
  }
}

.fallback-icon {
  display: grid;
  min-width: 44px;
  height: 44px;
  margin-top: 20px;
  margin-bottom: 54px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  color: currentColor;
  text-shadow: 0 0 12px currentColor;
}

.pos--wide {
  left: -16px;
}

.dot-caret::before {
  display: block;
  width: 0;
  height: 0;
  margin: 3px 0 0 7px;
  border-top: 9px solid transparent;
  border-bottom: 9px solid transparent;
  border-left: 12px solid currentColor;
  content: "";
  filter: drop-shadow(0 0 8px currentColor);
}

.dot-close {

  &::before,
  &::after {
    position: absolute;
    top: 5px;
    left: 11px;
    width: 2px;
    height: 14px;
    background: #000;
    content: "";
  }

  &::before {
    transform: rotate(45deg);
  }

  &::after {
    transform: rotate(-45deg);
  }
}

.rotation3D__line {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  width: 2px;
  height: 50%;
  padding-top: 60px;
  font-size: 50px;
  transform-origin: 50% 0;
  transform-style: preserve-3d;

  .pos,
  svg,
  .dot {
    position: absolute;
    top: 0;
  }

  .pos {
    left: auto;
  }

  .dot {
    left: 0;
    text-align: center;
    width: 24px;
    height: 24px;
    font-size: 24px;
  }

  svg path {
    stroke: #fff;
    fill: none;
    stroke-width: 3;
    animation: path-animation 100s linear infinite;
  }

  .dot1,
  .dot3,
  .dot4 {
    animation: svg-path-animation 6s ease-in-out infinite;
  }

  .dot1 {
    offset-path: path("M0 400, 0 0");
    offset-distance: 0%;
  }

  .dot2 {
    offset-path: path("M0 200, 0 0");
    offset-distance: 0%;
    background: #ffd200;
    border-radius: 100%;
    font-size: 22px;
    color: #000;
  }

  .dot3 {
    offset-path: path("M20 400 S 0 200, 20 0");
    offset-distance: 0%;
  }

  .dot4 {
    offset-path: path("M20 0 S 40 200, 20 400");
    offset-distance: 0%;
  }

  &.blue {
    color: #07b2f9;

    svg path {
      stroke: #07b2f9;
    }
  }

  &.green {
    color: #00ff5b;

    svg path {
      stroke: #00ff5b;
    }
  }

  &.yellow {
    color: #ffd500;

    svg path {
      stroke: #ffd500;
    }
  }
}

@keyframes path-animation {
  0% {
    stroke-dashoffset: 500;
  }

  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes svg-path-animation {
  from {
    offset-distance: 0%;
  }

  to {
    offset-distance: 100%;
  }
}

@keyframes rotation3d-bounce-up-down {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-18px);
  }
}

@media (max-width: 960px) {
  .rotation3d-stage {
    min-width: 960px;
    padding: 36px;
  }
}
</style>