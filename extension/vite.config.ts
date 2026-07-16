import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.config";
import path from "path";
import encryptFileMapPlugin from "./plugins/encrypt-file-map";
import removeConsole from "vite-plugin-remove-console";
import scanFiles from "./plugins/scan-input-file";
import generateFileMapPlugin from "./plugins/generate-file-map";
import svgLoader from "vite-svg-loader";

const isEncryptEnabled = process.env.ENCRYPT_FILE_MAP === "true";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/assets/components"),
      "@icons": path.resolve(__dirname, "./src/assets/icons"),
      "@types": path.resolve(__dirname, "./src/assets/types"),
    },
  },
  root: "src/",
  publicDir: "../public",
  envDir: "../",
  cacheDir: "../node_modules/.vite",
  plugins: [
    vue(),
    svgLoader(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: true,
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: true,
    }),
    crx({
      manifest,
      contentScripts: {
        injectCss: false,
      },
    }),
    removeConsole({
      // 保留指定的 console 方法
      external: ["error", "warn"], // 保留 console.error 和 console.warn
    }),
    generateFileMapPlugin(),
    isEncryptEnabled ? encryptFileMapPlugin() : undefined,
  ].filter(Boolean) as any,
  esbuild: {
    include: /\.[jt]sx?$/,
    exclude: [],
    loader: "ts",
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
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      // onwarn(warning, warn) {
      //   // 过滤所有提到的警告
      //   const ignored = [
      //     "contains an annotation that Rollup cannot interpret",
      //     // 'Use of eval'
      //   ];
      //   if (ignored.some((msg) => warning.message.includes(msg))) {
      //     return;
      //   }
      //   warn(warning);
      // },
      input: {
        "pages/profile": path.resolve(__dirname, "src/pages/profile.html"),
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
          dirPath: "src/pages/devtools",
          prefix: "devtools",
          extFilter: ".html",
        }),
        ...scanFiles({
          dirPath: "src/runtime",
          prefix: "runtime",
          useIndexFile: true,
          recursive: true,
        }),
        ...scanFiles({
          dirPath: "src/workers",
          prefix: "workers",
          useIndexFile: true,
          recursive: true,
        }),
      },
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "pinia"],
          "element-plus": ["element-plus", "@element-plus/icons-vue"],
          // 基础设施 - 纯函数工具，可在 Service Worker 中使用
          "infrastructure-pure": ["@/utils/pure-utils"],
          // DOM 工具 - 仅限有 DOM 访问权限的上下文使用
          "infrastructure-dom": ["@/utils/dom-utils"],
          message: ["@/message"],
          "content-runtime": ["@/content/runtime"],
          components: ["@/assets/components"],
          jsqr: ["jsqr"],
        },
        chunkFileNames: `assets/js/chunks/chunk-[hash].js`,
        assetFileNames: (assetInfo) => {
          const fileExtname = path.extname(assetInfo.name || "");
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
          } else if (chunkName.startsWith("runtime/")) {
            return `assets/js/runtime/[hash].js`;
          } else if (chunkName.startsWith("apps/")) {
            return `assets/js/apps/[hash].js`;
          } else if (chunkName.startsWith("devtools/")) {
            return `pages/devtools/[hash].js`;
          } else if (chunkName.startsWith("workers/")) {
            return `static/js/[name].js`;
          } else {
            return `assets/js/[hash].js`;
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      "vue",
      "pinia",
      "vue-router",
      "element-plus",
      "jsqr",
      "jszip",
      "file-saver",
      "crypto-js",
    ],
    esbuildOptions: {
      target: "es2022",
      loader: {
        ".ts": "ts",
        ".tsx": "tsx",
      },
    },
  },
});
