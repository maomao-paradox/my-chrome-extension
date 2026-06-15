<template>
  <div class="error-monitor-config-container">
    <div class="config-grid">
      <el-card class="config-card config-card--base">
        <template #header>
          <div class="card-header">
            <span>基础配置</span>
            <el-tag v-if="store.isEnabled" type="success">已启用</el-tag>
            <el-tag v-else type="info">已禁用</el-tag>
          </div>
        </template>

        <el-form :model="store.config" label-width="150px" :rules="formRules" ref="formRef" class="monitor-config-form">
          <!-- 监控开关 -->
          <el-form-item label="启用异常监控">
            <el-switch v-model="store.config.enabled" @change="handleEnabledChange" />
            <div class="form-item-hint">开启后将自动捕获页面异常</div>
          </el-form-item>

          <!-- Webhook 地址 -->
          <el-form-item label="Webhook 地址" prop="webhookUrl">
            <el-input v-model="store.config.webhookUrl"
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." :disabled="!store.config.enabled"
              @change="validateAndSave" />
            <div class="form-item-hint">填写钉钉机器人的 Webhook 地址</div>
          </el-form-item>

          <el-form-item label="机器人关键词">
            <el-input v-model="store.config.dingTalkKeyword" placeholder="可选，例如：监控告警" :disabled="!store.config.enabled"
              @change="validateAndSave" />
            <div class="form-item-hint">如果钉钉机器人开启了关键词安全校验，这里填写对应关键词</div>
          </el-form-item>

          <!-- 钉钉 Token -->
          <el-form-item label="额外 Token">
            <el-input v-model="store.config.dingTalkToken" placeholder="仅在你的转发服务需要额外鉴权时填写"
              :disabled="!store.config.enabled" show-password @change="validateAndSave" />
            <div class="form-item-hint">直接使用钉钉机器人 Webhook 时通常不需要填写</div>
          </el-form-item>

          <!-- 截图开关 -->
          <el-form-item label="启用截图">
            <el-switch v-model="store.config.screenshotEnabled" :disabled="!store.config.enabled"
              @change="validateAndSave" />
            <div class="form-item-hint">异常发生时自动截取页面屏幕</div>
          </el-form-item>

          <!-- 最大截图大小 -->
          <el-form-item label="最大截图大小 (MB)">
            <el-slider v-model="store.config.maxScreenshotSize" :min="0.1" :max="5" :step="0.1"
              :disabled="!store.config.enabled || !store.config.screenshotEnabled" show-input
              @change="validateAndSave" />
            <div class="form-item-hint">超过此大小的截图将不会被发送</div>
          </el-form-item>

          <!-- 节流间隔 -->
          <el-form-item label="节流间隔 (秒)">
            <el-slider v-model="store.config.throttleInterval" :min="5" :max="300" :step="5"
              :disabled="!store.config.enabled" show-input @change="validateAndSave" />
            <div class="form-item-hint">同一页面在间隔时间内产生的多个异常将被合并</div>
          </el-form-item>

          <!-- Console.error 捕获 -->
          <el-form-item label="捕获error日志">
            <el-switch v-model="store.config.captureConsoleError" :disabled="!store.config.enabled"
              @change="validateAndSave" />
            <div class="form-item-hint">是否捕获 maLogger.error 调用</div>
          </el-form-item>
        </el-form>
        <div class="action-buttons">
          <el-button @click="resetConfig">
            <el-icon>
              <RefreshLeft />
            </el-icon>
            重置为默认
          </el-button>
          <el-button type="info" @click="testConnection">
            <el-icon>
              <Connection />
            </el-icon>
            发送测试消息
          </el-button>
        </div>
      </el-card>

      <div class="config-stack">
        <!-- 域名白名单 -->
        <el-card class="config-card domain-card" :class="{ 'is-collapsed': activeDomainPanel !== 'whitelist' }"
          @click="openDomainPanel('whitelist')">
          <template #header>
            <div class="card-header card-header--interactive" :aria-expanded="activeDomainPanel === 'whitelist'">
              <span>域名白名单</span>
              <span class="domain-card__meta">
                <el-tag type="info">{{ store.config.domainWhitelist.length }} 个</el-tag>
                <el-icon class="domain-card__arrow" :class="{ 'is-open': activeDomainPanel === 'whitelist' }">
                  <ArrowDown />
                </el-icon>
              </span>
            </div>
          </template>

          <div class="domain-card__body-shell" :class="{ 'is-open': activeDomainPanel === 'whitelist' }"
            :inert="activeDomainPanel !== 'whitelist'" :aria-hidden="activeDomainPanel !== 'whitelist'">
            <div class="domain-card__content">
              <div class="domain-input-row">
                <el-input v-model="newWhitelistDomain" placeholder="输入域名，如：example.com 或 *.example.com"
                  :disabled="!store.config.enabled" @keyup.enter="addWhitelistDomain" />
                <el-button type="primary" :disabled="!store.config.enabled || !newWhitelistDomain"
                  @click="addWhitelistDomain">
                  添加
                </el-button>
              </div>

              <div class="domain-list" v-if="store.config.domainWhitelist.length > 0">
                <el-tag v-for="domain in store.config.domainWhitelist" :key="domain" closable
                  @close="store.removeFromWhitelist(domain)" class="domain-tag">
                  {{ domain }}
                </el-tag>
              </div>

              <el-empty v-else description="暂无白名单域名，空列表表示允许所有域名，添加域名后将只允许监控列表中的域名" />
            </div>
          </div>
        </el-card>

        <!-- 域名黑名单 -->
        <el-card class="config-card domain-card" :class="{ 'is-collapsed': activeDomainPanel !== 'blacklist' }"
          @click="openDomainPanel('blacklist')">
          <template #header>
            <div class="card-header card-header--interactive" :aria-expanded="activeDomainPanel === 'blacklist'">
              <span>域名黑名单</span>
              <span class="domain-card__meta">
                <el-tag type="danger">{{ store.config.domainBlacklist.length }} 个</el-tag>
                <el-icon class="domain-card__arrow" :class="{ 'is-open': activeDomainPanel === 'blacklist' }">
                  <ArrowDown />
                </el-icon>
              </span>
            </div>
          </template>

          <div class="domain-card__body-shell" :class="{ 'is-open': activeDomainPanel === 'blacklist' }"
            :inert="activeDomainPanel !== 'blacklist'" :aria-hidden="activeDomainPanel !== 'blacklist'">
            <div class="domain-card__content">

              <div class="domain-input-row">
                <el-input v-model="newBlacklistDomain" placeholder="输入域名，如：example.com 或 *.example.com"
                  :disabled="!store.config.enabled" @keyup.enter="addBlacklistDomain" />
                <el-button type="primary" :disabled="!store.config.enabled || !newBlacklistDomain"
                  @click="addBlacklistDomain">
                  添加
                </el-button>
              </div>

              <div class="domain-list" v-if="store.config.domainBlacklist.length > 0">
                <el-tag v-for="domain in store.config.domainBlacklist" :key="domain" closable type="danger"
                  @close="store.removeFromBlacklist(domain)" class="domain-tag">
                  {{ domain }}
                </el-tag>
              </div>

              <el-empty v-else description="暂无黑名单域名，黑名单中的域名将不会被监控" />
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox, ElCard, ElSwitch, ElTag, ElSlider, ElDialog, ElIcon, ElEmpty, ElInput, ElButton, ElRadioGroup, ElRadio, ElForm, ElFormItem, ElInputNumber, ElColorPicker, ElSelect, ElOption } from 'element-plus';
import { Check, RefreshLeft, Connection, ArrowDown } from '@element-plus/icons-vue';
import { useErrorMonitorStore } from '@/stores/error-monitor';
import messenger from '@/message';

