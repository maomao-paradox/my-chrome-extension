/**
 * @file pages/options/views/MemoryManagerView.tsx
 * @description AI 记忆管理界面 —— Options 页面入口
 *
 * 功能：
 *  - 查看所有角色及其记忆数量
 *  - 【新建】创建新角色身份（role + 显示名 + system prompt + persona）
 *  - 【新建】编辑已有角色的身份设定
 *  - 浏览某角色的记忆条目（按分类/重要性过滤）
 *  - 手动添加一条长期记忆
 *  - 导出全部 / 导出单个角色
 *  - 从文件导入（合并模式 / 替换模式）
 *  - 清除某角色所有记忆
 *  - 预览某角色的身份设定
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  message as antdMessage,
  theme,
} from "antd";
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UserOutlined,
  TagOutlined,
} from "@ant-design/icons";
import {
  classifyDecayState,
  computeRetention,
  downloadMemoriesAsFile,
  exportSingleRole,
  getMemoryService,
  importFromFile,
  isExemptFromForgetting,
  type IdentityMemory,
  type MemoryCategory,
  type MemoryDecayState,
  type MemoryEntry,
  type MemoryImportance,
} from "@/services/memory";
import KnowledgeGraph from "./memory/KnowledgeGraph";
import "./memory-center.scss";

/** 分类 → 中文标签 */
const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  identity: "身份",
  conversation: "对话片段",
  preference: "用户偏好",
  fact: "事实信息",
  episodic: "情景回忆",
};

/** 重要性 → 颜色 */
const IMPORTANCE_COLOR: Record<MemoryImportance, string> = {
  critical: "red",
  high: "orange",
  medium: "blue",
  low: "default",
};

const IMPORTANCE_LABEL: Record<MemoryImportance, string> = {
  critical: "关键",
  high: "高",
  medium: "中",
  low: "低",
};

/** 遗忘状态 → 中文标签（艾宾浩斯曲线推导） */
const DECAY_LABEL: Record<MemoryDecayState, string> = {
  active: "清晰",
  fading: "模糊",
  forgotten: "已遗忘",
};

/** 遗忘状态 → Tag 颜色 */
const DECAY_COLOR: Record<MemoryDecayState, string> = {
  active: "green",
  fading: "orange",
  forgotten: "default",
};

// ─── 预设角色模板 —— 新建时可选 ─── //
const ROLE_TEMPLATES: Array<{
  label: string;
  value: string;
  displayName: string;
  systemPrompt: string;
  persona: string;
}> = [
  {
    label: "初音未来（虚拟歌姬）",
    value: "hatsune_miku_tavern",
    displayName: "Hatsune Miku",
    systemPrompt: [
      "你正在进行角色扮演：你是初音未来风格的虚拟歌姬 Miku，在一个安静、温暖的酒馆式对话窗口里和用户聊天。",
      "用中文为主回应，语气轻快、亲切、有一点舞台感，但不要过度卖萌，不要刷屏。",
      "你可以谈音乐、创作、日常陪伴、学习和编程想法；当用户需要严肃帮助时，保持清晰、实用、可靠。",
      "不要声称自己是真实人物或真人偶像；你是一个由 AI 模拟的角色。",
      "回答尽量自然，短句优先。需要步骤时用简洁列表。",
    ].join("\n"),
    persona:
      "16 岁虚拟歌姬，身高 158cm，生日 8 月 31 日。擅长唱歌和跳舞，性格活泼开朗，对用户非常友好。",
  },
  {
    label: "编程助手（严谨）",
    value: "dev_assistant",
    displayName: "Dev Assistant",
    systemPrompt: [
      "你是一个严谨、准确的工程助手。",
      "回答编程问题时：先给结论，再给最小可运行示例，最后补充注意事项。",
      "遇到不确定的问题，直接说不知道，不要编造。",
      "默认使用 TypeScript 做代码示例。",
    ].join("\n"),
    persona:
      "工程效率助手，擅长 TypeScript / React / Node.js，追求简洁、正确、可维护的代码。",
  },
];

/** 记忆中心暗色主题 —— 仅包裹本视图，不影响其他面板 */
const MEMORY_CENTER_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#69b7ff",
    colorBgBase: "#050d18",
    colorBgContainer: "rgba(10, 22, 40, 0.92)",
    colorBgElevated: "#0d1f35",
    colorBorder: "rgba(105, 183, 255, 0.22)",
    colorText: "#e6f4ff",
    colorTextSecondary: "#9fb0c7",
    borderRadius: 10,
  },
};

