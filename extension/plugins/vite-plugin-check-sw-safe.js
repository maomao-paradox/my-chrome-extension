// plugins/vite-plugin-check-sw-safe.js
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

const traverse = traverseModule.default || traverseModule;

/**
 * Service Worker 不安全 API 检查插件
 *
 * 原理：在 generateBundle 阶段，递归收集 background 入口依赖的所有 chunk，
 * 对每个 chunk 的源码做 AST 分析，发现裸的 document/window/... 访问就报错。
 */
function checkSwSafe(options = {}) {
  const {
    // 入口模块的路径关键字（用于识别 background 入口）
    entryPattern = /service-worker\/background\.(ts|js)$/,
    // 危险标识符
    dangerous = [
      "document",
      "window",
      "localStorage",
      "sessionStorage",
      "navigator",
    ],
    // 是否把函数体内的访问也报出来（默认报，但标记为 warning）
    reportInsideFunction = true,
    // 白名单：文件路径匹配这些正则的跳过
    ignoreFiles = [/node_modules/],
    // 是否在构建失败时阻断（默认 true）
    failOnError = true,
  } = options;

  return {
    name: "check-sw-safe",
    apply: "build",
    enforce: "post",

    generateBundle(_, bundle) {
      const entryChunk = Object.values(bundle).find(
        (c) =>
          c.type === "chunk" &&
          c.facadeModuleId &&
          entryPattern.test(c.facadeModuleId),
      );
      if (!entryChunk) {
        this.warn("[check-sw-safe] 未找到 background 入口，跳过检查");
        return;
      }

      // 递归收集 background 链上的所有 chunk
      const visited = new Set();
      const chunks = [];
      const collect = (chunk) => {
        if (!chunk || visited.has(chunk.fileName)) return;
        visited.add(chunk.fileName);
        chunks.push(chunk);
        for (const imp of [
          ...(chunk.imports || []),
          ...(chunk.dynamicImports || []),
        ]) {
          const dep = bundle[imp];
          if (dep && dep.type === "chunk") collect(dep);
        }
      };
      collect(entryChunk);

      const errors = [];
      const warnings = [];

      for (const chunk of chunks) {
        // 遍历 chunk 里的每个模块
        for (const [moduleId, mod] of Object.entries(chunk.modules || {})) {
          // 跳过第三方库
          if (moduleId.includes("node_modules")) continue;
          // 跳过非业务源码（虚拟模块等）
          if (!moduleId.startsWith("/") && !moduleId.includes(":")) continue;

          const code = mod.code || mod.originalCode;
          if (!code) continue;

          const result = scanModule(code, moduleId, dangerous, {
            reportInsideFunction,
          });
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        }
      }

      // 输出
      if (warnings.length) {
        for (const w of warnings) this.warn(`[check-sw-safe] ${w}`);
      }
      if (errors.length) {
        const msg = [
          "",
          "💥 Service Worker 业务代码包含不安全的浏览器 API：",
          "",
          ...errors.map((e) => `  ${e}`),
          "",
          "  SW 里不存在 document/window/localStorage/sessionStorage。",
          "  修法：切断 background → 该模块的引用链，或加 typeof 保护。",
          "",
        ].join("\n");
        if (failOnError) this.error(msg);
        else this.warn(msg);
      } else {
        this.info?.(
          `[check-sw-safe] ✅ background 链上 ${chunks.length} 个 chunk 通过检查`,
        );
      }
    },
  };
}

/**
 * 扫描一段代码，找出裸的 document/window/... 访问
 */
function scanModule(code, moduleId, dangerous, options = {}) {
  const errors = [];
  const warnings = [];
  const { reportInsideFunction = true } = options;

  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      errorRecovery: true,
      plugins: ["jsx", "typescript", "classProperties", "dynamicImport"],
    });
  } catch (e) {
    warnings.push(`${moduleId}: AST 解析失败 (${e.message})`);
    return { errors, warnings };
  }

  const lines = code.split("\n");

  traverse(ast, {
    Identifier(path) {
      const name = path.node.name;
      if (!dangerous.includes(name)) return;

      const parent = path.parentPath;

      // 排除对象属性 obj.document
      if (
        parent.isMemberExpression() &&
        parent.node.property === path.node &&
        !parent.node.computed
      )
        return;
      // 排除对象 key { document: 1 }
      if (
        parent.isObjectProperty() &&
        parent.node.key === path.node &&
        !parent.node.computed
      )
        return;
      // 排除属性简写 { window }
      if (parent.isObjectProperty() && parent.node.shorthand) return;
      // 排除解构 { window } = obj
      if (parent.isObjectPattern()) return;
      // 排除变量声明 const window = ...
      if (parent.isVariableDeclarator() && parent.node.id === path.node) return;
      // 排除函数参数 function f(window) {}
      if (parent.isFunction() && parent.node.params.includes(path.node)) return;
      // 排除 import { window }
      if (parent.isImportSpecifier()) return;

      // 排除 typeof 保护（向上找最近的 UnaryExpression）
      let p = path.parentPath;
      while (p) {
        if (
          p.isUnaryExpression() &&
          p.node.operator === "typeof" &&
          p.node.argument === path.node
        )
          return;
        if (p.isStatement() || p.isFunction()) break;
        p = p.parentPath;
      }

      // 宽松版：同一行有 typeof window
      const loc = path.node.loc?.start;
      if (loc) {
        const line = lines[loc.line - 1] || "";
        if (new RegExp(`typeof\\s+${name}\\b`).test(line)) return;
        // UMD 环境探测：同一行有 typeof globalThis 和 typeof window
        if (
          line.includes("typeof globalThis") &&
          line.includes(`typeof ${name}`)
        )
          return;
      }

      // 判定：顶层 error，函数体内 warning
      const fnPath = path.findParent((p) => p.isFunction());
      const isTopLevel = !fnPath;
      const locStr = loc ? `${moduleId}:${loc.line}:${loc.column}` : moduleId;
      const line = loc ? (lines[loc.line - 1] || "").trim().slice(0, 120) : "";
      const msg = `${locStr} 访问了 ${name}  →  ${line}`;

      if (isTopLevel) errors.push(msg);
      else if (reportInsideFunction) warnings.push(msg);
    },
  });

  return { errors, warnings };
}

export default checkSwSafe;
