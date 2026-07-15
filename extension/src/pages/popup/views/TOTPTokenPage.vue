<template>
  <TableContainer density="compact" section-gap="10px" content-gap="10px" right-max-width="42%">
    <template #head__left>
      <p class="section-kicker">Authenticator</p>
      <h2 class="section-title">动态令牌</h2>
    </template>
    <template #head__right>
      <button class="icon-btn" type="button" title="刷新" :disabled="isLoading" @click="refreshAll">
        <IconTime />
      </button>
    </template>

    <template #default>
      <form class="token-form" @submit.prevent="submitAccount">
        <label class="field field--wide">
          <span>otpauth 链接</span>
          <textarea v-model.trim="form.otpauthUrl" rows="2" placeholder="otpauth://totp/..." />
        </label>
        <input ref="qrInputRef" class="qr-input" type="file" accept="image/*" @change="handleQRUpload" />

        <div class="form-grid">
          <label class="field">
            <span>账户</span>
            <input v-model.trim="form.accountName" type="text" autocomplete="off" placeholder="name@example.com" />
          </label>
          <label class="field">
            <span>发行方</span>
            <input v-model.trim="form.issuer" type="text" autocomplete="off" placeholder="GitHub" />
          </label>
        </div>

        <label class="field">
          <span>Secret</span>
          <input v-model.trim="form.secret" type="password" autocomplete="off" placeholder="Base32 secret" />
        </label>

        <div class="form-actions">
          <button class="secondary-btn" type="button" :disabled="isScanningQR" @click="openQRPicker">
            {{ isScanningQR ? '解析中' : '上传二维码' }}
          </button>
          <span class="form-spacer"></span>
          <button class="secondary-btn" type="button" :disabled="isLoading" @click="resetForm">清空</button>
          <button class="primary-btn" type="submit" :disabled="isSubmitDisabled">
            {{ isSubmitting ? '保存中' : '保存令牌' }}
          </button>
        </div>
      </form>

      <div v-if="errorMessage" class="notice notice--error">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="notice notice--success">
        {{ successMessage }}
      </div>

      <div v-if="isLoading && accounts.length === 0" class="empty-state">加载中</div>
      <div v-else-if="accounts.length === 0" class="empty-state">暂无令牌</div>

      <div v-else class="token-list">
        <article v-for="account in accounts" :key="account.id" class="token-card">
          <div class="token-card__main">
            <div class="token-meta">
              <strong>{{ displayIssuer(account) }}</strong>
              <span>{{ account.accountName }}</span>
            </div>
            <div class="token-code" :class="{ 'token-code--empty': !codes[account.id]?.code }">
              {{ codes[account.id]?.code || '------' }}
            </div>
          </div>

          <div class="token-card__bottom">
            <div class="timer">
              <span class="timer-track">
                <span class="timer-fill" :style="{ width: `${progressPercent(account)}%` }"></span>
              </span>
              <span>{{ remainingText(account) }}</span>
            </div>
            <div class="token-actions">
              <button class="text-btn" type="button" :disabled="!codes[account.id]?.code" @click="copyCode(account.id)">
                复制
              </button>
              <button class="text-btn text-btn--danger" type="button" @click="removeAccount(account.id)">
                删除
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>
  </TableContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import TableContainer from './TableContainer.vue';
import { IconTime } from '@icons/index';
import jsQR from 'jsqr';
import {
  createTOTPAccount,
  deleteTOTPAccount,
  getTOTPCode,
  listTOTPAccounts,
  type TOTPAccount,
  type TOTPCode,
} from '@/services/api/totp-api';

const accounts = ref<TOTPAccount[]>([]);
const codes = reactive<Record<string, TOTPCode>>({});
const isLoading = ref(false);
const isSubmitting = ref(false);
const isScanningQR = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const nowMs = ref(Date.now());
const qrInputRef = ref<HTMLInputElement | null>(null);

const form = reactive({
  issuer: '',
  accountName: '',
  secret: '',
  otpauthUrl: '',
});

