/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/auth.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import CryptoJS from 'crypto-js';
import { getHash } from './base';

// 动态生成密钥
const generateKey = () => {
  // 结合浏览器指纹、时间戳和随机数生成密钥
  const fingerprint = `${navigator.userAgent}-${window.screen.width}x${window.screen.height}`;
  const timestamp = Math.floor(Date.now() / 3600000); // 每小时更新一次
  // 结合指纹、时间戳和环境变量生成密钥
  //@ts-ignore
  return getHash(`${fingerprint}-${timestamp}-${import.meta.env.VITE_APP_SECRET || 'mria-secret'}`);
};

// 认证状态接口
interface AuthState {
  loggedIn: boolean;
  username: string;
  timestamp: number;
  expires: number;
}

/**
 * 保存登录状态
 * @param username 用户名
 * @param duration 过期时间（秒），默认24小时
 */
export const saveLoginState = (username: string, duration: number = 24 * 3600) => {
  const key = generateKey();
  const state: AuthState = {
    loggedIn: true,
    username,
    timestamp: Date.now(),
    expires: Date.now() + duration * 1000
  };

  // 加密状态
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(state),
    key
  ).toString();

  // 生成签名
  const signature = CryptoJS.HmacSHA256(encrypted, key).toString();

  // 存储到多个位置，使用复杂键名
  localStorage.setItem('__mria_auth', encrypted);
  localStorage.setItem('__mria_sig', signature);
  sessionStorage.setItem('__mria_ua', getHash(navigator.userAgent));

  // 保留旧的简单存储作为备份
  localStorage.setItem('mria-logged-in', 'true');
  localStorage.setItem('mria-username', username);
};

/**
 * 验证登录状态
 * @returns 是否登录
 */
export const verifyLoginState = (): boolean => {
  try {
    // 检查多个条件
    const encrypted = localStorage.getItem('__mria_auth');
    const signature = localStorage.getItem('__mria_sig');
    const storedUa = sessionStorage.getItem('__mria_ua');

    if (!encrypted || !signature || !storedUa) {
      // 尝试使用旧的简单存储作为备选
      const oldLoggedIn = localStorage.getItem('mria-logged-in') === 'true';
      if (oldLoggedIn) {
        const oldUsername = localStorage.getItem('mria-username') || '';
        saveLoginState(oldUsername); // 自动迁移到新的存储方式
        return true;
      }
      return false;
    }

    // 验证UA一致性
    if (storedUa !== getHash(navigator.userAgent)) {
      clearLoginState();
      return false;
    }

    const key = generateKey();

    // 验证签名
    const expectedSignature = CryptoJS.HmacSHA256(encrypted, key).toString();
    if (signature !== expectedSignature) {
      clearLoginState();
      return false;
    }

    // 解密状态
    const decrypted = CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8);
    const state: AuthState = JSON.parse(decrypted);

    // 验证过期时间
    if (Date.now() > state.expires) {
      clearLoginState();
      return false;
    }

    return state.loggedIn;
  } catch (error) {
    maLogger.error('Login state verification failed:', error);
    clearLoginState();
    return false;
  }
};

/**
 * 清除登录状态
 */
export const clearLoginState = () => {
  localStorage.removeItem('__mria_auth');
  localStorage.removeItem('__mria_sig');
  sessionStorage.removeItem('__mria_ua');
  // 清除旧的简单存储
  localStorage.removeItem('mria-logged-in');
  localStorage.removeItem('mria-username');
};

/**
 * 获取登录用户名
 * @returns 用户名或null
 */
export const getLoggedInUsername = (): string | null => {
  try {
    const encrypted = localStorage.getItem('__mria_auth');
    if (!encrypted) {
      // 尝试使用旧的简单存储
      return localStorage.getItem('mria-username');
    }

    const key = generateKey();
    const decrypted = CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8);
    const state: AuthState = JSON.parse(decrypted);

    return state.loggedIn && Date.now() <= state.expires ? state.username : null;
  } catch (error) {
    maLogger.error('Failed to get username:', error);
    return localStorage.getItem('mria-username');
  }
};
