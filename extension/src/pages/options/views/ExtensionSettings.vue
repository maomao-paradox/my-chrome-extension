<template>
  <div class="extension-settings-console">
    <!-- <section class="settings-bridge">
      <div class="settings-bridge__copy">
        <p class="settings-bridge__eyebrow">Hull Config / Deck-04</p>
        <h2>舰体设置矩阵</h2>
        <p class="settings-bridge__subtitle">统一配置运行模式、界面主题与导入导出链路，让整个终端维持同一套舰桥协议。</p>
      </div>

      <div class="settings-bridge__status">
        <article
          v-for="card in statusCards"
          :key="card.label"
          class="status-card"
          :data-tone="card.tone"
        >
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.detail }}</small>
        </article>
      </div>
    </section> -->

    <div class="settings-grid">
      <section class="settings-panel">
        <header class="panel-heading">
          <div>
            <span class="panel-heading__eyebrow">Core Config</span>
            <h3>基础参数</h3>
          </div>
          <strong>SYS-01</strong>
        </header>

        <ElForm :model="settings" label-width="132px" class="settings-form">
          <ElFormItem label="开启调试模式">
            <div class="field-block">
              <ElSwitch v-model="settings.debugMode" @change="saveSettings" />
              <p class="field-hint">启用后将提高可见性并暴露更多调试链路。</p>
            </div>
          </ElFormItem>

          <ElFormItem label="自动检查更新">
            <div class="field-block">
              <ElSwitch
                v-model="settings.autoCheckUpdate"
                @change="saveSettings"
              />
              <p class="field-hint">
                维持自动巡检时，扩展会周期性检查新版本信号。
              </p>
            </div>
          </ElFormItem>

          <ElFormItem label="通知超时时间">
            <div class="field-block field-block--compact">
              <ElInputNumber
                v-model="settings.notificationTimeout"
                :min="1"
                :max="60"
                @change="saveSettings"
              />
              <p class="field-hint">
                单位为秒，决定 HUD 弹窗在当前甲板上的保留时间。
              </p>
            </div>
          </ElFormItem>

          <ElFormItem label="性能档位">
            <div class="field-block">
              <ElRadioGroup
                v-model="settings.performanceMode"
                class="performance-mode-group"
                @change="saveSettings"
              >
                <ElRadio value="low" border>低</ElRadio>
                <ElRadio value="medium" border>中</ElRadio>
                <ElRadio value="high" border>高</ElRadio>
              </ElRadioGroup>
              <p class="field-hint">{{ performanceModeHint }}</p>
            </div>
          </ElFormItem>
        </ElForm>
      </section>

      <section class="settings-panel">
        <header class="panel-heading">
          <div>
            <span class="panel-heading__eyebrow">Interface Profile</span>
            <h3>界面协议</h3>
          </div>
          <strong>SYS-02</strong>
        </header>

        <div class="theme-signal">
          <div
            class="theme-signal__swatch"
            :style="{ '--signal-color': themeColor }"
          ></div>
          <div class="theme-signal__meta">
            <span>Theme Signal</span>
            <strong>{{ themeColorDisplay }}</strong>
            <small>{{ languageLabel }} / UI ACTIVE</small>
          </div>
        </div>

        <ElForm label-width="132px" class="settings-form">
          <ElFormItem label="主题颜色">
            <div class="field-block">
              <ElColorPicker v-model="themeColor" @change="saveThemeColor" />
              <p class="field-hint">控制终端主色调与局部高亮信号色。</p>
            </div>
          </ElFormItem>

          <ElFormItem label="语言协议">
            <div class="field-block field-block--compact">
              <ElSelect
                v-model="language"
                placeholder="选择语言"
                @change="saveLanguage"
              >
                <ElOption label="简体中文" value="zh_CN" />
                <ElOption label="English" value="en" />
              </ElSelect>
              <p class="field-hint">
                切换显示语言后，部分模块需要刷新当前页面才会重载。
              </p>
            </div>
          </ElFormItem>
        </ElForm>
      </section>
    </div>

    <section class="settings-panel settings-panel--ops">
      <header class="panel-heading">
        <div>
          <span class="panel-heading__eyebrow">Ops Deck</span>
          <h3>维护操作</h3>
        </div>
        <strong>SYS-03</strong>
      </header>

      <div class="ops-layout">
        <div class="action-matrix">
          <ElButton type="primary" @click="exportSettings"
            >导出设置矩阵</ElButton
          >
          <ElButton @click="showImportDialog = true">导入设置矩阵</ElButton>
          <ElButton type="danger" @click="resetSettings">恢复默认协议</ElButton>
        </div>

        <div class="ops-support">
          <!-- <div class="ops-note">
            <span>IMPORT / EXPORT</span>
            <p>通过 JSON 快照迁移当前舰体设置。导入完成后，界面协议会按存档重新同步。</p>
          </div> -->

          <a to="/home" class="ops-link">
            <span>作者主页</span>
            <strong>访问外部链路</strong>
            <small>HOME ROUTE</small>
          </a>
        </div>
      </div>

      <input
        ref="importInput"
        type="file"
        class="hidden-input"
        accept=".json"
        @change="importSettings"
      />
    </section>

    <ElDialog
      v-model="showImportDialog"
      title="导入设置矩阵"
      width="420px"
      append-to-body
    >
      <div class="import-dialog">
        <p>
          请选择一份 `JSON`
          设置快照。导入后会覆盖当前扩展设置、主题颜色与语言协议。
        </p>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="showImportDialog = false">取消</ElButton>
          <ElButton type="primary" @click="triggerImport">选择文件</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { storage } from "@/stores";
