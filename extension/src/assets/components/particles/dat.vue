<template>
    <canvas ref="canvasRef" class="canvas"></canvas>
</template>


<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import '@/libs/Vector2.js';
import '@/libs/perlin.js';
import '@/libs/dat.gui.js';

const PI = Math.PI;
const TAU = 2 * PI;
const cos = (n: number) => Math.cos(n);
const sin = (n: number) => Math.sin(n);

// 声明全局类型
declare global {
    interface Window {
        dat: any;
        Vector2: any;
        noise: any;
    }
}

// 动画类型
interface AnimationType {
    random: () => void;
    moebius: () => void;
    idle: () => void;
}

// 选项类型
interface Opts {
    startHue: number;
    blur: number;
    armCount: number;
    segmentLength: number;
    segmentMin: number;
    segmentMax: number;
    segmentNum: () => number;
    rigidity: number;
    responsiveness: number;
    animation: 'random' | 'moebius' | 'idle';
    reset: () => void;
}

// Mouse类
class Mouse {
    hover: boolean;
    position: any;
    animationTarget: any;
    animate: AnimationType;

    constructor() {
        this.hover = false;
        this.position = new window.Vector2(0.5 * window.innerWidth, 0.5 * window.innerHeight);
        this.animationTarget = new window.Vector2(this.position.x, this.position.y);
        this.animate = {
            random: () => {
                if (tick % 180 === 0) {
                    this.animationTarget.x = Math.random() * canvas.width;
                    this.animationTarget.y = Math.random() * canvas.height;
                }
                this.position.lerp(this.animationTarget, 0.35);
            },
            moebius: () => {
                this.animationTarget.lerp({
                    x: 0.5 * canvas.width + (0.35 * canvas.width) * cos(tick * 0.0125),
                    y: 0.5 * canvas.height + (0.35 * canvas.height) * sin(tick * 0.025)
                }, 0.85);
                this.position.lerp(this.animationTarget, 0.65);
            },
            idle: () => {
                this.animationTarget = new window.Vector2(0.5 * canvas.width, 0.5 * canvas.height);
                this.position.lerp(this.animationTarget, 1);
            }
        };
    }
}

// Segment类
class Segment {
    tick: number;
    jointSize: number;
    parent: any;
    color: string;
    len: number;
    angle: number;
    position: any;
    head: any;

    constructor(x: number, y: number, len: number, angle: number, color: string, parent: any) {
        this.tick = Math.round(Math.random() * 60);
        this.jointSize = Math.random() * 3;
        this.parent = parent;
        this.color = color;
        this.len = len;
        this.angle = angle;
        this.position = new window.Vector2(x + this.len * cos(this.angle), y + this.len * sin(this.angle));
        this.angle = Math.atan2(
            this.parent.position.y - this.position.y,
            this.parent.position.x - this.position.x
        );
        this.head = new window.Vector2(
            this.position.x + this.len * cos(this.angle),
            this.position.y + this.len * sin(this.angle)
        );
    }

    update(): void {
        this.tick++;
        this.angle = Math.atan2(
            this.parent.position.y - this.position.y,
            this.parent.position.x - this.position.x
        );
        this.head.x = this.parent.position.x;
        this.head.y = this.parent.position.y;
        this.position.lerp(
            {
                x: this.head.x - this.len * cos(this.angle),
                y: this.head.y - this.len * sin(this.angle)
            },
            opts.rigidity
        );
        this.position.x += cos(this.tick * 0.05) * 0.35;
        this.position.y += sin(this.tick * 0.05) * 0.35;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.head.x, this.head.y);
        ctx.stroke();
        ctx.closePath();
        ctx.beginPath();
        ctx.arc(this.head.x, this.head.y, this.jointSize, 0, TAU);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }
}

// Arm类
class Arm {
    tick: number;
    parent: any;
    segmentCount: number;
    segments: Segment[];
    radius: number;
    angle: number;

    constructor(segmentCount: number, parent: any, radius: number, angle: number, opts: Opts, ctx: CanvasRenderingContext2D) {
        this.tick = 0;
        this.parent = parent;
        this.segmentCount = segmentCount;
        this.segments = [];
        this.radius = radius;
        this.angle = angle;
        for (let i = 0; i < this.segmentCount; i++) {
            let x = this.segments[i - 1] ? this.segments[i - 1].position.x : parent.position.x;
            let y = this.segments[i - 1] ? this.segments[i - 1].position.y : parent.position.y;
            this.segments.push(
                new Segment(
                    x,
                    y,
                    opts.segmentLength,
                    this.angle,
                    `hsla(${-8 * i + opts.startHue},50%,50%,${1 / (i + 0.1)})`,
                    this.segments[i - 1] || {
                        position: new window.Vector2(parent.position.x, parent.position.y)
                    }
                )
            );
        }
    }

    update(opts: Opts, ctx: CanvasRenderingContext2D): void {
        this.tick++;
        this.radius = 40 + sin(this.tick * 0.05) * 20 + window.noise.simplex3(0, 0, this.tick * 0.0075) * 12;
        for (let i = 0; i < this.segmentCount; i++) {
            this.segments[0].parent.position.x = this.parent.position.x + (this.radius - i * 50) * cos(this.angle + this.tick * 0.0125);
            this.segments[0].parent.position.y = this.parent.position.y + (this.radius - i * 50) * sin(this.angle + this.tick * 0.0125);
            this.segments[i].update();
            this.segments[this.segments.length - i - 1].draw(ctx);
        }
    }
}

// Worm类
class Worm {
    tick: number;
    arms: Arm[];
    armCount: number;
    velocity: any;
    position: any;

