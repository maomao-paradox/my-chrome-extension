/**
 * @file vitest.config.react.ts
 * @description React 专用 Vitest 配置
 *
 * 背景：
 *   - 主配置 vitest.config.ts 启用了 @preact/preset-vite，会自动把
 *     `react` → `preact/compat`、`react/jsx-runtime` → `preact/jsx-runtime`
 *     重定向，导致 React 组件渲染时抛出 "older version of React" 错误。
 *   - 因此为 React 组件测试单独维护一份配置，不引入 preact preset。
 *
 * 使用方式：
 *   yarn test:react            # watch 模式
 *   yarn test:react:run         # 单次跑 React 测试
 *
 * 测试文件命名约定：`test/react-*.spec.ts(x)`
 *
 * @author Vivy
 * @date 2026-08-05
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // 仅启用 React 插件（不启用 preact/vue，避免相互污染）
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/assets/components"),
      "@icons": path.resolve(__dirname, "./src/assets/icons"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  test: {
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "http://localhost:3000/",
      },
    },
    // 仅匹配 react- 前缀的测试文件，避免与 preact/vue 测试冲突
    include: [
      "test/react-*.spec.ts",
      "test/react-*.spec.tsx",
      "test/react-*.test.ts",
      "test/react-*.test.tsx",
    ],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/apps/**/*.{ts,tsx}"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts"],
    },
    globals: true,
    isolate: true,
    testTimeout: 20000,
  },
});
