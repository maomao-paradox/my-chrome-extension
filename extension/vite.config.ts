import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import { crx } from "@crxjs/vite-plugin";
import { createManifest, type ManifestPageFlags } from "./src/manifest.config";
import { loadEnv } from "vite";
import path from "path";
import encryptFileMapPlugin from "./plugins/encrypt-file-map";
import removeConsole from "vite-plugin-remove-console";
import scanFiles from "./plugins/scan-input-file";
import generateFileMapPlugin from "./plugins/generate-file-map";

export default ({
  mode,
  command,
  isSsrBuild,
  isPreview,
}: {
  mode: string;
  command: string;
  isSsrBuild: boolean;
  isPreview: boolean;
}) => {
  const env = loadEnv(mode, process.cwd(), "");
  // console.log(env);
  const isEnvEnabled = (key: string, defaultValue = true): boolean =>
    env[key] === undefined ? defaultValue : env[key].toLowerCase() !== "false";
  const pages: ManifestPageFlags = {
    popup: isEnvEnabled("VITE_BUILD_POPUP"),
    options: isEnvEnabled("VITE_BUILD_OPTIONS"),
    sidepanel: isEnvEnabled("VITE_BUILD_SIDEPANEL"),
    devtools: isEnvEnabled("VITE_BUILD_DEVTOOLS"),
  };

  const isEncryptEnabled = isEnvEnabled("ENCRYPT_FILE_MAP");
  const isGenerateSourceMaps = isEnvEnabled("GENERATE_SOURCE_MAPS");
  const isProduction = env.NODE_ENV === "production";

  return defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/assets/components"),
        "@icons": path.resolve(__dirname, "./src/assets/icons"),
        "@types": path.resolve(__dirname, "./src/types"),
      },
    },
    root: "src/",
    publicDir: "../public",
    envDir: "../",
    cacheDir: "../node_modules/.vite",
    plugins: [
      react(),
      crx({
        manifest: createManifest(pages),
        contentScripts: {
          injectCss: false,
        },
      }),
      removeConsole({
        // 保留指定的 console 方法
        external: ["error", "warn"], // 保留 console.error 和 console.warn
      }),
      generateFileMapPlugin(),
      isEncryptEnabled
        ? encryptFileMapPlugin(env.VITE_FILE_MAP_KEY)
        : undefined,
      // 自定义插件，用于执行构建后的操作
      {
        name: "post-build-actions", // 插件名称
        closeBundle: () => {
          console.log("✅ 构建完成，dist 目录已生成！");
          // 在这里调用你的打包脚本或执行任何 Node.js 代码
          // 例如：
          // execSync('npm run zip');
          // 或执行你之前的打包逻辑
          console.log("📦 开始执行打包压缩...");
          // ... 你的打包逻辑
        },
      },
    ].filter(Boolean) as any,
    esbuild: {
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      mangleQuoted: true,
    },
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      modulePreload: false,
      minify: "esbuild",
      manifest: true,

      chunkSizeWarningLimit: 1024,
      sourcemap: isGenerateSourceMaps,
      cssCodeSplit: true,
      rollupOptions: {
        onwarn(warning, warn) {
          // 过滤所有提到的警告
          const ignored = [
            "contains an annotation that Rollup cannot interpret",
            // 'Use of eval'
          ];
          if (ignored.some((msg) => warning.message.includes(msg))) {
            return;
          }
          warn(warning);
        },
        input: {
          ...(pages.popup
            ? { "pages/popup": path.resolve(__dirname, "src/pages/popup.html") }
            : {}),
          ...(pages.options
            ? {
                "pages/options": path.resolve(
                  __dirname,
                  "src/pages/options.html",
                ),
              }
            : {}),
          ...(pages.sidepanel
            ? {
                "pages/sidepanel": path.resolve(
                  __dirname,
                  "src/pages/sidepanel.html",
                ),
              }
            : {}),
          ...(pages.devtools
            ? {
                "pages/devtools-page": path.resolve(
                  __dirname,
                  "src/pages/devtools.html",
                ),
              }
            : {}),
          ...(pages.devtools
            ? scanFiles({
                dirPath: "src/pages/devtools",
                prefix: "devtools",
                extFilter: ".html",
              })
            : {}),
          ...(isProduction
            ? {
                ...scanFiles({
                  dirPath: "src/apps",
                  prefix: "apps",
                  useIndexFile: true,
                  recursive: true,
                }),
                ...scanFiles({
                  dirPath: "src/content",
                  prefix: "content",
                  exclude: ["main.ts"],
                }),
                ...scanFiles({
                  dirPath: "src/sfs",
                  prefix: "sfs",
                  useIndexFile: true,
                  recursive: true,
                }),
              }
            : {}),
        },
        output: {
          manualChunks: isProduction
            ? {
                react: ["react", "react-dom/client"],
                antd: ["antd", "@ant-design/icons"],
                // 基础设施 - 纯函数工具，可在 Service Worker 中使用
                "infrastructure-pure": ["@/utils/pure-utils"],
                // DOM 工具 - 仅限有 DOM 访问权限的上下文使用
                "infrastructure-dom": ["@/utils/dom-utils"],
                message: ["@/message"],
                "content-runtime": ["@/content/runtime"],
              }
            : undefined,
          chunkFileNames: `assets/js/chunks/chunk-${isProduction ? "" : "[name]-"}[hash].js`,
          assetFileNames: (assetInfo) => {
            const fileExtname = path.extname(assetInfo.names?.[0] || "");

            if (
              [
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".svg",
                ".webp",
                ".mp3",
                ".wav",
                ".ogg",
                ".mp4",
                ".webm",
                ".ttf",
                ".woff",
                ".woff2",
                ".eot",
              ].includes(fileExtname)
            ) {
              return `static/[hash].[ext]`;
            }
            if (fileExtname === ".css") {
              return `assets/css/[hash].[ext]`;
            }
            return `assets/[hash].[ext]`;
          },
          entryFileNames: (chunkInfo) => {
            const chunkName = chunkInfo.name || "";
            if (chunkName.startsWith("content/")) {
              return `assets/js/content/[hash].js`;
            } else if (chunkName.startsWith("sfs/")) {
              return `assets/js/sfs/[hash].js`;
            } else if (chunkName.startsWith("apps/")) {
              return `assets/js/apps/[hash].js`;
            } else if (chunkName.startsWith("devtools/")) {
              return `pages/devtools/[hash].js`;
            } else {
              return `assets/js/[hash].js`;
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
      esbuildOptions: {
        target: "es2022",
      },
    },
  });
};
