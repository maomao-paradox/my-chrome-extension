/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/views/CapturePage.tsx
 * @description 广告拦截入口 - 从当前页面点选并保存广告元素规则
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CameraOutlined } from '@ant-design/icons';
import TableContainer from '../components/TableContainer';
import { useDomainState } from '../composables/useDomainState';
import type { ExtMessage } from '@/types';
import './capture-page.scss';

/**
 * 广告拦截状态枚举
 */
type CaptureStatus = 'on' | 'pending' | 'off';

/**
 * 广告拦截页面组件
 */
export const CapturePage: React.FC = () => {
  const { isDomainDisabled, checkDomainStatus } = useDomainState();
  const [isCheckingSiteReadiness, setIsCheckingSiteReadiness] = useState(false);
  const [isContentScriptReady, setIsContentScriptReady] = useState<boolean | null>(null);

  /** 拦截状态文本 */
  const captureStatusText = useMemo(() => {
    if (isDomainDisabled) return '已禁止';
    if (isCheckingSiteReadiness) return '连接中';
    if (isContentScriptReady) return '已就绪';
    return '未就绪';
  }, [isDomainDisabled, isCheckingSiteReadiness, isContentScriptReady]);

  /** 拦截状态样式类 */
  const captureStatusClass = useMemo(() => {
    if (isDomainDisabled) return 'capture-status--off';
    if (isCheckingSiteReadiness) return 'capture-status--pending';
    return isContentScriptReady ? 'capture-status--on' : 'capture-status--off';
  }, [isDomainDisabled, isCheckingSiteReadiness, isContentScriptReady]);

  /** 是否禁用拦截按钮 */
  const isCaptureDisabled = useMemo(() => {
    return (
      isDomainDisabled ||
      isCheckingSiteReadiness ||
      isContentScriptReady !== true
    );
  }, [isDomainDisabled, isCheckingSiteReadiness, isContentScriptReady]);

  /** 向活动内容脚本发送消息 */
  const sendMessageToActiveContentScript = useCallback(async (
    message: ExtMessage,
  ): Promise<any> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    maLogger.log('当前活动标签页:', tab);

    if (!tab?.id) {
      throw new Error('未找到当前活动标签页');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id!,
        { ...message, target: 'content' },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        },
      );
    });
  }, []);

  /** 检查内容脚本是否就绪 */
  const checkContentScriptReady = useCallback(async (): Promise<void> => {
    try {
      const response = await sendMessageToActiveContentScript({
        type: 'POPUP_CAPTURE_HANDSHAKE',
      });
      setIsContentScriptReady(response?.success === true);
    } catch (error) {
      maLogger.log('当前站点内容脚本未就绪:', error);
      setIsContentScriptReady(false);
    }
  }, [sendMessageToActiveContentScript]);

  /** 刷新捕获状态 */
  const refreshCaptureStatus = useCallback(async (): Promise<void> => {
    setIsCheckingSiteReadiness(true);
    setIsContentScriptReady(null);

    try {
      await Promise.allSettled([checkDomainStatus(), checkContentScriptReady()]);
    } finally {
      setIsCheckingSiteReadiness(false);
    }
  }, [checkDomainStatus, checkContentScriptReady]);

  /** 触发广告拦截选择 */
  const triggerComponentCapture = useCallback(async (): Promise<void> => {
    if (isCaptureDisabled) return;

    try {
      maLogger.log('从 popup 触发广告拦截选择...');
      const res = await sendMessageToActiveContentScript({
        type: 'TRIGGER_COMPONENT_CAPTURE',
      });
      maLogger.log('广告拦截响应:', res);
      window.close();
    } catch (error) {
      maLogger.error('启动广告拦截失败:', error);
    }
  }, [isCaptureDisabled, sendMessageToActiveContentScript]);

  /** 初始化加载捕获状态 */
  useEffect(() => {
    refreshCaptureStatus();
  }, [refreshCaptureStatus]);

  return (
    <TableContainer
      headLeft={
        <>
          <p className="section-kicker">Visual Inspector</p>
          <h2 className="section-title">广告拦截</h2>
          <p className="section-subtitle">
            在页面中点击广告元素，调整到合适的父级区域后确认拦截。
          </p>
        </>
      }
      headRight={
        <div className={`capture-status ${captureStatusClass}`}>
          <span className="status-dot"></span>
          <span>{captureStatusText}</span>
        </div>
      }
    >
      <button
        className="capture-btn"
        disabled={isCaptureDisabled}
        onClick={triggerComponentCapture}
      >
        <span className="capture-icon">
          <CameraOutlined />
        </span>
        <span className="capture-copy">
          <strong>开始拦截</strong>
          <small>点击后 popup 会自动关闭，随后在页面中点选广告元素。</small>
        </span>
      </button>

      <div className="capture-steps">
        <div className="step-card">
          <span className="step-index">01</span>
          <p>停留在需要分析的页面。</p>
        </div>
        <div className="step-card">
          <span className="step-index">02</span>
          <p>点击上方按钮进入拦截选择状态。</p>
        </div>
        <div className="step-card">
          <span className="step-index">03</span>
          <p>点击广告并用滑块选择父级区域。</p>
        </div>
      </div>
    </TableContainer>
  );
};

export default CapturePage;
