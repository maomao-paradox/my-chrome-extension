/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/components/icons/index.ts
 * @date 2026-02-05T02:38:01.693Z
 */

import { Component } from 'vue';

// 简洁的导入导出方式
export { default as IconDownload } from './download.svg?component';
export { default as IconSearch } from './search.svg?component';
export { default as IconDelete } from './delete.svg?component';
export { default as IconInfo } from './info.svg?component';
export { default as IconEarth } from './earth.svg?component';
export { default as IconSetting } from './setting.svg?component';
export { default as IconDocument } from './document.svg?component';
export { default as IconLoading } from './loading.svg?component';
export { default as IconCommunity } from './community.svg?component';
export { default as IconSupport } from './support.svg?component';
export { default as IconTooling } from './tool.svg?component';
export { default as IconEcosystem } from './ecosystem.svg?component';
export { default as IconUpload } from './upload.svg?component';
export { default as IconOpen } from './open.svg?component';
export { default as IconBookmark } from './bookmark.svg?component';
export { default as IconFullScreen } from './full-screen.svg?component';
export { default as IconOffScreen } from './off-screen.svg?component';
export { default as IconClose } from './close.svg?component';
export { default as IconTime } from './time.svg?component';
export { default as IconCapture } from './capture.svg?component';
export { default as GlowingArrow } from './GlowingArrow.vue'
export { default as IconConfirm } from './confirm.svg?component'
export { default as IconAIChat } from './ai-chat.svg?component'

import IconAIChat from './ai-chat.svg?component'

export const toolIcon: Map<string, Component> = new Map([
    ['ai-chat', IconAIChat as Component],
])
