<template>
  <TableContainer>
    <template #head__left>
      <p class="section-kicker">Control Center</p>
      <h2 class="section-title">配置设置</h2>
      <p class="section-subtitle">主题、站点脚本与功能入口集中配置。</p>
    </template>
    <template #head__right>
      <div class="settings-summary">
        <div class="summary-chip">
          <span>配置项</span>
          <strong>{{ pluginConfigEntries.length }}</strong>
        </div>
        <div class="summary-chip summary-chip--accent">
          <span>已启用</span>
          <strong>{{ enabledPluginCount }}</strong>
        </div>
      </div>
    </template>
    <template #default>
      <div class="settings-dashboard">
        <section class="settings-panel settings-panel--theme">
          <div class="panel-heading">
            <span class="panel-icon">
              <IconSetting />
            </span>
            <div class="panel-copy">
              <p class="card-kicker">Appearance</p>
              <h3 class="card-title">主题设置</h3>
            </div>
            <span class="panel-status">{{ currentThemeLabel }}</span>
          </div>

          <div class="theme-grid">
            <button
              v-for="theme in popupThemes"
              :key="theme.key"
              type="button"
              class="theme-option"
              :class="[
                `theme-option--${theme.key}`,
                { 'theme-option--active': activeTheme === theme.key },
              ]"
              :aria-pressed="activeTheme === theme.key"
              @click="selectTheme(theme.key)"
            >
              <span class="theme-preview">
                <span class="theme-preview__panel"></span>
                <span class="theme-preview__accent"></span>
              </span>
              <span class="theme-copy">
                <strong>{{ theme.label }}</strong>
                <small>{{ theme.description }}</small>
              </span>
            </button>
          </div>

          <div class="switch-row switch-row--appearance">
            <MASwitch
              v-model="isMouseTrailEnabled"
              label="鼠标拖尾"
              @change="handleMouseTrailChange"
            >
              <select
                v-model="mouseTrailPreset"
                class="dropdown-select mouse-trail-preset-select"
                :disabled="!isMouseTrailEnabled"
                aria-label="鼠标拖尾样式"
                @change="handleMouseTrailPresetChange"
              >
                <option
                  v-for="option in mouseTrailPresetOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </MASwitch>
          </div>
        </section>

        <section class="settings-panel settings-panel--site">
          <div class="panel-heading">
            <span class="panel-icon">
              <IconDocument />
            </span>
            <div class="panel-copy">
              <p class="card-kicker">Current Site</p>
              <h3 class="card-title">内容脚本</h3>
            </div>
            <span class="panel-status"
              >{{ availableContentScripts.length }} 个</span
            >
          </div>

          <div class="site-controls">
            <div class="domain-row">
              <span class="field-label">当前域名</span>
              <strong class="domain-value">{{
                currentActivedTabDomain || "未识别"
              }}</strong>
            </div>

            <label class="script-field">
              <span class="field-label">绑定脚本</span>
              <span class="select-shell">
                <select
                  v-model="selectedContentScript"
                  class="content-script-select"
                  :disabled="
                    availableContentScripts.length === 0 ||
                    !currentActivedTabDomain
                  "
                  @change="handleScriptChange"
                >
                  <option value="">不启用内容脚本</option>
                  <option
                    v-for="script of availableContentScripts"
                    :key="script"
                    :value="script"
                  >
                    {{ script }}
                  </option>
                </select>
              </span>
            </label>

            <div
              class="selection-summary"
              :class="{ 'selection-summary--empty': !selectedContentScript }"
            >
              <span class="selection-dot"></span>
              <span>{{ selectedScriptLabel }}</span>
            </div>

            <p
              v-if="availableContentScripts.length === 0"
              class="selector-hint"
            >
              暂无可用内容脚本
            </p>
          </div>
        </section>

        <section class="settings-panel settings-panel--features">
          <div class="panel-heading">
            <span class="panel-icon">
              <IconTooling />
            </span>
            <div class="panel-copy">
              <p class="card-kicker">Feature Routing</p>
              <h3 class="card-title">功能设置</h3>
            </div>
            <span class="panel-status">{{ routedPluginCount }} 个入口</span>
          </div>

          <TransitionGroup
            v-if="pluginConfigEntries.length > 0"
            name="config-row"
            tag="div"
            class="switch-list"
          >
            <div
              v-for="[key, app] in pluginConfigEntries"
              :key="key"
              class="switch-row"
              :class="{ 'switch-row--routed': app.type !== undefined }"
            >
              <MASwitch v-model="pluginConfigs[key].enabled" :label="app.name">
                <input
                  v-if="app.type === 'toolbar'"
                  type="color"
                  class="color-picker"
                  aria-label="选择品牌颜色"
                  v-model="app.options.brandColor"
                />
              </MASwitch>
            </div>
          </TransitionGroup>

          <div v-else class="empty-state">
            <div class="empty-icon">
              <IconTime />
            </div>
            <p class="empty-title">暂无配置项</p>
          </div>
        </section>
      </div>

      <div
        class="save-dock"
        :class="`save-dock--${saveState}`"
        aria-live="polite"
      >
        <button class="primary-btn" :disabled="isSaving" @click="saveConfig">
          <span class="primary-btn__icon">
            <IconConfirm />
          </span>
          <span class="primary-btn__copy">
            <strong>{{ saveButtonTitle }}</strong>
            <small>{{ saveButtonHint }}</small>
          </span>
        </button>
      </div>
    </template>
  </TableContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storage } from "@/stores";
