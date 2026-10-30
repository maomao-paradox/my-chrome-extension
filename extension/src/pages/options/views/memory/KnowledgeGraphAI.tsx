/**
 * @file KnowledgeGraphAI.tsx
 * @description 记忆知识图谱视图 —— 用大模型从记忆条目中抽取实体/关系，
 *              再用 ChatKnowledgeGraph 渲染
 *
 * 行为：
 *   - 进入视图时先查缓存（指纹一致直接复用）
 *   - 缓存未命中才调用 AI 通道生成
 *   - 生成失败给出可重试的提示，不影响记忆列表本身
 *
 * 旧的 Cytoscape 版 KnowledgeGraph.tsx 保留未删，仅不再被引用。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Empty, Space, Spin, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import ChatKnowledgeGraph from "@/components/ChatKnowledgeGraph";
import type {
  GraphData,
  GraphNode,
} from "@/components/ChatKnowledgeGraph/types";
import type { MemoryEntry } from "@/services/memory";
import {
  buildGraphFingerprint,
  readGraphCache,
  requestGraphData,
  writeGraphCache,
} from "./ai-graph";

export interface KnowledgeGraphAIProps {
  /** 当前角色 */
  role: string;
  /** 当前角色的全部记忆条目 */
  entries: MemoryEntry[];
  /** 点击节点回调 */
  onSelectNode?: (node: GraphNode | null) => void;
}

const MIN_HEIGHT = 520;

/** 记忆知识图谱视图 */
const KnowledgeGraphAI: React.FC<KnowledgeGraphAIProps> = ({
  role,
  entries,
  onSelectNode,
}) => {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  /** 请求序号：角色切换 / 重新生成时丢弃过期结果 */
  const requestSeq = useRef(0);

  /**
   * 生成（或复用缓存）图谱数据
   * @param force 为 true 时跳过缓存，强制重新调用模型
   */
  const generate = useCallback(
    async (force: boolean) => {
      if (!role || entries.length === 0) {
        setData(null);
        setError("");
        setGeneratedAt(null);
        return;
      }

      const seq = ++requestSeq.current;
      const fingerprint = buildGraphFingerprint(role, entries);
      setLoading(true);
      setError("");

      try {
        if (!force) {
          const cached = await readGraphCache(role);
          if (seq !== requestSeq.current) return;
          if (cached && cached.fingerprint === fingerprint) {
            setData(cached.data);
            setGeneratedAt(cached.generatedAt);
            return;
          }
        }

        const generated = await requestGraphData(role, entries);
        if (seq !== requestSeq.current) return;
        if (generated.nodes.length === 0) {
          throw new Error("模型没有返回有效的图谱节点");
        }

        setData(generated);
        setGeneratedAt(Date.now());
        // 缓存写入失败不影响展示
        void writeGraphCache(role, fingerprint, generated);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setData(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [role, entries],
  );

  useEffect(() => {
    void generate(false);
    // 卸载或依赖变化时让在途请求失效
    return () => {
      requestSeq.current += 1;
    };
  }, [generate]);

  /** 手动重新生成（跳过缓存） */
  const handleRefresh = useCallback(() => {
    void generate(true);
  }, [generate]);

  if (!role || entries.length === 0) {
    return (
      <Empty
        description="当前角色还没有记忆条目，先积累一些对话再来生成知识图谱吧"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Space size={8} wrap>
          <Tag color="blue">AI 抽取</Tag>
          {generatedAt && (
            <span style={{ color: "#9fb0c7", fontSize: 12 }}>
              生成于 {new Date(generatedAt).toLocaleString()}
            </span>
          )}
        </Space>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={handleRefresh}
        >
          重新生成
        </Button>
      </div>

      {loading && !data && (
        <div
          style={{
            minHeight: MIN_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Spin tip="大模型正在抽取实体与关系…">
            <div style={{ width: 240, height: 80 }} />
          </Spin>
        </div>
      )}

      {error && !loading && (
        <Alert
          type="warning"
          showIcon
          message="知识图谱生成失败"
          description={error}
          action={
            <Button size="small" onClick={handleRefresh}>
              重试
            </Button>
          }
        />
      )}

      {data && !error && (
        <ChatKnowledgeGraph
          data={data}
          height={MIN_HEIGHT}
          maxWidth="100%"
          showLegend
          showBadge
          theme="dark"
          onNodeClick={onSelectNode}
        />
      )}
    </div>
  );
};

export default KnowledgeGraphAI;
