<template>
  <TableContainer>
    <template #head__left>
      <p class="section-kicker">Visual Inspector</p>
      <h2 class="section-title">组件捕获</h2>
      <p class="section-subtitle">
        从当前页面拾取任意组件，结构信息会同步显示到开发者工具。
      </p>
    </template>
    <template #head__right>
      <div class="capture-status" :class="captureStatusClass">
        <span class="status-dot"></span>
        <span>{{ captureStatusText }}</span>
      </div>
    </template>
    <template #default>
      <button
        class="capture-btn"
        :disabled="isCaptureDisabled"
        @click="triggerComponentCapture"
      >
        <span class="capture-icon">
          <IconCapture />
        </span>
        <span class="capture-copy">
          <strong>开始捕获</strong>
          <small>点击后 popup 会自动关闭，随后在页面中点选目标组件。</small>
        </span>
      </button>

      <div class="capture-steps">
        <div class="step-card">
          <span class="step-index">01</span>
          <p>停留在需要分析的页面。</p>
        </div>
        <div class="step-card">
          <span class="step-index">02</span>
          <p>点击上方按钮进入捕获状态。</p>
        </div>
        <div class="step-card">
          <span class="step-index">03</span>
          <p>在页面中选择目标组件查看结果。</p>
        </div>
      </div>
    </template>
  </TableContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { ExtMessage } from "@/types";
import { useDomainState } from "../composables/useDomainState";
import TableContainer from "./TableContainer.vue";
import { IconCapture } from "@icons/index";

const { isDomainDisabled, checkDomainStatus } = useDomainState();
const isCheckingSiteReadiness = ref(false);
const isContentScriptReady = ref<boolean | null>(null);

const captureStatusText = computed(() => {
  if (isDomainDisabled.value) {
    return "已禁止";
  }

  if (isCheckingSiteReadiness.value) {
    return "连接中";
  }

  if (isContentScriptReady.value) {
    return "已就绪";
  }

  return "未就绪";
});

const captureStatusClass = computed(() => {
  if (isDomainDisabled.value) {
    return "capture-status--off";
  }

  if (isCheckingSiteReadiness.value) {
    return "capture-status--pending";
  }

  return isContentScriptReady.value
    ? "capture-status--on"
    : "capture-status--off";
});

const isCaptureDisabled = computed(() => {
  return (
    isDomainDisabled.value ||
    isCheckingSiteReadiness.value ||
    isContentScriptReady.value !== true
  );
});

const sendMessageToActiveContentScript = async (
  message: ExtMessage,
): Promise<any> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  maLogger.log("当前活动标签页:", tab);

  if (!tab?.id) {
    throw new Error("未找到当前活动标签页");
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tab.id!,
      { ...message, target: "content" },
      (response: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      },
    );
  });
};

const checkContentScriptReady = async (): Promise<void> => {
  try {
    const response = await sendMessageToActiveContentScript({
      type: "POPUP_CAPTURE_HANDSHAKE",
    });
    isContentScriptReady.value = response?.success === true;
  } catch (error) {
    maLogger.log("当前站点内容脚本未就绪:", error);
    isContentScriptReady.value = false;
  }
};

const refreshCaptureStatus = async (): Promise<void> => {
  isCheckingSiteReadiness.value = true;
  isContentScriptReady.value = null;

  try {
    await Promise.allSettled([checkDomainStatus(), checkContentScriptReady()]);
  } finally {
    isCheckingSiteReadiness.value = false;
  }
};

const triggerComponentCapture = async (): Promise<void> => {
  if (isCaptureDisabled.value) {
    return;
  }

  try {
    maLogger.log("从popup触发组件捕获...");
    const res = await sendMessageToActiveContentScript({
      type: "TRIGGER_COMPONENT_CAPTURE",
    });
    maLogger.log("组件捕获响应:", res);
    window.close();
  } catch (error) {
    maLogger.error("触发组件捕获失败:", error);
  }
};

onMounted(() => {
  refreshCaptureStatus();
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

.capture-status {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
  min-width: 58px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--popup-text-primary);
  background: var(--popup-accent-gradient);
  border: 1px solid var(--popup-button-border);

  &--on {
    color: var(--popup-success-text);
    background: var(--popup-success-bg);
    border-color: var(--popup-success-border);

    .status-dot {
      background: var(--popup-success-dot);
      box-shadow: 0 0 0 5px
        color-mix(in srgb, var(--popup-success-dot) 16%, transparent);
    }
  }

  &--pending {
    color: var(--popup-info-text);
    background: var(--popup-info-bg);
    border-color: var(--popup-info-border);

    .status-dot {
      background: var(--popup-info-dot);
      box-shadow: 0 0 0 5px
        color-mix(in srgb, var(--popup-info-dot) 16%, transparent);
    }
  }

  &--off {
    color: var(--popup-danger-text);
    background: var(--popup-danger-bg);
    border-color: var(--popup-danger-border);

    .status-dot {
      background: var(--popup-danger-dot);
      box-shadow: 0 0 0 5px
        color-mix(in srgb, var(--popup-danger-dot) 16%, transparent);
    }
  }
}

.status-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.capture-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 74px;
  padding: 10px 12px;
  border: 1px solid var(--popup-border-strong);
  border-radius: 16px;
  background: var(--popup-button-bg);
  color: var(--popup-text-on-accent);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
  box-shadow: var(--popup-shadow-accent);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--popup-shadow-accent);
  }

  &:disabled {
    cursor: not-allowed;
    filter: saturate(0.6);
    opacity: 0.6;
    box-shadow: none;
  }
}

.capture-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: color-mix(in srgb, var(--popup-text-on-accent) 16%, transparent);
  box-shadow: var(--popup-inset-highlight);

  :deep(svg) {
    width: 18px;
    height: 18px;
  }
}

.capture-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.15;
  }

  small {
    font-size: 11px;
    line-height: 1.35;
    color: color-mix(in srgb, var(--popup-text-on-accent) 88%, transparent);
  }
}

.capture-steps {
  display: grid;
  gap: 8px;
}

.step-card {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 7px 9px;
  border-radius: 13px;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg);
}

.step-index {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 11px;
  background: var(--popup-accent-gradient);
  font-size: 11px;
  font-weight: 700;
  color: var(--popup-accent);
}

.step-card p {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--popup-text-muted);
}
</style>