import { sendMessageToContentScript } from "@/message/back-content";
import { MASwitch } from "@components/index";
import TableContainer from "./TableContainer.vue";
import { appConfigKey, domainConfigsKey } from "@/config";
import {
  IconConfirm,
  IconDocument,
  IconSetting,
  IconTime,
  IconTooling,
} from "@icons/index";
import { useDomainState } from "../composables/useDomainState.js";
import {
  popupThemes,
  usePopupTheme,
  type PopupThemeKey,
} from "../composables/usePopupTheme.js";
import { usePopupMouseTrail } from "../composables/usePopupMouseTrail.js";
import { mouseTrailPresetOptions } from "@/assets/composables/mouse/mouseTrailPreference";
import {
  useDomainManager,
  type DomainConfigItem,
} from "@/assets/composables/useDomainManager";
import { usePluginManager } from "@/assets/composables/usePluginManager";

const { extractDomain } = useDomainState();
const { activeTheme, setPopupTheme } = usePopupTheme();
const {
  isMouseTrailEnabled,
  mouseTrailPreset,
  setPopupMouseTrail,
  setPopupMouseTrailPreset,
} = usePopupMouseTrail();
const { domainConfigs, loadDomainConfigs } = useDomainManager();
const { pluginConfigs, loadPluginConfigs } = usePluginManager();

const MESSAGE_TYPE = {
  "0": "CONFIG_INIT",
  "1": "CONFIG_UPDATE",
  "2": "CONFIG_DELETE",
} as const;

const selectedContentScript = ref<string>("");
const currentActivedTabDomain = ref<string>("");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveResetTimer: ReturnType<typeof setTimeout> | undefined;

const availableContentScripts = computed<string[]>(() => {
  return Object.entries(domainConfigs.value)
    .filter(([key, config]) => {
      if (key === "Eve") {
        return false;
      }
      if (typeof config === "object" && config !== null) {
        return config.enabled;
      }
      return true;
    })
    .map(([key]) => key);
});

