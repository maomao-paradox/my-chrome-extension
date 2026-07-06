<template>
  <i :class="['icon', direction]" :style="style">
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2345">
      <path
        d="M369.728 512l384.768-384.704a48.64 48.64 0 0 0 0.896-68.8 48.64 48.64 0 0 0-68.736 0.96L269.44 476.736a48.704 48.704 0 0 0-11.136 17.344c-1.024 2.304-1.024 4.736-1.472 7.04-0.896 3.648-2.048 7.168-2.048 10.88 0 3.712 1.152 7.232 1.984 10.88 0.512 2.368 0.512 4.8 1.472 7.04a48.704 48.704 0 0 0 11.136 17.344l417.216 417.28a48.576 48.576 0 0 0 68.736 0.96 48.576 48.576 0 0 0-0.896-68.736L369.728 512z"
        fill="currentColor" p-id="2346"></path>
    </svg>
  </i>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

const props = defineProps<{
  color?: string,
  size?: string,
  direction?: 'left' | 'right' | 'top' | 'bottom' | 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'
}>()

const style = computed<CSSProperties>(() => {
  const { size, color } = props

  return {
    '--font-size': size || '24px',
    '--color': color || '#FFFFFF',
  }
})
</script>

<style scoped>
.icon {
  color: var(--color);
  width: var(--font-size);
  height: var(--font-size);
  font-size: var(--font-size);
}

.left {
  transform: rotate(0deg);
}

.right {
  transform: scaleX(-1);
}

.top {
  transform: rotate(90deg);
}

.bottom {
  transform: rotate(-90deg);
}

.left-top {
  transform: rotate(45deg);
}

.right-top {
  transform: rotate(-45deg) scaleX(-1);
}

.left-bottom {
  transform: rotate(-45deg);
}

.right-bottom {
  transform: rotate(45deg) scaleX(-1);
}
</style>