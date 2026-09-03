interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
}

export const Rain = () => {
  // ---------- DOM 与 Canvas 初始化 ----------
  const canvas = document.getElementById("rainCanvas") as HTMLCanvasElement;
  const ctx = canvas?.getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) {
    return;
  }

  const CANVAS_WIDTH = canvas.width;
  const CANVAS_HEIGHT = canvas.height;

  // ---------- 参数配置 ----------
  const CONFIG = {
    RAIN_COUNT: 300,
    RAIN_MIN_LENGTH: 15,
    RAIN_MAX_LENGTH: 30,
    RAIN_MIN_SPEED: 8,
    RAIN_MAX_SPEED: 16,
    RAIN_BASE_OPACITY: 0.35,
    RAIN_COLOR: "180, 215, 255",

    // 雷电参数 - 降低频率
    LIGHTNING_GROUP_INTERVAL_MIN: 300, // 两组闪电之间的最小间隔（帧），约5秒
    LIGHTNING_GROUP_INTERVAL_MAX: 600, // 两组闪电之间的最大间隔（帧），约10秒
    LIGHTNING_FLASH_DURATION: 4, // 单次闪光的峰值持续时间（帧）
    LIGHTNING_FADE_DURATION: 15, // 闪光淡出持续时间（帧），制造渐变效果
    LIGHTNING_MAX_INTENSITY: 0.95, // 最大亮度系数
    LIGHTNING_MIN_INTENSITY: 0.02, // 最小亮度（几乎不可见）
  };

  // ---------- 状态 ----------
  let rainDrops: RainDrop[] = [];

  // 闪电状态机
  let lightning = {
    state: "idle", // 'idle' | 'flashing' | 'fading' | 'cooldown'
    intensity: 0,
    timer: 0,
    flashCount: 0,
    maxFlashes: 0,
    flashInterval: 0,
    nextGroupDelay: 0,
    peakIntensity: 0, // 当前闪光的峰值亮度
  };

  // ---------- 初始化雨滴 ----------
  function initRain() {
    rainDrops = [];
    for (let i = 0; i < CONFIG.RAIN_COUNT; i++) {
      const length =
        CONFIG.RAIN_MIN_LENGTH +
        Math.random() * (CONFIG.RAIN_MAX_LENGTH - CONFIG.RAIN_MIN_LENGTH);
      const speed =
        CONFIG.RAIN_MIN_SPEED +
        Math.random() * (CONFIG.RAIN_MAX_SPEED - CONFIG.RAIN_MIN_SPEED);
      rainDrops.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT - CANVAS_HEIGHT,
        length: length,
        speed: speed,
        opacity: CONFIG.RAIN_BASE_OPACITY * (0.5 + Math.random() * 0.5),
        width: 0.8 + Math.random() * 1.5,
      });
    }
  }

  // ---------- 更新雨滴 ----------
  function updateRain() {
    for (const drop of rainDrops) {
      drop.y += drop.speed;
      if (drop.y > CANVAS_HEIGHT + 30) {
        drop.y = -drop.length - Math.random() * 40;
        drop.x = Math.random() * CANVAS_WIDTH;
        drop.length =
          CONFIG.RAIN_MIN_LENGTH +
          Math.random() * (CONFIG.RAIN_MAX_LENGTH - CONFIG.RAIN_MIN_LENGTH);
        drop.speed =
          CONFIG.RAIN_MIN_SPEED +
          Math.random() * (CONFIG.RAIN_MAX_SPEED - CONFIG.RAIN_MIN_SPEED);
        drop.opacity = CONFIG.RAIN_BASE_OPACITY * (0.5 + Math.random() * 0.5);
      }
    }
  }

  // ---------- 闪电状态机 ----------
  function updateLightning() {
    switch (lightning.state) {
      case "idle":
        // 等待下一次闪电组
        if (lightning.nextGroupDelay > 0) {
          lightning.nextGroupDelay--;
          return;
        }
        // 开始新的闪电组
        lightning.state = "flashing";
        lightning.flashCount = 0;
        // 随机闪 1-3 次（降低连续次数）
        lightning.maxFlashes = 1 + Math.floor(Math.random() * 3);
        lightning.timer = 0;
        lightning.flashInterval = 8 + Math.floor(Math.random() * 12); // 闪光间隔 8-20 帧
        lightning.peakIntensity =
          CONFIG.LIGHTNING_MAX_INTENSITY * (0.7 + Math.random() * 0.3);
        lightning.intensity = lightning.peakIntensity;
        break;

      case "flashing":
        lightning.timer++;

        if (lightning.timer <= CONFIG.LIGHTNING_FLASH_DURATION) {
          // 闪光持续期间保持高亮，但微微波动
          const progress = lightning.timer / CONFIG.LIGHTNING_FLASH_DURATION;
          if (progress < 0.2) {
            // 快速上升到峰值
            lightning.intensity = lightning.peakIntensity * (progress / 0.2);
          } else {
            // 保持峰值附近，略微下降
            lightning.intensity =
              lightning.peakIntensity * (1 - (progress - 0.2) * 0.15);
          }
          return;
        }

        // 闪光结束，进入淡出阶段
        lightning.state = "fading";
        lightning.timer = 0;
        break;

      case "fading":
        lightning.timer++;
        const fadeProgress = lightning.timer / CONFIG.LIGHTNING_FADE_DURATION;
        if (fadeProgress >= 1) {
          // 淡出完成
          lightning.intensity = 0;
          lightning.flashCount++;

          if (lightning.flashCount >= lightning.maxFlashes) {
            // 所有闪光完成，进入空闲
            lightning.state = "idle";
            lightning.nextGroupDelay =
              CONFIG.LIGHTNING_GROUP_INTERVAL_MIN +
              Math.random() *
                (CONFIG.LIGHTNING_GROUP_INTERVAL_MAX -
                  CONFIG.LIGHTNING_GROUP_INTERVAL_MIN);
            return;
          }

          // 还有下一次闪光，进入冷却
          lightning.state = "cooldown";
          lightning.timer = lightning.flashInterval;
          return;
        }

        // 平滑淡出：使用二次曲线让亮度缓慢衰减
        // 先快后慢，模拟余晖效果
        const easeOut = 1 - Math.pow(1 - fadeProgress, 1.5);
        lightning.intensity = lightning.peakIntensity * (1 - easeOut) * 0.95;
        break;

      case "cooldown":
        lightning.timer--;
        if (lightning.timer <= 0) {
          // 冷却结束，触发下一次闪光
          lightning.state = "flashing";
          lightning.timer = 0;
          lightning.peakIntensity =
            CONFIG.LIGHTNING_MAX_INTENSITY * (0.6 + Math.random() * 0.4);
          lightning.intensity = lightning.peakIntensity;
        } else {
          // 冷却期间完全黑暗
          lightning.intensity = 0;
        }
        break;
    }
  }

  // ---------- 绘制 ----------
  function drawScene() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // ---- 1. 背景 ----
    const flashBoost = lightning.intensity * 0.7;
    const r = 8 + 200 * flashBoost;
    const g = 12 + 220 * flashBoost;
    const b = 25 + 245 * flashBoost;
    ctx.fillStyle = `rgb(${Math.min(r, 255)}, ${Math.min(g, 255)}, ${Math.min(b, 255)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // ---- 2. 雨滴 ----
    const flashFactor = 1 + lightning.intensity * 0.5;
    const rBase = 170,
      gBase = 210,
      bBase = 255;
    const rFinal = Math.min(255, rBase * flashFactor);
    const gFinal = Math.min(255, gBase * flashFactor);
    const bFinal = Math.min(255, bBase * flashFactor);

    ctx.lineCap = "round";
    for (const drop of rainDrops) {
      let opacity = drop.opacity * (1 + lightning.intensity * 0.7);
      if (opacity > 1) opacity = 1;
      ctx.strokeStyle = `rgba(${rFinal | 0}, ${gFinal | 0}, ${bFinal | 0}, ${opacity})`;
      ctx.lineWidth = drop.width;

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      const tiltX = 0.6;
      ctx.lineTo(drop.x + tiltX, drop.y + drop.length);
      ctx.stroke();
    }

    // ---- 3. 闪电光晕 ----
    if (lightning.intensity > 0.05) {
      const glow = lightning.intensity * 0.3;
      const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        20,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        CANVAS_WIDTH * 0.7,
      );
      gradient.addColorStop(0, `rgba(200, 235, 255, ${glow * 0.2})`);
      gradient.addColorStop(1, `rgba(200, 235, 255, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // ---- 4. 暗角 ----
    const vignette = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH * 0.2,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH * 0.95,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(
      1,
      `rgba(0,0,0,${0.35 + lightning.intensity * 0.05})`,
    );
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // ---------- 动画循环 ----------
  function animate() {
    updateRain();
    updateLightning();
    drawScene();
    requestAnimationFrame(animate);
  }

  // ---------- 启动 ----------
  function init() {
    initRain();
    // 初始延迟短一些，让效果快速出现
    lightning.nextGroupDelay = 20 + Math.random() * 40;
    lightning.state = "idle";
    animate();
    console.log("⛈️ 下雨雷电效果已启动 (低频 + 渐变淡出)");
    console.log(
      `⏱️ 闪电间隔: ${CONFIG.LIGHTNING_GROUP_INTERVAL_MIN / 60}-${CONFIG.LIGHTNING_GROUP_INTERVAL_MAX / 60} 秒`,
    );
  }

  // 确保DOM加载完成
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
};