const pluginConfigEntries = computed(() => Object.entries(pluginConfigs.value));
const enabledPluginCount = computed(() => {
  return pluginConfigEntries.value.filter(([_, app]) => Boolean(app.enabled))
    .length;
});
const routedPluginCount = computed(() => {
  return pluginConfigEntries.value.filter(
    ([, value]) => value.type !== undefined,
  ).length;
});
const currentThemeLabel = computed(() => {
  return (
    popupThemes.find((theme) => theme.key === activeTheme.value)?.label ??
    popupThemes[0].label
  );
});
const selectedScriptLabel = computed(() => {
  if (!currentActivedTabDomain.value) {
    return "当前站点未识别";
  }

  return selectedContentScript.value || "当前站点未绑定脚本";
});
const isSaving = computed(() => saveState.value === "saving");
const saveButtonTitle = computed(() => {
  if (saveState.value === "saving") {
    return "保存中";
  }

  if (saveState.value === "saved") {
    return "已保存";
  }

  if (saveState.value === "error") {
    return "保存失败";
  }

  return "保存配置";
});
const saveButtonHint = computed(() => {
  if (saveState.value === "saving") {
    return "正在写入本地并同步页面";
  }

  if (saveState.value === "saved") {
    return "配置已同步到当前页面";
  }

  if (saveState.value === "error") {
    return "请稍后重试或检查当前页面状态";
  }

  return "写入本地并同步到当前页面";
});

const parseDomains = (domainsString: string): string[] => {
  if (!domainsString) {
    return [];
  }

  return Array.from(
    new Set(
      domainsString
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const getDomainsString = (scriptKey: string): string => {
  const config = domainConfigs.value[scriptKey];
  if (typeof config === "object" && config !== null) {
    return config.domains || "";
  }
  return typeof config === "string" ? config : "";
};

const ensureDomainConfigObject = (scriptKey: string): DomainConfigItem => {
  const currentConfig = domainConfigs.value[scriptKey];
  if (typeof currentConfig === "object" && currentConfig !== null) {
    return currentConfig;
  }

  const normalizedConfig: DomainConfigItem = {
    enabled: true,
    domains: typeof currentConfig === "string" ? currentConfig : "",
  };
  domainConfigs.value[scriptKey] = normalizedConfig;
  return normalizedConfig;
};

const syncCurrentDomainSelection = (scriptKey: string): void => {
  if (!currentActivedTabDomain.value) {
    return;
  }

  for (const [key] of Object.entries(domainConfigs.value)) {
    if (key === "Eve") {
      continue;
    }

    const config = ensureDomainConfigObject(key);
    const filteredDomains = parseDomains(config.domains).filter(
      (item) => item !== currentActivedTabDomain.value,
    );

    if (scriptKey && key === scriptKey) {
      filteredDomains.push(currentActivedTabDomain.value);
    }

    config.domains = Array.from(new Set(filteredDomains)).join(",");
  }
};

const resolveSelectedScript = (): string => {
  if (!currentActivedTabDomain.value) {
    return "";
  }

  for (const scriptKey of availableContentScripts.value) {
    if (
      parseDomains(getDomainsString(scriptKey)).includes(
        currentActivedTabDomain.value,
      )
    ) {
      return scriptKey;
    }
  }

  return "";
};

const handleScriptChange = () => {
  syncCurrentDomainSelection(selectedContentScript.value);
};

const selectTheme = async (themeKey: PopupThemeKey): Promise<void> => {
  if (themeKey === activeTheme.value) {
    return;
  }

  await setPopupTheme(themeKey);
};

const handleMouseTrailChange = async (enabled: boolean): Promise<void> => {
  await setPopupMouseTrail(enabled);
};

const handleMouseTrailPresetChange = async (): Promise<void> => {
  await setPopupMouseTrailPreset(mouseTrailPreset.value);
};

const loadConfig = async (): Promise<void> => {
  try {
    await loadPluginConfigs();
    await loadDomainConfigs();
  } catch (error) {
    maLogger.error("加载配置失败:", error);
  }
};

const getActivedTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
};

const getActivedTabDomain = async (): Promise<string> => {
  const tab = await getActivedTab();
  return extractDomain(tab?.url || "");
};

const scheduleSaveStateReset = (): void => {
  if (saveResetTimer) {
    clearTimeout(saveResetTimer);
  }

  saveResetTimer = setTimeout(() => {
    saveState.value = "idle";
    saveResetTimer = undefined;
  }, 1800);
};

const saveConfig = async (): Promise<void> => {
  if (isSaving.value) {
    return;
  }

  saveState.value = "saving";

  try {
    if (chrome.storage?.local) {
      await storage.ext.local.set(appConfigKey, pluginConfigs.value);
      await storage.ext.local.set(domainConfigsKey, domainConfigs.value);
    }

    const res = await sendMessageToContentScript({
      type: MESSAGE_TYPE["1"],
      payload: pluginConfigs.value,
    });
    maLogger.log(res);
    saveState.value = "saved";
  } catch (error) {
    maLogger.error("保存配置失败:", error);
    saveState.value = "error";
  } finally {
    scheduleSaveStateReset();
  }
};

watch(
  () => pluginConfigs.value,
  async (newValue) => {
    if (newValue) {
      if (isSaving.value) {
        return;
      }

      saveState.value = "saving";

      try {
        const res = await sendMessageToContentScript({
          type: MESSAGE_TYPE["1"],
          payload: pluginConfigs.value,
        });
        maLogger.log(res);
        saveState.value = "saved";
      } catch (error) {
        maLogger.error("保存配置失败:", error);
        saveState.value = "error";
      } finally {
        scheduleSaveStateReset();
      }
    }
  },
);

onMounted(async () => {
  await loadConfig();
  currentActivedTabDomain.value = await getActivedTabDomain();
  selectedContentScript.value = resolveSelectedScript();
});

onBeforeUnmount(() => {
  if (saveResetTimer) {
    clearTimeout(saveResetTimer);
  }
});
</script>

<style scoped lang="scss">
.section-kicker {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--popup-accent);
}

.card-kicker {
  margin: 0 0 2px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--popup-accent);
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--popup-text-primary);
}

