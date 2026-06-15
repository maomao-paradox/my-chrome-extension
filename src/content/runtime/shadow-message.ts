import { createApp } from 'vue';
import  { ElMessage } from 'element-plus';
import { shadowHostId } from '@/config';
import { createShadowHost } from '@/utils/shadow-dom';

export const initializeShadowMessage = (ctx: AppContext): ShadowRoot | null => {
    const { shadowRoot } = createShadowHost(shadowHostId, 'open');

    if (shadowRoot) {
        const mountPoint = document.createElement('div');
        mountPoint.id = 'shadow-app';
        shadowRoot.appendChild(mountPoint);

        const shadowApp = createApp({}, {
            popupContainer: mountPoint,
        });
        shadowApp.mount(mountPoint);

        Object.defineProperty(ctx, 'message', {
            value: {},
            writable: true,
            enumerable: false,
            configurable: false,
        });

        const messageTypes: Array<'success' | 'error' | 'warning' | 'info'> = ['success', 'error', 'warning', 'info'];
        messageTypes.forEach((type) => {
            Object.defineProperty(ctx.message, type, {
                value: (message: string, options: any = {}) => {
                    ElMessage[type]({
                        message,
                        appendTo: mountPoint,
                        ...options,
                    });
                },
                writable: false,
                enumerable: false,
                configurable: false,
            });
        });
    }

    Object.defineProperty(ctx, '__SHADOW_DOM', {
        value: shadowRoot,
        writable: false,
        enumerable: false,
        configurable: false,
    });

    return shadowRoot;
};
