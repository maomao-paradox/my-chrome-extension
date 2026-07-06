// 粒子类型定义
class Particle {
    x: number;
    y: number;
    angle: number;
    speed: number;
    normalSpeed: number;
    oscAmplitudeX: number;
    oscSpeedX: number;
    oscAmplitudeY: number;
    oscSpeedY: number;
    connectDistance: number;
    color: { r: number; g: number; b: number };
    constructor(canvas: HTMLCanvasElement) {
        this.x = canvas.width * 0.5 + (Math.cos(Math.random() * Math.PI * 2) * Math.random() * canvas.width * 0.5);
        this.y = canvas.height * 0.5 + (Math.sin(Math.random() * Math.PI * 2) * Math.random() * canvas.height * 0.5);
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.15;
        this.normalSpeed = Math.random() * 0.15;
        this.oscAmplitudeX = Math.random() * 2;
        this.oscSpeedX = 0.001 + Math.random() * 0.008;
        this.oscAmplitudeY = Math.random() * 2;
        this.oscSpeedY = 0.001 + Math.random() * 0.008;
        this.connectDistance = Math.random() * (canvas.width * 0.05);
        this.color = {
            r: Math.round(200 + Math.random() * 55),
            g: Math.round(150 + Math.random() * 105),
            b: Math.round(200 + Math.random() * 55)
        };
    }
}

class PushParticles extends HTMLElement {
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    animationFrameId: number | null;
    mouseX: number;
    mouseY: number;
    RESOLUTION: number;
    w: number;
    h: number;
    CONNECT_DISTANCE: number;
    FORCE_DISTANCE: number;
    PARTICLE_COUNT: number;
    time: number;
    particles: Particle[];
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // 状态变量
        this.canvas = null;
        this.ctx = null;
        this.animationFrameId = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.RESOLUTION = 1;
        this.w = 0;
        this.h = 0;
        this.CONNECT_DISTANCE = 0;
        this.FORCE_DISTANCE = 0;
        this.PARTICLE_COUNT = 400;
        this.time = 0;
        this.particles = [];
    }

    connectedCallback() {
        // 创建canvas元素
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        // 创建样式
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                position: relative;
                width: 100%;
                height: 100%;
            }
            canvas {
                position: fixed;
                top: 0;
                left: 0;
                display: block;
                width: 100%;
                height: 100%;
                z-index: -1;
                pointer-events: none;
            }
        `;

        // 添加到shadow DOM
        this.shadowRoot!.appendChild(style);
        this.shadowRoot!.appendChild(this.canvas);

        // 初始化
        this.initCanvas();
        this.loop();

        // 添加事件监听器
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    disconnectedCallback() {
        // 清理资源
        cancelAnimationFrame(this.animationFrameId!);
        window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        window.removeEventListener('resize', this.handleResize.bind(this));
    }

    initCanvas() {
        // 初始化尺寸
        this.resizeCanvas();

        // 生成粒子
        this.generateParticles();
    }

    resizeCanvas() {
        this.w = this.canvas!.width = window.innerWidth * this.RESOLUTION;
        this.h = this.canvas!.height = window.innerHeight * this.RESOLUTION;

        // 重新计算距离参数
        this.CONNECT_DISTANCE = this.w * 0.05;
        this.FORCE_DISTANCE = this.w * 0.1;

        // 重新生成粒子
        this.generateParticles();
    }

    generateParticles() {
        this.particles = [];
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            this.particles.push(new Particle(this.canvas!));
        }
    }

    lerp(start: number, end: number, amt: number) {
        return (1 - amt) * start + amt * end;
    }

    distance(x1: number, y1: number, x2: number, y2: number) {
        const a = x1 - x2;
        const b = y1 - y2;
        return Math.sqrt(a * a + b * b);
    }

    angle(cx: number, cy: number, ex: number, ey: number) {
        return Math.atan2(ey - cy, ex - cx);
    }

    update() {
        this.particles.forEach(p1 => {
            p1.x += (Math.cos(p1.angle) + (Math.cos(this.time * p1.oscSpeedX) * p1.oscAmplitudeX)) * p1.speed;
            p1.y += (Math.sin(p1.angle) + (Math.cos(this.time * p1.oscSpeedY) * p1.oscAmplitudeY)) * p1.speed;

            p1.speed = this.lerp(p1.speed, p1.normalSpeed * this.RESOLUTION, 0.1);

            if (p1.x > this.w || p1.x < 0) {
                p1.angle = Math.PI - p1.angle;
            }
            if (p1.y > this.h || p1.y < 0) {
                p1.angle = -p1.angle;
            }

            if (Math.random() < 0.005)
                p1.oscAmplitudeX = Math.random() * 2;
            if (Math.random() < 0.005)
                p1.oscSpeedX = 0.001 + Math.random() * 0.008;
            if (Math.random() < 0.005)
                p1.oscAmplitudeY = Math.random() * 2;
            if (Math.random() < 0.005)
                p1.oscSpeedY = 0.001 + Math.random() * 0.008;

            p1.x = Math.max(-0.01, Math.min(p1.x, this.w + 0.01));
            p1.y = Math.max(-0.01, Math.min(p1.y, this.h + 0.01));
        });
    }

    render() {
        this.ctx!.clearRect(0, 0, this.w, this.h);

        this.particles.forEach(p1 => {
            this.particles
                .filter(p2 => {
                    if (p1 === p2)
                        return false;
                    if (this.distance(p1.x, p1.y, p2.x, p2.y) > p1.connectDistance)
                        return false;
                    return true;
                })
                .map(p2 => {
                    const dist = this.distance(p1.x, p1.y, p2.x, p2.y);
                    p1.speed = this.lerp(p1.speed, p1.speed + (0.05 / p1.connectDistance * dist), 0.2);
                    return {
                        p1,
                        p2,
                        color: p1.color,
                        opacity: Math.floor(100 / p1.connectDistance * (p1.connectDistance - dist)) / 100
                    };
                })
                .forEach((line) => {
                    const colorSwing = Math.sin(this.time * (line.p1.oscSpeedX));
                    this.ctx!.beginPath();
                    this.ctx!.globalAlpha = line.opacity;
                    this.ctx!.moveTo(line.p1.x, line.p1.y);
                    this.ctx!.lineTo(line.p2.x, line.p2.y);
                    this.ctx!.strokeStyle = `rgb(
                        ${Math.floor(line.color.r * colorSwing)},
                        ${Math.floor((line.color.g * 0.5) + ((line.color.g * 0.5) * colorSwing))},
                        ${line.color.b}
                    )`;
                    this.ctx!.lineWidth = line.opacity * 4;
                    this.ctx!.stroke();
                    this.ctx!.closePath();
                });
        });

        // 重置globalAlpha
        this.ctx!.globalAlpha = 1;
    }

    loop() {
        this.time = Date.now() * 0.001;
        this.update();
        this.render();
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    handleMouseMove(e: MouseEvent) {
        this.mouseX = e.clientX * this.RESOLUTION;
        this.mouseY = e.clientY * this.RESOLUTION;

        this.particles.forEach(p => {
            const dist = this.distance(this.mouseX, this.mouseY, p.x, p.y);
            if (dist < this.FORCE_DISTANCE && dist > 0) {
                p.angle = this.angle(this.mouseX, this.mouseY, p.x, p.y);
                const force = (this.FORCE_DISTANCE - dist) * 0.1;
                p.speed = this.lerp(p.speed, force, 0.2);
            }
        });
    }

    handleResize() {
        this.resizeCanvas();
    }
}

// 注册自定义元素
customElements.define('push-particles', PushParticles);
