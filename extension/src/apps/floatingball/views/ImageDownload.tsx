/**
 * ImageDownload.tsx - React 版图片下载工具
 * 从 Vue 版 ImageDownload.vue 迁移而来
 *
 * 功能：扫描页面图片、过滤、单独/批量下载为 ZIP
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Input, Checkbox, Tooltip, Modal } from "antd";
import {
  DownloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  FileTextOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  scanImages,
  downloadAllImages,
  downloadSingleImage,
} from "@/utils/image-zip-download";
import type { ImageInfo } from "@/types/utils";
import "./styles/image-download.scss";

/** 通知消息类型 */
interface NotificationMessage {
  message: string;
  type: "success" | "info" | "warning" | "error";
}

interface ImageDownloadProps {
  /** 添加通知消息回调（对应原 emit('add-message')）*/
  onAddMessage?: (msg: NotificationMessage) => void;
}

/** 图片信息（扩展 loaded 字段用于 React 状态跟踪）*/
interface ImageItem extends ImageInfo {
  loaded: boolean;
}

/** 使用说明 */
const INSTRUCTIONS = [
  "点击'重新扫描图片'可刷新检测",
  "支持 Base64 图片和普通 URL 图片",
  "可以删除不需要下载的图片",
  "支持单独下载某张图片",
  "点击'下载所有图片'即可打包为 ZIP",
];

/**
 * ImageDownload - 图片资源压缩下载工具
 */
