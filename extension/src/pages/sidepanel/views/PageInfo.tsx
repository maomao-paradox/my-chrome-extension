import React, { FC, useEffect, useState } from "react";
import "./PageInfo.scss";

interface PageInfo {
  currentUrl: string;
  pageTitle: string;
  domainName: string;
}

const PageInfo: FC<{}> = () => {
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    currentUrl: "加载中...",
    pageTitle: "加载中...",
    domainName: "加载中...",
  });
  function updatePageInfo(): void {
    try {
      // 从当前活动标签页获取信息
      chrome.tabs.query(
        { active: true, currentWindow: true },
        (tabs: chrome.tabs.Tab[]) => {
          if (tabs && tabs[0]) {
            const tab = tabs[0];

            // 更新UI显示
            const currentUrl = tab.url || "未知URL";
            const pageTitle = tab.title || "无标题页面";
            let domainName = "";

            // 提取域名
            try {
              if (tab.url) {
                const url = new URL(tab.url);
                domainName = url.hostname;
              }
            } catch (e) {
              domainName = "无法解析域名";
            }
            setPageInfo({ currentUrl, pageTitle, domainName });
          }
        },
      );
    } catch (error) {
      maLogger.error("更新页面信息失败:", error);
    }
  }

  // 组件挂载时更新页面信息
  useEffect(() => {
    if (!chrome.tabs) {
      setPageInfo({
        currentUrl: window.location.href,
        pageTitle: document.title,
        domainName: window.location.hostname,
      });
      return;
    }
    updatePageInfo();

    // 监听标签页变化，更新页面信息
    chrome.tabs.onActivated.addListener(() => {
      updatePageInfo();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id === tabId) {
            updatePageInfo();
          }
        });
      }
    });
  }, []);

  return (
    <div className="panel">
      <div className="panel-title">页面信息</div>
      <div className="info-display">
        <div className="info-item">
          <span className="info-label">当前URL:</span>
          <span className="info-value">{pageInfo.currentUrl}</span>
        </div>
        <div className="info-item">
          <span className="info-label">页面标题:</span>
          <span className="info-value">{pageInfo.pageTitle}</span>
        </div>
        <div className="info-item">
          <span className="info-label">域名:</span>
          <span className="info-value">{pageInfo.domainName}</span>
        </div>
      </div>
    </div>
  );
};

export default PageInfo;
