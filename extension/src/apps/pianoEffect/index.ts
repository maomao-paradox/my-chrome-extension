/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/pianoEffect/index.ts
 * @date 2026-02-05T02:38:01.690Z
 */

// pianoEffect.ts - 钢琴音效模块
import { storage } from '@/stores';
import { getStaticAbstractPath } from '@/utils/common';
import { wzyTool } from '@/apps/rainmeter';
import { AppModule } from '@/types';

const fetchAndDecodeAudioBuffer = async (
  soundFile: string,
  audioCtx: AudioContext
): Promise<{ buffer: AudioBuffer | null; ok: boolean }> => {
  const soundUrl = getStaticAbstractPath(`keytone/Piano/${soundFile}`);
  const response = await fetch(soundUrl);
  if (!response.ok) return { buffer: null, ok: false };
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return { buffer: audioBuffer, ok: true };
};


class PianoEffect implements AppModule {
  _context: any = null
  shadowHostId: string = '';
  isInjected: boolean = false;
  vueContainer: HTMLElement | null = null;
  shadowRoot: ShadowRoot | null = null;
  appInstance: any | null = null;

  isEnabled: boolean = false;
  private audioContext: AudioContext | null = null;
  private soundBuffers: Map<string, AudioBuffer> = new Map();
  private keySoundMap: Map<string, string> = new Map();
  private rainTextModule: any = null; // 使用wzyTool实例

  constructor() {
    // 初始化按键与音效文件的映射
    this.initKeySoundMap();
  }

  // 初始化按键与音效文件的映射
  private initKeySoundMap(): void {
    // 字母键
    for (let i = 65; i <= 90; i++) {
      const key = String.fromCharCode(i);
      this.keySoundMap.set(key.toLowerCase(), `Sound_${key}.wav`);
    }

    // 特殊键
    this.keySoundMap.set(' ', 'space.wav');
    this.keySoundMap.set('backspace', 'backspace.wav');
    this.keySoundMap.set('enter', 'enter.wav');
  }

