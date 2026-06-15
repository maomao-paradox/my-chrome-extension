/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/esm-module-loader.ts
 * @date 2026-02-05T02:38:01.699Z
 */

// utils/esm-module-loader.ts
export interface ModuleFactory<T = any, C = any> {
    default: (context: AppContext, config?: C) => T | Promise<T>;
}

export interface LoaderConfig {
    basePath?: string;
    enableCache?: boolean;
}

export interface ModuleOption {
    domainKey?: string;
    path: string | Promise<string>;
    flag: string;
}

export class ESMModuleLoader<T extends Record<string, any> = any> {
    private _context: AppContext;

    constructor(context: AppContext) {
        this._context = context;
    }

    async load<K extends keyof T>(
        moduleOption: ModuleOption,
        initOptions?: T[K] extends { _config?: infer C } ? C : never
    ): Promise<T[K] extends { _instance?: infer I } ? I : T[K]> {
        // 只在顶层加载，在iframe中不加载
        if (window.self !== window.top) {
            return Promise.resolve(this._context.gmod(moduleOption.flag));
        }
        if (typeof moduleOption.path === 'object' && moduleOption.path instanceof Promise) {
            moduleOption.path = await moduleOption.path;
        }
        // 类型安全的加载实现...
        const module = await import(String(moduleOption.path)) as ModuleFactory;
        const instance = await Promise.resolve(module.default(this._context, initOptions));
        Object.defineProperty(this._context, moduleOption.flag, {
            value: instance,
            writable: true,
            enumerable: true,
            configurable: false
        });
        maLogger.info(`%c[ESM] ${moduleOption.flag} has been loaded.`, 'font-weight: bold; color: rgba(94, 235, 153, 1)');
        // maLogger.groupEnd();
        return instance;
    }
}
