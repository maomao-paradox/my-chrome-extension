import React, {
  JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import $ from "jquery";
import "./rotation-3D-showcase.scss";

// 类型定义
type RotationItemType = "blue" | "green" | "yellow";

interface RotationItem {
  name: string;
  type: RotationItemType;
  icon: string;
  fallbackIcon: string;
}

export interface RotationItemInput {
  name: string;
  type: RotationItemType;
  icon?: string;
  fallbackIcon?: string;
}

interface Rotation3DOptions {
  id: string;
  farScale?: number;
  xRadius?: number;
  yRadius?: number;
  autoPlay?: boolean;
  autoPlayDelay?: number;
}

interface Rotation3DInstance {
  timer?: number;
  autoPlayTimer?: number;
}

// 扩展 Window 类型
declare global {
  interface Window {
    Rotation3D?: new (options: Rotation3DOptions) => Rotation3DInstance;
    $: typeof $;
    jQuery: typeof $;
  }
}

// 默认数据
const defaultItemList: RotationItem[] = [
  {
    name: "人员管理",
    type: "blue",
    icon: "icon-renyuanguanli",
    fallbackIcon: "人",
  },
  { name: "GPS服务", type: "green", icon: "icon-GPS", fallbackIcon: "GPS" },
  {
    name: "路基施工",
    type: "yellow",
    icon: "icon-a-lujishigong2x",
    fallbackIcon: "基",
  },
  {
    name: "数据服务中心",
    type: "blue",
    icon: "icon-shujufuwuzhongxin",
    fallbackIcon: "数",
  },
  {
    name: "智慧梁场",
    type: "blue",
    icon: "icon-liangchang",
    fallbackIcon: "梁",
  },
];

// Props 接口
interface Rotation3DPageProps {
  embedded?: boolean;
  projection?: boolean;
  items?: RotationItemInput[];
}

// 工具函数：加载脚本
function loadScriptOnce(src: string, id: string): Promise<void> {
  const existingScript = document.getElementById(
    id,
  ) as HTMLScriptElement | null;

  if (existingScript) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

const Rotation3DPage: React.FC<Rotation3DPageProps> = ({
  embedded = false,
  projection = false,
  items,
}) => {
  const rotationRootRef = useRef<HTMLDivElement>(null);
  const rotation3DInstanceRef = useRef<Rotation3DInstance | null>(null);
  const pluginLoadPromiseRef = useRef<Promise<void> | null>(null);

  // 计算属性
  const rootTag = embedded || projection ? "div" : "main";

  const itemList = useMemo<RotationItem[]>(() => {
    if (!items?.length) {
      return defaultItemList;
    }

    return items.map((item) => ({
      name: item.name,
      type: item.type,
      icon: item.icon ?? "",
      fallbackIcon: item.fallbackIcon ?? item.name.slice(0, 1),
    }));
  }, [items]);

  // 确保插件加载
  const ensureRotationPluginLoaded = useCallback(async () => {
    if (!pluginLoadPromiseRef.current) {
      // 将 jQuery 挂载到 window 上
      window.$ = $;
      window.jQuery = $;

      const rotation3DScriptUrl = new URL("./rotation3D.js", import.meta.url)
        .href;
      pluginLoadPromiseRef.current = loadScriptOnce(
        rotation3DScriptUrl,
        "rotation3d-legacy-plugin",
      );
    }

    await pluginLoadPromiseRef.current;
  }, []);

  // 初始化 3D 旋转
  const initRotation3D = useCallback(async () => {
    await ensureRotationPluginLoaded();

    if (!rotationRootRef.current || !window.Rotation3D) {
      return;
    }

    rotation3DInstanceRef.current = new window.Rotation3D({
      id: "#rotation3D",
      farScale: 0.6,
      xRadius: 0,
      yRadius: 220,
    });
  }, [ensureRotationPluginLoaded]);

  // 组件挂载时初始化
  useEffect(() => {
    initRotation3D();

    // 清理函数
    return () => {
      if (rotation3DInstanceRef.current?.autoPlayTimer) {
        window.clearInterval(rotation3DInstanceRef.current.autoPlayTimer);
      }

      if (rotation3DInstanceRef.current?.timer) {
        window.cancelAnimationFrame(rotation3DInstanceRef.current.timer);
        window.clearTimeout(rotation3DInstanceRef.current.timer);
      }
    };
  }, [initRotation3D]);

  // 计算 class 名称
  const pageClassName = [
    "rotation3d-page",
    embedded && "rotation3d-page--embedded",
    projection && "rotation3d-page--projection",
  ]
    .filter(Boolean)
    .join(" ");

  const RootTag = rootTag as keyof JSX.IntrinsicElements;

  return (
    <RootTag className={pageClassName}>
      <section className="rotation3d-stage" aria-label="3D 功能模块展示">
        <div className="rotation3D-baseMap" aria-hidden="true"></div>

        <div id="rotation3D" ref={rotationRootRef} className="rotation3D">
          <button className="center" type="button">
            中心
          </button>

          <div className="itemList">
            {itemList.map((item) => (
              <button
                key={item.name}
                className={`rotation3D__item ${item.type}`}
                type="button"
              >
                <span className="scale">
                  <span className="cont">
                    <span className="fallback-icon" aria-hidden="true">
                      {item.fallbackIcon}
                    </span>
                    <span className="item-name">{item.name}</span>
                  </span>
                  <span className="baseImg" aria-hidden="true"></span>
                </span>
              </button>
            ))}
          </div>

          <div className="lineList" aria-hidden="true">
            {itemList.map((item) => (
              <div
                key={`${item.name}-line`}
                className={`rotation3D__line ${item.type}`}
              >
                {item.type === "blue" && (
                  <div className="pos">
                    <svg width="10" height="400">
                      <path id="path1" d="M0 400, 0 0" strokeDasharray="5,10" />
                    </svg>
                    <div className="dot dot1 dot-caret"></div>
                  </div>
                )}

                {item.type === "yellow" && (
                  <div className="pos">
                    <svg width="10" height="400">
                      <path id="path2" d="M0 400, 0 0" strokeDasharray="5,10" />
                    </svg>
                    <div className="dot dot2 dot-close"></div>
                  </div>
                )}

                {item.type === "green" && (
                  <div className="pos pos--wide">
                    <svg width="50" height="400">
                      <path
                        id="path3"
                        d="M20 400 S 0 200, 20 0"
                        strokeDasharray="5,10"
                      />
                      <path
                        id="path4"
                        d="M20 400 S 40 200, 20 0"
                        strokeDasharray="5,10"
                      />
                    </svg>
                    <div className="dot dot3 dot-caret"></div>
                    <div className="dot dot4 dot-caret"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </RootTag>
  );
};

export default Rotation3DPage;

// 按需导出类型
export type {
  RotationItemType,
  RotationItem,
  Rotation3DInstance,
  Rotation3DOptions,
};