let timer: number | undefined;

const isSubmitDisabled = computed(() => {
  return isSubmitting.value || (!form.otpauthUrl && (!form.accountName || !form.secret));
});

const displayIssuer = (account: TOTPAccount) => account.issuer || '未命名';

const clearStatus = () => {
  errorMessage.value = '';
  successMessage.value = '';
};

const resetForm = () => {
  form.issuer = '';
  form.accountName = '';
  form.secret = '';
  form.otpauthUrl = '';
};

const openQRPicker = () => {
  qrInputRef.value?.click();
};

const handleQRUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  clearStatus();
  isScanningQR.value = true;
  try {
    const content = await decodeQRCodeFromImage(file);
    if (!content.startsWith('otpauth://totp/')) {
      throw new Error('二维码不是 TOTP 令牌链接');
    }
    form.otpauthUrl = content;
    successMessage.value = '二维码已解析';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '二维码解析失败';
  } finally {
    isScanningQR.value = false;
  }
};

const decodeQRCodeFromImage = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('无法读取二维码图片');
    }

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    const content = result?.data?.trim();
    if (!content) {
      throw new Error('未识别到二维码内容');
    }
    return content;
  } finally {
    bitmap.close();
  }
};

const loadAccounts = async () => {
  isLoading.value = true;
  clearStatus();
  try {
    accounts.value = await listTOTPAccounts();
    await refreshCodes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载令牌失败';
  } finally {
    isLoading.value = false;
  }
};

const refreshCode = async (accountId: string) => {
  codes[accountId] = await getTOTPCode(accountId);
};

const refreshCodes = async () => {
  await Promise.all(accounts.value.map((account) => refreshCode(account.id)));
};

const refreshAll = async () => {
  clearStatus();
  try {
    await refreshCodes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '刷新动态码失败';
  }
};

const submitAccount = async () => {
  isSubmitting.value = true;
  clearStatus();
  try {
    await createTOTPAccount({
      issuer: form.issuer,
      accountName: form.accountName,
      secret: form.secret,
      otpauthUrl: form.otpauthUrl,
    });
    resetForm();
    successMessage.value = '令牌已保存';
    await loadAccounts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存令牌失败';
  } finally {
    isSubmitting.value = false;
  }
};

const removeAccount = async (accountId: string) => {
  if (!window.confirm('确认删除这个令牌？')) {
    return;
  }
  clearStatus();
  try {
    await deleteTOTPAccount(accountId);
    delete codes[accountId];
    accounts.value = accounts.value.filter((account) => account.id !== accountId);
    successMessage.value = '令牌已删除';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除令牌失败';
  }
};

const copyCode = async (accountId: string) => {
  const code = codes[accountId]?.code;
  if (!code) return;
  clearStatus();
  try {
    await navigator.clipboard.writeText(code);
    successMessage.value = '动态码已复制';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '复制失败';
  }
};

const remainingSeconds = (account: TOTPAccount) => {
  const code = codes[account.id];
  if (!code) return account.period;
  const expiresAt = new Date(code.expiresAt).getTime();
  return Math.max(0, Math.ceil((expiresAt - nowMs.value) / 1000));
};

const progressPercent = (account: TOTPAccount) => {
  const remaining = remainingSeconds(account);
  return Math.max(0, Math.min(100, (remaining / account.period) * 100));
};

const remainingText = (account: TOTPAccount) => {
  const remaining = remainingSeconds(account);
  return remaining > 0 ? `${remaining}s` : '刷新中';
};

const tick = async () => {
  nowMs.value = Date.now();
  const expiredAccounts = accounts.value.filter((account) => remainingSeconds(account) <= 0);
  if (expiredAccounts.length === 0) return;
  try {
    await Promise.all(expiredAccounts.map((account) => refreshCode(account.id)));
  } catch (error) {
    maLogger.warn('刷新 TOTP 动态码失败:', error);
  }
};

