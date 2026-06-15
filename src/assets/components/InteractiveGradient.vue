<template>
    <!-- SVG Filters Definition -->
    <!-- 永远纠缠在一起吧 头发 命运 我和你 -->
    <svg xmlns="http://www.w3.org/2000/svg"
        style="position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none;">
        <defs>
            <filter id="goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                    result="goo" />
                <feBlend in="SourceGraphic" in2="goo" />
            </filter>
            <filter id='noiseFilter'>
                <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='6' stitchTiles='stitch' />
            </filter>
            <filter id='noiseFilterBg'>
                <feTurbulence type='fractalNoise' baseFrequency='0.6' stitchTiles='stitch' />
            </filter>
        </defs>
    </svg>

    <!-- 标题：卡片上方 -->
    <div class="top-title">
        <slot name="title"> </slot>
    </div>
    <div class="card">
        <svg viewBox="0 0 100% 100%" xmlns='http://www.w3.org/2000/svg' class="noise">
            <rect width='100%' height='100%' preserveAspectRatio="xMidYMid meet" filter='url(#noiseFilter)' />
        </svg>
        <div class="content">
            <slot name="content">
                <h1>Interactive Gradient</h1>
                <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Ipsum tempore unde ex pariatur distinctio
                    laboriosam, dolorem quibusdam aperiam expedita consequuntur dolorum porro vitae earum quos
                    voluptates et maxime. Tempora, mollitia.</p>
            </slot>
        </div>
    </div>

    <div class="gradient-bg">
        <svg viewBox="0 0 100vw 100vw" xmlns='http://www.w3.org/2000/svg' class="noiseBg">
            <rect width='100%' height='100%' preserveAspectRatio="xMidYMid meet" filter='url(#noiseFilterBg)' />
        </svg>
        <div class="gradients-container">
            <div class="g1"></div>
            <div class="g2"></div>
            <div class="g3"></div>
            <div class="g4"></div>
            <div class="g5"></div>
            <div ref="interactiveBubble" class="interactive"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMouseTracker } from '@/assets/composables/mouse/mouseTracker'

const curX = ref(0)
const curY = ref(0)

const { x: tgX, y: tgY } = useMouseTracker()

const interactiveBubble = ref<HTMLDivElement>()

const move = () => {
    curX.value += (tgX.value - curX.value) / 20;
    curY.value += (tgY.value - curY.value) / 20;
    //@ts-ignore
    interactiveBubble.value.style.transform = `translate(${Math.round(curX.value)}px, ${Math.round(curY.value)}px)`;
    requestAnimationFrame(move);
};
onMounted(() => {
    if (!interactiveBubble.value || interactiveBubble.value === void 0) {
        maLogger.error('Interactive element not found');
        return;
    }
    move();
    maLogger.log('Interactive gradient initialized');
});
</script>

<style>
@import url("https://fonts.googleapis.com/css?family=Montserrat:400,700");

:root {
    --color-bg1: rgb(8, 10, 15);
    --color-bg2: rgb(0, 17, 32);
    --color1: 18, 113, 255;
    --color2: 107, 74, 255;
    --color3: 100, 100, 255;
    --color4: 50, 160, 220;
    --color5: 80, 47, 122;
    --color-interactive: 140, 100, 255;
    --circle-size: 80%;
    --blending: hard-light;
}

* {
    margin: 0;
    padding: 0;
    outline: none;
    list-style: none;
    text-decoration: none;
    box-sizing: border-box;
    color: #FFF;
    background: transparent;
    border: none;
}

html,
body {
    font-family: "Dongle", sans-serif;
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
}

body {
    background: #FFF;
    font-family: "Montserrat", sans-serif;
    overflow: hidden;
}

h1,
h2,
h3 {
    font-family: "Montserrat", sans-serif;
    font-weight: 700;
}
</style>

<style scoped>
.top-title {
    position: absolute;
    z-index: 10;
    top: 25%;
    left: 50%;
    transform: translate(-50%, -50%);
    user-select: none;
    /* max-width: 600px; */
    padding: 48px;
    /* -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px); */
    /* border-radius: 8px; */
    /* box-shadow: 0 4px 90px rgba(0, 0, 0, 0.1); */
    overflow: hidden;
}

