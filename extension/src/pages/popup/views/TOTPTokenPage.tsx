/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/views/TOTPTokenPage.tsx
 * @description React 版动态令牌页面 - 查看后端生成的动态验证码
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, Input, message } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import jsQR from 'jsqr';
import TableContainer from '../components/TableContainer';
import {
  createTOTPAccount,
  deleteTOTPAccount,
  getTOTPCode,
  listTOTPAccounts,
  type TOTPAccount,
  type TOTPCode,
} from '@/services/api/totp-api';
import './totp-token-page.scss';

/**
 * 表单数据类型
 */
interface TOTPForm {
  issuer: string;
  accountName: string;
  secret: string;
  otpauthUrl: string;
}

/**
 * TOTP 动态令牌页面组件
 */
export const TOTPTokenPage: React.FC = () => {
  const [accounts, setAccounts] = useState<TOTPAccount[]>([]);
  const [codes, setCodes] = useState<Record<string, TOTPCode>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const qrInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const [form, setForm] = useState<TOTPForm>({
    issuer: '',
    accountName: '',
    secret: '',
    otpauthUrl: '',
  });

  const [messageApi, messageContextHolder] = message.useMessage();

  /** 提交按钮是否禁用 */
  const isSubmitDisabled = useMemo(() => {
    return isSubmitting || (!form.otpauthUrl && (!form.accountName || !form.secret));
  }, [isSubmitting, form]);

  /** 显示发行方 */
  const displayIssuer = useCallback((account: TOTPAccount): string => {
    return account.issuer || '未命名';
  }, []);

  /** 清空状态消息 */
  const clearStatus = useCallback(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  /** 重置表单 */
  const resetForm = useCallback(() => {
    setForm({
      issuer: '',
      accountName: '',
      secret: '',
      otpauthUrl: '',
    });
  }, []);

  /** 打开二维码选择器 */
  const openQRPicker = useCallback(() => {
    qrInputRef.current?.click();
  }, []);

  /** 从图片解码二维码 */
  const decodeQRCodeFromImage = useCallback(async (file: File): Promise<string> => {
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
  }, []);

  /** 处理二维码上传 */
  const handleQRUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    clearStatus();
    setIsScanningQR(true);
    try {
      const content = await decodeQRCodeFromImage(file);
      if (!content.startsWith('otpauth://totp/')) {
        throw new Error('二维码不是 TOTP 令牌链接');
      }
      setForm((prev) => ({ ...prev, otpauthUrl: content }));
      setSuccessMessage('二维码已解析');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '二维码解析失败');
    } finally {
      setIsScanningQR(false);
    }
  }, [decodeQRCodeFromImage, clearStatus]);

  /** 加载账户列表 */
  const loadAccounts = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    clearStatus();
    try {
      const loadedAccounts = await listTOTPAccounts();
      setAccounts(loadedAccounts);
      await refreshCodesForAccounts(loadedAccounts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '加载令牌失败');
    } finally {
      setIsLoading(false);
    }
  }, [clearStatus]);

  /** 刷新单个账户的验证码 */
  const refreshCode = useCallback(async (accountId: string): Promise<void> => {
    try {
      const code = await getTOTPCode(accountId);
      setCodes((prev) => ({ ...prev, [accountId]: code }));
    } catch (error) {
      maLogger.warn('刷新验证码失败:', accountId, error);
    }
  }, []);

  /** 批量刷新验证码 */
  const refreshCodesForAccounts = useCallback(async (accountsList: TOTPAccount[]): Promise<void> => {
    await Promise.all(accountsList.map((account) => refreshCode(account.id)));
  }, [refreshCode]);

  /** 刷新所有验证码 */
  const refreshAll = useCallback(async (): Promise<void> => {
    clearStatus();
    try {
      await refreshCodesForAccounts(accounts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '刷新动态码失败');
    }
  }, [accounts, refreshCodesForAccounts, clearStatus]);

  /** 提交账户 */
  const submitAccount = useCallback(async (): Promise<void> => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    clearStatus();
    try {
      await createTOTPAccount({
        issuer: form.issuer,
        accountName: form.accountName,
        secret: form.secret,
        otpauthUrl: form.otpauthUrl,
      });
      resetForm();
      setSuccessMessage('令牌已保存');
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存令牌失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, clearStatus, resetForm, loadAccounts]);

  /** 删除账户 */
  const removeAccount = useCallback(async (accountId: string): Promise<void> => {
    if (!window.confirm('确认删除这个令牌？')) return;

    clearStatus();
    try {
      await deleteTOTPAccount(accountId);
      setCodes((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setAccounts((prev) => prev.filter((account) => account.id !== accountId));
      setSuccessMessage('令牌已删除');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除令牌失败');
    }
  }, [clearStatus]);

  /** 复制验证码 */
  const copyCode = useCallback(async (accountId: string): Promise<void> => {
    const code = codes[accountId]?.code;
    if (!code) return;

    clearStatus();
    try {
      await navigator.clipboard.writeText(code);
      messageApi.success('动态码已复制');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '复制失败');
    }
  }, [codes, clearStatus, messageApi]);

  /** 计算剩余秒数 */
  const remainingSeconds = useCallback((account: TOTPAccount): number => {
    const code = codes[account.id];
    if (!code) return account.period;
    const expiresAt = new Date(code.expiresAt).getTime();
    return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  }, [codes, nowMs]);

  /** 计算进度百分比 */
  const progressPercent = useCallback((account: TOTPAccount): number => {
    const remaining = remainingSeconds(account);
    return Math.max(0, Math.min(100, (remaining / account.period) * 100));
  }, [remainingSeconds]);

  /** 剩余时间文本 */
  const remainingText = useCallback((account: TOTPAccount): string => {
    const remaining = remainingSeconds(account);
    return remaining > 0 ? `${remaining}s` : '刷新中';
  }, [remainingSeconds]);

  /** 定时器回调 */
  const tick = useCallback(async (): Promise<void> => {
    setNowMs(Date.now());
    const expiredAccounts = accounts.filter((account) => remainingSeconds(account) <= 0);
    if (expiredAccounts.length === 0) return;

    try {
      await Promise.all(expiredAccounts.map((account) => refreshCode(account.id)));
    } catch (error) {
      maLogger.warn('刷新 TOTP 动态码失败:', error);
    }
  }, [accounts, remainingSeconds, refreshCode]);

  /** 初始化加载 */
  useEffect(() => {
    loadAccounts();
    timerRef.current = window.setInterval(() => {
      tick();
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [loadAccounts, tick]);

  return (
    <TableContainer
      density="compact"
      sectionGap="10px"
      contentGap="10px"
      rightMaxWidth="42%"
      headLeft={
        <>
          <p className="section-kicker">Authenticator</p>
          <h2 className="section-title">动态令牌</h2>
        </>
      }
      headRight={
        <Button
          className="icon-btn"
          htmlType="button"
          title="刷新"
          disabled={isLoading}
          onClick={refreshAll}
          icon={<ClockCircleOutlined />}
        />
      }
    >
      {messageContextHolder}

      <form
        className="token-form"
        onSubmit={(e) => {
          e.preventDefault();
          submitAccount();
        }}
      >
        <label className="field field--wide">
          <span>otpauth 链接</span>
          <Input.TextArea
            value={form.otpauthUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, otpauthUrl: e.target.value.trim() }))}
            rows={2}
            placeholder="otpauth://totp/..."
          />
        </label>
        <input
          ref={qrInputRef}
          className="qr-input"
          type="file"
          accept="image/*"
          onChange={handleQRUpload}
        />

        <div className="form-grid">
          <label className="field">
            <span>账户</span>
            <Input
              value={form.accountName}
              onChange={(e) => setForm((prev) => ({ ...prev, accountName: e.target.value.trim() }))}
              type="text"
              autoComplete="off"
              placeholder="name@example.com"
            />
          </label>
          <label className="field">
            <span>发行方</span>
            <Input
              value={form.issuer}
              onChange={(e) => setForm((prev) => ({ ...prev, issuer: e.target.value.trim() }))}
              type="text"
              autoComplete="off"
              placeholder="GitHub"
            />
          </label>
        </div>

        <label className="field">
          <span>Secret</span>
          <Input
            value={form.secret}
            onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value.trim() }))}
            type="password"
            autoComplete="off"
            placeholder="Base32 secret"
          />
        </label>

        <div className="form-actions">
          <Button
            className="secondary-btn"
            htmlType="button"
            disabled={isScanningQR}
            onClick={openQRPicker}
          >
            {isScanningQR ? '解析中' : '上传二维码'}
          </Button>
          <span className="form-spacer"></span>
          <Button
            className="secondary-btn"
            htmlType="button"
            disabled={isLoading}
            onClick={resetForm}
          >
            清空
          </Button>
          <Button
            className="primary-btn"
            type="primary"
            htmlType="submit"
            disabled={isSubmitDisabled}
            loading={isSubmitting}
          >
            {isSubmitting ? '保存中' : '保存令牌'}
          </Button>
        </div>
      </form>

      {errorMessage && <div className="notice notice--error">{errorMessage}</div>}
      {successMessage && <div className="notice notice--success">{successMessage}</div>}

      {isLoading && accounts.length === 0 && (
        <div className="empty-state">加载中</div>
      )}
      {!isLoading && accounts.length === 0 && (
        <div className="empty-state">暂无令牌</div>
      )}

      {accounts.length > 0 && (
        <div className="token-list">
          {accounts.map((account) => (
            <article key={account.id} className="token-card">
              <div className="token-card__main">
                <div className="token-meta">
                  <strong>{displayIssuer(account)}</strong>
                  <span>{account.accountName}</span>
                </div>
                <div
                  className={`token-code ${
                    !codes[account.id]?.code ? 'token-code--empty' : ''
                  }`}
                >
                  {codes[account.id]?.code || '------'}
                </div>
              </div>

              <div className="token-card__bottom">
                <div className="timer">
                  <span className="timer-track">
                    <span
                      className="timer-fill"
                      style={{ width: `${progressPercent(account)}%` }}
                    ></span>
                  </span>
                  <span>{remainingText(account)}</span>
                </div>
                <div className="token-actions">
                  <Button
                    className="text-btn"
                    htmlType="button"
                    disabled={!codes[account.id]?.code}
                    onClick={() => copyCode(account.id)}
                  >
                    复制
                  </Button>
                  <Button
                    className="text-btn text-btn--danger"
                    htmlType="button"
                    danger
                    onClick={() => removeAccount(account.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </TableContainer>
  );
};

export default TOTPTokenPage;
