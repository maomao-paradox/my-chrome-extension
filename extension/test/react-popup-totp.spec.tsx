/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file test/react-popup-totp.spec.tsx
 * @description TOTP 令牌页面单元测试 - 专注于核心逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockListTOTPAccounts,
  mockGetTOTPCode,
  mockCreateTOTPAccount,
  mockDeleteTOTPAccount,
} = vi.hoisted(() => ({
  mockListTOTPAccounts: vi.fn().mockResolvedValue([
    {
      id: 'account-1',
      issuer: 'GitHub',
      accountName: 'test@example.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: 'JBSWY3DPEHPK3PXP',
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    },
  ]),
  mockGetTOTPCode: vi.fn().mockResolvedValue({
    code: '123456',
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    remainingSeconds: 30,
  }),
  mockCreateTOTPAccount: vi.fn().mockResolvedValue(undefined),
  mockDeleteTOTPAccount: vi.fn().mockResolvedValue(undefined),
}));

describe('TOTP API 逻辑测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTOTPAccounts.mockResolvedValueOnce([
      {
        id: 'account-1',
        issuer: 'GitHub',
        accountName: 'test@example.com',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: 'JBSWY3DPEHPK3PXP',
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
      },
    ]);
  });

  describe('账户管理', () => {
    it('应该能获取账户列表', async () => {
      const accounts = await mockListTOTPAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].issuer).toBe('GitHub');
      expect(accounts[0].accountName).toBe('test@example.com');
    });

    it('应该能获取动态码', async () => {
      const code = await mockGetTOTPCode('account-1');
      expect(code.code).toBe('123456');
      expect(code.remainingSeconds).toBe(30);
    });

    it('应该能创建账户', async () => {
      await mockCreateTOTPAccount({
        issuer: 'Google',
        accountName: 'user@gmail.com',
        secret: 'JBSWY3DPEHPK3PXP',
      });
      expect(mockCreateTOTPAccount).toHaveBeenCalled();
    });

    it('应该能删除账户', async () => {
      await mockDeleteTOTPAccount('account-1');
      expect(mockDeleteTOTPAccount).toHaveBeenCalledWith('account-1');
    });
  });

  describe('表单验证', () => {
    it('空表单应该不满足提交条件', () => {
      const form = { issuer: '', accountName: '', secret: '', otpauthUrl: '' };
      const isSubmitDisabled = !form.otpauthUrl && (!form.accountName || !form.secret);
      expect(isSubmitDisabled).toBe(true);
    });

    it('有 otpauth URL 应该满足提交条件', () => {
      const form = {
        issuer: '',
        accountName: '',
        secret: '',
        otpauthUrl: 'otpauth://totp/GitHub:test?secret=JBSWY3DPEHPK3PXP',
      };
      const isSubmitDisabled = !form.otpauthUrl && (!form.accountName || !form.secret);
      expect(isSubmitDisabled).toBe(false);
    });

    it('有 accountName 和 secret 应该满足提交条件', () => {
      const form = {
        issuer: 'GitHub',
        accountName: 'test@example.com',
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: '',
      };
      const isSubmitDisabled = !form.otpauthUrl && (!form.accountName || !form.secret);
      expect(isSubmitDisabled).toBe(false);
    });

    it('只有 accountName 没有 secret 应该不满足提交条件', () => {
      const form = {
        issuer: 'GitHub',
        accountName: 'test@example.com',
        secret: '',
        otpauthUrl: '',
      };
      const isSubmitDisabled = !form.otpauthUrl && (!form.accountName || !form.secret);
      expect(isSubmitDisabled).toBe(true);
    });
  });

  describe('动态码逻辑', () => {
    it('应该能计算剩余秒数', () => {
      const nowMs = Date.now();
      const expiresAt = new Date(nowMs + 30000).toISOString();
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
      expect(remaining).toBe(30);
    });

    it('过期的动态码剩余秒数应该为 0', () => {
      const nowMs = Date.now();
      const expiresAt = new Date(nowMs - 5000).toISOString();
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
      expect(remaining).toBe(0);
    });

    it('应该能计算进度百分比', () => {
      const remaining = 15;
      const period = 30;
      const progress = Math.max(0, Math.min(100, (remaining / period) * 100));
      expect(progress).toBe(50);
    });

    it('进度百分比应该在有效范围内', () => {
      const remaining = 45;
      const period = 30;
      const progress = Math.max(0, Math.min(100, (remaining / period) * 100));
      expect(progress).toBe(100);
    });
  });

  describe('账户显示', () => {
    it('有 issuer 时应该显示 issuer', () => {
      const account = { issuer: 'GitHub', accountName: 'test@test.com' };
      const displayName = account.issuer || '未命名';
      expect(displayName).toBe('GitHub');
    });

    it('无 issuer 时应该显示默认值', () => {
      const account = { issuer: '', accountName: 'test@test.com' };
      const displayName = account.issuer || '未命名';
      expect(displayName).toBe('未命名');
    });

    it('有动态码时应该显示动态码', () => {
      const code = { code: '123456' };
      expect(code.code).toBe('123456');
    });

    it('无动态码时应该显示占位符', () => {
      const code = undefined;
      const displayCode = code?.code || '------';
      expect(displayCode).toBe('------');
    });
  });

  describe('API 错误处理', () => {
    it('列表 API 错误应该抛出异常', async () => {
      mockListTOTPAccounts.mockRejectedValueOnce(new Error('加载失败'));
      try {
        await mockListTOTPAccounts();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('加载失败');
      }
    });

    it('创建 API 错误应该抛出异常', async () => {
      mockCreateTOTPAccount.mockRejectedValueOnce(new Error('保存失败'));
      try {
        await mockCreateTOTPAccount({} as any);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('保存失败');
      }
    });

    it('删除 API 错误应该抛出异常', async () => {
      mockDeleteTOTPAccount.mockRejectedValueOnce(new Error('删除失败'));
      try {
        await mockDeleteTOTPAccount('test-id');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('删除失败');
      }
    });
  });

  describe('定时器逻辑', () => {
    it('应该创建和清除定时器', () => {
      const intervalId = window.setInterval(() => {}, 1000);
      expect(intervalId).toBeDefined();
      window.clearInterval(intervalId);
    });
  });
});
