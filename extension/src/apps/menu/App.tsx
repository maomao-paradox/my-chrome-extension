/**
 * Menu 应用主组件（React 版）
 * 从 App.vue 迁移而来
 *
 * 关键变更：
 * - Vue toolIcon（?component svg）→ Ant Design 图标（AppstoreOutlined）
 * - toggleMenu 逻辑用 useEffect + 闭包变量（rot/count/flag 不需要触发重渲染）
 * - defineProps → React FC props
 * - v-for → .map()
 * - <component :is> → 直接用 Ant Design 图标组件
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AppstoreOutlined } from "@ant-design/icons";
import type { Tool } from "@/types";
import { showSuccessMessage } from "@/utils/element-control";
import AutoClick from "./tools/AutoClick";
import "./styles/app.scss";

interface MenuAppProps {
  visible?: boolean;
  tools: Tool[];
}

const MenuApp: React.FC<MenuAppProps> = ({ tools }) => {
  // 限定长度最多为4个
  const localTools = useMemo(() => [...tools].slice(0, 4), [tools]);

  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);

  const [autoClickVisible, setAutoClickVisible] = useState(false);

  const handleToolClick = useCallback((toolId: string) => {
    maLogger.log(toolId);
    if (toolId === "autoClick") {
      setAutoClickVisible((prev) => !prev);
      return;
    }
    // 其他工具的逻辑（原 Vue 版被注释）
  }, []);

  /**
   * 菜单旋转动画 + 事件监听
   * rot/count/flag 是闭包内变量，不需要触发重渲染
   */
  useEffect(() => {
    if (!menuRef.current || !toggleRef.current) {
      return;
    }

    const menuEl = menuRef.current;
    const toggleEl = toggleRef.current;
    const iconElements = menuEl.querySelectorAll(".tool-item-icon");

    let rot = parseInt(toggleEl.getAttribute("data-rot") || "0") || 0;
    let count = 1;
    let flag = 1;

    const onToggleClick = () => {
      count++;
      if (count >= 10 && count % 10 === 0) {
        showSuccessMessage(`达成成就：点击菜单${count}次`);
        count = 0;
      }

      if (rot === 180) {
        flag = -1;
      } else if (rot === -180) {
        flag = 1;
      }
      rot += flag * 180;

      menuEl.style.transform = `rotate(${rot}deg)`;
      (menuEl.style as any).webkitTransform = `rotate(${rot}deg)`;

      const isEven = (rot / 180) % 2 === 0;
      const parent = toggleEl.parentElement!;

      if (isEven) {
        parent.classList.add("ss_active");
        toggleEl.classList.add("close");
      } else {
        parent.classList.remove("ss_active");
        toggleEl.classList.remove("close");
      }

      toggleEl.setAttribute("data-rot", rot.toString());
    };

    const onTransitionEnd = (ev: TransitionEvent) => {
      if (
        ev.propertyName &&
        ev.propertyName !== "transform" &&
        ev.propertyName !== "-webkit-transform"
      ) {
        return;
      }
      const isEven = (rot / 180) % 2 === 0;
      iconElements.forEach((el) => {
        if (isEven) {
          el.classList.add("ss_animate");
        } else {
          el.classList.remove("ss_animate");
        }
      });
    };

    toggleEl.addEventListener("click", onToggleClick);
    menuEl.addEventListener("transitionend", onTransitionEnd);

    return () => {
      toggleEl.removeEventListener("click", onToggleClick);
      menuEl.removeEventListener("transitionend", onTransitionEnd);
    };
  }, []);

  return (
    <>
      <div className="app-container">
        <div id="ss_menu" ref={menuRef}>
          {localTools.map((tool, index) => (
            <div className="tool-item" key={index}>
              <AppstoreOutlined
                className="tool-item-icon"
                onClick={() => handleToolClick(tool.id)}
              />
            </div>
          ))}
          <div className="menu">
            <div
              id="ss_toggle"
              ref={toggleRef}
              className="share"
              data-rot="180"
            >
              <div className="circle"></div>
              <div className="bar"></div>
            </div>
          </div>
        </div>
      </div>
      <AutoClick visible={autoClickVisible} />
    </>
  );
};

export default MenuApp;
