/**
 * ScriptRunner.tsx - React 版脚本执行工具
 * 从 Vue 版 ScriptRunner.vue 迁移而来
 *
 * 功能：支持代码输入、文件上传、网络脚本三种方式执行 JavaScript
 *
 * @author Zero
 * @version v1.0.0
 * @license MIT
 */
import React, { useState, useCallback } from "react";
import { Button, Tabs, Input, Upload } from "antd";
import type { UploadProps } from "antd";
import {
  PlayCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  UploadOutlined,
  FileTextOutlined,
  LinkOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
} from "@ant-design/icons";
import { injectScriptToActivateTab } from "@/utils/element-control";
import message from "@/message/index.js";
import "./styles/script-runner.scss";

/** Tab 类型（替代原 TabPaneName）*/
type TabKey = "code" | "file" | "url";

/** 通知消息类型 */
interface NotificationMessage {
  message: string;
  type: "success" | "info" | "warning" | "error";
}

interface ScriptRunnerProps {
  /** 添加通知消息回调（对应原 emit('add-message')）*/
  onAddMessage?: (msg: NotificationMessage) => void;
}

const { TextArea } = Input;

/**
 * ScriptRunner - 脚本执行工具
 */
const ScriptRunner: React.FC<ScriptRunnerProps> = ({ onAddMessage }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("code");
  const [scriptCode, setScriptCode] = useState("");
  const [outputText, setOutputText] = useState("");
  const [running, setRunning] = useState(false);
  const [scriptUrl, setScriptUrl] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [urlInfo, setUrlInfo] = useState<{ url: string } | null>(null);

  const ext = message.ext;

  /**
   * 执行脚本
   */
  const executeScript = useCallback(async () => {
    let codeToExecute = "";

    switch (activeTab) {
      case "code":
        if (!scriptCode.trim()) {
          onAddMessage?.({ message: "请输入JavaScript代码", type: "warning" });
          return;
        }
        codeToExecute = scriptCode;
        break;
      case "file":
        if (!fileInfo) {
          onAddMessage?.({ message: "请选择本地JavaScript文件", type: "warning" });
          return;
        }
        codeToExecute = scriptCode;
        break;
      case "url":
        if (!urlInfo) {
          onAddMessage?.({ message: "请加载网络脚本", type: "warning" });
          return;
        }
        codeToExecute = scriptCode;
        break;
    }

    setRunning(true);
    setOutputText("");

    try {
      // 直接执行脚本
      injectScriptToActivateTab({ scriptStr: codeToExecute });

      // 显示执行成功信息
      setOutputText("脚本已开始执行，请在控制台查看输出");
      onAddMessage?.({ type: "success", message: "脚本执行开始" });
    } catch (error: any) {
      // 捕获执行错误
      setOutputText(`执行错误: ${error.message}\n${error.stack || ""}`);
      onAddMessage?.({ type: "error", message: "脚本执行出错" });
    } finally {
      setRunning(false);
    }
  }, [activeTab, scriptCode, fileInfo, urlInfo, onAddMessage]);

  /**
   * 清空脚本
   */
  const clearScript = useCallback(() => {
    setScriptCode("");
    setOutputText("");
    setFileInfo(null);
    setUrlInfo(null);
    setScriptUrl("");
    onAddMessage?.({ type: "info", message: "已清空" });
  }, [onAddMessage]);

  /**
   * 复制结果
   */
  const copyResult = useCallback(() => {
    if (outputText) {
      navigator.clipboard
        .writeText(outputText)
        .then(() => {
          onAddMessage?.({ type: "success", message: "结果已复制到剪贴板" });
        })
        .catch(() => {
          onAddMessage?.({ type: "error", message: "复制失败" });
        });
    }
  }, [outputText, onAddMessage]);

  /**
   * 处理文件选择
   */
  const handleFileChange: UploadProps["onChange"] = useCallback(
    (info) => {
      const selectedFile = info.file?.originFileObj;
      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          setScriptCode(e.target?.result as string);
          setFileInfo({
            name: selectedFile.name,
            size: selectedFile.size,
          });
          onAddMessage?.({ type: "success", message: "文件读取成功" });
        };
        reader.onerror = () => {
          onAddMessage?.({ type: "error", message: "文件读取失败" });
        };
        reader.readAsText(selectedFile);
      }
    },
    [onAddMessage]
  );

  /**
   * 清除文件
   */
  const clearFile = useCallback(() => {
    setFileInfo(null);
    setScriptCode("");
  }, []);

  /**
   * 加载网络脚本
   */
  const loadUrlScript = useCallback(async () => {
    if (!scriptUrl.trim()) {
      onAddMessage?.({ type: "warning", message: "请输入网络脚本URL" });
      return;
    }

    setRunning(true);

    try {
      // 使用脚本执行服务加载网络脚本，绕过 CORS 限制
      const response = await ext.send({
        type: "LOAD_URL_SCRIPT",
        payload: { url: scriptUrl },
        target: "background",
      });

      if (!response.success) {
        throw new Error(response.error || "加载网络脚本失败");
      }

      const scriptContent = response.result;
      maLogger.log("加载的网络脚本内容:", scriptContent);
      setScriptCode(scriptContent);
      setUrlInfo({ url: scriptUrl });
      onAddMessage?.({ type: "success", message: "网络脚本加载成功" });
    } catch (error: any) {
      onAddMessage?.({
        type: "error",
        message: `网络脚本加载失败: ${error.message}`,
      });
    } finally {
      setRunning(false);
    }
  }, [scriptUrl, ext, onAddMessage]);

  /**
   * 清除 URL
   */
  const clearUrl = useCallback(() => {
    setUrlInfo(null);
    setScriptUrl("");
    setScriptCode("");
  }, []);

  // Tab 项配置（antd items API）
  const tabItems = [
    {
      key: "code",
      label: "代码输入",
      children: (
        <div className="script-input-container">
          <div className="section-header">
            <EditOutlined />
            <span>JavaScript代码</span>
          </div>
          <div className="code-editor">
            <textarea
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              placeholder={`在这里输入JavaScript代码...\n\n// 可以访问当前页面的DOM\n// 示例: maLogger.log('Hello World!');\n// 示例: document.title = '修改后的标题';`}
              rows={10}
              readOnly={running}
            />
          </div>
        </div>
      ),
    },
    {
      key: "file",
      label: "文件上传",
      children: (
        <div className="file-upload-container">
          <div className="section-header">
            <UploadOutlined />
            <span>本地脚本文件</span>
          </div>
          <div className="upload-area">
            <Upload
              beforeUpload={() => false}
              onChange={handleFileChange}
              showUploadList={false}
              accept=".js"
            >
              <Button type="primary">
                <UploadOutlined /> 选择JS文件
              </Button>
            </Upload>
            {fileInfo ? (
              <div className="file-info">
                <FileTextOutlined />
                <span>{fileInfo.name}</span>
                <Button size="small" type="link" onClick={clearFile}>
                  清除
                </Button>
              </div>
            ) : (
              <div className="upload-hint">请选择本地JavaScript文件</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "url",
      label: "网络脚本",
      children: (
        <div className="url-script-container">
          <div className="section-header">
            <LinkOutlined />
            <span>网络脚本URL</span>
          </div>
          <div className="url-input-area">
            <Input
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="输入网络脚本URL..."
              disabled={running}
              addonAfter={
                <Button
                  size="small"
                  type="link"
                  disabled={!scriptUrl || running}
                  onClick={loadUrlScript}
                  style={{ padding: 0 }}
                >
                  <DownloadOutlined /> 加载
                </Button>
              }
            />
            {urlInfo ? (
              <div className="url-info">
                <CheckCircleOutlined />
                <span>已加载: {urlInfo.url}</span>
                <Button size="small" type="link" onClick={clearUrl}>
                  清除
                </Button>
              </div>
            ) : scriptUrl ? (
              <div className="url-hint">点击加载按钮获取脚本内容</div>
            ) : (
              <div className="url-hint">请输入网络脚本URL</div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="script-runner">
      <header>
        <h1>
          <FileTextOutlined /> 自动化工具
        </h1>
      </header>

      <div className="content">
        {/* 控制面板 */}
        <div className="control-panel">
          <div className="control-buttons">
            <Button
              type="primary"
              loading={running}
              icon={running ? <LoadingOutlined /> : <PlayCircleOutlined />}
              onClick={executeScript}
            >
              {running ? "执行中..." : "执行脚本"}
            </Button>
            <Button icon={<DeleteOutlined />} onClick={clearScript}>
              清空
            </Button>
            <Button
              icon={<CopyOutlined />}
              disabled={!outputText}
              onClick={copyResult}
            >
              复制结果
            </Button>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="tab-container">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as TabKey)}
            items={tabItems}
          />
        </div>

        {/* 输出结果区域 */}
        <div className="output-container">
          <div className="section-header">
            <DesktopOutlined />
            <span>执行结果</span>
          </div>
          <div className="output-content">
            {outputText ? (
              <pre className="output-text">{outputText}</pre>
            ) : (
              <div className="no-output">暂无输出</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ScriptRunner.displayName = "ScriptRunner";

export default ScriptRunner;
// 重新导出类型供其他模块使用
export type { ScriptRunnerProps, TabKey };
