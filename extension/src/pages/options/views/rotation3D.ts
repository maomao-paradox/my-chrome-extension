// Rotation3D.ts
import $ from "jquery";

interface Point {
  x: number;
  y: number;
}

interface Rotation3DOptions {
  id: string;
  xRadius?: number;
  yRadius?: number;
  farScale?: number;
  xs?: number;
  ys?: number;
  xr?: number;
  yr?: number;
  autoPlay?: boolean;
  autoPlayDelay?: number;
  currenIndex?: number;
  fps?: number;
  speed?: number;
}

interface CircleMathContext {
  farScale: number;
  itemWidth: number;
  xs: number;
  xr: number;
  ys: number;
  yr: number;
  $rotation: JQuery;
  $item: JQuery;
}

const cancelFrame = window.cancelAnimationFrame;
const requestFrame = window.requestAnimationFrame;

const time = !window.performance || !window.performance.now
  ? (): number => +new Date()
  : (): number => performance.now();

const distance = (points: Point[]): number => {
  const p1 = points[0];
  const p2 = points[1];
  const a = p2.x - p1.x;
  const b = p2.y - p1.y;
  return Math.sqrt(a * a + b * b);
};

/**
 * 圆公式
 */
const circleMath = {
  /**
   * 根据弧度计算角度
   */
  parseRotate: (rotation: number, self: CircleMathContext): number => {
    const sin = Math.sin(rotation);
    const cos = Math.cos(rotation);
    const sin_cos = sin * cos;
    const angle = (180 / Math.PI) * rotation - 180;
    return angle + self.yr * (sin_cos / (Math.PI + 1));
  },

  /**
   * 计算scale,x,y
   */
  parseSXY: (rotation: number, self: CircleMathContext) => {
    const { farScale, itemWidth, xs, xr, ys, yr } = self;
    const sin = Math.sin(rotation);
    const cos = Math.cos(rotation);
    const scale = farScale + (1 - farScale) * (sin + 1) * 0.5;

    const x = xs + cos * xr - itemWidth * 0.5;
    const y = ys + sin * yr - itemWidth * 0.5;

    const distanceNumber = distance([
      {
        x: self.$rotation.width() / 2 - self.$item.width() / 2,
        y: self.$rotation.height() / 2 - self.$item.height() / 2,
      },
      { x, y },
    ]);

    return { x, y, scale, distanceNumber };
  },
};

class Rotation3D {
  // DOM 元素
  private $rotation: JQuery;
  private $lineList: JQuery;
  private $item: JQuery;
  private $line: JQuery;

  // 尺寸属性
  private itemWidth: number;
  private itemHeight: number;
  private length: number;

  // 旋转状态
  private rotation: number = Math.PI / 2;
  private destRotation: number = Math.PI / 2;

  // 配置选项
  private farScale: number = 1;
  private xs: number = 0;
  private ys: number = 0;
  private xr: number = 0;
  private yr: number = 0;
  private autoPlay: boolean = false;
  private autoPlayDelay: number = 3000;
  private currenIndex: number = -1;
  private fps: number = 30;
  private speed: number = 4;

  // 定时器
  private autoPlayTimer?: number | NodeJS.Timeout;
  private timer?: number | NodeJS.Timeout;

  // 动画帧
  private lastTime: number = 0;

  // 缩放适配相关
  private resizeObserver?: ResizeObserver;

  constructor(opts: Rotation3DOptions) {
    this.$rotation = $(opts.id);
    this.$lineList = this.$rotation.find(".lineList");
    this.$item = this.$rotation.find(".rotation3D__item");
    this.$line = this.$rotation.find(".rotation3D__line");

    this.itemWidth = this.$item.width() || 0;
    this.itemHeight = this.$item.height() || 0;
    this.length = this.$item.length;

    const xr = this.$rotation.width() * 0.5;
    const yr = this.$rotation.height() * 0.5;
    const xRadius = opts.xRadius || 0;
    const yRadius = opts.yRadius || 0;

    // 合并配置
    Object.assign(this, {
      farScale: opts.farScale || 1,
      xs: xr,
      ys: yr,
      xr: xr - xRadius,
      yr: yr - yRadius,
      autoPlay: opts.autoPlay || false,
      autoPlayDelay: opts.autoPlayDelay || 3000,
      currenIndex: opts.currenIndex || -1,
      fps: opts.fps || 30,
      speed: opts.speed || 4,
    });

    // 处理缩放适配
    this.handleResize();

    // 初始化事件
    this.initEvents();
    this.onAutoPlay();
    this.onDrag();
    this.render();
  }