type ModalMode =
  | "createRole"
  | "editIdentity"
  | "addMemory"
  | "editMemory"
  | null;

/** MemoryManagerView —— 星舰风格 UI 的记忆管理面板 */
const MemoryManagerView: React.FC = () => {
  const service = useMemo(() => getMemoryService(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form] = Form.useForm();

  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [identity, setIdentity] = useState<IdentityMemory | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | "all">(
    "all",
  );
  /** 遗忘状态过滤：全部 / 清晰(active) / 模糊(fading) / 已遗忘(forgotten) */
  const [decayFilter, setDecayFilter] = useState<MemoryDecayState | "all">(
    "all",
  );
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  /** 正在编辑的记忆条目 —— 仅 editMemory 模式下有值 */
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  /** 右侧区域当前视图：记忆条目 / 知识网络 */
  const [rightView, setRightView] = useState<"list" | "graph">("list");
  /** 知识网络中被选中的记忆 —— 用于详情浮层 */
  const [graphSelected, setGraphSelected] = useState<MemoryEntry | null>(null);

  // ─── 加载角色列表 ─── //
  const loadRoles = useCallback(async () => {
    const list = await service.listRoles();
    setRoles(list);
    setSelectedRole((current) => {
      if (list.length > 0 && !list.includes(current)) return list[0];
      return current;
    });
  }, [service]);

  // ─── 加载某角色的记忆条目 ─── //
  const loadEntries = useCallback(async () => {
    if (!selectedRole) {
      setEntries([]);
      setIdentity(null);
      return;
    }
    const list = await service.listEntries(selectedRole);
    list.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
    setEntries(list);
    setIdentity(await service.getIdentity(selectedRole));
  }, [selectedRole, service]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  /**
   * 给每条记忆附上遗忘曲线信息（保留率 / 状态 / 是否豁免）
   * —— 每次渲染重新计算，因为保留率随时间变化
   */
  const decoratedEntries = useMemo(() => {
    const now = Date.now();
    return entries
      .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
      .map((entry) => ({
        entry,
        state: classifyDecayState(entry, now),
        retention: computeRetention(entry, now),
        exempt: isExemptFromForgetting(entry),
      }));
  }, [entries, categoryFilter]);

  /** 遗忘状态分布统计 */
  const decayStats = useMemo(() => {
    const counter: Record<MemoryDecayState, number> = {
      active: 0,
      fading: 0,
      forgotten: 0,
    };
    for (const item of decoratedEntries) {
      counter[item.state] += 1;
    }
    return counter;
  }, [decoratedEntries]);

  /** 按遗忘状态二次过滤 */
  const visibleEntries = useMemo(
    () =>
      decayFilter === "all"
        ? decoratedEntries
        : decoratedEntries.filter((item) => item.state === decayFilter),
    [decoratedEntries, decayFilter],
  );

  // ─── 手动唤醒一条记忆（等价于用户再次提起） ─── //
  const handleRecall = async (id: string) => {
    try {
      setLoading(true);
      const revived = await service.recallEntry(id);
      if (!revived) {
        antdMessage.warning("未找到该记忆条目");
        return;
      }
      antdMessage.success("已唤醒这条记忆，稳定性已加强");
      await loadEntries();
    } catch (error) {
      antdMessage.error(
        `唤醒失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── 打开"新建角色"表单 ─── //
  const openCreateRole = () => {
    form.resetFields();
    setModalMode("createRole");
  };

  // ─── 打开"编辑身份"表单 ─── //
  const openEditIdentity = () => {
    if (!selectedRole) {
      antdMessage.warning("请先选择一个角色");
      return;
    }
    form.setFieldsValue({
      role: identity?.role ?? selectedRole,
      displayName: identity?.displayName ?? selectedRole,
      systemPrompt: identity?.systemPromptTemplate ?? "",
      persona: identity?.personaDescription ?? "",
    });
    setModalMode("editIdentity");
  };

  // ─── 打开"手动添加记忆"表单 ─── //
  const openAddMemory = () => {
    if (!selectedRole) {
      antdMessage.warning("请先选择一个角色");
      return;
    }
    form.resetFields();
    setEditingEntry(null);
    setModalMode("addMemory");
  };

  // ─── 打开"编辑记忆"表单 ─── //
  const openEditMemory = (entry: MemoryEntry) => {
    form.setFieldsValue({
      content: entry.content,
      category: entry.category,
      importance: entry.importance,
      tags: entry.tags?.join(", ") ?? "",
    });
    setEditingEntry(entry);
    setModalMode("editMemory");
  };

  // ─── 删除单条记忆 ─── //
  const handleDeleteEntry = (entry: MemoryEntry) => {
    Modal.confirm({
      title: "删除这条记忆？",
      content: (
        <div>
          <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {entry.content}
          </p>
          <p style={{ color: "#888", fontSize: 12 }}>
            删除后该记忆不再参与检索与对话注入，且无法恢复。
          </p>
        </div>
      ),
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          setLoading(true);
          await service.removeEntry(entry.id);
          antdMessage.success("记忆已删除");
          await loadEntries();
        } catch (error) {
          antdMessage.error(
            `删除失败：${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // ─── 从预设模板填充 ─── //
  const applyTemplate = (templateValue: string) => {
    const template = ROLE_TEMPLATES.find((t) => t.value === templateValue);
    if (!template) return;
    form.setFieldsValue({
      role: template.value,
      displayName: template.displayName,
      systemPrompt: template.systemPrompt,
      persona: template.persona,
    });
  };

  // ─── 表单提交统一处理 ─── //
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (modalMode === "createRole" || modalMode === "editIdentity") {
        await service.upsertIdentity({
          role: values.role.trim(),
          displayName: values.displayName.trim(),
          systemPromptTemplate: values.systemPrompt.trim(),
          personaDescription: values.persona?.trim(),
        });

        if (modalMode === "createRole") {
          // 新角色自动选中
          setSelectedRole(values.role.trim());
          antdMessage.success(`角色 "${values.displayName}" 已创建`);
        } else {
          antdMessage.success("身份设定已更新");
        }

        await loadRoles();
        await loadEntries();
      } else if (modalMode === "addMemory") {
        const entry = await service.addEntry({
          role: selectedRole,
          content: values.content.trim(),
          category: values.category,
          importance: values.importance,
          tags: values.tags
            ?.split(",")
            .map((t: string) => t.trim())
            .filter(Boolean),
        });
        antdMessage.success(
          `已添加 ${CATEGORY_LABEL[entry.category]}：${entry.content}`,
        );
        await loadEntries();
      } else if (modalMode === "editMemory" && editingEntry) {
        await service.updateEntry(editingEntry.id, {
          content: values.content.trim(),
          category: values.category,
          importance: values.importance,
          tags: values.tags
            ?.split(",")
            .map((t: string) => t.trim())
            .filter(Boolean),
        });
        antdMessage.success("记忆已更新");
        await loadEntries();
      }

      setModalMode(null);
      setEditingEntry(null);
      form.resetFields();
    } catch (error) {
      if (error instanceof Error && error.message.includes("validateFields")) {
        return; // 表单校验失败
      }
      antdMessage.error(
        `操作失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── 导出全部 ─── //
  const handleExportAll = async () => {
    try {
      setLoading(true);
      await downloadMemoriesAsFile();
      antdMessage.success("已导出全部记忆备份");
    } catch (error) {
      antdMessage.error(
        `导出失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportRole = async () => {
    if (!selectedRole) {
      antdMessage.warning("请先选择一个角色");
      return;
    }
    try {
      setLoading(true);
      const payload = await exportSingleRole(selectedRole);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-memory-${selectedRole}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      antdMessage.success(`已导出角色 "${selectedRole}" 的记忆`);
    } catch (error) {
      antdMessage.error(
        `导出失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Modal.confirm({
      title: "导入记忆备份",
      content: (
        <div>
          <p>
            将从文件 <b>{file.name}</b> 恢复记忆数据。
          </p>
          <p>
            <b>合并模式</b>：与现有记忆合并，同 ID 条目会被覆盖。
            <br />
            <b>替换模式</b>：先清除文件中涉及的所有角色的记忆，再全部导入。
          </p>
        </div>
      ),
      okText: `以"${importMode === "merge" ? "合并" : "替换"}"模式导入`,
      cancelText: "取消",
      onOk: async () => {
        try {
          setLoading(true);
          const result = await importFromFile(file, importMode);
          antdMessage.success(
            `导入成功：${result.identitiesImported} 个身份，` +
              `${result.entriesImported} 条记忆，` +
              `${result.shortTermImported} 份短期摘要` +
              (result.rolesCleared > 0
                ? `（已清除 ${result.rolesCleared} 个角色）`
                : ""),
          );
          await loadRoles();
          await loadEntries();
        } catch (error) {
          antdMessage.error(
            `导入失败：${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleClearRole = () => {
    if (!selectedRole) return;
    Modal.confirm({
      title: `确定要清除角色 "${selectedRole}" 的所有记忆吗？`,
      content: "此操作不可恢复，建议先导出备份。",
      okText: "清除",
      okButtonProps: { danger: true },
      onOk: async () => {
        await service.forgetAll(selectedRole);
        antdMessage.success("已清除该角色的全部记忆");
        await loadRoles();
        await loadEntries();
      },
    });
  };

  // ─── Modal 标题 ─── //
  const modalTitle =
    modalMode === "createRole"
      ? "新建角色"
      : modalMode === "editIdentity"
        ? "编辑角色身份设定"
        : modalMode === "addMemory"
          ? "手动添加一条记忆"
          : modalMode === "editMemory"
            ? "编辑记忆"
            : "";

  return (
    <ConfigProvider theme={MEMORY_CENTER_THEME}>
      <div className="memory-center" style={{  }}>
        {/* 左栏 30%：AI 记忆管理 + 角色身份设定 上下堆叠；右栏 70%：条目 / 知识网络 */}
        <Row gutter={16} wrap={false}>
          <Col
            flex="0 0 30%"
            style={{
              maxWidth: "30%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <Card size="small" title="AI 记忆管理">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <UserOutlined style={{ marginRight: 8 }} />
                  角色：
                  <Select
                    style={{ marginLeft: 8, flex: 1 }}
                    value={selectedRole || undefined}
                    placeholder={
                      roles.length === 0 ? "暂无记忆角色" : "选择角色"
                    }
                    onChange={setSelectedRole}
                    options={roles.map((r) => ({ value: r, label: r }))}
                    disabled={roles.length === 0}
                  />
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={openCreateRole}
                    style={{ marginLeft: 8 }}
                  >
                    新建角色
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadRoles}
                    style={{ marginLeft: 4 }}
                  >
                    刷新
                  </Button>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <TagOutlined style={{ marginRight: 8 }} />
                  分类：
                  <Select
                    style={{ marginLeft: 8, flex: 1 }}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={[
                      { value: "all", label: "全部" },
                      ...Object.entries(CATEGORY_LABEL).map(([v, l]) => ({
                        value: v,
                        label: l,
                      })),
                    ]}
                  />
                  <Button
                    icon={<FileAddOutlined />}
                    onClick={openAddMemory}
                    disabled={!selectedRole}
                    style={{ marginLeft: 8 }}
                  >
                    + 添加记忆
                  </Button>
                </div>
                <div>
                  <Button
                    type="primary"
                    icon={<CloudDownloadOutlined />}
                    onClick={handleExportAll}
                    loading={loading}
                  >
                    导出全部
                  </Button>
                  <Button
                    icon={<CloudDownloadOutlined />}
                    onClick={handleExportRole}
                    disabled={!selectedRole}
                    style={{ marginLeft: 8 }}
                  >
                    导出当前角色
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleClearRole}
                    disabled={!selectedRole}
                    style={{ marginLeft: 8 }}
                  >
                    清除当前角色
                  </Button>
                </div>
                <div>
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={triggerImport}
                    loading={loading}
                    style={{ marginRight: 8 }}
                  >
                    导入备份
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  导入模式：
                  <Select
                    style={{}}
                    value={importMode}
                    onChange={setImportMode}
                    options={[
                      { value: "merge", label: "合并" },
                      { value: "replace", label: "替换" },
                    ]}
                  />
                </div>
              </Space>
            </Card>

            {/* 身份设定：与上方卡片在同一列上下堆叠 */}
            <Card
              size="small"
              title={
                <span>
                  <UserOutlined style={{ marginRight: 8 }} />
                  角色身份设定
                  {selectedRole && (
                    <Button
                      size="small"
                      type="link"
                      icon={<EditOutlined />}
                      onClick={openEditIdentity}
                      style={{ marginLeft: 8, padding: 0 }}
                    >
                      编辑
                    </Button>
                  )}
                </span>
              }
            >
              {selectedRole ? (
                identity ? (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="blue">
                        <b>{identity.displayName}</b>
                      </Tag>
                      <Tag>{identity.role}</Tag>
                      <Tag color="green">v{identity.version}</Tag>
                    </div>
                    <div
                      style={{
                        marginBottom: 8,
                        fontSize: 12,
                        color: "#9fb0c7",
                      }}
                    >
                      更新于 {new Date(identity.updatedAt).toLocaleString()}
                    </div>
                    {identity.personaDescription && (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          background: "rgba(255, 255, 255, 0.04)",
                          padding: 8,
                          borderRadius: 4,
                          color: "#dbeafe",
                        }}
                      >
                        【性格描述】{"\n"}
                        {identity.personaDescription}
                      </pre>
                    )}
                    {identity.systemPromptTemplate && (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          background: "rgba(250, 173, 20, 0.08)",
                          padding: 8,
                          borderRadius: 4,
                          borderLeft: "3px solid #faad14",
                          color: "#fde9c8",
                          marginTop: 8,
                        }}
                      >
                        【System Prompt 模板】{"\n"}
                        {identity.systemPromptTemplate}
                      </pre>
                    )}
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span>
                        该角色暂无身份设定
                        <br />
                        <Button type="link" onClick={openCreateRole}>
                          为其创建身份
                        </Button>
                      </span>
                    }
                  />
                )
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="请先选择一个角色，或点击「新建角色」"
                />
              )}
            </Card>
          </Col>

          {/* 右栏 70%：记忆条目 / 知识网络 二选一 */}
          <Col flex="1 1 70%" style={{ minWidth: 0 }}>
            <Card
              size="small"
              title={
                <div className="memory-center__right-head">
                  <Segmented
                    value={rightView}
                    onChange={(value) =>
                      setRightView(value as "list" | "graph")
                    }
                    options={[
                      { value: "list", label: "记忆条目" },
                      { value: "graph", label: "知识网络" },
                    ]}
                  />
                  <span className="memory-center__count">
                    {rightView === "list"
                      ? `清晰 ${decayStats.active} · 模糊 ${decayStats.fading} · 已遗忘 ${decayStats.forgotten}`
                      : `${visibleEntries.length} 条记忆`}
                  </span>
                  {rightView === "list" && (
                    <Space size={4}>
                      <span style={{ fontSize: 12 }}>遗忘状态：</span>
                      <Select
                        size="small"
                        style={{ width: 110 }}
                        value={decayFilter}
                        onChange={setDecayFilter}
                        options={[
                          { value: "all", label: "全部" },
                          { value: "active", label: "清晰" },
                          { value: "fading", label: "模糊" },
                          { value: "forgotten", label: "已遗忘" },
                        ]}
                      />
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => void loadEntries()}
                      >
                        刷新
                      </Button>
                    </Space>
                  )}
                </div>
              }
            >
              {rightView === "graph" ? (
                <div>
                  <KnowledgeGraph
                    entries={decoratedEntries.map((item) => item.entry)}
                    onSelectEntry={setGraphSelected}
                  />
                  {/* 点击图谱节点后的只读详情 */}
                  {graphSelected && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(105, 183, 255, 0.08)",
                        border: "1px solid rgba(105, 183, 255, 0.22)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <Space size={4}>
                          <Tag
                            color={IMPORTANCE_COLOR[graphSelected.importance]}
                          >
                            {IMPORTANCE_LABEL[graphSelected.importance]}
                          </Tag>
                          <Tag>{CATEGORY_LABEL[graphSelected.category]}</Tag>
                        </Space>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => setGraphSelected(null)}
                        >
                          关闭
                        </Button>
                      </div>
                      <div className="memory-center__content">
                        {graphSelected.content}
                      </div>
                    </div>
                  )}
                </div>
              ) : visibleEntries.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    roles.length === 0
                      ? "暂无记忆 —— 让 AI 在对话中自动学习，或手动添加"
                      : "当前过滤条件下无记忆条目"
                  }
                />
              ) : (
                <div>
                  {visibleEntries.map(({ entry, state, retention, exempt }) => (
                    <Card
                      key={entry.id}
                      size="small"
                      style={{ marginBottom: 8 }}
                      bodyStyle={{ padding: "8px 12px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag color={IMPORTANCE_COLOR[entry.importance]}>
                              {IMPORTANCE_LABEL[entry.importance]}
                            </Tag>
                            <Tag>{CATEGORY_LABEL[entry.category]}</Tag>
                            {/* 艾宾浩斯保留率 —— 越接近 100% 记得越清楚 */}
                            <Tag color={DECAY_COLOR[state]}>
                              {DECAY_LABEL[state]} {Math.round(retention * 100)}
                              %
                            </Tag>
                            {exempt && <Tag color="purple">永不忘却</Tag>}
                            {entry.tags?.map((t) => (
                              <Tag key={t}>{t}</Tag>
                            ))}
                          </div>
                          <div className="memory-center__content">
                            {entry.content}
                          </div>
                        </div>
                        <div
                          className="memory-center__meta"
                          style={{
                            marginLeft: 12,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <div>
                            创建 {new Date(entry.createdAt).toLocaleString()}
                          </div>
                          <div>访问 {entry.accessCount} 次</div>
                          {/* 条目级操作：唤醒 / 编辑 / 删除 */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 2,
                              marginTop: 4,
                            }}
                          >
                            <Button
                              size="small"
                              type="link"
                              icon={<ThunderboltOutlined />}
                              onClick={() => void handleRecall(entry.id)}
                              style={{ padding: 0, height: "auto" }}
                            >
                              想起来
                            </Button>
                            <Button
                              size="small"
                              type="link"
                              icon={<EditOutlined />}
                              onClick={() => openEditMemory(entry)}
                              style={{ padding: 0, height: "auto" }}
                            >
                              编辑
                            </Button>
                            <Button
                              size="small"
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteEntry(entry)}
                              style={{ padding: 0, height: "auto" }}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* ─── Modal: 新建/编辑角色 ─── */}
        {(modalMode === "createRole" || modalMode === "editIdentity") && (
          <Modal
            open
            title={modalTitle}
            onCancel={() => setModalMode(null)}
            onOk={handleModalOk}
            confirmLoading={loading}
            width={620}
            destroyOnClose
          >
            <Form form={form} layout="vertical" preserve={false}>
              {modalMode === "createRole" && (
                <Form.Item label="角色模板（可选，一键填充）">
                  <Select
                    allowClear
                    placeholder="选择预设模板快速创建"
                    options={ROLE_TEMPLATES.map((t) => ({
                      value: t.value,
                      label: t.label,
                    }))}
                    onChange={applyTemplate}
                  />
                </Form.Item>
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="角色 ID (role)"
                    name="role"
                    rules={[
                      { required: true, message: "请输入角色 ID" },
                      {
                        pattern: /^[a-z0-9_\-]+$/i,
                        message:
                          "仅允许字母、数字、下划线和连字符，如 hatsune_miku_tavern",
                      },
                    ]}
                    extra="对话链路中会用这个 ID 做记忆隔离"
                  >
                    <Input
                      placeholder="如 hatsune_miku_tavern"
                      disabled={modalMode === "editIdentity"}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="显示名称"
                    name="displayName"
                    rules={[{ required: true, message: "请输入显示名" }]}
                  >
                    <Input placeholder="如 初音未来" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="System Prompt 模板"
                name="systemPrompt"
                rules={[{ required: true, message: "请输入 system prompt" }]}
                extra="每次对话都会注入到 AI 的 system prompt 里，决定角色的「行为方式」"
              >
                <Input.TextArea
                  rows={6}
                  placeholder="你是一个……（决定角色说话风格和行为准则的指令）"
                />
              </Form.Item>

              <Form.Item
                label="性格描述 / Persona"
                name="persona"
                extra="用于记忆系统给 AI 注入「角色身份」标签，让 AI 知道「自己是谁」"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="16 岁虚拟歌姬，身高 158cm，活泼开朗……"
                />
              </Form.Item>
            </Form>
          </Modal>
        )}

        {/* ─── Modal: 手动添加 / 编辑记忆 ─── */}
        {(modalMode === "addMemory" || modalMode === "editMemory") && (
          <Modal
            open
            title={modalTitle}
            onCancel={() => {
              setModalMode(null);
              setEditingEntry(null);
            }}
            onOk={handleModalOk}
            confirmLoading={loading}
            width={520}
            destroyOnClose
          >
            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item
                label="记忆内容"
                name="content"
                rules={[{ required: true, message: "请输入记忆内容" }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="如：用户喜欢 TypeScript"
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="分类"
                    name="category"
                    initialValue="preference"
                  >
                    <Select
                      options={Object.entries(CATEGORY_LABEL).map(([v, l]) => ({
                        value: v,
                        label: l,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="重要性"
                    name="importance"
                    initialValue="medium"
                  >
                    <Select
                      options={Object.entries(IMPORTANCE_LABEL).map(
                        ([v, l]) => ({
                          value: v,
                          label: l,
                        }),
                      )}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="标签（逗号分隔，可选）" name="tags">
                <Input placeholder="如 coding, frontend" />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    </ConfigProvider>
  );
};

export default MemoryManagerView;
