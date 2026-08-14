import "./styles/app.scss";

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type Point = {
  x: number;
  y: number;
};

type FingerSet = {
  thumb: Point;
  index: Point;
  middle: Point;
  pinky: Point;
};

type HandLandmarkerModule = {
  FilesetResolver: {
    forVisionTasks: (path: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (
      resolver: unknown,
      options: Record<string, unknown>,
    ) => Promise<{
      detectForVideo: (
        video: HTMLVideoElement,
        timestampMs: number,
      ) => {
        landmarks?: Landmark[][];
      };
      setOptions: (options: Record<string, unknown>) => Promise<void>;
    }>;
  };
};

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const SMOOTHING = 0.28;
const FINGER_TIPS = [4, 8, 12, 20] as const;
const PORTALS = [
  {
    name: "拇指 - 食指",
    color: "#ff3158",
    filter: "saturate(1.8) contrast(1.2) sepia(0.25) hue-rotate(326deg)",
  },
  {
    name: "食指 - 中指",
    color: "#27a8ff",
    filter: "saturate(1.7) contrast(1.35) hue-rotate(178deg)",
  },
  {
    name: "中指 - 小指",
    color: "#36f08a",
    filter: "saturate(1.55) contrast(1.22) hue-rotate(74deg)",
  },
];

const root = document.querySelector<HTMLElement>(".hand-portals");
const video = document.querySelector<HTMLVideoElement>(".hand-portals__video");
const canvas = document.querySelector<HTMLCanvasElement>(".hand-portals__canvas");
const startButton = document.querySelector<HTMLButtonElement>("[data-start]");
const statusText = document.querySelector<HTMLElement>("[data-status]");

if (!root || !video || !canvas || !startButton || !statusText) {
  throw new Error("Hand portals page is missing required DOM nodes.");
}

const ctx = canvas.getContext("2d", { alpha: false });

if (!ctx) {
  throw new Error("Canvas 2D context is not available.");
}

let handLandmarker:
  | Awaited<ReturnType<HandLandmarkerModule["HandLandmarker"]["createFromOptions"]>>
  | undefined;
let animationFrame = 0;
let lastDetectTime = -1;
let smoothedHands: [FingerSet, FingerSet] | undefined;
let viewportWidth = 0;
let viewportHeight = 0;

const setStatus = (message: string) => {
  statusText.textContent = message;
};

const resizeCanvas = () => {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  canvas.width = Math.round(viewportWidth * pixelRatio);
  canvas.height = Math.round(viewportHeight * pixelRatio);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
};

const coverRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
};

const drawMirroredVideo = () => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  const rect = coverRect(
    video.videoWidth || VIDEO_WIDTH,
    video.videoHeight || VIDEO_HEIGHT,
    viewportWidth,
    viewportHeight,
  );

  ctx.save();
  ctx.translate(viewportWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, viewportWidth - rect.x - rect.width, rect.y, rect.width, rect.height);
  ctx.restore();
};

const landmarkToCanvas = (landmark: Landmark): Point => ({
  x: (1 - landmark.x) * viewportWidth,
  y: landmark.y * viewportHeight,
});

const extractFingerSet = (landmarks: Landmark[]): FingerSet => {
  const [thumb, index, middle, pinky] = FINGER_TIPS.map((tip) =>
    landmarkToCanvas(landmarks[tip]),
  );

  return { thumb, index, middle, pinky };
};

const smoothPoint = (previous: Point, next: Point): Point => ({
  x: previous.x + (next.x - previous.x) * SMOOTHING,
  y: previous.y + (next.y - previous.y) * SMOOTHING,
});

const smoothFingerSet = (previous: FingerSet, next: FingerSet): FingerSet => ({
  thumb: smoothPoint(previous.thumb, next.thumb),
  index: smoothPoint(previous.index, next.index),
  middle: smoothPoint(previous.middle, next.middle),
  pinky: smoothPoint(previous.pinky, next.pinky),
});

const updateHands = (landmarkGroups: Landmark[][]) => {
  if (landmarkGroups.length < 2) {
    return;
  }

  const hands = landmarkGroups
    .slice(0, 2)
    .map(extractFingerSet)
    .sort((a, b) => a.index.x - b.index.x) as [FingerSet, FingerSet];

  smoothedHands = smoothedHands
    ? [
        smoothFingerSet(smoothedHands[0], hands[0]),
        smoothFingerSet(smoothedHands[1], hands[1]),
      ]
    : hands;
};

