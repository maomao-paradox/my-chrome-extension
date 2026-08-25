<template>
  <section
    class="scrolling-timeline"
    :aria-label="title"
  >
    <header class="timeline-header">
      <div>
        <p class="timeline-kicker">{{ eyebrow }}</p>
        <h2 class="timeline-title">{{ title }}</h2>
      </div>
      <p class="timeline-count" aria-live="polite">
        {{ activeIndex + 1 }} / {{ items.length }}
      </p>
    </header>

    <div class="timeline-window">
      <button
        class="timeline-nav timeline-nav--previous"
        type="button"
        :disabled="activeIndex === 0"
        :aria-label="previousLabel"
        :title="previousLabel"
        @click="moveTo(activeIndex - 1)"
      >
        <span aria-hidden="true" class="timeline-chevron timeline-chevron--left"></span>
      </button>

      <ol
        ref="trackRef"
        class="timeline-track"
        tabindex="0"
        :aria-label="`${title}项目`"
        @keydown.home.prevent="moveTo(0)"
        @keydown.end.prevent="moveTo(items.length - 1)"
        @keydown.left.prevent="moveTo(activeIndex - 1)"
        @keydown.right.prevent="moveTo(activeIndex + 1)"
      >
        <li
          v-for="(item, index) in items"
          :key="item.id"
          :ref="(element) => setItemRef(element, index)"
          class="timeline-item"
          :class="{ 'timeline-item--active': item.id === activeId }"
        >
          <button
            class="timeline-node"
            type="button"
            :aria-current="item.id === activeId ? 'step' : undefined"
            :aria-label="`${item.date}：${item.title}`"
            @click="selectItem(item.id)"
          >
            <span class="timeline-node-dot" aria-hidden="true"></span>
            <span class="timeline-node-line" aria-hidden="true"></span>
          </button>

          <button
            class="timeline-card"
            type="button"
            :aria-pressed="item.id === activeId"
            @click="selectItem(item.id)"
          >
            <span class="timeline-date">{{ item.date }}</span>
            <span class="timeline-card-title">{{ item.title }}</span>
            <span v-if="item.description" class="timeline-description">
              {{ item.description }}
            </span>
            <span v-if="item.meta" class="timeline-meta">{{ item.meta }}</span>
          </button>
        </li>
      </ol>

      <button
        class="timeline-nav timeline-nav--next"
        type="button"
        :disabled="activeIndex === items.length - 1"
        :aria-label="nextLabel"
        :title="nextLabel"
        @click="moveTo(activeIndex + 1)"
      >
        <span aria-hidden="true" class="timeline-chevron timeline-chevron--right"></span>
      </button>
    </div>

    <div class="timeline-progress" aria-hidden="true">
      <span class="timeline-progress-value" :style="{ width: `${progress}%` }"></span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

export interface ScrollingTimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  meta?: string;
}

const props = withDefaults(
  defineProps<{
    items?: ScrollingTimelineItem[];
    modelValue?: string | null;
    eyebrow?: string;
    title?: string;
    previousLabel?: string;
    nextLabel?: string;
  }>(),
  {
    items: () => [
      { id: 'launch', date: '01.12', title: '项目启动', description: '确认目标与交付边界', meta: '阶段 01' },
      { id: 'prototype', date: '01.26', title: '原型评审', description: '完成核心交互验证', meta: '阶段 02' },
      { id: 'build', date: '02.08', title: '功能开发', description: '进入组件与数据联调', meta: '阶段 03' },
      { id: 'release', date: '02.23', title: '正式发布', description: '上线并观察使用反馈', meta: '阶段 04' },
    ],
    modelValue: null,
    eyebrow: 'PROJECT LOG',
    title: '进度时间轴',
    previousLabel: '查看上一个时间点',
    nextLabel: '查看下一个时间点',
  },
);

const emit = defineEmits<{
  'update:modelValue': [id: string];
  select: [item: ScrollingTimelineItem];
}>();

const trackRef = ref<HTMLOListElement | null>(null);
const itemRefs = ref<(HTMLElement | null)[]>([]);

const activeIndex = computed(() => {
  const selectedIndex = props.items.findIndex((item) => item.id === props.modelValue);
  return selectedIndex >= 0 ? selectedIndex : 0;
});

const activeId = computed(() => props.items[activeIndex.value]?.id ?? null);
const progress = computed(() => {
  if (props.items.length < 2) return 100;
  return (activeIndex.value / (props.items.length - 1)) * 100;
});

function setItemRef(element: Element | null, index: number) {
  itemRefs.value[index] = element instanceof HTMLElement ? element : null;
}

function selectItem(id: string) {
  const item = props.items.find((candidate) => candidate.id === id);
  if (!item) return;
  emit('update:modelValue', id);
  emit('select', item);
  scrollItemIntoView(props.items.indexOf(item));
}

function moveTo(index: number) {
  const target = Math.max(0, Math.min(index, props.items.length - 1));
  const item = props.items[target];
  if (item) selectItem(item.id);
}

