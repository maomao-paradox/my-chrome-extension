<template>
    <div ref="pointer" class="pointer" :style="mouseStyle">
        <template v-for="(_, index) in 4" :key="index">
            <i class="corner" />
        </template>
    </div>
    <div class="content">
        <p class="_target">HOVER ME</p>
        <p class="_target">鼠标位置: {{ x }} {{ y }}</p>
    </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import { useMouseTracker } from '@/assets/composables/mouse/mouseTracker'

export interface PointerProps {
    color?: string
    size?: string
    cssSelector?: string[]
}

const props = withDefaults(defineProps<PointerProps>(), {
    color: '#1ff700',
    size: '4rem'
})

const { x, y } = useMouseTracker()
const currentElement = ref<HTMLElement | null>(null)
const pointerRef = useTemplateRef<HTMLElement>('pointer')

const mouseStyle = computed(() => {
    let newX = x.value
    let newY = y.value
    if (currentElement.value) {
        const rect = currentElement.value.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        newX = centerX + (x.value - centerX) * 0.1
        newY = centerY + (y.value - centerY) * 0.1
    }
    return {
        '--x': `${newX}px`,
        '--y': `${newY}px`,
    }
})

onMounted(() => {
    const targetElements = [...document.querySelectorAll<HTMLElement>(props.cssSelector?.join(',') || '._target')]
    console.log(targetElements)
    if (props.color) {
        pointerRef.value!.style.setProperty('--color', props.color)
    }
    if (props.size) {
        pointerRef.value!.style.setProperty('--width', props.size)
        pointerRef.value!.style.setProperty('--height', props.size)
    }
    targetElements.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const rect = item.getBoundingClientRect()
            currentElement.value = item
            pointerRef.value!.style.setProperty('--width', rect.width + innerWidth * 0.02 + "px")
            pointerRef.value!.style.setProperty('--height', rect.height + innerHeight * 0.02 + "px")
        })
        item.addEventListener('mouseleave', () => {
            currentElement.value = null
            pointerRef.value!.style.setProperty('--width', "4rem")
            pointerRef.value!.style.setProperty('--height', "4rem")
        })
    })
})
</script>

<style scoped lang="less">
p {
    color: #fff;
    font-size: 2rem;
    font-family: 'Courier New', Courier, monospace;
}

.content {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

._target {
    width: auto;
    height: auto;
    color: rgb(255, 255, 255);
}

.pointer {
    --x: 0;
    --y: 0;
    --width: 4rem;
    --height: 4rem;
    --color: #1ff700;
    margin-left: calc(var(--width) / -2);
    margin-top: calc(var(--height) / -2);
    left: 0;
    top: 0;
    width: var(--width);
    height: var(--height);
    position: fixed;
    transform: translate(var(--x), var(--y));
    transition: all 0.2s ease-out;
    pointer-events: none;

    .corner {
        position: absolute;
        width: 1rem;
        height: 1rem;
        border: 0.3rem solid var(--color);
    }

    .corner:nth-child(1) {
        left: 0;
        top: 0;
        border-right: none;
        border-bottom: none;
    }

    .corner:nth-child(2) {
        right: 0;
        bottom: 0;
        border-top: none;
        border-left: none;
    }

    .corner:nth-child(3) {
        left: 0;
        bottom: 0;
        border-top: none;
        border-right: none;
    }

    .corner:nth-child(4) {
        right: 0;
        top: 0;
        border-left: none;
        border-bottom: none;
    }
}
</style>
