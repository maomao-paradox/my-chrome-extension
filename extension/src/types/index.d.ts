/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/index.ts
 * @date 2026-02-05T02:38:01.697Z
 */

import { type Requester } from '@/services/api/mria-api';
import { type Logger } from '@/utils/logger';


// 全局类型声明
declare global {
    var maLogger: Logger;

    interface Window {
        maLogger: Logger;
    }

    interface AppContext extends Window {
        gmod: (...args: any[]) => any;
        message: {
            success: (message: string, options?: any) => void;
            error: (message: string, options?: any) => void;
            warning: (message: string, options?: any) => void;
            info: (message: string, options?: any) => void;
        };
        requester?: Requester;
        globalConfig?: any;
    }

    namespace NodeJS {
        interface ProcessEnv {
            readonly NODE_ENV: 'development' | 'production' | 'test';
            readonly API_BASE_URL: string;
        }
    }
}

// 统一导出所有类型
export * from './api';
export * from './components';
export * from './store';
export * from './utils';
export * from './message';
export * from './automation';