import {
  ElMessage,
  ElMessageBox,
  ElSwitch,
  ElDialog,
  ElButton,
  ElRadioGroup,
  ElRadio,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElColorPicker,
  ElSelect,
  ElOption,
} from "element-plus";
import {
  DEFAULT_OPTIONS_PERFORMANCE_LEVEL,
  normalizeOptionsPerformanceLevel,
  syncOptionsPerformanceMirror,
  type OptionsPerformanceLevel,
} from "../composables/useOptionsPerformance";

// 定义设置类型
interface ExtensionSettings {
  debugMode: boolean;
  autoCheckUpdate: boolean;
  notificationTimeout: number;
  performanceMode: OptionsPerformanceLevel;
}

// 基本设置
const settings = ref<ExtensionSettings>({
  debugMode: false,
  autoCheckUpdate: true,
  notificationTimeout: 5,
  performanceMode: DEFAULT_OPTIONS_PERFORMANCE_LEVEL,
});

// 界面设置
const themeColor = ref<string>("#409EFF");
const language = ref<string>("zh_CN");

const languageLabel = computed(() =>
  language.value === "en" ? "English" : "简体中文",
);
const themeColorDisplay = computed(() => themeColor.value.toUpperCase());
const performanceModeHint = computed(() => {
  const hints: Record<OptionsPerformanceLevel, string> = {
    low: "低: 关闭页面动画、光标特效和大部分动态联动，优先保证低配机器流畅。",
    medium: "中: 保留基础切换和表单交互，关闭持续性的氛围动画与高频视觉效果。",
    high: "高: 保持当前完整视觉效果，自定义光标、扫描动效和动态联动全部开启。",
  };

  return hints[settings.value.performanceMode];
});

const statusCards = computed(() => {
  return [
    {
      label: "MODE",
      value: settings.value.debugMode ? "DEBUG" : "STABLE",
      detail: settings.value.debugMode ? "调试链路开放" : "运行参数已锁定",
      tone: settings.value.debugMode ? "amber" : "blue",
    },
    {
      label: "UPDATE",
      value: settings.value.autoCheckUpdate ? "AUTO" : "MANUAL",
      detail: settings.value.autoCheckUpdate
        ? "自动巡检在线"
        : "仅手动检查版本",
      tone: settings.value.autoCheckUpdate ? "green" : "blue",
    },
    {
      label: "NOTICE",
      value: `${settings.value.notificationTimeout}s`,
      detail: `${languageLabel.value} / HUD 通知窗口`,
      tone: "blue",
    },
  ];
});

// 对话框状态
const showImportDialog = ref<boolean>(false);

// 文件导入input引用
const importInput = ref<HTMLInputElement | null>(null);

// 加载所有设置
const loadAllSettings = async () => {
  if (!chrome.storage) {
    ElMessage({
      message: "开发环境无法访问后台存储，请到生产环境测试",
      type: "warning",
    });
    return;
  }
  try {
    // 加载基本设置
    const savedSettings = await storage.ext.local.get(
      "extensionSettings",
      null,
    );
    if (savedSettings) {
      settings.value = { ...settings.value, ...savedSettings };
    }
    settings.value.performanceMode = normalizeOptionsPerformanceLevel(
      settings.value.performanceMode,
    );
    syncOptionsPerformanceMirror(settings.value.performanceMode);

    // 加载界面设置
    themeColor.value = await storage.ext.local.get("themeColor", "#409EFF");
    language.value = await storage.ext.local.get("language", "zh_CN");
  } catch (error) {
    maLogger.error("加载设置失败:", error);
    ElMessage({ message: "加载设置失败", type: "error" });
  }
};