  // 初始化音频上下文
  private async initAudioContext(): Promise<void> {
    try {
      // 尝试创建音频上下文，兼容不同浏览器
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 立即开始预加载，不等待用户交互
      // 注意：浏览器策略可能会阻止自动播放，但预加载不受影响
      this.preloadSounds().catch(() => { }); // 预加载失败不影响主流程
    } catch (error) {
      // 处理浏览器音频策略限制
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // 静默处理，将在用户首次交互时尝试重新初始化
      }
    }
  }

  // 预加载音效文件
  private async preloadSounds(): Promise<void> {
    try {
      const commonKeys = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ' ', 'enter'];
      const preloadPromises = commonKeys.map(async (key) => {
        const soundFile = this.keySoundMap.get(key);
        if (soundFile && !this.soundBuffers.has(soundFile) && this.audioContext) {
          try {
            const { buffer, ok } = await fetchAndDecodeAudioBuffer(soundFile, this.audioContext);
            if (ok && buffer) this.soundBuffers.set(soundFile, buffer);
          } catch { }
        }
      });
      await Promise.all(preloadPromises);
    } catch { }
  }

  // 播放音效
  private async playSound(key: string): Promise<void> {
    const soundFile = this.keySoundMap.get(key);
    if (!soundFile) return;

    // 快速路径：已缓存且上下文正常就立即播放
    if (this.canPlayImmediately(soundFile)) {
      this.playFromBuffer(soundFile);
      return;
    }

    // 初始化上下文并恢复状态
    if (!(await this.ensureAudioContextReady())) return;

    // 有缓存就播放
    if (this.soundBuffers.has(soundFile)) {
      this.playFromBuffer(soundFile);
      return;
    }

    // 慢速路径：网络请求解码再播放
    try {
      const { buffer, ok } = await fetchAndDecodeAudioBuffer(soundFile, this.audioContext!);
      if (ok && buffer) {
        this.soundBuffers.set(soundFile, buffer);
        this.playFromBuffer(soundFile);
      }
    } catch {
      // 静默处理网络请求失败
    }
  }

  private canPlayImmediately(soundFile: string): boolean {
    return this.soundBuffers.has(soundFile)
      && !!this.audioContext
      && this.audioContext.state === 'running';
  }

  private async ensureAudioContextReady(): Promise<boolean> {
    if (!this.audioContext) await this.initAudioContext();
    if (!this.audioContext) return false;
    if (this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume(); } catch { return false; }
    }
    return true;
  }

  // 从缓存的音频数据播放
  private playFromBuffer(soundFile: string): void {
    if (!this.audioContext) return;

    const buffer = this.soundBuffers.get(soundFile);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  // 键盘事件处理
  private handleKeyPress = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;
    const target = event.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (isInputElement) return;

    // 确保rainTextModule存在且方法有效
    const hasRainModule = this.rainTextModule && typeof this.rainTextModule.addCharDrop === 'function';
    // maLogger.log(`[PianoEffect] rainTextModule状态检查: 存在=${!!this.rainTextModule}, 方法有效=${hasRainModule}`);

    // if (!hasRainModule) {
    //   maLogger.error('[PianoEffect] 严重问题: rainTextModule未初始化或缺少addCharDrop方法');
    //   // 尝试重新初始化wzyTool
    //   if (!this.rainTextModule) {
    //     maLogger.log('[PianoEffect] 尝试重新初始化wzyTool...');
    //     this.initializeRainText().catch(err => {
    //       maLogger.error('[PianoEffect] 重新初始化wzyTool失败:', err);
    //     });
    //   }
    // }

    try {
      if (event.code === 'Space') {
        this.playSound(' ');
      } else if (event.code === 'Backspace') {
        this.playSound('backspace');
      } else if (event.code === 'Enter') {
        this.playSound('enter');
      } else if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
        this.playSound(event.key.toLowerCase());
      }
    } catch (error) {
      maLogger.error('[PianoEffect] 处理按键事件时出错:', error);
    }
  }

  // 启用钢琴音效
  public async enable(): Promise<void> {
    if (this.isEnabled) return;

    this.initAudioContext();
    this.preloadSounds().catch(() => {});
    this.isEnabled = true;
    document.addEventListener('keydown', this.handleKeyPress);

    const activateAudioOnce = () => {
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      document.removeEventListener('click', activateAudioOnce);
      document.removeEventListener('keydown', activateAudioOnce);
    };

    document.addEventListener('click', activateAudioOnce);
    document.addEventListener('keydown', activateAudioOnce);
  }

  // 禁用钢琴音效
  public async disable(): Promise<void> {
    if (!this.isEnabled) {
      // maLogger.log('钢琴音效已经处于禁用状态');
      return;
    }

    this.isEnabled = false;
    document.removeEventListener('keydown', this.handleKeyPress);

    // 停止并销毁wzyTool
    if (this.rainTextModule) {
      try {
        this.rainTextModule.destroy();
        this.rainTextModule = null;
      } catch (error) {
        maLogger.error('Failed to destroy wzyTool:', error);
      }
    }

    // 保存设置到本地存储，添加错误处理
    try {
      await storage.ext.local.set('enablePianoEffect', false);
      // maLogger.log('钢琴音效设置已保存到本地存储');
    } catch (storageError) {
      maLogger.error('保存钢琴音效设置失败:', storageError);
    }

    // 确保无论存储操作是否成功，都打印禁用日志
    // maLogger.log('钢琴音效已禁用');
  }

  // 初始化钢琴音效模块
  public async init(): Promise<void> {
    try {
      // maLogger.log('[调试] 开始初始化钢琴音效模块...');
      // 从本地存储加载设置
      const enablePiano = await storage.ext.local.get('enablePianoEffect', false);
      // maLogger.log('[调试] 从本地存储获取钢琴音效设置:', enablePiano);

      if (enablePiano) {
        await this.enable();
      } else {
        // maLogger.log('[调试] 钢琴音效设置为禁用状态，不启用');
      }

      // wzyTool会在enable方法中初始化，这里不再重复初始化
    } catch (error) {
      maLogger.error('[调试] 初始化钢琴音效模块失败:', error);
    }
  }

  // 根据设置更新状态
  public async updateStatus(enabled: boolean): Promise<void> {
    // maLogger.log(`[调试] 更新钢琴音效状态: enabled=${enabled}`);
    if (enabled) {
      await this.enable();
    } else {
      await this.disable();
    }
  }

  // 重新初始化rainText模块的辅助方法
  private async initializeRainText(): Promise<void> {
    try {
      maLogger.log('[PianoEffect] 进入initializeRainText辅助方法');
      // 确保rainTextModule被正确初始化
      if (!this.rainTextModule || typeof this.rainTextModule.addCharDrop !== 'function') {
        try {
          maLogger.log('[PianoEffect] 尝试初始化wzyTool...');
          await wzyTool.initialize();
          this.rainTextModule = wzyTool;
          maLogger.log('[PianoEffect] 辅助方法成功初始化wzyTool');
        } catch (error) {
          maLogger.error('[PianoEffect] initializeRainText辅助方法失败:', error);
          throw error;
        }
      } else {
        maLogger.log('[PianoEffect] rainTextModule已经可用');
      }
    } catch (error) {
      maLogger.error('[PianoEffect] 初始化rainText模块出错:', error);
      throw error;
    }
  }
}


export default (ctx: AppContext, options?: any): AppModule => {
  const appInstance = new PianoEffect();
  appInstance.init();
  return appInstance;
}