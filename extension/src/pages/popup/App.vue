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

      <nav class="tab-navigation" aria-label="Popup navigation" role="tablist">
        <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" role="tab"
          type="button" :aria-selected="activeTab === tab.key" :aria-controls="`popup-panel-${tab.key}`"
          :title="tab.label" @click="activeTab = tab.key">
          <span class="tab-icon">
            <component :is="tab.icon" />
          </span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>

      <main class="popup-content">
        <Transition name="tab-fade" mode="out-in">
          <KeepAlive>
            <component :is="activeTabPage" :key="activeTab" />
          </KeepAlive>
        </Transition>
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
import TOTPTokenPage from './views/TOTPTokenPage.vue';
import { IconSetting, IconCapture, IconBookmark, IconTime } from '@icons/index';
import { useDomainState } from './composables/useDomainState.js';
import { usePopupTheme } from './composables/usePopupTheme.js';
import { usePopupMouseTrail } from './composables/usePopupMouseTrail.js';

const { isDomainDisabled, checkDomainStatus } = useDomainState();
const { loadPopupTheme } = usePopupTheme();
const { loadPopupMouseTrail } = usePopupMouseTrail();

const popupTitle = computed(() => chrome.i18n.getMessage('popupTitle'));

const tabs = [
  {
    key: 'bookmarks',
    label: '锚点',
    hint: '管理片段书签，快速回到对应页面。',
    icon: IconBookmark,
    tabPage: BookmarkPage,
  },
  {
    key: 'capture',
    label: '捕获',
    hint: '从当前页面拾取组件，结果同步到开发者工具。',
    icon: IconCapture,
    tabPage: CapturePage,
  },
  {
    key: 'tokens',
    label: '令牌',
    hint: '查看后端生成的动态验证码。',
    icon: IconTime,
    tabPage: TOTPTokenPage,
  },
  // {
  //   key: 'accessibility',
  //   label: '理解',
  //   hint: '查看当前页面的可访问性树，辅助理解页面结构。',
  //   icon: IconDocument,
  //   tabPage: AccessibilityTreePage,
  // },
  {
    key: 'settings',
    label: '设置',
    hint: '管理内容脚本与插件默认打开方式。',
    icon: IconSetting,
    tabPage: SettingPage,
  },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const activeTab = ref<TabKey>(tabs[0].key);

const activeTabPage = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.tabPage);

const activeTabHint = computed(() => {
  return tabs.find((tab) => tab.key === activeTab.value)?.hint ?? tabs[0].hint;
});

onMounted(async () => {
  await loadPopupTheme();
  await loadPopupMouseTrail();
  checkDomainStatus();
});
</script>

<style scoped lang="scss">
.popup-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--popup-page-background);
}

.popup-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(0);
  pointer-events: none;
  opacity: 0.45;


  &--left {
    top: -68px;
    left: -80px;
    width: 180px;
    height: 180px;
    background: var(--popup-orb-left);
  }

  &--right {
    right: -90px;
    bottom: 110px;
    width: 220px;
    height: 220px;
    background: var(--popup-orb-right);
  }
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
  padding: 10px 14px 8px;
  background: var(--popup-header-bg);
  border-bottom: 1px solid var(--popup-border);


  &::after {
    content: '';
    position: absolute;
    inset: auto 16px 0;
    height: 1px;
    background: var(--popup-divider-gradient);
  }
}

.header-version {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 5vh;
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

@font-face {
  font-family: 'EagleLake';
  src: url('/static/fonts/EagleLake-Regular.ttf') format('truetype');
  font-weight: 400;
}

.logo {
  margin: 0;
  font-family: 'EagleLake', sans-serif;
  font-size: 20px;
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
  min-height: 5vh;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  backdrop-filter: blur(12px);

  &--on {
    color: var(--popup-success-text);
    background: var(--popup-success-bg);
    border-color: var(--popup-success-border);

    .status-dot {
      background: var(--popup-success-dot);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--popup-success-dot) 18%, transparent);
    }
  }

  &--off {
    color: var(--popup-danger-text);
    background: var(--popup-danger-bg);
    border-color: var(--popup-danger-border);

    .status-dot {
      background: var(--popup-danger-dot);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--popup-danger-dot) 18%, transparent);
    }
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2.4s ease-in-out infinite;
}

.tab-navigation {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 12px 0;
  padding: 4px;
  border: 1px solid var(--popup-border);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--popup-control-bg-strong) 84%, transparent), var(--popup-tab-bg));
  box-shadow: var(--popup-inset-highlight);
}

.tab-btn {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  background-color: transparent;
  color: var(--popup-text-muted);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--popup-border);
    color: var(--popup-text-primary);
    background: var(--popup-tab-hover-bg);
  }

  &:focus-visible {
    outline: 2px solid var(--popup-accent-strong);
    outline-offset: 2px;
  }

  &.active {
    border: 1px solid var(--popup-border-strong);
    color: var(--popup-text-primary);
    background: var(--popup-tab-active-bg);
    box-shadow:
      var(--popup-shadow-soft),
      var(--popup-inset-highlight);

    .tab-icon {
      color: var(--popup-text-primary);
      background: var(--popup-accent-gradient);
      box-shadow: var(--popup-inset-highlight);
    }

    .tab-label {
      color: var(--popup-text-primary);
    }
  }
}

.tab-icon {
  flex: 0 0 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 8px;
  color: var(--popup-text-subtle);
  background: transparent;

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}

.tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  color: var(--popup-text-muted);
}

.popup-content {
  flex: 1;
  padding: 12px 12px 0 14px;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
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

@media (prefers-reduced-motion: reduce) {
  .status-dot {
    animation: none;
  }

  .tab-btn {
    transition: none;
  }
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