const traceQuad = (points: Point[]) => {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
};

const drawPortal = (points: Point[], portal: (typeof PORTALS)[number]) => {
  ctx.save();
  traceQuad(points);
  ctx.clip();
  ctx.filter = portal.filter;
  drawMirroredVideo();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = portal.color;
  ctx.globalAlpha = 0.34;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  ctx.save();
  traceQuad(points);
  ctx.lineWidth = 2;
  ctx.strokeStyle = portal.color;
  ctx.shadowColor = portal.color;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.restore();
};

const drawFingerPoint = (point: Point, color: string) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawHands = (hands: [FingerSet, FingerSet]) => {
  const left = hands[0];
  const right = hands[1];
  const leftPoints = [left.thumb, left.index, left.middle, left.pinky];
  const rightPoints = [right.thumb, right.index, right.middle, right.pinky];

  for (let index = 0; index < PORTALS.length; index += 1) {
    drawPortal(
      [
        leftPoints[index],
        leftPoints[index + 1],
        rightPoints[index + 1],
        rightPoints[index],
      ],
      PORTALS[index],
    );
  }

  [...leftPoints, ...rightPoints].forEach((point, index) => {
    drawFingerPoint(point, PORTALS[index % PORTALS.length].color);
  });
};

const drawIdleGuide = () => {
  ctx.save();
  ctx.fillStyle = "rgba(5, 5, 7, 0.52)";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 14]);

  const centerY = viewportHeight * 0.54;
  const width = Math.min(viewportWidth * 0.56, 680);
  const height = Math.min(viewportHeight * 0.3, 260);
  const x = (viewportWidth - width) / 2;
  const y = centerY - height / 2;

  for (let index = 0; index < 3; index += 1) {
    const offset = (index - 1) * 34;
    ctx.strokeStyle = `${PORTALS[index].color}88`;
    traceQuad([
      { x: x + offset, y: y + index * 22 },
      { x: x + width * 0.42 + offset, y: y - 8 + index * 18 },
      { x: x + width + offset, y: y + height - index * 24 },
      { x: x + width * 0.54 + offset, y: y + height + 12 - index * 18 },
    ]);
    ctx.stroke();
  }

  ctx.restore();
};

const render = () => {
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.filter = "grayscale(0.38) contrast(0.9) brightness(0.7)";
  drawMirroredVideo();
  ctx.filter = "none";

  if (handLandmarker && video.currentTime !== lastDetectTime) {
    lastDetectTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, performance.now());
    updateHands(results.landmarks ?? []);
  }

  if (smoothedHands) {
    root.classList.add("is-tracking");
    drawHands(smoothedHands);
    setStatus("已识别双手，三片空间跟随中");
  } else {
    root.classList.remove("is-tracking");
    drawIdleGuide();
  }

  animationFrame = window.requestAnimationFrame(render);
};

const loadHandLandmarker = async () => {
  const visionTasksUrl =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";
  const wasmPath =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
  const modelPath =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  const vision = (await import(/* @vite-ignore */ visionTasksUrl)) as HandLandmarkerModule;
  const resolver = await vision.FilesetResolver.forVisionTasks(wasmPath);

  return vision.HandLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath: modelPath,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.62,
    minHandPresenceConfidence: 0.62,
    minTrackingConfidence: 0.5,
  });
};

const startDemo = async () => {
  startButton.disabled = true;
  setStatus("正在加载 MediaPipe 模型");

  try {
    handLandmarker = await loadHandLandmarker();
    setStatus("正在请求摄像头权限");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: VIDEO_WIDTH },
        height: { ideal: VIDEO_HEIGHT },
        facingMode: "user",
      },
    });

    video.srcObject = stream;
    await video.play();
    startButton.hidden = true;
    setStatus("把双手同时放入画面");
    window.cancelAnimationFrame(animationFrame);
    render();
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    setStatus("启动失败，请确认浏览器摄像头权限和网络模型加载");
  }
};

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
startButton.addEventListener("click", startDemo);
drawIdleGuide();
