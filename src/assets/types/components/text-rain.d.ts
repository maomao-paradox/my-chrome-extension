// textRainScreensaver 雨滴对象接口
export interface TextRainDrop {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  speed: number;
  opacity: number;
  color: string;
}

// textRainScreensaver 接口定义
export interface TextRainScreensaver {
  // 状态属性
  isActive: boolean;
  isRunning: boolean;
  timeout: NodeJS.Timeout | null;
  container: HTMLDivElement | null;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  drops: TextRainDrop[];
  density: number;
  
  // 弹幕池
  baseWords: string[];
  customWords: string[];
  
  // 方法定义
  init(): void;
  loadCustomBullets(): void;
  addCustomBullet(text: string): void;
  getAllWords(): string[];
  resizeCanvas(): void;
  start(): void;
  stop(): void;
  createDrop(): void;
  getRandomColor(): string;
  animate(): void;
  updateStatus(active: boolean): void;
  updateDensity(value: number): void;
}

// 其他导出函数的类型定义
export function resetScreensaverTimer(): void;
export function initScreensaver(): void;