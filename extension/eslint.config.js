import js from "@eslint/js";
import globals from "globals";
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint"; // 改这里
import vueParser from "vue-eslint-parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

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

  // Vue 配置
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser, // 改这里，使用 tseslint 的 parser
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

  // React 配置
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    // 排除 .vue 文件
    ignores: ["**/*.vue"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // TypeScript 配置（应用到所有 .ts/.tsx 文件，但 .vue 文件已经由 vue 配置处理）
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.vue"], // 排除 .vue 文件
    languageOptions: {
      parser: tseslint.parser, // 改这里
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin, // 改这里
    },
    rules: {
      ...tseslint.configs.recommended.rules, // 改这里
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

  // 针对 eval 警告的特殊规则
  {
    files: ["**/mcp-executor.ts", "**/getPageVariable.js"],
    rules: {
      "no-eval": "off",
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
      "no-eval": "error",
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