    constructor(armCount: number, opts: Opts, ctx: CanvasRenderingContext2D) {
        this.tick = 0;
        this.arms = [];
        this.armCount = armCount;
        this.velocity = new window.Vector2(0, 0);
        this.position = new window.Vector2(0.5 * window.innerWidth, 0.5 * window.innerHeight);
        for (let i = 0; i < this.armCount; i++) {
            this.arms.push(
                new Arm(opts.segmentNum(), this, 50, i / this.armCount * TAU, opts, ctx)
            );
        }
    }

    animate(mouse: Mouse, opts: Opts, ctx: CanvasRenderingContext2D): void {
        this.tick++;
        this.velocity.lerp(
            {
                x: cos(window.noise.simplex3(this.position.x * 0.0015, this.position.y * 0.0015, this.tick * 0.0015) * TAU) * 4,
                y: sin(window.noise.simplex3(this.position.x * 0.0015, this.position.y * 0.0015, this.tick * 0.0015) * TAU) * 4
            },
            0.0175
        );
        this.position.add(this.velocity);
        this.position.lerp(mouse.position, 0.05 * opts.responsiveness);
        for (let i = 0; i < this.armCount; i++) {
            this.arms[i].update(opts, ctx);
        }
    }
}

// 组件引用
const canvasRef = ref<HTMLCanvasElement | null>(null);

// 组件状态
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let worm: Worm | null = null;
let mouse: Mouse | null = null;
let tick = 0;
let animationFrameId: number;
let gui: any = null;

// 选项
const opts: Opts = {
    startHue: 270,
    blur: 0.1,
    armCount: 32,
    segmentLength: 20,
    segmentMin: 6,
    segmentMax: 18,
    segmentNum: () => Math.round(Math.random() * (opts.segmentMax - opts.segmentMin) + opts.segmentMin),
    rigidity: 0.9,
    responsiveness: 0.3,
    animation: 'idle',
    reset: () => {
        if (canvas && ctx) {
            worm = new Worm(opts.armCount, opts, ctx);
        }
    }
};

// 初始化GUI
const initGUI = () => {
    if (window.dat) {
        gui = new window.dat.GUI();
        gui.add(opts, 'animation', ['random', 'moebius', 'idle']);
        gui.add(opts, 'rigidity').step(0.1).min(0.1).max(1);
        gui.add(opts, 'responsiveness').step(0.1).min(0.1).max(2);
        gui.add(opts, 'startHue').step(1).min(0).max(360).onFinishChange(() => {
            if (canvas && ctx) {
                worm = new Worm(opts.armCount, opts, ctx);
            }
        });
        gui.add(opts, 'blur').step(0.1).min(0).max(0.9);
        gui.add(opts, 'armCount').step(1).min(4).max(48).onFinishChange(() => {
            if (canvas && ctx) {
                worm = new Worm(opts.armCount, opts, ctx);
            }
        });
        gui.add(opts, 'segmentLength').step(1).min(5).max(40).onFinishChange(() => {
            if (canvas && ctx) {
                worm = new Worm(opts.armCount, opts, ctx);
            }
        });
        gui.add(opts, 'segmentMin').step(1).min(2).max(12).onFinishChange(() => {
            if (canvas && ctx) {
                worm = new Worm(opts.armCount, opts, ctx);
            }
        });
        gui.add(opts, 'segmentMax').step(1).min(2).max(28).onFinishChange(() => {
            if (canvas && ctx) {
                worm = new Worm(opts.armCount, opts, ctx);
            }
        });
        gui.add(opts, 'reset');
    }
};

// 调整画布大小
const resize = () => {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
};

// 绘制函数
const draw = () => {
    if (canvas && ctx && mouse && worm) {
        ctx.fillStyle = `hsla(240,30%,1%,${1 - opts.blur})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!mouse.hover) {
            mouse.animate[opts.animation]();
        }
        worm.animate(mouse, opts, ctx);
    }
};

// 动画循环
const loop = () => {
    tick++;
    draw();
    animationFrameId = window.requestAnimationFrame(loop);
};

// 鼠标移动事件处理
const handleMouseMove = (e: MouseEvent) => {
    if (mouse) {
        mouse.position.x = e.clientX;
        mouse.position.y = e.clientY;
        mouse.hover = true;
    }
};

// 鼠标离开事件处理
const handleMouseOut = () => {
    if (mouse) {
        mouse.hover = false;
    }
};

// 窗口调整大小事件处理
const handleResize = () => {
    resize();
};

import { useEventListener } from '@/event'

// 监听窗口大小变化
useEventListener(window, new Map([
    ['resize', handleResize],
    ['mousemove', handleMouseMove],
    ['mouseout', handleMouseOut],
]))


// 组件挂载
onMounted(() => {
    if (canvasRef.value) {
        canvas = canvasRef.value;
        ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        resize();
        mouse = new Mouse();
        worm = new Worm(opts.armCount, opts, ctx);
        initGUI();
        loop();
    }
});

// 组件卸载
onUnmounted(() => {
    // 取消动画
    window.cancelAnimationFrame(animationFrameId);

    // 关闭GUI
    if (gui) {
        gui.destroy();
    }
});
</script>

<style scoped>
body {
    background: #020203;
}

.canvas {
    position: absolute;
    width: 100vw;
    height: 100vh;
}

.codepen-link {
    position: absolute;
    bottom: 30px;
    right: 30px;
    height: 40px;
    width: 40px;
    z-index: 10;
    border-radius: 50%;
    box-sizing: border-box;
    background-image: url("https://s3-us-west-2.amazonaws.com/s.cdpn.io/544318/logo.jpg");
    background-position: center center;
    background-size: cover;
    opacity: 0.5;
    -webkit-transition: all 0.25s;
    transition: all 0.25s;
}

.codepen-link:hover {
    opacity: 0.8;
    box-shadow: 0 0 6px #efefef;
}
</style>