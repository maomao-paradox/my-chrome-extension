import { getCurrentInstance, onBeforeUnmount } from 'vue';
import { shadowHostId } from '@/config';
import { createShadowHost } from '@/utils/shadow-dom';

interface MusicNoteTrailOptions {
  hostId?: string;
  canvasId?: string;
  maxParticles?: number;
  maxStars?: number;
  spawnInterval?: number;
  burstCount?: number;
  jitter?: number;
  zIndex?: number;
}

interface MusicNoteTrailControls {
  canvas: HTMLCanvasElement | null;
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

interface PointerPosition {
  x: number;
  y: number;
  active: boolean;
  moved: boolean;
}

const DEFAULT_CANVAS_ID = 'musicNoteTrailCanvas';
const DEFAULT_MAX_PARTICLES = 180;
const DEFAULT_SPAWN_INTERVAL = 24;
const DEFAULT_BURST_COUNT = 36;
const DEFAULT_JITTER = 18;
const DEFAULT_Z_INDEX = 2147483646;
const MAX_DEVICE_PIXEL_RATIO = 2;
const MUSIC_NOTE_SYMBOLS = ['♪', '♫', '♬', '♩', '♭', '♯'];

let activeControls: MusicNoteTrailControls | null = null;

class MusicNoteParticle {
  private readonly image: HTMLCanvasElement;
  private readonly imageSize: number;
  private readonly note: string;
  private readonly opacitySpeed: number;
  private readonly rotateSpeed: number;
  private readonly scaleSpeed: number;
  private readonly size: number;
  private opacity = 1;
  private rotate = Math.random() * Math.PI * 2;
  private scale = Math.random() * 0.45 + 0.75;
  private vx: number;
  private vy: number;

  constructor(
    private x: number,
    private y: number,
    burst = false,
  ) {
    this.size = Math.random() * 12 + 16;
    this.note = MUSIC_NOTE_SYMBOLS[Math.floor(Math.random() * MUSIC_NOTE_SYMBOLS.length)];
    this.vx = (Math.random() - 0.5) * (burst ? 9 : 3);
    this.vy = burst ? (Math.random() - 0.5) * 9 : Math.random() * 1.6 + 0.4;
    this.opacitySpeed = Math.random() * 0.012 + 0.008;
    this.rotateSpeed = (Math.random() - 0.5) * 0.12;
    this.scaleSpeed = Math.random() * 0.018 + 0.01;

    this.image = this.createImage();
    this.imageSize = this.image.width;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.rotate += this.rotateSpeed;
    this.scale = Math.max(0, this.scale - this.scaleSpeed);
    this.vy = Math.min(7, this.vy + 0.035);
    this.x += this.vx;
    this.y += this.vy;
    this.opacity -= this.opacitySpeed;

    ctx.save();
    ctx.globalAlpha = Math.max(this.opacity, 0);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotate);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(this.image, -this.imageSize / 2, -this.imageSize / 2);
    ctx.restore();
  }

  isDead(width: number, height: number): boolean {
    const padding = this.size * 4;
    return (
      this.opacity <= 0 ||
      this.scale <= 0 ||
      this.x < -padding ||
      this.x > width + padding ||
      this.y < -padding ||
      this.y > height + padding
    );
  }