const ImageDownload: React.FC<ImageDownloadProps> = ({ onAddMessage }) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [includeBase64, setIncludeBase64] = useState(true);
  const [filterText, setFilterText] = useState("");

  // 确认对话框状态（替代原 SciFiConfirmDialog）
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogContent] = useState("");
  const dialogCallbackRef = useRef<(() => void) | null>(null);

  /**
   * 自定义确认框（替代原 $msgbox + SciFiConfirmDialog）
   */
  const showConfirm = useCallback(
    (title: string, message: string, confirmCallback: () => void) => {
      setDialogTitle(title);
      setDialogContent(message);
      dialogCallbackRef.current = confirmCallback;
      setDialogVisible(true);
    },
    []
  );

  const handleDialogConfirm = useCallback(() => {
    if (dialogCallbackRef.current) {
      dialogCallbackRef.current();
      dialogCallbackRef.current = null;
    }
    setDialogVisible(false);
  }, []);

  const handleDialogCancel = useCallback(() => {
    setDialogVisible(false);
    dialogCallbackRef.current = null;
  }, []);

  /**
   * 扫描页面图片
   */
  const onScan = useCallback(() => {
    const scannedImages = scanImages(document) as ImageInfo[];
    setImages(
      scannedImages.map((img) => ({ ...img, loaded: false }))
    );
    setScanned(true);

    if (scannedImages.length > 0) {
      onAddMessage?.({
        message: `找到 ${scannedImages.length} 张图片`,
        type: "success",
      });
    } else {
      onAddMessage?.({ message: "未找到图片", type: "info" });
    }
  }, [onAddMessage]);

  /**
   * 打包下载所有图片
   */
  const onDownload = useCallback(async () => {
    if (!images.length) {
      onAddMessage?.({ message: "没有找到可下载的图片！", type: "warning" });
      return;
    }

    setRunning(true);
    setProgress(0);

    try {
      await downloadAllImages(images, {
        onProgress: (p: number) => setProgress(p),
        fileName: "page_images.zip",
      });
      onAddMessage?.({ message: "图片打包下载完成！", type: "success" });
    } catch (e: any) {
      maLogger.error(e);
      onAddMessage?.({
        message: "打包失败: " + e.message,
        type: "error",
      });
    } finally {
      setRunning(false);
    }
  }, [images, onAddMessage]);

  /**
   * 单独下载图片
   */
  const downloadSingle = useCallback(
    async (img: ImageItem) => {
      try {
        await downloadSingleImage(img.src, img.name);
        onAddMessage?.({ message: "图片下载完成！", type: "success" });
      } catch (error: any) {
        onAddMessage?.({
          message: "下载失败: " + error.message,
          type: "error",
        });
        maLogger.error("下载错误:", error);
      }
    },
    [onAddMessage]
  );

  /**
   * 删除单张图片（带确认）
   */
  const removeImage = useCallback(
    (index: number) => {
      showConfirm("确定删除", "确定要删除这张图片吗？", () => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        onAddMessage?.({ message: "图片已删除", type: "success" });
      });
    },
    [showConfirm, onAddMessage]
  );

  /**
   * 清空所有图片（带确认）
   */
  const removeAllImages = useCallback(() => {
    if (!images.length) return;
    showConfirm("确定删除", "确定要清空所有图片吗？", () => {
      setImages([]);
      onAddMessage?.({ message: "已清空所有图片", type: "success" });
    });
  }, [images.length, showConfirm, onAddMessage]);

  /**
   * 图片加载完成回调
   */
  const handleImageLoad = useCallback((idx: number) => {
    setImages((prev) =>
      prev.map((img, i) => (i === idx ? { ...img, loaded: true } : img))
    );
  }, []);

  /**
   * 截断长 URL 显示
   */
  const truncateUrl = useCallback(
    (url: string, maxLength: number = 30): string => {
      if (url.length <= maxLength) return url;
      return url.substring(0, maxLength) + "...";
    },
    []
  );

  // 过滤后的图片列表（原 computed）
  const filteredImages = useMemo(() => {
    let result = images;
    if (!includeBase64) {
      result = result.filter((img) => !img.isBase64);
    }
    if (filterText) {
      const keyword = filterText.toLowerCase();
      result = result.filter(
        (img) =>
          img.src.toLowerCase().includes(keyword) ||
          (img.alt && img.alt.toLowerCase().includes(keyword))
      );
    }
    return result;
  }, [images, includeBase64, filterText]);

  // 挂载时自动扫描（原 onMounted(onScan)）
  useEffect(() => {
    onScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="image-zip-downloader scifi-container">
      <header className="scifi-header">
        <div className="scifi-title-wrapper">
          <FileTextOutlined className="scifi-icon" />
          <h1 className="scifi-title">图片资源压缩下载工具</h1>
        </div>
        <p className="subtitle scifi-subtitle">
          一键下载页面中的所有图片资源为 ZIP 压缩包
        </p>
      </header>

      <div className="content">
        {/* 控制面板 */}
        <div className="control-panel scifi-panel">
          <h2 className="panel-title scifi-panel-title">
            <SettingOutlined className="scifi-icon" />
            控制面板
          </h2>

          <div className="control-buttons">
            <button
              className="download-btn scifi-btn scifi-btn-primary"
              disabled={running || !images.length}
              onClick={onDownload}
            >
              <DownloadOutlined className="scifi-icon" />
              {running ? "打包中…" : `下载图片 (${images.length})`}
            </button>
            <button
              disabled={running}
              className="scifi-btn scifi-btn-secondary"
              onClick={onScan}
            >
              <SearchOutlined className="scifi-icon" />
              重新扫描图片
            </button>
            {images.length > 0 && (
              <button
                className="delete-all-btn scifi-btn scifi-btn-danger"
                disabled={running}
                onClick={removeAllImages}
              >
                <DeleteOutlined className="scifi-icon" />
                清空列表
              </button>
            )}
          </div>

          <div className="filters">
            <Checkbox
              checked={includeBase64}
              onChange={(e) => setIncludeBase64(e.target.checked)}
            >
              包含 Base64 图片
            </Checkbox>
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="过滤图片URL"
              allowClear
              style={{ width: 200, marginLeft: 10 }}
              prefix={<SearchOutlined className="scifi-icon-small" />}
            />
          </div>

          <div className="status scifi-status">
            <h3 className="scifi-status-title">
              <InfoCircleOutlined className="scifi-icon" />
              扫描结果
            </h3>
            <p>
              共找到 {images.length} 张图片 ({filteredImages.length} 张显示)
            </p>
          </div>

          {running && (
            <div className="progress-container scifi-progress-container">
              <div className="progress-bg">
                <div
                  className="progress-bar scifi-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-text scifi-progress-text">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>

        {/* 图片预览 */}
        <div className="image-gallery scifi-gallery">
          {filteredImages.map((img, idx) => (
            <div key={img.src + idx} className="image-card scifi-card">
              <div className="scifi-card-bg"></div>
              <div className="image-wrapper">
                <img
                  src={img.src}
                  alt={`Image ${idx}`}
                  onLoad={() => handleImageLoad(idx)}
                />
                <div className="image-overlay scifi-overlay">
                  <button
                    className="delete-btn scifi-icon-btn scifi-icon-btn-danger"
                    title="删除图片"
                    onClick={() => removeImage(idx)}
                  >
                    <DeleteOutlined className="scifi-icon-small" />
                  </button>
                  <button
                    className="download-single-btn scifi-icon-btn scifi-icon-btn-primary"
                    title="单独下载"
                    onClick={() => downloadSingle(img)}
                  >
                    <DownloadOutlined className="scifi-icon-small" />
                  </button>
                </div>
                {!img.loaded && (
                  <div className="image-loading scifi-loading">
                    <LoadingOutlined className="scifi-icon-large scifi-loading-spin" />
                  </div>
                )}
              </div>
              <div className="image-info">
                <span className={`image-type ${img.isBase64 ? "base64" : ""}`}>
                  {img.isBase64 ? "Base64" : "URL"}
                </span>
                <Tooltip title={img.src} placement="top">
                  <span className="image-url">{truncateUrl(img.src)}</span>
                </Tooltip>
              </div>
            </div>
          ))}

          {!filteredImages.length && scanned && (
            <div className="empty-gallery scifi-empty">
              <div className="scifi-empty-content">
                <FileTextOutlined className="scifi-icon-large" />
                <p className="scifi-empty-text">没有找到图片或过滤后无结果</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="instructions scifi-instructions">
        <h3 className="scifi-instructions-title">
          <InfoCircleOutlined className="scifi-icon" />
          使用说明
        </h3>
        <ul>
          {INSTRUCTIONS.map((item, index) => (
            <li key={index} className="scifi-instruction-item">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <footer className="scifi-footer">
        <div className="scifi-footer-content">
          © 2023 图片资源压缩下载工具 | 基于 JSZip 与 FileSaver.js
        </div>
      </footer>

      {/* 确认对话框（替代 SciFiConfirmDialog）*/}
      <Modal
        open={dialogVisible}
        title={dialogTitle}
        okText="确定"
        cancelText="取消"
        onOk={handleDialogConfirm}
        onCancel={handleDialogCancel}
      >
        <p>{dialogMessage}</p>
      </Modal>
    </div>
  );
};

ImageDownload.displayName = "ImageDownload";

export default ImageDownload;
