/**
 * @file vitest.config.ts
 * @description React tests use the React plugin to avoid Preact aliases.
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // 解析与 vite.config.ts 保持一致的路径别名
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/assets/components"),
      "@icons": path.resolve(__dirname, "./src/assets/icons"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  test: {
    // DOM 密集型工具，使用 happy-dom 提供轻量浏览器环境
    environment: "happy-dom",
    // happy-dom 环境选项：配置基础 URL
    environmentOptions: {
      happyDOM: {
        url: "http://localhost:3000/",
      },
    },
    // 测试文件匹配规则
    include: [
      "test/react-*.spec.ts",
      "test/react-*.spec.tsx",
      "test/react-*.test.ts",
      "test/react-*.test.tsx",
      "test/content-feature-manager.spec.ts",
      "test/route-watcher.spec.ts",
    ],
    // 全局 setup：注入 maLogger / chrome API 等 chrome 扩展运行时
    setupFiles: ["./test/setup.ts"],
    // 测试覆盖率配置（可选，未来扩展使用）
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/modules/**/*.{ts,tsx}"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts"],
    },
    // 全局 API（describe/it/expect）无需 import 即可使用
    globals: true,
    // 隔离策略：每个测试文件独立的 DOM 上下文，避免相互污染
    isolate: true,
    // 单测最长 20s（waitForSelector 等异步流程需要余量）
    testTimeout: 20000,
  },
});
