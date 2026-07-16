import { onMounted, onUnmounted } from 'vue';
import mitt, { Emitter } from 'mitt';

export const bus = mitt();

export interface EventManager {
    useBus(busName: string, handler: (...args: any[]) => void): Emitter<any> | void
    useBus(eventMap: Map<string, (...args: any[]) => void>): Emitter<any> | void
    useListener<T extends Event>(target: any, eventMap: Map<string, (event: T) => void>): void
    useListener<T extends Event>(target: any, eventName: string, handler: (event: T) => void, options?: AddEventListenerOptions): void
}

class EventManagerImpl implements EventManager {
  constructor() {
  }
  useBus(...args: any[]) {
    const busNameOrMap = args[0];
    const handler = args[1];

    if (busNameOrMap instanceof Map) {
      // 处理事件映射对象的情况
      const eventMap = busNameOrMap;
      onMounted(() => {
        eventMap.forEach((handler, busName) => {
          bus.on(busName, handler);
        });
      });
      onUnmounted(() => {
        eventMap.forEach((handler, busName) => {
          bus.off(busName, handler);
        });
      });
    } else if (typeof busNameOrMap === 'string' && handler) {
      // 处理单个事件的情况
      const busName = busNameOrMap;
      onMounted(() => {
        bus.on(busName, handler);
      });
      onUnmounted(() => {
        bus.off(busName, handler);
      });
    }

    return bus;
  }

  useListener(...args: any[]) {
    const target = args[0];
    const eventNameOrMap = args[1];
    const handler = args[2];
    if (eventNameOrMap instanceof Map) {
      // 处理事件映射对象的情况
      const eventMap = eventNameOrMap;
      onMounted(() => {
        eventMap.forEach((handler, eventName) => {
          target.addEventListener(eventName, handler);
        });
      });
      onUnmounted(() => {
        eventMap.forEach((handler, eventName) => {
          target.removeEventListener(eventName, handler);
        });
      });
    } else if (typeof eventNameOrMap === 'string' && handler) {
      const options = args[3];
      // 处理单个事件的情况
      const eventName = eventNameOrMap;
      onMounted(() => {
        target.addEventListener(eventName, handler, options);
      });
      onUnmounted(() => {
        target.removeEventListener(eventName, handler, options);
      });
    }
  }
}

export const eventManager = new EventManagerImpl();

export function useEventBus(busName: string, handler: (...args: any[]) => void): void
// 函数重载：支持传入事件映射对象
export function useEventBus(eventMap: Map<string, (...args: any[]) => void>): void
// 函数实现
export function useEventBus(busNameOrMap: string | Map<string, (...args: any[]) => void>, handler?: (...args: any[]) => void) {
  if (busNameOrMap instanceof Map) {
    // 处理事件映射对象的情况
    const eventMap = busNameOrMap;
    onMounted(() => {
      eventMap.forEach((handler, busName) => {
        bus.on(busName, handler);
      });
    });
    onUnmounted(() => {
      eventMap.forEach((handler, busName) => {
        bus.off(busName, handler);
      });
    });
  } else if (typeof busNameOrMap === 'string' && handler) {
    // 处理单个事件的情况
    const busName = busNameOrMap;
    onMounted(() => {
      bus.on(busName, handler);
    });
    onUnmounted(() => {
      bus.off(busName, handler);
    });
  }

  return bus;
}

// 函数重载：支持传入事件映射对象
export function useEventListener<T extends Event>(target: any, eventMap: Map<string, (event: T) => void>): void
// 函数重载：支持传入单个事件名和处理函数
export function useEventListener<T extends Event>(target: any, eventName: string, handler: (event: T) => void, options?: AddEventListenerOptions): void
// 函数实现
export function useEventListener<T extends Event>(target: any, eventNameOrMap: string | Map<string, (event: T) => void>, handler?: (event: T) => void, options?: AddEventListenerOptions) {
  if (eventNameOrMap instanceof Map) {
    // 处理事件映射对象的情况
    const eventMap = eventNameOrMap;
    onMounted(() => {
      eventMap.forEach((handler, eventName) => {
        target.addEventListener(eventName, handler);
      });
    });
    onUnmounted(() => {
      eventMap.forEach((handler, eventName) => {
        target.removeEventListener(eventName, handler);
      });
    });
  } else if (typeof eventNameOrMap === 'string' && handler) {
    // 处理单个事件的情况
    const eventName = eventNameOrMap;
    onMounted(() => {
      target.addEventListener(eventName, handler, options);
    });
    onUnmounted(() => {
      target.removeEventListener(eventName, handler, options);
    });
  }
}