  private createImage(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const imageSize = Math.ceil(this.size * 3.2);
    const center = imageSize / 2;
    const color = `hsl(${Math.floor(Math.random() * 76) + 190}, 78%, 68%)`;
    const ctx = canvas.getContext('2d');

    canvas.width = imageSize;
    canvas.height = imageSize;

    if (!ctx) {
      return canvas;
    }

    ctx.font = `700 ${this.size}px "Times New Roman", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.size * 0.8;
    ctx.fillText(this.note, center, center);

    return canvas;
  }
}

const createNoopControls = (): MusicNoteTrailControls => ({
  canvas: null,
  start: () => undefined,
  stop: () => undefined,
  isRunning: () => false,
});

const getEventPoint = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  return { x: event.clientX, y: event.clientY };
};

const trimParticles = (particles: MusicNoteParticle[], maxParticles: number): void => {
  if (particles.length > maxParticles) {
    particles.splice(0, particles.length - maxParticles);
  }
};

export function useMusicNoteTrails(options: MusicNoteTrailOptions = {}): MusicNoteTrailControls {
  if (activeControls?.isRunning()) {
    if (getCurrentInstance()) {
      onBeforeUnmount(activeControls.stop);
    }
    return activeControls;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return createNoopControls();
  }

  const hostId = options.hostId ?? shadowHostId;
  const { shadowHost, shadowRoot } = createShadowHost(hostId, 'open');
  if (!shadowRoot) {
    return createNoopControls();
  }

  if (options.hostId) {
    Object.assign(shadowHost.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: String(options.zIndex ?? DEFAULT_Z_INDEX),
    });
  }

  const canvasId = options.canvasId ?? DEFAULT_CANVAS_ID;
  const existingElement = shadowRoot.getElementById(canvasId);
  let canvas = existingElement instanceof HTMLCanvasElement ? existingElement : null;

  if (!canvas) {
    existingElement?.remove();
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.setAttribute('aria-hidden', 'true');
    shadowRoot.appendChild(canvas);
  }

  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    display: 'block',
    pointerEvents: 'none',
    zIndex: String(options.zIndex ?? DEFAULT_Z_INDEX),
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return createNoopControls();
  }

  const particles: MusicNoteParticle[] = [];
  const pointer: PointerPosition = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false,
    moved: false,
  };
  const cleanupFns: Array<() => void> = [];
  const maxParticles = options.maxParticles ?? options.maxStars ?? DEFAULT_MAX_PARTICLES;
  const spawnInterval = options.spawnInterval ?? DEFAULT_SPAWN_INTERVAL;
  const burstCount = options.burstCount ?? DEFAULT_BURST_COUNT;
  const jitter = options.jitter ?? DEFAULT_JITTER;

  let animationFrameId: number | null = null;
  let lastSpawnTime = 0;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let running = false;

  const addWindowListener = <K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    listenerOptions?: AddEventListenerOptions,
  ): void => {
    window.addEventListener(type, handler as EventListener, listenerOptions);
    cleanupFns.push(() => window.removeEventListener(type, handler as EventListener, listenerOptions));
  };

  const resizeCanvas = (): void => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.floor(viewportWidth * dpr);
    canvas.height = Math.floor(viewportHeight * dpr);
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    if (!pointer.active) {
      pointer.x = viewportWidth / 2;
      pointer.y = viewportHeight / 2;
    }
  };

  const spawnNote = (x = pointer.x, y = pointer.y, burst = false): void => {
    particles.push(
      new MusicNoteParticle(
        x + (Math.random() - 0.5) * jitter,
        y + (Math.random() - 0.5) * jitter,
        burst,
      ),
    );
    trimParticles(particles, maxParticles);
  };

  const spawnBurst = (x: number, y: number): void => {
    for (let index = 0; index < burstCount; index += 1) {
      spawnNote(x, y, true);
    }
  };

  const updatePointer = (event: MouseEvent | TouchEvent): void => {
    const point = getEventPoint(event);
    if (!point) {
      return;
    }

    pointer.x = point.x;
    pointer.y = point.y;
    pointer.active = true;
    pointer.moved = true;
  };

  const handlePointerBurst = (event: MouseEvent | TouchEvent): void => {
    const point = getEventPoint(event);
    if (!point) {
      return;
    }

    pointer.x = point.x;
    pointer.y = point.y;
    pointer.active = true;
    pointer.moved = false;
    spawnBurst(point.x, point.y);
  };

  const render = (time: number): void => {
    if (!running) {
      return;
    }

    animationFrameId = requestAnimationFrame(render);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    if (pointer.active && pointer.moved && time - lastSpawnTime >= spawnInterval) {
      spawnNote();
      pointer.moved = false;
      lastSpawnTime = time;
    }

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.draw(ctx);

      if (particle.isDead(viewportWidth, viewportHeight)) {
        particles.splice(index, 1);
      }
    }
  };

  const controls: MusicNoteTrailControls = {
    canvas,
    start: () => {
      if (running) {
        return;
      }

      running = true;
      activeControls = controls;
      if (!canvas.isConnected) {
        shadowRoot.appendChild(canvas);
      }
      resizeCanvas();
      addWindowListener('resize', resizeCanvas, { passive: true });
      addWindowListener('mousemove', updatePointer, { passive: true });
      addWindowListener('touchmove', updatePointer, { passive: true });
      addWindowListener('click', handlePointerBurst, { passive: true });
      addWindowListener('touchstart', handlePointerBurst, { passive: true });
      animationFrameId = requestAnimationFrame(render);
    },
    stop: () => {
      if (!running) {
        return;
      }

      running = false;

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      cleanupFns.splice(0).forEach((cleanup) => cleanup());
      particles.splice(0);
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);
      canvas.remove();

      if (activeControls === controls) {
        activeControls = null;
      }
    },
    isRunning: () => running,
  };

  controls.start();
  activeControls = controls;

  if (getCurrentInstance()) {
    onBeforeUnmount(controls.stop);
  }

  return controls;
}

export const useStarTrails = useMusicNoteTrails;
