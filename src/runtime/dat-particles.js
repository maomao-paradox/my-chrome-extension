// Vector2 类实现
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    
    lerp(v, t) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }
}

// Perlin 噪声实现
class PerlinNoise {
    constructor() {
        this.p = new Array(512);
        this.perm = new Array(256);
        
        for (let i = 0; i < 256; i++) {
            this.perm[i] = Math.floor(Math.random() * 256);
        }
        
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.perm[i & 255];
        }
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(t, a, b) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    simplex3(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;
        
        return this.lerp(w, 
            this.lerp(v, 
                this.lerp(u, 
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x - 1, y, z)
                ),
                this.lerp(u, 
                    this.grad(this.p[AB], x, y - 1, z),
                    this.grad(this.p[BB], x - 1, y - 1, z)
                )
            ),
            this.lerp(v, 
                this.lerp(u, 
                    this.grad(this.p[AA + 1], x, y, z - 1),
                    this.grad(this.p[BA + 1], x - 1, y, z - 1)
                ),
                this.lerp(u, 
                    this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
                )
            )
        );
    }
}

// 简化的 dat.GUI 实现（仅用于基本功能）
class SimpleGUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #222;
            color: #fff;
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            font-size: 12px;
        `;
        document.body.appendChild(this.container);
    }
    
    add(object, property, ...args) {
        const control = document.createElement('div');
        control.style.marginBottom = '8px';
        
        const label = document.createElement('label');
        label.textContent = property + ': ';
        label.style.display = 'inline-block';
        label.style.width = '100px';
        
        if (typeof object[property] === 'number') {
            const input = document.createElement('input');
            input.type = 'range';
            input.min = args[0] || 0;
            input.max = args[1] || 100;
            input.step = args[2] || 1;
            input.value = object[property];
            
            input.addEventListener('input', (e) => {
                object[property] = parseFloat(e.target.value);
            });
            
            control.appendChild(label);
            control.appendChild(input);
        } else if (typeof object[property] === 'string' && Array.isArray(args[0])) {
            const select = document.createElement('select');
            
            args[0].forEach((option) => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                if (option === object[property]) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
            
            select.addEventListener('change', (e) => {
                object[property] = e.target.value;
            });
            
            control.appendChild(label);
            control.appendChild(select);
        } else if (typeof object[property] === 'function') {
            const button = document.createElement('button');
            button.textContent = property;
            button.style.backgroundColor = '#444';
            button.style.color = '#fff';
            button.style.border = 'none';
            button.style.padding = '5px 10px';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', object[property]);
            
            control.appendChild(button);
        }
        
        this.container.appendChild(control);
        
        // 返回一个支持方法链的对象
        const controlObj = {
            step: (step) => controlObj,
            min: (min) => controlObj,
            max: (max) => controlObj,
            onFinishChange: (callback) => controlObj
        };
        
        return controlObj;
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// 全局变量
const PI = Math.PI;
const TAU = 2 * PI;
const cos = (n) => Math.cos(n);
const sin = (n) => Math.sin(n);

// 初始化全局对象
window.Vector2 = Vector2;
window.noise = new PerlinNoise();
window.dat = { GUI: SimpleGUI };

// Mouse类
class Mouse {
    constructor() {
        this.hover = false;
        // 初始位置设置为画布中心
        this.position = new window.Vector2(0.5 * canvas.width, 0.5 * canvas.height);
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
    constructor(x, y, len, angle, color, parent) {
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

    update() {
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

    draw(ctx) {
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
    constructor(segmentCount, parent, radius, angle, opts, ctx) {
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

    update(opts, ctx) {
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
    constructor(armCount, opts, ctx) {
        this.tick = 0;
        this.arms = [];
        this.armCount = armCount;
        this.velocity = new window.Vector2(0, 0);
        // 初始位置设置为画布中心
        this.position = new window.Vector2(0.5 * canvas.width, 0.5 * canvas.height);
        for (let i = 0; i < this.armCount; i++) {
            this.arms.push(
                new Arm(opts.segmentNum(), this, 50, i / this.armCount * TAU, opts, ctx)
            );
        }
    }

    animate(mouse, opts, ctx) {
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

// 全局变量
let canvas;
let ctx;
let worm = null;
let mouse = null;
let tick = 0;
let animationFrameId;
let gui = null;

// 选项
const opts = {
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
const handleMouseMove = (e) => {
    if (mouse) {
        // 获取组件的位置
        const rect = canvas.getBoundingClientRect();
        // 计算鼠标相对于组件的坐标
        mouse.position.x = e.clientX - rect.left;
        mouse.position.y = e.clientY - rect.top;
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

// 自定义元素类
class DatParticles extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    
    connectedCallback() {
        // 创建canvas元素
        canvas = document.createElement('canvas');
        canvas.className = 'canvas';
        
        // 创建样式
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
                position: relative;
                width: 100%;
                height: 100%;
            }
            .canvas {
                position: absolute;
                width: 100vw;
                height: 100vh;
            }
        `;
        
        // 添加到shadow DOM
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(canvas);
        
        // 初始化
        ctx = canvas.getContext('2d');
        resize();
        mouse = new Mouse();
        worm = new Worm(opts.armCount, opts, ctx);
        initGUI();
        loop();
        
        // 添加事件监听
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseOut);
        window.addEventListener('resize', handleResize);
    }
    
    disconnectedCallback() {
        // 清理事件监听
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseout', handleMouseOut);
        window.removeEventListener('resize', handleResize);
        
        // 取消动画
        window.cancelAnimationFrame(animationFrameId);
        
        // 关闭GUI
        if (gui) {
            gui.destroy();
        }
    }
}

// 注册自定义元素
customElements.define('dat-particles', DatParticles);