onMounted(async () => {
  await loadAccounts();
  timer = window.setInterval(tick, 1000);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<style scoped lang="scss">
.section-kicker,
.section-title {
  margin: 0;
}

.section-kicker {
  color: var(--popup-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-title {
  margin-top: 3px;
  color: var(--popup-text-primary);
}

.icon-btn,
.primary-btn,
.secondary-btn,
.text-btn {
  border: 1px solid var(--popup-border);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  &:focus-visible {
    outline: 2px solid var(--popup-accent-strong);
    outline-offset: 2px;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--popup-accent);
  background: var(--popup-control-bg);

  :deep(svg) {
    width: 16px;
    height: 16px;
  }

  &:hover:not(:disabled) {
    border-color: var(--popup-border-strong);
    background: var(--popup-control-hover-bg);
  }
}

.token-form {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--popup-border);
  border-radius: 8px;
  background: var(--popup-panel-bg);
  box-shadow: var(--popup-shadow-soft), var(--popup-inset-highlight);
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.field {
  display: grid;
  gap: 5px;
  min-width: 0;

  span {
    color: var(--popup-text-subtle);
    font-size: 11px;
    font-weight: 700;
  }

  input,
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--popup-border-muted);
    border-radius: 8px;
    padding: 8px 9px;
    background: var(--popup-control-bg);
    color: var(--popup-text-primary);
    font-size: 12px;
    line-height: 1.35;
    outline: none;
    box-sizing: border-box;

    &::placeholder {
      color: var(--popup-text-subtle);
    }

    &:focus {
      border-color: var(--popup-border-strong);
      box-shadow: 0 0 0 4px var(--popup-focus-ring);
    }
  }

  textarea {
    resize: vertical;
    min-height: 54px;
  }
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.qr-input {
  display: none;
}

.form-spacer {
  flex: 1 1 auto;
}

.primary-btn,
.secondary-btn {
  min-height: 32px;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
}

.primary-btn {
  color: var(--popup-text-on-accent);
  border-color: var(--popup-button-border);
  background: var(--popup-button-bg);
}

.secondary-btn,
.text-btn {
  color: var(--popup-text-secondary);
  background: var(--popup-control-bg);

  &:hover:not(:disabled) {
    color: var(--popup-text-primary);
    border-color: var(--popup-border-strong);
    background: var(--popup-control-hover-bg);
  }
}

.notice,
.empty-state {
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 12px;
}

.notice--error {
  color: var(--popup-danger-text);
  border: 1px solid var(--popup-danger-border);
  background: var(--popup-danger-bg);
}

.notice--success {
  color: var(--popup-success-text);
  border: 1px solid var(--popup-success-border);
  background: var(--popup-success-bg);
}

.empty-state {
  text-align: center;
  color: var(--popup-text-muted);
  border: 1px dashed var(--popup-border);
  background: var(--popup-card-bg-muted);
}

.token-list {
  display: grid;
  gap: 8px;
}

.token-card {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--popup-border);
  border-radius: 8px;
  background: var(--popup-card-bg);
  box-shadow: var(--popup-inset-highlight);
}

.token-card__main,
.token-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.token-meta {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong,
  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--popup-text-primary);
    font-size: 13px;
  }

  span {
    color: var(--popup-text-subtle);
    font-size: 11px;
  }
}

.token-code {
  flex-shrink: 0;
  color: var(--popup-accent);
  font-family: "Fira Code", "SFMono-Regular", Consolas, monospace;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;

  &--empty {
    color: var(--popup-text-subtle);
  }
}

.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--popup-text-subtle);
  font-size: 11px;
  font-weight: 700;
}

.timer-track {
  position: relative;
  width: 74px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--popup-control-bg);
}

.timer-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--popup-accent-line-gradient);
}

.token-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.text-btn {
  min-height: 28px;
  border-radius: 8px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 700;
}

.text-btn--danger {
  color: var(--popup-danger-strong);
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn,
  .primary-btn,
  .secondary-btn,
  .text-btn {
    transition: none;
  }
}
</style>