// Store
const store = useErrorMonitorStore();

// 表单引用
const formRef = ref();

// 新域名输入
const newWhitelistDomain = ref('');
const newBlacklistDomain = ref('');
const activeDomainPanel = ref<'whitelist' | 'blacklist'>('whitelist');

// 表单验证规则
const formRules = {
  webhookUrl: [
    { required: true, message: '请输入 Webhook 地址', trigger: 'blur' },
    {
      pattern: /^https?:\/\/.+/,
      message: 'Webhook 地址格式不正确（应以 http:// 或 https:// 开头）',
      trigger: 'blur'
    }
  ]
};

// 组件挂载时加载配置
onMounted(async () => {
  await store.loadConfig();
});

// 监听验证错误，用 ElMessage 提示
watch(
  () => store.validationErrors,
  (newErrors) => {
    if (newErrors && newErrors.length > 0) {
      newErrors.forEach((error: string) => {
        ElMessage.error(error);
      });
    }
  }
);

function openDomainPanel(panel: 'whitelist' | 'blacklist') {
  activeDomainPanel.value = panel;
}

// 处理启用状态变化
function handleEnabledChange() {
  validateAndSave();
}

// 验证并保存
async function validateAndSave() {
  store.validateConfig();
  if (store.isValid) {
    await saveConfig();
  }
}

