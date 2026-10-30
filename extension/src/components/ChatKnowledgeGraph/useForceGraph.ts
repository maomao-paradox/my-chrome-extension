// src/components/ChatKnowledgeGraph/useForceGraph.ts
import { useEffect, useRef, useCallback } from 'react';
import type { GraphData, GraphNode, GraphEdge } from './types';

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimEdge extends GraphEdge {
  sourceNode: SimNode;
  targetNode: SimNode;
}

interface Options {
  width: number;
  height: number;
  draggable: boolean;
  zoomable: boolean;
  initialScale: number;
  colorMap: Record<string, string>;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

export function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  data: GraphData,
  options: Options
) {
  const stateRef = useRef<{
    simNodes: SimNode[];
    simEdges: SimEdge[];
    transform: { x: number; y: number; k: number };
    hovered: SimNode | null;
    dragged: SimNode | null;
    isPanning: boolean;
    panStart: { x: number; y: number };
    raf: number;
  } | null>(null);

  const buildSim = useCallback(() => {
    const { width, height, colorMap } = options;
    const cx = width / 2;
    const cy = height / 2;

    const simNodes: SimNode[] = data.nodes.map((n, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const r = 180 + (i % 5) * 50;
      return {
        ...n,
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 80,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 80,
        vx: 0,
        vy: 0,
        radius: n.size ?? 22,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges: SimEdge[] = data.edges
      .map((e) => ({
        ...e,
        sourceNode: nodeMap.get(e.source)!,
        targetNode: nodeMap.get(e.target)!,
      }))
      .filter((e) => e.sourceNode && e.targetNode);

    return { simNodes, simEdges };
  }, [data, options.width, options.height]);

  const simulate = useCallback(() => {
    const st = stateRef.current;
    if (!st) return;
    const { simNodes, simEdges } = st;
    const { width, height } = options;
    const cx = width / 2;
    const cy = height / 2;

    const REPULSION = 8000;
    const SPRING_LENGTH = 220;
    const SPRING_STRENGTH = 0.008;
    const DAMPING = 0.82;
    const CENTER_GRAVITY = 0.008;
    const MAX_V = 12;

    // 斥力
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i], b = simNodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 15;
        if (dist < minDist) dist = minDist;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // 弹簧
    simEdges.forEach((e) => {
      const a = e.sourceNode, b = e.targetNode;
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    // 向心 + 阻尼
    simNodes.forEach((n) => {
      n.vx += (cx - n.x) * CENTER_GRAVITY;
      n.vy += (cy - n.y) * CENTER_GRAVITY;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > MAX_V) {
        n.vx = (n.vx / speed) * MAX_V;
        n.vy = (n.vy / speed) * MAX_V;
      }
      n.x += n.vx;
      n.y += n.vy;
      const m = 60;
      if (n.x < m) { n.x = m; n.vx *= -0.5; }
      if (n.x > width - m) { n.x = width - m; n.vx *= -0.5; }
      if (n.y < m) { n.y = m; n.vy *= -0.5; }
      if (n.y > height - m) { n.y = height - m; n.vy *= -0.5; }
    });
  }, [options]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const st = stateRef.current;
    if (!canvas || !st) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height, colorMap, theme } = options as any;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bg = theme === 'light' ? '#f8fafc' : '#0f172a';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(st.transform.x, st.transform.y);
    ctx.scale(st.transform.k, st.transform.k);

    // 边
    st.simEdges.forEach((e) => {
      const a = e.sourceNode, b = e.targetNode;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.color ?? '#475569';
      ctx.lineWidth = (e.width ?? 1.5) * 0.9;
      if (e.dashed) ctx.setLineDash([6, 6]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (e.label && st.transform.k > 0.8) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = '10px "Segoe UI","PingFang SC",sans-serif';
        ctx.fillStyle = theme === 'light' ? '#64748b' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.label, mx, my - 5);
      }
    });

    // 节点
    st.simNodes.forEach((n) => {
      const r = n.radius;
      const color = colorMap[n.type] ?? '#64748b';
      const isHover = st.hovered?.id === n.id;

      ctx.shadowColor = isHover ? color : 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = isHover ? 20 : 8;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `600 ${Math.max(11, r * 0.5)}px "Segoe UI","PingFang SC",sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, n.x, n.y + (r > 25 ? 2 : 0));
    });

    ctx.restore();
  }, [canvasRef, options]);

  const tick = useCallback(() => {
    simulate();
    draw();
    const st = stateRef.current;
    if (st) st.raf = requestAnimationFrame(tick);
  }, [simulate, draw]);

  // 初始化
  useEffect(() => {
    const { width, height, initialScale } = options;
    const { simNodes, simEdges } = buildSim();
    stateRef.current = {
      simNodes,
      simEdges,
      transform: { x: 0, y: 0, k: initialScale },
      hovered: null,
      dragged: null,
      isPanning: false,
      panStart: { x: 0, y: 0 },
      raf: 0,
    };
    // 预跑稳定布局
    for (let i = 0; i < 150; i++) simulate();
    draw();
    const st = stateRef.current;
    if (st) st.raf = requestAnimationFrame(tick);

    return () => {
      if (stateRef.current) cancelAnimationFrame(stateRef.current.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options.width, options.height]);

  // 事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      const st = stateRef.current!;
      const mx =
        ((e.clientX - rect.left) * (canvas.width / rect.width)) /
          window.devicePixelRatio -
        st.transform.x;
      const my =
        ((e.clientY - rect.top) * (canvas.height / rect.height)) /
          window.devicePixelRatio -
        st.transform.y;
      return { x: mx / st.transform.k, y: my / st.transform.k };
    };

    const findNode = (x: number, y: number) => {
      const st = stateRef.current!;
      for (let i = st.simNodes.length - 1; i >= 0; i--) {
        const n = st.simNodes[i];
        const dx = x - n.x, dy = y - n.y;
        if (dx * dx + dy * dy <= n.radius * n.radius) return n;
      }
      return null;
    };

    const onMove = (e: MouseEvent) => {
      const st = stateRef.current!;
      const { x, y } = getPos(e);

      if (st.dragged) {
        st.dragged.x = x;
        st.dragged.y = y;
        st.dragged.vx = 0;
        st.dragged.vy = 0;
        draw();
        return;
      }
      if (st.isPanning) {
        st.transform.x = e.clientX - st.panStart.x;
        st.transform.y = e.clientY - st.panStart.y;
        draw();
        return;
      }

      const node = findNode(x, y);
      const nextHover = node ?? null;
      if (st.hovered?.id !== nextHover?.id) {
        st.hovered = nextHover;
        options.onNodeHover?.(nextHover);
      }
      canvas.style.cursor = node ? 'pointer' : 'grab';
    };

    const onDown = (e: MouseEvent) => {
      const st = stateRef.current!;
      const { x, y } = getPos(e);
      const node = findNode(x, y);
      if (node) {
        if (options.draggable) {
          st.dragged = node;
          canvas.style.cursor = 'grabbing';
        }
        options.onNodeClick?.(node);
      } else {
        st.isPanning = true;
        st.panStart = { x: e.clientX - st.transform.x, y: e.clientY - st.transform.y };
        canvas.style.cursor = 'grabbing';
      }
    };

    const onUp = () => {
      const st = stateRef.current!;
      st.dragged = null;
      st.isPanning = false;
      canvas.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      if (!options.zoomable) return;
      e.preventDefault();
      const st = stateRef.current!;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newK = st.transform.k * (1 + delta * 0.05);
      if (newK < 0.3 || newK > 3) return;
      const rect = canvas.getBoundingClientRect();
      const mx =
        ((e.clientX - rect.left) * (canvas.width / rect.width)) /
        window.devicePixelRatio;
      const my =
        ((e.clientY - rect.top) * (canvas.height / rect.height)) /
        window.devicePixelRatio;
      st.transform.x = mx - (mx - st.transform.x) * (newK / st.transform.k);
      st.transform.y = my - (my - st.transform.y) * (newK / st.transform.k);
      st.transform.k = newK;
      draw();
    };

    const onLeave = () => {
      const st = stateRef.current!;
      st.hovered = null;
      options.onNodeHover?.(null);
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [canvasRef, options, draw]);

  return stateRef;
}