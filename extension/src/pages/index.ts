interface PageLink {
  title: string;
  description: string;
  path?: string;
}

const pages: PageLink[] = [
  {
    title: "组件墙",
    description: "展示扩展中可用的 UI 组件和元素。",
    path: "components.html",
  },
  {
    title: "弹出面板",
    description: "从浏览器工具栏打开的扩展主面板。",
    path: "popup.html",
  },
  {
    title: "设置面板",
    description: "管理扩展选项和功能配置。",
    path: "options.html",
  },
  {
    title: "侧边栏",
    description: "在浏览器侧边栏中使用扩展功能。",
    path: "sidebar.html",
  },
  {
    title: "开发者工具",
    description: "扩展提供的 DevTools 页面。",
    path: "devtools.html",
  },
];

const container = document.querySelector<HTMLElement>("#pages");
if (!container) {
  throw new Error("Quick navigation page container was not found.");
}

const availablePages = pages.filter(
  (page): page is PageLink & { path: string } => Boolean(page.path),
);

if (availablePages.length === 0) {
  const emptyState = document.createElement("p");
  emptyState.className = "empty";
  emptyState.textContent = "当前构建版本没有启用可跳转的扩展页面。";
  container.append(emptyState);
} else {
  for (const page of availablePages) {
    const link = document.createElement("a");
    link.className = "page-link";
    link.href = page.path;
    link.target = "";
    link.rel = "noreferrer";

    const title = document.createElement("strong");
    title.textContent = page.title;
    const description = document.createElement("span");
    description.textContent = page.description;

    link.append(title, description);
    container.append(link);
  }
}