// 保存配置
async function saveConfig() {
  if (!chrome.storage) {
    ElMessage.warning('当前为开发环境，不支持存储配置');
    return;
  }
  const success = await store.saveConfig();
  if (success) {
    ElMessage.success('配置已保存');
  } else {
    ElMessage.error('配置保存失败，请检查配置项');
  }
}

// 重置配置
async function resetConfig() {
  try {
    await ElMessageBox.confirm('确定要重置为默认配置吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    store.resetConfig();
    await saveConfig();
    ElMessage.success('已重置为默认配置');
  } catch (error: any) {
    if (error !== 'cancel') {
      maLogger.error('重置配置失败:', error);
      ElMessage.error('重置配置失败');
    }
  }
}

// 添加白名单域名
function addWhitelistDomain() {
  const domain = newWhitelistDomain.value.trim();
  if (!domain) return;

  store.addToWhitelist(domain);
  newWhitelistDomain.value = '';
  saveConfig();
}

// 添加黑名单域名
function addBlacklistDomain() {
  const domain = newBlacklistDomain.value.trim();
  if (!domain) return;

  store.addToBlacklist(domain);
  newBlacklistDomain.value = '';
  saveConfig();
}

// 测试钉钉 Webhook
async function testConnection() {
  if (!store.config.webhookUrl) {
    ElMessage.warning('请先配置 Webhook 地址');
    return;
  }

  try {
    const messageLines = [
      `【${store.config.dingTalkKeyword?.trim()}】`,
      '【MACEX 星舰】异常监控 Webhook 测试消息',
      `时间：${new Date().toLocaleString()}`
    ].filter((line): line is string => !!line);

    await ElMessageBox.confirm(
      '这会向当前钉钉机器人发送一条测试消息，是否继续？',
      '测试 Webhook',
      {
        confirmButtonText: '发送',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      ElMessage.warning('由于CORS策略，当前环境无法进行测试，请转到生产环境进行测试');
      return;
    }

    const response = await messenger.ext.send({
      type: 'TEST_DINGTALK_WEBHOOK',
      target: 'background',
      source: 'options',
      payload: {
        webhookUrl: store.config.webhookUrl,
        content: messageLines.join('\n')
      }
    });

    if (!response?.success) {
      throw new Error(typeof response?.error === 'string' ? response.error : '后台发送测试消息失败');
    }

    ElMessage.success('测试消息发送成功');
  } catch (error: any) {
    if (error === 'cancel') {
      return;
    }

    ElMessage.warning('Webhook 测试失败：' + error.message);
  }
}
</script>

<style scoped>
.error-monitor-config-container {
  box-sizing: border-box;
  overflow-y: auto;
  scrollbar-gutter: stable;
  color: rgba(210, 233, 246, 0.88);
}

.error-monitor-config-container h2 {
  color: var(--text-primary);
  font-size: 20px;
  margin: 0 0 24px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(320px, 0.92fr);
  gap: 20px;
  align-items: start;
}

.config-stack {
  display: grid;
  gap: 20px;
  align-content: start;
  min-width: 0;
}

.config-card {
  border: 1px solid rgba(86, 170, 235, 0.18);
  border-radius: 16px !important;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(7, 16, 29, 0.94), rgba(4, 10, 18, 0.9)),
    radial-gradient(circle at top right, rgba(60, 146, 255, 0.08), transparent 42%);
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.24),
    0 0 22px rgba(68, 165, 255, 0.05),
    inset 0 1px 0 rgba(183, 231, 255, 0.05);
  min-width: 0;
}

