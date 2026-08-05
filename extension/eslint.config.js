import js from "@eslint/js";
import globals from "globals";
import vue from "eslint-plugin-vue";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "rust-wasm/**",
      "plugins/**",
      "public/**",
      "*.config.js",
      "*.config.ts",
      "*.json",
      ".vscode/**",
      ".idea/**",
    ],
  },

  js.configs.recommended,

  // Vue 配置（使用 vue-eslint-parser）
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      vue,
    },
    rules: {
      ...vue.configs["flat/recommended"].rules,
      "vue/multi-word-component-names": "off",
      "vue/component-name-in-template-casing": ["error", "PascalCase"],
      "vue/attributes-order": [
        "error",
        {
          order: [
            "DEFINITION",
            "LIST_RENDERING",
            "CONDITIONALS",
            "RENDER_MODIFIERS",
            "GLOBAL",
            "UNIQUE",
            "TWO_WAY_BINDING",
            "OTHER_DIRECTIVES",
            "OTHER_ATTR",
            "EVENTS",
            "CONTENT",
          ],
        },
      ],
    },
  },

  // TypeScript 文件配置
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },

  // 针对 eval 警告的特殊规则（允许某些场景）
  {
    files: ["**/mcp-executor.ts", "**/getPageVariable.js"],
    rules: {
      "no-eval": "off", // 或 'warn' 如果你想保持警告
      "no-new-func": "off",
    },
  },

  // 全局变量
  {
    files: ["**/*.{js,ts,vue}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        defineProps: "readonly",
        defineEmits: "readonly",
        defineExpose: "readonly",
        withDefaults: "readonly",
        maLogger: "readonly",
        chrome: "readonly",
        AppContext: "readonly",
        gmod: "readonly",
        NodeJS: "readonly",
      },
    },
  },

  // 通用规则
  {
    files: ["**/*.{js,ts,vue}"],
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-eval": "error", // 默认禁止 eval
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      quotes: ["error", "single", { avoidEscape: true }],
      semi: ["error", "always"],
      "comma-dangle": ["error", "never"],
      indent: ["error", 2, { SwitchCase: 1 }],
    },
  },
];