// 保存基本设置
const saveSettings = async () => {
  try {
    settings.value.performanceMode = normalizeOptionsPerformanceLevel(
      settings.value.performanceMode,
    );
    syncOptionsPerformanceMirror(settings.value.performanceMode);
    await storage.ext.local.set("extensionSettings", settings.value);
    ElMessage({ message: "基本设置已保存", type: "success" });
  } catch (error) {
    maLogger.error("保存设置失败:", error);
    ElMessage({ message: "保存设置失败", type: "error" });
  }
};

// 保存主题颜色
const saveThemeColor = async () => {
  try {
    await storage.ext.local.set("themeColor", themeColor.value);
    ElMessage({ message: "主题颜色已保存", type: "success" });
    // 这里可以添加更新主题颜色的逻辑
  } catch (error) {
    maLogger.error("保存主题颜色失败:", error);
    ElMessage({ message: "保存主题颜色失败", type: "error" });
  }
};

// 保存语言设置
const saveLanguage = async () => {
  try {
    await storage.ext.local.set("language", language.value);
    ElMessage({
      message: "语言设置已保存，需要刷新页面生效",
      type: "success",
      duration: 3000,
    });
  } catch (error) {
    maLogger.error("保存语言设置失败:", error);
    ElMessage({ message: "保存语言设置失败", type: "error" });
  }
};

// 重置为默认设置
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm("确定要重置所有设置为默认值吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    // 重置设置
    settings.value = {
      debugMode: false,
      autoCheckUpdate: true,
      notificationTimeout: 5,
      performanceMode: DEFAULT_OPTIONS_PERFORMANCE_LEVEL,
    };

    themeColor.value = "#409EFF";
    language.value = "zh_CN";
    syncOptionsPerformanceMirror(settings.value.performanceMode);

    // 保存重置后的设置
    await Promise.all([
      storage.ext.local.set("extensionSettings", settings.value),
      storage.ext.local.set("themeColor", themeColor.value),
      storage.ext.local.set("language", language.value),
    ]);

    ElMessage({ message: "设置已重置为默认值", type: "success" });
  } catch (error: any) {
    // 用户取消操作
    if (error !== "cancel") {
      maLogger.error("重置设置失败:", error);
      ElMessage({ message: "重置设置失败", type: "error" });
    }
  }
};

