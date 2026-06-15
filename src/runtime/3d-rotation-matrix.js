// 3D Rotation Matrix Web Component
class RotationMatrix3D extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // 初始化变量
        this.dotCount = 100;
        this.canvas = null;
        this.ctx = null;
        this.dots = [];
        this.pointsRange = 0;
        this.baseDotRadius = 0;
        this.maxLineDistance = 0;
        this.xcenter = 0;
        this.ycenter = 0;
        this.alpha = 0;
        this.beta = 0;
        this.gamma = 0;
        this.betaScrollAddition = 0;
        this.gammaScrollAddition = 0;
        this.timedAngleAddition = 0;
        this.animationFrameId = null;
    }

    connectedCallback() {
        // 创建模板
        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    // pointer-events: none;
                }
                canvas {
                    height: 100%;
                    left: 0;
                    position: absolute;
                    top: 0;
                    width: 100%;
                    // pointer-events: none;
                }
                .page-wrap {
                    position: relative;
                    pointer-events: none;
                    text-align: center;
                    color: #fff;
                    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif;
                    font-weight: 100;
                    z-index: 1;
                }
                h1 {
                    font-size: 22px;
                }
                p {
                    font-size: 13px;
                }
            </style>
            <canvas id="canvas"></canvas>
            <div class="page-wrap">
                <h1>3D Rotation Matrix</h1>
                <p>(move your mouse)</p>
            </div>
        `;

        // 克隆模板内容到shadow DOM
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // 初始化画布
        this.canvas = this.shadowRoot.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // 创建点
        this.createDots();

        // 添加事件监听器
        this.shadowRoot.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));

        // 开始渲染
        this.render();
    }

    disconnectedCallback() {
        // 清理事件监听器
        this.shadowRoot.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        window.removeEventListener('resize', this.handleResize.bind(this));

        // 取消动画
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.pointsRange = Math.min(window.innerWidth, window.innerHeight);
        this.baseDotRadius = (this.pointsRange > 300) ? 3 : 1.5;
        this.maxLineDistance = this.pointsRange / 2;
        this.xcenter = this.ctx.canvas.width / 2;
        this.ycenter = (this.ctx.canvas.height / 2);
    }

    randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    createDots() {
        this.dots = [];
        for (let i = 0; i < this.dotCount; i++) {
            this.dots.push(this.createDot());
        }
    }

    // 创建Dot对象
    createDot(x = null, y = null, z = null) {
        const self = this; // 保存RotationMatrix3D实例的引用
        return {
            radius: self.baseDotRadius,
            opacity: 1,
            position: {
                x: x || self.randomRange(-self.pointsRange, self.pointsRange),
                y: y || self.randomRange(-self.pointsRange, self.pointsRange),
                z: z || self.randomRange(-self.pointsRange, self.pointsRange),
            },
            initialPosition: {
                x: x || self.randomRange(-self.pointsRange, self.pointsRange),
                y: y || self.randomRange(-self.pointsRange, self.pointsRange),
                z: z || self.randomRange(-self.pointsRange, self.pointsRange),
            },
            update: function () {
                // z position
                let one = this.initialPosition.x * -Math.sin(self.beta);
                let two = this.initialPosition.y * Math.cos(self.beta) * Math.sin(self.gamma);
                let three = this.initialPosition.z * Math.cos(self.beta) * Math.cos(self.gamma);
                this.position.z = one + two + three;

                // "Depth of field" variables based on z-position
                let zPercentage = this.position.z / self.pointsRange;
                this.radius = self.baseDotRadius + ((self.baseDotRadius / 3) * zPercentage);
                this.opacity = 0.5 + ((zPercentage + 1) / 4);
                let depthOfFieldMultiplier = ((zPercentage + 1) / 2) + 0.5;

                // x position
                one = this.initialPosition.x * Math.cos(self.alpha) * Math.cos(self.beta);
                two = this.initialPosition.y * ((Math.cos(self.alpha) * Math.sin(self.beta) * Math.sin(self.gamma)) - (Math.sin(self.alpha) * Math.cos(self.gamma)));
                three = this.initialPosition.z * ((Math.cos(self.alpha) * Math.sin(self.beta) * Math.cos(self.gamma)) + (Math.sin(self.alpha) * Math.sin(self.gamma)));
                this.position.x = (one + two + three) * depthOfFieldMultiplier;

                // y position
                one = this.initialPosition.x * Math.sin(self.alpha) * Math.cos(self.beta);
                two = this.initialPosition.y * ((Math.sin(self.alpha) * Math.sin(self.beta) * Math.sin(self.gamma)) + (Math.cos(self.alpha) * Math.cos(self.gamma)));
                three = this.initialPosition.z * ((Math.sin(self.alpha) * Math.sin(self.beta) * Math.cos(self.gamma)) - (Math.cos(self.alpha) * Math.sin(self.gamma)));
                this.position.y = (one + two + three) * depthOfFieldMultiplier;
            }
        };
    }

    render() {
        this.timedAngleAddition += 0.2 * Math.PI / 180;
        this.beta = this.timedAngleAddition + this.betaScrollAddition;
        this.gamma = this.timedAngleAddition + this.gammaScrollAddition;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制点
        this.dots.forEach((dot, index) => {
            // 更新点的位置和半径
            dot.update();

            this.ctx.translate(this.xcenter + dot.position.x, this.ycenter + dot.position.y);

            // 绘制线条
            for (let i = index; i < this.dots.length; i++) {
                // 使用距离公式计算点之间的距离
                let distance = Math.sqrt(Math.pow(this.dots[i].position.x - dot.position.x, 2) + Math.pow(this.dots[i].position.y - dot.position.y, 2) + Math.pow(this.dots[i].position.z - dot.position.z, 2));
                if (distance < this.maxLineDistance) {
                    // 使用距离影响透明度
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeStyle = 'rgba(57, 136, 100, ' + ((1 - (distance / this.maxLineDistance)) / 2) + ')';
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, 0);
                    this.ctx.lineTo(this.dots[i].position.x - dot.position.x, this.dots[i].position.y - dot.position.y);
                    this.ctx.stroke();
                }
            }

            // 绘制点
            this.ctx.fillStyle = 'rgba(27, 136, 252, ' + dot.opacity + ')';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, dot.radius, 0, 2 * Math.PI);
            this.ctx.fill();

            // 重置变换矩阵
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        });

        // 循环绘制
        this.animationFrameId = requestAnimationFrame(this.render.bind(this));
    }

    handleMouseMove(e) {
        let rect = this.shadowRoot.host.getBoundingClientRect();
        let percentageX = (e.clientX - rect.left) / rect.width;
        let percentageY = (e.clientY - rect.top) / rect.height;
        this.betaScrollAddition = (percentageX * 2 * Math.PI) - Math.PI;
        this.gammaScrollAddition = -(percentageY * 2 * Math.PI) - Math.PI;
    }

    handleResize() {
        this.resizeCanvas();
        this.createDots();
    }
}

// 注册自定义元素
customElements.define('rotation-matrix-3d', RotationMatrix3D);
