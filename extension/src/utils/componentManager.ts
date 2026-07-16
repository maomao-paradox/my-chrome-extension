/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/componentManager.ts
 * @date 2026-02-05T02:38:01.698Z
 */

// utils/componentManager.js
class ComponentManager {
  private _components: Map<string, any>;
  constructor() {
    this._components = new Map();
  }

  register(name: string, component: any) {
    this._components.set(name, component);
  }

  unregister(name: string) {
    this._components.delete(name);
  }

  call(name: string, method: string, ...args: any[]) {
    const component = this._components.get(name);
    if (component && component[method]) {
      return component[method](...args);
    }
  }
}

export const componentManager = new ComponentManager();