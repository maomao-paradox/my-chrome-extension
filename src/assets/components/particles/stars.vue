<template>
    <canvas ref="canvasRef"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

// 类型定义
interface Star {
    orbitRadius: number;
    radius: number;
    orbitX: number;
    orbitY: number;
    timePassed: number;
    speed: number;
    alpha: number;
    draw: () => void;
}

// 组件引用
const canvasRef = ref<HTMLCanvasElement | null>(null);

// 组件状态
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let w: number;
let h: number;
let hue = 217;
let stars: Star[] = [];
let count = 0;
let maxStars = 1200;
let animationFrameId: number;
let canvas2: HTMLCanvasElement;
let ctx2: CanvasRenderingContext2D;

// 随机数生成函数
const random = (min: number, max?: number): number => {
    if (max === undefined) {
        max = min;
        min = 0;
    }

    if (min > max) {
        const hold = max;
        max = min;
        min = hold;
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 计算最大轨道半径
const maxOrbit = (x: number, y: number): number => {
    const max = Math.max(x, y);
    const diameter = Math.round(Math.sqrt(max * max + max * max));
    return diameter / 2;
};

// Star类
class StarImpl implements Star {
    orbitRadius: number;
    radius: number;
    orbitX: number;
    orbitY: number;
    timePassed: number;
    speed: number;
    alpha: number;

    constructor() {
        this.orbitRadius = random(maxOrbit(w, h));
        this.radius = random(60, this.orbitRadius) / 12;
        this.orbitX = w / 2;
        this.orbitY = h / 2;
        this.timePassed = random(0, maxStars);
        this.speed = random(this.orbitRadius) / 50000;
        this.alpha = random(2, 10) / 10;

        count++;
        stars[count] = this;
    }

    draw(): void {
        if (!ctx || !canvas2) return;

        const x = Math.sin(this.timePassed) * this.orbitRadius + this.orbitX;
        const y = Math.cos(this.timePassed) * this.orbitRadius + this.orbitY;
        const twinkle = random(10);

        if (twinkle === 1 && this.alpha > 0) {
            this.alpha -= 0.05;
        } else if (twinkle === 2 && this.alpha < 1) {
            this.alpha += 0.05;
        }

        ctx.globalAlpha = this.alpha;
        ctx.drawImage(canvas2, x - this.radius / 2, y - this.radius / 2, this.radius, this.radius);
        this.timePassed += this.speed;
    }
}

// 动画函数
const animation = () => {
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = `hsla(${hue}, 64%, 6%, 1)`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1, l = stars.length; i < l; i++) {
        stars[i].draw();
    }

    animationFrameId = window.requestAnimationFrame(animation);
};

// 调整画布大小
const resizeCanvas = () => {
    if (canvas) {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
};

// 窗口调整大小事件处理
const handleResize = () => {
    resizeCanvas();
    // 重置星星
    stars = [];
    count = 0;
    for (let i = 0; i < maxStars; i++) {
        new StarImpl();
    }
};

import { useEventListener } from '@/event'

// 监听窗口大小变化
useEventListener(window, 'resize', handleResize)

// 组件挂载
onMounted(() => {
    if (canvasRef.value) {
        canvas = canvasRef.value;
        ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        // 初始化画布大小
        resizeCanvas();

        // 创建缓存画布
        canvas2 = document.createElement('canvas');
        ctx2 = canvas2.getContext('2d') as CanvasRenderingContext2D;
        canvas2.width = 100;
        canvas2.height = 100;
        const half = canvas2.width / 2;
        const gradient2 = ctx2.createRadialGradient(half, half, 0, half, half, half);
        gradient2.addColorStop(0.025, '#fff');
        gradient2.addColorStop(0.1, `hsl(${hue}, 61%, 33%)`);
        gradient2.addColorStop(0.25, `hsl(${hue}, 64%, 6%)`);
        gradient2.addColorStop(1, 'transparent');

        ctx2.fillStyle = gradient2;
        ctx2.beginPath();
        ctx2.arc(half, half, half, 0, Math.PI * 2);
        ctx2.fill();

        // 初始化星星
        for (let i = 0; i < maxStars; i++) {
            new StarImpl();
        }

        // 开始动画
        animation();

        // 添加事件监听
        // window.addEventListener('resize', handleResize);
    }
});

// 组件卸载
onUnmounted(() => {
    // 取消动画
    window.cancelAnimationFrame(animationFrameId);

    // 移除事件监听
    // window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
body {
    background: #060e1b;
    overflow: hidden;
}

/* canvas {
    opacity: 0.5;
} */
</style>