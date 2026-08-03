/**
 * @file vitest.config.ts
 * @description Vitest 测试框架配置文件
 *   - 使用 happy-dom 提供 DOM 模拟环境（element-control.ts 重度依赖 DOM API）
 *   - 复用 tsconfig 的路径别名（@ -> src/），让被测代码 import 顺利解析
 *   - 故意不加载 vite.config.ts 中的 chrome 扩展插件（crx / encryptFileMapPlugin 等），
 *     避免测试环境被构建期插件污染
 * @author Vivy
 * @date 2026-08-03
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
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
    include: ["test/**/*.spec.ts", "test/**/*.test.ts"],
    // 全局 setup：注入 maLogger / chrome API 等 chrome 扩展运行时
    setupFiles: ["./test/setup.ts"],
    // 测试覆盖率配置（可选，未来扩展使用）
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/utils/**/*.{ts,tsx}"],
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