// 导出设置
const exportSettings = async () => {
  try {
    const allSettings = {
      extensionSettings: settings.value,
      themeColor: themeColor.value,
      language: language.value,
      exportTime: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(allSettings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `mria-extension-settings-${new Date().toISOString().split("T")[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
    ElMessage({ message: "设置导出成功", type: "success" });
  } catch (error) {
    maLogger.error("导出设置失败:", error);
    ElMessage({ message: "导出设置失败", type: "error" });
  }
};

// 触发导入文件选择
const triggerImport = () => {
  importInput.value?.click();
};

// 导入设置
const importSettings = async (event: Event) => {
  try {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.endsWith(".json")) {
      ElMessage({ message: "请选择JSON格式的文件", type: "error" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const settingsData = JSON.parse(e.target?.result as string);

        // 验证设置数据格式
        if (!settingsData || typeof settingsData !== "object") {
          ElMessage({ message: "设置文件格式不正确", type: "error" });
          return;
        }

        // 更新设置
        if (settingsData.extensionSettings) {
          settings.value = {
            ...settings.value,
            ...settingsData.extensionSettings,
          };
          settings.value.performanceMode = normalizeOptionsPerformanceLevel(
            settings.value.performanceMode,
          );
          syncOptionsPerformanceMirror(settings.value.performanceMode);
          await storage.ext.local.set("extensionSettings", settings.value);
        }

        if (settingsData.themeColor) {
          themeColor.value = settingsData.themeColor;
          await storage.ext.local.set("themeColor", themeColor.value);
        }

        if (settingsData.language) {
          language.value = settingsData.language;
          await storage.ext.local.set("language", language.value);
        }

        showImportDialog.value = false;
        ElMessage({
          message: "设置导入成功，部分设置需要刷新页面生效",
          type: "success",
          duration: 3000,
        });
      } catch (error) {
        maLogger.error("解析设置文件失败:", error);
        ElMessage({ message: "解析设置文件失败", type: "error" });
      }
    };

    reader.readAsText(file);
  } catch (error) {
    maLogger.error("导入设置失败:", error);
    ElMessage({ message: "导入设置失败", type: "error" });
  }

  // 清空input值，以便可以重复选择同一个文件
  const target = event.target as HTMLInputElement;
  target.value = "";
};

// 组件挂载时加载设置
onMounted(() => {
  loadAllSettings();
});
</script>

<style scoped>
.extension-settings-console {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-bridge,
.settings-panel,
.status-card,
.ops-link {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(86, 170, 235, 0.16);
  background:
    linear-gradient(180deg, rgba(7, 16, 29, 0.94), rgba(4, 10, 18, 0.9)),
    radial-gradient(
      circle at top right,
      rgba(60, 146, 255, 0.08),
      transparent 42%
    );
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.24),
    0 0 22px rgba(68, 165, 255, 0.05),
    inset 0 1px 0 rgba(183, 231, 255, 0.05);
}

.settings-bridge,
.settings-panel {
  clip-path: polygon(
    0 18px,
    18px 0,
    calc(100% - 28px) 0,
    100% 18px,
    100% 100%,
    20px 100%,
    0 calc(100% - 20px)
  );
}

.settings-bridge::before,
.settings-panel::before,
.status-card::before,
.ops-link::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(transparent 96%, rgba(84, 154, 212, 0.05) 100%),
    linear-gradient(90deg, transparent 96%, rgba(84, 154, 212, 0.04) 100%);
  background-size:
    100% 18px,
    18px 100%;
  opacity: 0.16;
}

.settings-bridge {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 18px;
  padding: 22px;
}

.settings-bridge__eyebrow,
.panel-heading__eyebrow,
.status-card span,
.theme-signal__meta span,
.theme-signal__meta small,
.ops-note span,
.ops-link small {
  font-family: "JetBrains Mono", "Consolas", monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.settings-bridge__eyebrow {
  margin: 0 0 10px;
  color: rgba(137, 203, 239, 0.76);
  font-size: 11px;
}

.settings-bridge h2 {
  margin: 0;
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.05;
  color: #eefaff;
  text-shadow: 0 0 18px rgba(107, 189, 255, 0.18);
}

.settings-bridge__subtitle {
  margin: 12px 0 0;
  max-width: 720px;
  line-height: 1.65;
  color: rgba(196, 227, 243, 0.8);
}

.settings-bridge__status {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.status-card {
  padding: 16px 14px;
  clip-path: polygon(
    0 12px,
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%
  );
}

.status-card span {
  display: block;
  margin-bottom: 10px;
  font-size: 10px;
  color: rgba(131, 195, 233, 0.72);
}

.status-card strong {
  display: block;
  margin-bottom: 8px;
  font-size: 20px;
  color: #f3fbff;
}

.status-card small {
  display: block;
  color: rgba(188, 223, 244, 0.72);
  line-height: 1.5;
}

.status-card[data-tone="green"] {
  border-color: rgba(122, 247, 208, 0.24);
}

.status-card[data-tone="amber"] {
  border-color: rgba(255, 179, 71, 0.26);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.settings-panel {
  padding: 18px;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-heading__eyebrow {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  color: rgba(131, 195, 233, 0.72);
}

.panel-heading h3 {
  margin: 0;
  font-size: 22px;
  color: #f1fbff;
}

.panel-heading strong {
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 12px;
  color: rgba(147, 219, 241, 0.82);
}

.theme-signal {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px solid rgba(96, 181, 239, 0.14);
  background: rgba(5, 14, 24, 0.68);
  clip-path: polygon(
    0 10px,
    10px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%
  );
}

.theme-signal__swatch {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--signal-color) 82%, #ffffff),
    var(--signal-color)
  );
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 24px color-mix(in srgb, var(--signal-color) 26%, transparent);
}

.theme-signal__meta strong {
  display: block;
  margin: 4px 0;
  font-size: 18px;
  color: #eefaff;
}

.theme-signal__meta span,
.theme-signal__meta small {
  color: rgba(137, 205, 241, 0.76);
  font-size: 10px;
}

.field-block {
  width: 100%;
  display: grid;
  gap: 8px;
}

.field-block--compact {
  max-width: 320px;
}

.performance-mode-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.field-hint {
  margin: 0;
  line-height: 1.5;
  color: rgba(176, 210, 232, 0.68);
  font-size: 12px;
}

.settings-panel--ops {
  padding-bottom: 22px;
}

.ops-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: 18px;
}

.action-matrix {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ops-support {
  display: grid;
  gap: 12px;
}

.ops-note {
  padding: 16px;
  border: 1px solid rgba(96, 181, 239, 0.14);
  background: rgba(5, 14, 24, 0.68);
  clip-path: polygon(
    0 10px,
    10px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%
  );
}

.ops-note span {
  display: block;
  margin-bottom: 10px;
  font-size: 10px;
  color: rgba(137, 205, 241, 0.76);
}

.ops-note p {
  margin: 0;
  line-height: 1.6;
  color: rgba(196, 227, 243, 0.78);
}

.ops-link {
  display: block;
  padding: 16px;
  text-decoration: none;
  clip-path: polygon(
    0 10px,
    10px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%
  );
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.ops-link:hover {
  transform: translateY(-1px);
  border-color: rgba(122, 247, 208, 0.28);
  box-shadow: 0 0 24px rgba(122, 247, 208, 0.08);
}

.ops-link span {
  display: block;
  margin-bottom: 8px;
  font-size: 10px;
  color: rgba(137, 205, 241, 0.76);
}

.ops-link strong {
  display: block;
  margin-bottom: 6px;
  font-size: 18px;
  color: #eefaff;
}

.ops-link small {
  color: rgba(176, 210, 232, 0.68);
  font-size: 10px;
}

.hidden-input {
  display: none;
}

.import-dialog p {
  margin: 0;
  color: rgba(196, 227, 243, 0.82);
  line-height: 1.65;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.settings-form .el-form-item) {
  margin-bottom: 18px;
}

:deep(.settings-form .el-form-item__label) {
  color: rgba(141, 204, 239, 0.76) !important;
  font-family: "JetBrains Mono", "Consolas", monospace;
  letter-spacing: 0.08em;
}

:deep(.performance-mode-group .el-radio.is-bordered) {
  margin-right: 0;
}

:deep(.el-switch) {
  --el-switch-on-color: #5dafff;
  --el-switch-off-color: rgba(59, 88, 116, 0.92);
}

:deep(.el-input-number),
:deep(.el-select),
:deep(.el-color-picker) {
  max-width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-input-number .el-input__wrapper) {
  background: rgba(6, 16, 30, 0.8) !important;
  box-shadow: inset 0 0 0 1px rgba(96, 181, 239, 0.16) !important;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-input-number .el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px rgba(122, 247, 208, 0.26) !important;
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  background: rgba(8, 17, 31, 0.86) !important;
  color: rgba(191, 223, 241, 0.72) !important;
}

:deep(.el-select__wrapper),
:deep(.el-color-picker__trigger) {
  background: rgba(6, 16, 30, 0.8) !important;
  box-shadow: inset 0 0 0 1px rgba(96, 181, 239, 0.16) !important;
  border: 0 !important;
}

:deep(.el-button) {
  border-radius: 12px;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

:deep(.action-matrix .el-button:hover),
:deep(.dialog-footer .el-button:hover) {
  transform: translateY(-1px);
}

:deep(.el-dialog) {
  border: 1px solid rgba(86, 170, 235, 0.16);
  background: linear-gradient(
    180deg,
    rgba(7, 16, 29, 0.98),
    rgba(4, 10, 18, 0.96)
  ) !important;
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.32),
    0 0 22px rgba(68, 165, 255, 0.05) !important;
}

:deep(.el-dialog__title) {
  color: #eefaff !important;
}

:deep(.el-dialog__body) {
  color: rgba(196, 227, 243, 0.82) !important;
}

@media (max-width: 1180px) {
  .settings-bridge,
  .settings-grid,
  .ops-layout {
    grid-template-columns: 1fr;
  }

  .settings-bridge__status,
  .action-matrix {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .settings-bridge,
  .settings-panel {
    padding: 16px;
  }

  .panel-heading,
  .ops-layout {
    gap: 14px;
  }

  :deep(.settings-form .el-form-item__label) {
    width: 100% !important;
    margin-bottom: 8px;
  }

  :deep(.settings-form .el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