.config-card--base {
  min-width: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #effaff;
  font-size: 16px;
  font-weight: 600;
}

.card-header--interactive {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 16px 18px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.card-header--interactive:focus-visible {
  outline: 1px solid rgba(122, 247, 208, 0.4);
  outline-offset: 6px;
  border-radius: 8px;
}

.card-header--interactive:hover .domain-card__arrow {
  color: #dff7ff;
}

.domain-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.domain-card__arrow {
  color: rgba(163, 212, 239, 0.72);
  font-size: 16px;
  transition: transform 0.22s ease, color 0.22s ease;
}

.domain-card__arrow.is-open {
  color: #7af7d0;
  transform: rotate(180deg);
}

.domain-card__body-shell {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-10px) scaleY(0.985);
  transform-origin: top center;
  filter: blur(6px);
  transition:
    grid-template-rows 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease,
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.32s ease;
}

.domain-card__body-shell.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0) scaleY(1);
  filter: blur(0);
}

.domain-card__content {
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: min(56vh, 720px);
  scrollbar-gutter: stable;
}

.form-item-hint {
  margin-top: 5px;
  font-size: 12px;
  color: rgba(170, 207, 228, 0.68);
  line-height: 1.4;
}

.domain-list-hint {
  margin-bottom: 15px;
  font-size: 13px;
  color: rgba(189, 221, 240, 0.78);
  background: rgba(5, 14, 24, 0.72);
  border: 1px solid rgba(96, 181, 239, 0.14);
  padding: 12px 14px;
  border-radius: 10px;
  line-height: 1.6;
}

.domain-input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.domain-input-row .el-input {
  flex: 1;
}

.domain-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.domain-tag {
  margin-right: 0;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  /* gap: 10px; */
  flex-wrap: wrap;
  position: sticky;
  bottom: 0;
  z-index: 3;
  /* padding: 16px 0 4px; */
  /* background: linear-gradient(180deg, rgba(22, 27, 34, 0) 0%, rgba(22, 27, 34, 0.88) 24%, rgba(22, 27, 34, 0.96) 100%); */
  /* backdrop-filter: blur(6px); */
}

:deep(.config-card.el-card) {
  --el-card-bg-color: transparent;
  --el-card-border-color: transparent;
  color: inherit;
}

:deep(.config-card .el-card__header) {
  padding: 16px 18px;
  border-bottom: 1px solid rgba(86, 170, 235, 0.14);
  background: linear-gradient(180deg, rgba(10, 22, 38, 0.92), rgba(8, 17, 29, 0.88));
}

:deep(.config-card .el-card__body) {
  padding: 18px;
  background: transparent;
}

:deep(.domain-card.el-card .el-card__header) {
  padding: 0;
}

