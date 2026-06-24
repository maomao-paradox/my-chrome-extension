<template>
  <div class="popup-shell">
    <div class="popup-orb popup-orb--left"></div>
    <div class="popup-orb popup-orb--right"></div>

    <div class="popup-container">
      <header class="popup-header">
        <div class="header-main">
          <div class="header-brand">
            <h1 class="logo">{{ popupTitle }}</h1>
          </div>

          <div class="header-meta">
            <div class="status-chip" :class="isDomainDisabled ? 'status-chip--off' : 'status-chip--on'">
              <span class="status-dot"></span>
              <span>{{ isDomainDisabled ? '停用' : '可用' }}</span>
            </div>
            <span class="header-version">v1.0.0</span>
          </div>
        </div>
      </header>

      <nav class="tab-navigation" aria-label="Popup navigation">
        <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key">
          <span class="tab-icon">
            <component :is="tab.icon" />
          </span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>

      <main class="popup-content">
        <div v-show="activeTab === 'bookmarks'" class="tab-content">
          <BookmarkPage />
        </div>

        <div v-show="activeTab === 'capture'" class="tab-content">
          <CapturePage :is-active="activeTab === 'capture'" />
        </div>

        <div v-show="activeTab === 'accessibility'" class="tab-content">
          <AccessibilityTreePage />
        </div>

        <div v-show="activeTab === 'settings'" class="tab-content">
          <SettingPage />
        </div>
      </main>

      <footer class="popup-footer">
        <span class="footer-signal"></span>
        <span>{{ activeTabHint }}</span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import BookmarkPage from './views/BookmarkPage.vue';
import SettingPage from './views/SettingPage.vue';
import CapturePage from './views/CapturePage.vue';
import { IconSetting, IconCapture, IconBookmark, IconDocument } from '@icons/index';
import { useDomainState } from './composables/useDomainState';
import { usePopupTheme } from './composables/usePopupTheme';
import { usePopupMouseTrail } from './composables/usePopupMouseTrail';
import AccessibilityTreePage from './views/AccessibilityTree.vue';

const { isDomainDisabled, checkDomainStatus } = useDomainState();
const { loadPopupTheme } = usePopupTheme();
const { loadPopupMouseTrail } = usePopupMouseTrail();

const popupTitle = computed(() => chrome.i18n.getMessage('popupTitle'));

const tabs = [
  {
    key: 'bookmarks',
    label: '书签',
    hint: '管理片段书签，快速回到对应页面。',
    icon: IconBookmark,
  },
  {
    key: 'capture',
    label: '捕获',
    hint: '从当前页面拾取组件，结果同步到开发者工具。',
    icon: IconCapture,
  },
  {
    key: 'accessibility',
    label: '理解',
    hint: '从当前页面拾取组件，结果同步到开发者工具。',
    icon: IconDocument,
  },
  {
    key: 'settings',
    label: '设置',
    hint: '管理内容脚本与插件默认打开方式。',
    icon: IconSetting,
  },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const activeTab = ref<TabKey>('bookmarks');

const activeTabHint = computed(() => {
  return tabs.find((tab) => tab.key === activeTab.value)?.hint ?? tabs[0].hint;
});

onMounted(async () => {
  await loadPopupTheme();
  await loadPopupMouseTrail();
  checkDomainStatus();
});
</script>

<style scoped>
.popup-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--popup-page-background);
}

.popup-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(0);
  pointer-events: none;
  opacity: 0.45;
}

.popup-orb--left {
  top: -68px;
  left: -80px;
  width: 180px;
  height: 180px;
  background: var(--popup-orb-left);
}

.popup-orb--right {
  right: -90px;
  bottom: 110px;
  width: 220px;
  height: 220px;
  background: var(--popup-orb-right);
}

.popup-container {
  position: relative;
  width: 100%;
  height: 100%;
  max-height: var(--popup-max-height);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popup-header {
  position: relative;
  padding: 12px 16px 10px;
  background: var(--popup-header-bg);
  border-bottom: 1px solid var(--popup-border);
}

.popup-header::after {
  content: '';
  position: absolute;
  inset: auto 16px 0;
  height: 1px;
  background: var(--popup-divider-gradient);
}

.header-version {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg);
  color: var(--popup-text-muted);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-brand {
  min-width: 0;
}

.logo {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.1;
  color: var(--popup-text-primary);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  backdrop-filter: blur(12px);
}

.status-chip--on {
  color: var(--popup-success-text);
  background: var(--popup-success-bg);
  border-color: var(--popup-success-border);
}

.status-chip--off {
  color: var(--popup-danger-text);
  background: var(--popup-danger-bg);
  border-color: var(--popup-danger-border);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2.4s ease-in-out infinite;
}

.status-chip--on .status-dot {
  background: var(--popup-success-dot);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--popup-success-dot) 18%, transparent);
}

.status-chip--off .status-dot {
  background: var(--popup-danger-dot);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--popup-danger-dot) 18%, transparent);
}

.tab-navigation {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 16px 0;
}

.tab-btn {
  width: max-content;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  /* padding: 8px 10px; */
  border: 1px solid var(--popup-border);
  border-radius: 16px;
  background: var(--popup-tab-bg);
  color: var(--popup-text-muted);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.tab-btn:hover {
  transform: translateY(-1px);
  color: var(--popup-text-primary);
  border-color: var(--popup-border-strong);
  background: var(--popup-tab-hover-bg);
}

.tab-btn.active {
  color: var(--popup-text-primary);
  border-color: var(--popup-border-strong);
  background: var(--popup-tab-active-bg);
  box-shadow:
    var(--popup-shadow-soft),
    var(--popup-inset-highlight);
}

.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--popup-control-bg);
}

.tab-btn.active .tab-icon {
  background: var(--popup-accent-gradient);
  box-shadow: var(--popup-inset-highlight);
}

.tab-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
}

.popup-content {
  flex: 1;
  min-height: 0;
  padding: 12px 10px 0 14px;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding-right: 2px;
}

.popup-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 20px;
  font-size: 12px;
  color: var(--popup-text-subtle);
  border-top: 1px solid var(--popup-border-muted);
  background: var(--popup-footer-bg);
}

.footer-signal {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--popup-accent-line-gradient);
  box-shadow: 0 0 12px color-mix(in srgb, var(--popup-accent-strong) 45%, transparent);
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}
</style>
