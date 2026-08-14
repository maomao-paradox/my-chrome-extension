// import { onMounted, onUnmounted } from 'vue';
import { Emitter } from "mitt";
import { bus } from "./bus";

// re-export bus 保持向后兼容（但从此处导入 bus 会引入 vue chunk，
// React/Preact 应用应直接从 @/event/bus 导入）
export { bus };

export interface EventManager {
  useBus(busName: string, handler: (...args: any[]) => void): void;
  useBus(eventMap: Map<string, (...args: any[]) => void>): void;
  useListener<T extends Event>(
    target: any,
    eventMap: Map<string, (event: T) => void>,
  ): void;
  useListener<T extends Event>(
    target: any,
    eventName: string,
    handler: (event: T) => void,
    options?: AddEventListenerOptions,
  ): void;
}

class EventManagerImpl implements EventManager {
  constructor() {}
  useBus(...args: any[]) {
    const busNameOrMap = args[0];
    const handler = args[1];
    let unsubscribe = undefined;

    if (busNameOrMap instanceof Map && handler) {
      // 处理事件映射对象的情况
      const eventMap = busNameOrMap;

      eventMap.forEach((handler, busName) => {
        bus.on(busName, handler);
      });
      unsubscribe = () => {
        eventMap.forEach((handler, busName) => {
          bus.off(busName, handler);
        });
      };
      return [bus, unsubscribe];
    } else if (typeof busNameOrMap === "string" && handler) {
      // 处理单个事件的情况
      const busName = busNameOrMap;

      bus.on(busName, handler);

      unsubscribe = () => {
        bus.off(busName, handler);
      };
      return [bus, unsubscribe];
    } else {
      throw new Error("useBus: busNameOrMap must be a string or a Map");
    }
  }

  useListener(...args: any[]) {
    const target = args[0];
    const eventNameOrMap = args[1];
    const handler = args[2];
    let unsubscribe = undefined;
    if (eventNameOrMap instanceof Map) {
      // 处理事件映射对象的情况
      const eventMap = eventNameOrMap;
      eventMap.forEach((handler, eventName) => {
        target.addEventListener(eventName, handler);
      });
      unsubscribe = () => {
        eventMap.forEach((handler, eventName) => {
          target.removeEventListener(eventName, handler);
        });
      };
      return [target, unsubscribe];
    } else if (typeof eventNameOrMap === "string" && handler) {
      const options = args[3];
      // 处理单个事件的情况
      const eventName = eventNameOrMap;
      target.addEventListener(eventName, handler, options);

      unsubscribe = () => {
        target.removeEventListener(eventName, handler, options);
      };
      return [target, unsubscribe];
    } else {
      throw new Error("useListener: eventNameOrMap must be a string or a Map");
    }
  }
}

export const eventManager = new EventManagerImpl();

export function useEventBus(
  busName: string,
  handler: (...args: any[]) => void,
): void;
// 函数重载：支持传入事件映射对象
export function useEventBus(
  eventMap: Map<string, (...args: any[]) => void>,
): void;
// 函数实现
export function useEventBus(
  busNameOrMap: string | Map<string, (...args: any[]) => void>,
  handler?: (...args: any[]) => void,
) {
  if (busNameOrMap instanceof Map) {
    // 处理事件映射对象的情况
    const eventMap = busNameOrMap;
    eventMap.forEach((handler, busName) => {
      bus.on(busName, handler);
    });
    const unsubscribe = () => {
      eventMap.forEach((handler, busName) => {
        bus.off(busName, handler);
      });
    };
    return [bus, unsubscribe];
  } else if (typeof busNameOrMap === "string" && handler) {
    // 处理单个事件的情况
    const busName = busNameOrMap;
    bus.on(busName, handler);

    const unsubscribe = () => {
      bus.off(busName, handler);
    };
    return [bus, unsubscribe];
  }

  return bus;
}

// 函数重载：支持传入事件映射对象
export function useEventListener<T extends Event>(
  target: any,
  eventMap: Map<string, (event: T) => void>,
): void;
// 函数重载：支持传入单个事件名和处理函数
export function useEventListener<T extends Event>(
  target: any,
  eventName: string,
  handler: (event: T) => void,
  options?: AddEventListenerOptions,
): void;
// 函数实现
export function useEventListener<T extends Event>(
  target: any,
  eventNameOrMap: string | Map<string, (event: T) => void>,
  handler?: (event: T) => void,
  options?: AddEventListenerOptions,
) {
  if (eventNameOrMap instanceof Map) {
    // 处理事件映射对象的情况
    const eventMap = eventNameOrMap;

    eventMap.forEach((handler, eventName) => {
      target.addEventListener(eventName, handler);
    });

    const unsubscribe = () => {
      eventMap.forEach((handler, eventName) => {
        target.removeEventListener(eventName, handler);
      });
    };
    return [target, unsubscribe];
  } else if (typeof eventNameOrMap === "string" && handler) {
    // 处理单个事件的情况
    const eventName = eventNameOrMap;

    target.addEventListener(eventName, handler, options);

    const unsubscribe = () => {
      target.removeEventListener(eventName, handler, options);
    };
    return [target, unsubscribe];
  }
}
