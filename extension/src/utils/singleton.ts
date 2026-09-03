import { AppModule } from "@/types";

// 创建代理类，拦截所有 new 操作
export const useSingletonEffect = (className: AppModule) =>
  new Proxy(className, {
    construct(target, args, newTarget) {
      // 如果实例不存在，创建新实例
      if (!target["_instance"]) {
        // 使用 Reflect.construct 绕过私有构造函数限制
        const instance = Reflect.construct(target, args, newTarget);
        Object.defineProperty(target, "instance", {
          value: instance,
          writable: false,
          configurable: false,
          enumerable: false,
        });
      }
      return target["_instance"];
    },
  });