.section-subtitle {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--popup-text-muted);
}

.settings-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 112px;
}

.summary-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 36px;
  padding: 5px 8px;
  border-radius: 12px;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg);
  box-shadow: var(--popup-inset-highlight);

  span {
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    color: var(--popup-text-subtle);
  }

  strong {
    font-size: 14px;
    line-height: 1;
    color: var(--popup-text-primary);
  }

  &--accent {
    border-color: var(--popup-border-strong);
    background: var(--popup-accent-gradient);
  }
}

.settings-dashboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 15px;
  border: 1px solid var(--popup-border);
  background: var(--popup-panel-bg);
  box-shadow: var(--popup-shadow-soft), var(--popup-inset-highlight);
}

.settings-panel::before {
  content: "";
  position: absolute;
  inset: 0 10px auto;
  height: 1px;
  background: var(--popup-divider-gradient);
  opacity: 0.68;
}

.panel-heading {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 11px;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg);
  color: var(--popup-accent);
  box-shadow: var(--popup-inset-highlight);
}

.panel-icon :deep(svg) {
  width: 15px;
  height: 15px;
}

.panel-copy {
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--popup-text-primary);
}

.panel-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  max-width: 82px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--popup-border-muted);
  background: var(--popup-control-bg);
  color: var(--popup-text-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.theme-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 56px;
  padding: 6px 8px;
  border: 1px solid var(--popup-border);
  border-radius: 13px;
  background: var(--popup-theme-option-bg);
  color: var(--popup-text-secondary);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: var(--popup-border-strong);
    background: var(--popup-control-hover-bg);
  }

  &--active {
    border-color: var(--popup-border-strong);
    background: var(--popup-theme-option-active-bg);
    box-shadow: var(--popup-shadow-soft), var(--popup-inset-highlight);
  }
}

.theme-option:focus-visible,
.content-script-select:focus-visible,
.dropdown-select:focus-visible,
.primary-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--popup-focus-ring);
}