.card {
    position: absolute;
    z-index: 10;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    user-select: none;
    max-width: 600px;
    padding: 48px;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    box-shadow: 0 4px 90px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.card:before {
    content: "";
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: white;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, white 34%, white 89%, rgba(255, 255, 255, 0) 100%);
    opacity: 0.3;
    filter: blur(0.5px);
    mix-blend-mode: hard-light;
}

.card .noise {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    z-index: 1;
    opacity: 0.1;
}

.card .content {
    position: relative;
    z-index: 2;
    text-shadow: -3px 0px 2px rgba(0, 0, 0, 0.1);
}

h1 {
    font-size: 3rem;
    margin-bottom: 16px;
}

p {
    line-height: 1.6;
}

@keyframes moveInCircle {
    0% {
        transform: rotate(0deg);
    }

    50% {
        transform: rotate(180deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

@keyframes moveVertical {
    0% {
        transform: translateY(-50%);
    }

    50% {
        transform: translateY(50%);
    }

    100% {
        transform: translateY(-50%);
    }
}

@keyframes moveHorizontal {
    0% {
        transform: translateX(-50%) translateY(-10%);
    }

    50% {
        transform: translateX(50%) translateY(10%);
    }

    100% {
        transform: translateX(-50%) translateY(-10%);
    }
}

.gradient-bg {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: linear-gradient(40deg, var(--color-bg1), var(--color-bg2));
    top: 0;
    left: 0;
}

/* SVG filters are now defined in a hidden SVG element */

.gradient-bg .noiseBg {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    mix-blend-mode: soft-light;
    opacity: 0.3;
}

.gradient-bg .gradients-container {
    filter: url(#goo) blur(40px);
    width: 100%;
    height: 100%;
}

.gradient-bg .g1 {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color1), 0.8) 0, rgba(var(--color1), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: var(--circle-size);
    height: var(--circle-size);
    top: calc(50% - var(--circle-size) / 2);
    left: calc(50% - var(--circle-size) / 2);
    transform-origin: center center;
    animation: moveVertical 30s ease infinite;
    opacity: 1;
}

.gradient-bg .g2 {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color2), 0.8) 0, rgba(var(--color2), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: var(--circle-size);
    height: var(--circle-size);
    top: calc(50% - var(--circle-size) / 2);
    left: calc(50% - var(--circle-size) / 2);
    transform-origin: calc(50% - 400px);
    animation: moveInCircle 20s reverse infinite;
    opacity: 1;
}

.gradient-bg .g3 {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color3), 0.8) 0, rgba(var(--color3), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: var(--circle-size);
    height: var(--circle-size);
    top: calc(50% - var(--circle-size) / 2 + 200px);
    left: calc(50% - var(--circle-size) / 2 - 500px);
    transform-origin: calc(50% + 400px);
    animation: moveInCircle 40s linear infinite;
    opacity: 1;
}

.gradient-bg .g4 {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color4), 0.8) 0, rgba(var(--color4), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: var(--circle-size);
    height: var(--circle-size);
    top: calc(50% - var(--circle-size) / 2);
    left: calc(50% - var(--circle-size) / 2);
    transform-origin: calc(50% - 200px);
    animation: moveHorizontal 40s ease infinite;
    opacity: 0.7;
}

.gradient-bg .g5 {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color5), 0.8) 0, rgba(var(--color5), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: calc(var(--circle-size) * 2);
    height: calc(var(--circle-size) * 2);
    top: calc(50% - var(--circle-size));
    left: calc(50% - var(--circle-size));
    transform-origin: calc(50% - 800px) calc(50% + 200px);
    animation: moveInCircle 20s ease infinite;
    opacity: 1;
}

.gradient-bg .interactive {
    position: absolute;
    background: radial-gradient(circle at center, rgba(var(--color-interactive), 0.8) 0, rgba(var(--color-interactive), 0) 50%) no-repeat;
    mix-blend-mode: var(--blending);
    width: 100%;
    height: 100%;
    top: -50%;
    left: -50%;
    opacity: 0.7;
}
</style>
