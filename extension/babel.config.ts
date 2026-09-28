export default {
  // presets: [
  //   '@vue/cli-plugin-babel/preset'
  // ],
  presets: [
    [
      "@babel/preset-env",
      {
        // 关键配置：按需注入 polyfill，避免直接 require 模块
        useBuiltIns: "usage",  
        corejs: 3,            // 必须与安装的 core-js 版本一致
        modules: false,        // 保留 ES 模块语法，让打包工具处理
        shippedProposals: true // 启用提案阶段的语法 polyfill
      }
    ]
  ]
}