.theme-preview {
  position: relative;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 11px;
  border: 1px solid var(--popup-border);
  background: var(--theme-preview-bg);
  box-shadow: var(--popup-inset-highlight);

  &__panel {
    position: absolute;
    top: 7px;
    left: 6px;
    width: 17px;
    height: 12px;
    border-radius: 5px;
    background: color-mix(
      in srgb,
      var(--popup-text-on-accent) 42%,
      transparent
    );
  }

  &__accent {
    position: absolute;
    right: 5px;
    bottom: 5px;
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: var(--theme-preview-accent);
  }
}

.theme-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--popup-text-primary);
  }

  small {
    display: -webkit-box;
    overflow: hidden;
    font-size: 10px;
    line-height: 1.25;
    color: var(--popup-text-subtle);
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.site-controls {
  display: grid;
  gap: 7px;
}

.domain-row,
.script-field,
.selection-summary {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 7px 9px;
  border-radius: 12px;
  border: 1px solid var(--popup-border-muted);
  background: var(--popup-control-bg);
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--popup-text-subtle);
  white-space: nowrap;
}

.domain-value {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.25;
  color: var(--popup-text-primary);
}

.select-shell {
  position: relative;
  min-width: 0;

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    right: 12px;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid var(--popup-text-subtle);
    border-bottom: 1.5px solid var(--popup-text-subtle);
    pointer-events: none;
    transform: translateY(-65%) rotate(45deg);
  }
}

.content-script-select,
.dropdown-select {
  width: 100%;
  min-height: 32px;
  padding: 0 30px 0 10px;
  border-radius: 10px;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg-strong);
  color: var(--popup-text-secondary);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.content-script-select:hover,
.dropdown-select:hover {
  background: var(--popup-control-hover-bg);
  border-color: var(--popup-border-strong);
}

.content-script-select:focus,
.dropdown-select:focus,
.content-script-select:focus-visible,
.dropdown-select:focus-visible {
  border-color: var(--popup-border-strong);
  box-shadow: 0 0 0 4px var(--popup-focus-ring);
}

.content-script-select:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.content-script-select option,
.dropdown-select option {
  background: var(--popup-bg-secondary);
  color: var(--popup-text-secondary);
}

.selector-hint {
  margin: 0;
  padding: 0 2px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--popup-danger-strong);
}

.selection-summary {
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 32px;
  color: var(--popup-success-text);
  background: var(--popup-success-bg);
  border-color: var(--popup-success-border);
  font-size: 11px;
  font-weight: 700;
}

.selection-summary--empty {
  color: var(--popup-text-muted);
  background: var(--popup-control-bg);
  border-color: var(--popup-border-muted);
}

.selection-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 14%, transparent);
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

// 提取可复用的过渡mixin
@mixin fade-slide($duration: 0.2s, $offset: 6px) {
  &-enter-active,
  &-leave-active,
  &-move {
    transition:
      opacity $duration ease,
      transform $duration ease;
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
    transform: translateY($offset);
  }
}