:deep(.domain-card.el-card .el-card__body) {
  overflow: hidden;
  transition: padding 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

:deep(.domain-card.is-collapsed.el-card .el-card__body) {
  padding-top: 0;
  padding-bottom: 0;
}

:deep(.monitor-config-form .el-form-item) {
  margin-bottom: 20px;
}

:deep(.monitor-config-form .el-form-item__label) {
  color: rgba(141, 204, 239, 0.78) !important;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.06em;
}

:deep(.monitor-config-form .el-input__wrapper),
:deep(.monitor-config-form .el-input-number .el-input__wrapper),
:deep(.monitor-config-form .el-textarea__inner) {
  background: rgba(6, 16, 30, 0.84) !important;
  box-shadow: inset 0 0 0 1px rgba(96, 181, 239, 0.16) !important;
  border: 0 !important;
}

:deep(.monitor-config-form .el-input__wrapper.is-focus),
:deep(.monitor-config-form .el-input-number .el-input__wrapper.is-focus) {
  box-shadow:
    inset 0 0 0 1px rgba(122, 247, 208, 0.28),
    0 0 0 4px rgba(72, 148, 255, 0.08) !important;
}

:deep(.monitor-config-form .el-input__inner),
:deep(.monitor-config-form .el-textarea__inner),
:deep(.monitor-config-form .el-input-number__input) {
  color: #effaff !important;
}

:deep(.monitor-config-form .el-input__inner::placeholder),
:deep(.monitor-config-form .el-textarea__inner::placeholder) {
  color: rgba(137, 195, 233, 0.44) !important;
}

:deep(.monitor-config-form .el-switch) {
  --el-switch-on-color: #5dafff;
  --el-switch-off-color: rgba(59, 88, 116, 0.92);
}

:deep(.monitor-config-form .el-slider__runway) {
  background: rgba(19, 42, 67, 0.72);
}

:deep(.monitor-config-form .el-slider__bar) {
  background: linear-gradient(90deg, rgba(83, 173, 255, 0.88), rgba(102, 245, 212, 0.82));
}

:deep(.monitor-config-form .el-slider__button) {
  border-color: rgba(130, 225, 255, 0.78);
  background: #dff7ff;
  box-shadow: 0 0 16px rgba(102, 245, 212, 0.18);
}

:deep(.monitor-config-form .el-input-number),
:deep(.monitor-config-form .el-slider__input) {
  max-width: 100%;
}

:deep(.monitor-config-form .el-input-number__decrease),
:deep(.monitor-config-form .el-input-number__increase) {
  background: rgba(8, 17, 31, 0.88) !important;
  color: rgba(191, 223, 241, 0.72) !important;
  border-color: rgba(96, 181, 239, 0.12) !important;
}

:deep(.action-buttons .el-button) {
  border-radius: 12px;
  border-color: rgba(96, 181, 239, 0.2);
  background: rgba(6, 16, 30, 0.8);
  color: #eaf8ff;
  backdrop-filter: blur(8px);
}

:deep(.action-buttons .el-button:hover) {
  border-color: rgba(122, 247, 208, 0.28);
  color: #f6feff;
  transform: translateY(-1px);
}

:deep(.action-buttons .el-button--primary) {
  background: linear-gradient(135deg, rgba(53, 126, 255, 0.92), rgba(47, 183, 214, 0.88));
  border-color: rgba(106, 203, 255, 0.38);
}

:deep(.el-tag) {
  border-color: rgba(96, 181, 239, 0.16);
  background: rgba(7, 17, 30, 0.72);
  color: rgba(214, 236, 248, 0.88);
}

:deep(.el-tag.el-tag--danger) {
  border-color: rgba(255, 138, 138, 0.18);
  background: rgba(50, 13, 20, 0.58);
}

:deep(.el-empty) {
  --el-empty-description-color: rgba(161, 203, 226, 0.64);
}

:deep(.el-empty__image svg) {
  opacity: 0.6;
}

@media (max-width: 1100px) {
  .error-monitor-config-container {
    max-width: 100%;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .error-monitor-config-container {
    padding: 12px 12px 24px;
  }

  :deep(.monitor-config-form .el-form-item__label) {
    letter-spacing: 0.03em;
  }

  .domain-input-row {
    flex-direction: column;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-buttons .el-button {
    width: 100%;
  }
}
</style>
