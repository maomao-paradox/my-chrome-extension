// AI助手DevTools面板 - 面板注册逻辑
import { installGlobalLogger, syncGlobalLoggerFromStorage } from '@/utils/logger';

installGlobalLogger({ title: 'MRIA DEVTOOLS', enabled: false });
void syncGlobalLoggerFromStorage();

chrome.devtools.panels.create(
  "AI助手",      // 面板名称
  "static/icons/favicon16.ico",     // 图标
  "pages/devtools/panel.html",   // 面板内容页面
  function(panel) {
    maLogger.log("AI助手面板创建成功");
    
    // 面板显示时触发
    panel.onShown.addListener(function(panelWindow) {
      maLogger.log("AI助手面板显示了");
      // 可以在这里初始化面板内容
    });
    
    // 面板隐藏时触发
    panel.onHidden.addListener(function() {
      maLogger.log("AI助手面板隐藏了");
      // 可以在这里清理资源
    });
  }
);

chrome.devtools.panels.create(
  "XHR助手",      // 面板名称
  "static/icons/favicon16.ico",     // 图标
  "pages/devtools/xhr.html",   // 面板内容页面
  function(panel) {
    maLogger.log("XHR助手面板创建成功");
    
    // 面板显示时触发
    panel.onShown.addListener(function(panelWindow) {
      maLogger.log("XHR助手面板显示了");
      // 可以在这里初始化面板内容
    });
    
    // 面板隐藏时触发
    panel.onHidden.addListener(function() {
      maLogger.log("XHR助手面板隐藏了");
      // 可以在这里清理资源
    });
  }
);


// 创建侧边栏
chrome.devtools.panels.elements.createSidebarPane(
  "AI助手",
  function(sidebar) {
    // 侧边栏初始化
    sidebar.setObject({ 
      name: "AI助手",
      version: "1.0.0",
      description: "通过自然语言指令操控浏览器的智能助手",
      features: [
        "DOM操作",
        "页面导航",
        "网络请求",
        "浏览器设置",
        "截图功能"
      ]
    });
  }
);
