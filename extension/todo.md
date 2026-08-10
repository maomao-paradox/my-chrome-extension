依赖声明/构建配置

- [ ] package.json: vue, vue-router, pinia, element-plus, @element-plus/icons-vue, @vitejs/plugin-
  vue, @vue/test-utils, eslint-plugin-vue, unplugin-vue-components, vue-eslint-parser
- [ ] yarn.lock
- [ ] package-lock.json
- [ ] vite.config.ts: @vitejs/plugin-vue, unplugin-vue-components, Vue manualChunks/optimizeDeps
- [ ] vitest.config.ts: @vitejs/plugin-vue
- [ ] eslint.config.js: Vue parser/plugin/rules
- [ ] tsconfig.json: includes src/\*\*/\*.vue
- [ ] src/vite-env.d.ts: \*.vue module declarations

非 .vue 但直接依赖 Vue/Pinia/Vue Router

- [ ] src/apps/textSelectionToolbar/index-old.ts
- [ ] src/assets/composables/useDomainManager.ts
- [ ] src/assets/composables/mouse/mouseTracker.ts
- [ ] src/assets/composables/mouse/useStarTrails.ts
- [ ] src/assets/icons/index.ts
- [ ] src/content/content-mria.ts
- [ ] src/content/content-qapro.ts
- [ ] src/content/content-teach.ts
- [ ] src/content/runtime/shadow-message.ts
- [ ] src/event/index.ts
- [ ] src/pages/options/main.ts
- [ ] src/pages/options/views/router.ts
- [ ] src/pages/profile/main.ts
- [ ] src/pages/sidepanel/main.ts
- [ ] src/stores/index.ts
- [ ] src/stores/error-monitor.ts
- [ ] src/utils/element-control.ts
- [ ] test/BookmarkPage.spec.ts
- [ ] test/element-control.spec.ts
- [ ] test/useDomainState.spec.ts

Vue SFC 文件，合计 109 个

- [ ] src/apps/floatingball/views/AIConversation.vue
- [ ] src/apps/floatingball/views/HiddenPathScanner.vue
- [ ] src/apps/textSelectionToolbar/App.vue
- [ ] src/apps/textSelectionToolbar/CommentDisplay.vue
- [ ] src/apps/textSelectionToolbar/CommentModal.vue
- [ ] src/apps/textSelectionToolbar/ReplaceModal.vue
- [ ] src/apps/textSelectionToolbar/TextToolbar.vue
- [ ] src/apps/textSelectionToolbar/TranslationPanel.vue
- [ ] src/assets/icons/GlowingArrow\.vue
- [ ] src/assets/components/\*\*/\*.vue: 60 个，主要是通用组件、layout、cursor、particles、logo、
  richtext、response-code、special 等
- [ ] src/pages/options/App.vue
- [ ] src/pages/options/App2.vue
- [ ] src/pages/options/views/\*.vue: 17 个
- [ ] src/pages/sidepanel/App.vue
- [ ] src/pages/sidepanel/views/\*.vue: 11 个
- [ ] src/pages/popup/App.vue
- [ ] src/pages/popup/components/TableContainer.vue
- [ ] src/pages/popup/views/\*.vue: 4 个
- [ ] src/pages/profile/App.vue
- [ ] src/pages/devtools/panel.vue
- [ ] src/pages/devtools/xhr.vue

额外注意

- [ ] src/pages/options/views/HeroSection.vue 里引用了 @/pages/index/App.vue，但这次文件扫描没有找到
  src/pages/index/App.vue，迁移时需要确认是否是历史残留或路径错误。
- [ ] src/assets/components/MaCollapse.vue 引用 @/plugins/floatingball/Draggable.vue，也需要确认目标
  文件是否仍存在。