.switch-row {
  overflow: hidden;
  border-radius: 13px;
  border: 1px solid var(--popup-border-muted);
  background: var(--popup-theme-option-bg);
  transition: all 0.2s ease;

  .color-picker {
    width: 22px;
    height: 22px;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid var(--popup-border);

    /* 颜色预览区域的外层容器 */
    &::-webkit-color-swatch-wrapper {
      padding: 0;
      border: none;
      background: transparent;
    }

    /* 颜色预览块 - 这里就是实际显示颜色的地方 */
    &::-webkit-color-swatch {
      border: none;
      transition: all 0.3s ease;
    }
  }

  &:hover {
    transform: translateY(-1px);
    border-color: var(--popup-border-strong);
    background: var(--popup-control-hover-bg);
  }

  :deep() {
    // 容器
    .sci-fi-switch-container {
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 8px 9px;
    }

    // 标签
    .sci-fi-switch-label {
      min-width: 0;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
      color: var(--popup-text-secondary);
      text-shadow: none;
      letter-spacing: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    // 下拉选择
    .dropdown-select {
      width: 78px;
      min-width: 78px;
      min-height: 30px;
      padding: 0 24px 0 8px;
      border-radius: 10px;
      font-size: 11px;
    }

    // 开关
    .sci-fi-switch {
      flex-shrink: 0;

      &:hover,
      &:active {
        transform: none;
      }

      &.active {
        .switch-track {
          animation: none;
          border-color: var(--popup-switch-active-border);
          background: var(--popup-switch-active-bg);
          box-shadow: var(--popup-inset-highlight);
        }

        .switch-thumb {
          left: calc(100% - 23px);
          background: var(--popup-switch-active-thumb-bg);
        }

        .switch-indicator {
          right: 29px;
          color: var(--popup-text-on-accent);
          text-shadow: none;
        }
      }
    }

    // 开关部件（统一过渡）
    .switch-track,
    .switch-thumb,
    .switch-indicator {
      transition: all 0.24s ease;
    }

    .switch-track {
      width: 52px;
      height: 28px;
      border: 1px solid var(--popup-border);
      background: var(--popup-switch-track-bg);
      box-shadow: var(--popup-inset-highlight);
    }

    .switch-thumb {
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background: var(--popup-switch-thumb-bg);
      box-shadow: none;
      transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .switch-glow {
      display: none;
    }

    .switch-indicator {
      right: 7px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--popup-text-subtle);
      text-shadow: none;
    }
  }
}

// 配置行动画
.config-row {
  @include fade-slide;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 16px 12px;
  border-radius: 14px;
  border: 1px dashed var(--popup-border);
  background: var(--popup-control-bg);
  text-align: center;
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-bottom: 8px;
  border-radius: 13px;
  color: var(--popup-accent);
  background: var(--popup-accent-gradient);
  box-shadow: var(--popup-inset-highlight);
}

.empty-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--popup-text-primary);
}

.save-dock {
  position: sticky;
  bottom: 0;
  z-index: 4;
  padding: 7px 0 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--popup-bg-primary) 38%,
    var(--popup-bg-primary) 100%
  );

  .primary-btn {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    width: 100%;
    min-height: 46px;
    padding: 7px 10px;
    border: 1px solid var(--popup-button-border);
    border-radius: 14px;
    background: var(--popup-button-bg);
    color: var(--popup-text-on-accent);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    box-shadow: var(--popup-shadow-accent);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
    }

    &:disabled {
      cursor: progress;
      filter: saturate(0.88);
    }

    &__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 11px;
      background: color-mix(
        in srgb,
        var(--popup-text-on-accent) 18%,
        transparent
      );
      box-shadow: var(--popup-inset-highlight);

      :deep(svg) {
        width: 14px;
        height: 14px;
      }
    }

    &__copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;

      strong {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.15;
      }

      small {
        font-size: 10px;
        line-height: 1.25;
        color: color-mix(in srgb, var(--popup-text-on-accent) 88%, transparent);
      }
    }
  }

  // 使用mixin简化状态管理
  @mixin state-variant($color-var, $bg-var, $border-var) {
    .primary-btn {
      color: var(#{$color-var});
      border-color: var(#{$border-var});
      background: var(#{$bg-var});
      box-shadow: var(--popup-inset-highlight);
    }

    .primary-btn__copy small {
      color: color-mix(in srgb, var(#{$color-var}) 82%, transparent);
    }
  }

  &--saving .primary-btn__icon {
    animation: savePulse 0.9s ease-in-out infinite;
  }

  &--saved {
    @include state-variant(
      --popup-success-text,
      --popup-success-bg,
      --popup-success-border
    );
  }

  &--error {
    @include state-variant(
      --popup-danger-text,
      --popup-danger-bg,
      --popup-danger-border
    );
  }
}

@keyframes savePulse {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.92);
  }
}

@media (max-width: 300px) {
  .settings-summary {
    grid-template-columns: 1fr;
    min-width: 76px;
  }

  .summary-chip {
    min-height: 38px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .panel-heading {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .panel-status {
    grid-column: 2;
    justify-self: flex-start;
    max-width: 100%;
  }

  .domain-row,
  .script-field {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .switch-row :deep(.dropdown-select) {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