function scrollItemIntoView(index: number) {
  nextTick(() => {
    const itemElement = itemRefs.value[index];
    if (typeof itemElement?.scrollIntoView === 'function') {
      itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
}

watch(
  () => props.items,
  (items) => {
    if (items.length && props.modelValue && !items.some((item) => item.id === props.modelValue)) {
      emit('update:modelValue', items[0].id);
    }
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.scrolling-timeline {
  --timeline-bg: #10141b;
  --timeline-surface: #171d26;
  --timeline-border: rgba(168, 181, 199, 0.18);
  --timeline-muted: #8894a5;
  --timeline-text: #f3f6fa;
  --timeline-accent: #d8a84e;
  --timeline-accent-soft: rgba(216, 168, 78, 0.16);
  width: 100%;
  min-width: 0;
  padding: 24px;
  color: var(--timeline-text);
  background: var(--timeline-bg);
  border: 1px solid var(--timeline-border);
  border-radius: 8px;
  box-sizing: border-box;
}

.timeline-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.timeline-kicker,
.timeline-count,
.timeline-date,
.timeline-meta {
  margin: 0;
  color: var(--timeline-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.timeline-title {
  margin: 5px 0 0;
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 700;
  line-height: 1.15;
}

.timeline-window {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 10px;
}

.timeline-track {
  display: flex;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 8px 2px 16px;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: var(--timeline-accent) transparent;
  outline: none;
}

.timeline-track:focus-visible {
  box-shadow: 0 0 0 2px var(--timeline-accent);
}

.timeline-item {
  position: relative;
  flex: 0 0 min(248px, 72vw);
  min-width: 0;
  padding-top: 25px;
}

.timeline-item::before {
  position: absolute;
  top: 8px;
  right: 0;
  left: 0;
  height: 1px;
  background: var(--timeline-border);
  content: '';
}

.timeline-node {
  position: absolute;
  top: 0;
  left: 18px;
  z-index: 1;
  width: 22px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.timeline-node-dot {
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--timeline-muted);
  border-radius: 50%;
  background: var(--timeline-bg);
  box-sizing: border-box;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.timeline-node-line {
  position: absolute;
  top: 8px;
  left: 16px;
  width: calc(100% + 12px);
  height: 1px;
  background: var(--timeline-border);
}

.timeline-item:last-child .timeline-node-line {
  display: none;
}

.timeline-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-height: 148px;
  padding: 18px;
  color: inherit;
  text-align: left;
  background: var(--timeline-surface);
  border: 1px solid var(--timeline-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease;
}

.timeline-card:hover,
.timeline-card:focus-visible {
  border-color: rgba(216, 168, 78, 0.65);
  background: #1b222c;
  outline: none;
}

.timeline-item--active .timeline-node-dot {
  border-color: var(--timeline-accent);
  background: var(--timeline-accent);
  box-shadow: 0 0 0 5px var(--timeline-accent-soft);
}

.timeline-item--active .timeline-card {
  border-color: var(--timeline-accent);
  background: linear-gradient(135deg, var(--timeline-accent-soft), var(--timeline-surface) 58%);
}

.timeline-item--active .timeline-date {
  color: var(--timeline-accent);
}

.timeline-card-title {
  margin-top: 12px;
  font-size: 17px;
  font-weight: 700;
}

.timeline-description {
  margin-top: 10px;
  color: #b8c1ce;
  font-size: 13px;
  line-height: 1.55;
}

.timeline-meta {
  margin-top: auto;
  padding-top: 14px;
  font-size: 10px;
}

.timeline-nav {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--timeline-border);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, opacity 180ms ease;
}

.timeline-nav:hover:not(:disabled),
.timeline-nav:focus-visible {
  border-color: var(--timeline-accent);
  background: var(--timeline-accent-soft);
  outline: none;
}

.timeline-nav:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.timeline-chevron {
  width: 8px;
  height: 8px;
  border-top: 2px solid var(--timeline-text);
  border-right: 2px solid var(--timeline-text);
}

.timeline-chevron--left { transform: rotate(-135deg); }
.timeline-chevron--right { transform: rotate(45deg); }

.timeline-progress {
  height: 2px;
  margin: 2px 46px 0;
  overflow: hidden;
  background: var(--timeline-border);
}

.timeline-progress-value {
  display: block;
  height: 100%;
  background: var(--timeline-accent);
  transition: width 220ms ease;
}

@media (max-width: 560px) {
  .scrolling-timeline { padding: 18px 14px; }
  .timeline-header { margin-bottom: 18px; }
  .timeline-window { grid-template-columns: 30px minmax(0, 1fr) 30px; gap: 6px; }
  .timeline-nav { width: 30px; height: 30px; }
  .timeline-progress { margin-right: 36px; margin-left: 36px; }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-node-dot,
  .timeline-card,
  .timeline-nav,
  .timeline-progress-value { transition: none; }
}
</style>