  /**
   * 处理窗口缩放适配 - 核心方法
   */
  private handleResize(): void {
    // 方案1: 使用 ResizeObserver 监听容器变化
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDimensions();
        this.render();
      });
      this.resizeObserver.observe(this.$rotation[0]);
    }

    // 方案2: 监听窗口缩放变化
    const mediaQuery = window.matchMedia('(resolution: 1dppx)');
    const handleZoomChange = () => {
      this.updateDimensions();
      this.render();
    };

    // 使用 matchMedia 监听缩放变化
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleZoomChange);
    }

    // 方案3: 使用 ResizeObserver 的 fallback
    window.addEventListener('resize', () => {
      this.updateDimensions();
      this.render();
    });

    // 关键：在缩放后重新计算
    this.updateDimensions();
  }

  /**
   * 更新尺寸 - 解决缩放溢出问题
   */
  private updateDimensions(): void {
    const rotationEl = this.$rotation[0];
    const rect = rotationEl.getBoundingClientRect();

    // 获取父容器可用高度，避免溢出
    const parent = rotationEl.parentElement;
    let availableHeight = window.innerHeight;
    let availableWidth = window.innerWidth;

    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      // 考虑父容器的 padding
      const parentStyle = window.getComputedStyle(parent);
      const paddingTop = parseFloat(parentStyle.paddingTop) || 0;
      const paddingBottom = parseFloat(parentStyle.paddingBottom) || 0;
      const paddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(parentStyle.paddingRight) || 0;

      availableHeight = parentRect.height - paddingTop - paddingBottom;
      availableWidth = parentRect.width - paddingLeft - paddingRight;
    }

    // 如果容器溢出，重新计算尺寸
    if (rect.height > availableHeight || rect.width > availableWidth) {
      // 缩小尺寸以适应容器
      const scaleX = availableWidth / rect.width;
      const scaleY = availableHeight / rect.height;
      const scale = Math.min(scaleX, scaleY, 1);

      // 更新半径等参数
      const newXr = this.xr * scale;
      const newYr = this.yr * scale;
      this.xr = newXr;
      this.yr = newYr;

      // 更新中心点
      this.xs = availableWidth / 2;
      this.ys = availableHeight / 2;

      // 更新容器尺寸
      this.$rotation.css({
        width: availableWidth,
        height: availableHeight,
        overflow: 'hidden', // 关键：防止溢出
      });
    }

    // 更新 item 尺寸
    this.itemWidth = this.$item.width() || 0;
    this.itemHeight = this.$item.height() || 0;
  }

  /**
   * 初始化点击事件
   */
  private initEvents(): void {
    const self = this;
    this.$item.each(function (index: number) {
      $(this).on('click', function () {
        $(this).addClass('active').siblings().removeClass('active');
        self.goTo(index);
      });
    });

    // hover 控制自动播放
    this.$rotation.on('mouseenter', function () {
      clearInterval(self.autoPlayTimer as number);
    });
    this.$rotation.on('mouseleave', function () {
      self.onAutoPlay();
    });
  }

  /**
   * item样式
   */
  private itemStyle($item: JQuery, index: number, rotation: number): void {
    const parseSXY = circleMath.parseSXY(rotation, {
      farScale: this.farScale,
      itemWidth: this.itemWidth,
      xs: this.xs,
      xr: this.xr,
      ys: this.ys,
      yr: this.yr,
      $rotation: this.$rotation,
      $item: this.$item,
    });

    const { scale, x, y, distanceNumber } = parseSXY;
    const $line = this.$lineList.find('.rotation3D__line').eq(index);

    // 设置当前子菜单的位置
    $item.find('.scale').css({
      transform: `scale(${scale})`,
    });

    $item.css({
      position: 'absolute',
      display: 'inline-block',
      'z-index': parseInt(String(scale * 100)),
      'transform-origin': '0px 0px',
      transform: `translate(${x}px, ${y}px)`,
    });

    // 线样式
    $line.css({
      height: distanceNumber,
    });
    $line.find('svg').css({
      height: distanceNumber,
    });
    $line.find('.dot1').css({
      'offset-path': `path("M0 ${distanceNumber}, 0 0")`,
    });
    $line.find('#path1').attr({
      d: `M0 ${distanceNumber}, 0 0`,
    });

    $line.find('.dot2').css({
      'offset-path': `path("M0 ${distanceNumber / 2}, 0 0")`,
    });
    $line.find('#path2').attr({
      d: `M0 ${distanceNumber}, 0 0`,
    });

    $line.find('.dot3').css({
      'offset-path': `path("M20 ${distanceNumber} S 0 ${distanceNumber / 2}, 20 0")`,
    });
    $line.find('#path3').attr({
      d: `M20 ${distanceNumber} S 0 ${distanceNumber / 2}, 20 0`,
    });

    $line.find('.dot4').css({
      'offset-path': `path("M20 0 S 40 ${distanceNumber / 2}, 20 ${distanceNumber}")`,
    });
    $line.find('#path4').attr({
      d: `M20 0 S 40 ${distanceNumber / 2}, 20 ${distanceNumber}`,
    });
  }

  /**
   * line样式
   */
  private lineStyle($line: JQuery, index: number, rotation: number): void {
    const rotate = circleMath.parseRotate(rotation, {
      farScale: this.farScale,
      itemWidth: this.itemWidth,
      xs: this.xs,
      xr: this.xr,
      ys: this.ys,
      yr: this.yr,
      $rotation: this.$rotation,
      $item: this.$item,
    });

    $line.css({
      transform: `rotate(${rotate}deg)`,
    });
  }

  /**
   * 旋转至index
   */
  public goTo(index: number): void {
    this.currenIndex = index;

    // 计算floatIndex
    const itemsRotated =
      (this.length * (Math.PI / 2 - this.rotation)) / (2 * Math.PI);
    let floatIndex = itemsRotated % this.length;
    if (floatIndex < 0) {
      floatIndex += this.length;
    }

    // 计算diff
    let diff = index - (floatIndex % this.length);
    if (2 * Math.abs(diff) > this.length) {
      diff -= diff > 0 ? this.length : -this.length;
    }

    this.destRotation += ((2 * Math.PI) / this.length) * -diff;
    this.scheduleNextFrame();
  }

  /**
   * 定时器渐近旋转
   */
  private scheduleNextFrame(): void {
    const self = this;
    this.lastTime = time();

    const pause = (): void => {
      if (cancelFrame) {
        cancelFrame(this.timer as number);
      } else {
        clearTimeout(this.timer as number);
      }
      this.timer = 0;
    };

    const playFrame = (): void => {
      const rem = self.destRotation - self.rotation;
      const now = time();
      const dt = (now - self.lastTime) * 0.002;
      self.lastTime = now;

      if (Math.abs(rem) < 0.003) {
        self.rotation = self.destRotation;
        pause();
      } else {
        self.rotation = self.destRotation - rem / (1 + self.speed * dt);
        self.scheduleNextFrame();
      }
      self.render();
    };

    this.timer = cancelFrame
      ? requestFrame(playFrame)
      : setTimeout(playFrame, 1000 / this.fps);
  }

  /**
   * 更新
   */
  private render(): void {
    const self = this;
    const spacing = (2 * Math.PI) / this.$item.length;
    let itemRotation = this.rotation;
    let lineRotation = this.rotation + Math.PI / 2;

    this.$item.each(function (index: number) {
      self.itemStyle($(this), index, itemRotation);
      itemRotation += spacing;
    });

    this.$line.each(function (index: number) {
      self.lineStyle($(this), index, lineRotation);
      lineRotation += spacing;
    });
  }

  /**
   * 自动播放
   */
  private onAutoPlay(): void {
    if (this.autoPlay) {
      this.autoPlayTimer = setInterval(() => {
        if (this.currenIndex < 0) {
          this.currenIndex = this.length - 1;
        }
        this.goTo(this.currenIndex);
        this.currenIndex--;
      }, this.autoPlayDelay);
    }
  }

  /**
   * 拖拽
   */
  private onDrag(): void {
    const self = this;
    let startX: number, startY: number;
    let moveX: number = 0,
      moveY: number = 0;

    this.$rotation.on('mousedown', function (e) {
      startX = e.pageX;
      startY = e.pageY;

      $(document).on('mousemove', function (e) {
        const endX = e.pageX;
        const endY = e.pageY;
        moveX = endX - startX;
        moveY = endY - startY;
      });

      $(document).on('mouseup', function () {
        const moveIndex = parseInt(String(Math.abs(moveX) / 50));
        if (moveIndex > 0) {
          if (moveX < 0) {
            self.currenIndex = self.currenIndex - moveIndex;
          } else {
            self.currenIndex = self.currenIndex + moveIndex;
          }
          self.play();
        }

        $(document).off('mousemove');
        $(document).off('mouseup');
      });
    });
  }

  private play(): void {
    if (this.currenIndex === 0) {
      this.currenIndex = this.length - 1;
    }
    this.goTo(this.currenIndex % this.length);
  }

  /**
   * 销毁方法 - 清理资源
   */
  public destroy(): void {
    // 清理定时器
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer as number);
    }
    if (this.timer) {
      if (cancelFrame) {
        cancelFrame(this.timer as number);
      } else {
        clearTimeout(this.timer as number);
      }
    }

    // 清理 ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // 解绑事件
    this.$rotation.off();
    $(document).off('mousemove');
    $(document).off('mouseup');
  }
}

export default Rotation3D;