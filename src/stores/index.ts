/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/stores/index.ts
 * @date 2026-02-05T02:38:01.697Z
 */

// stores/index.js

import { createPinia } from 'pinia'

const pinia = createPinia();

export { pinia };

export { default as storage, type PageStorage, type ExtStorage } from './chromestorge';
