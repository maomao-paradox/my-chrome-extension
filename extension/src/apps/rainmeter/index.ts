/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/index.ts
 * @date 2026-02-05T02:38:01.691Z
 */

// import { Debug } from "@/utils/common";
import { addElementToDom } from '@/utils/element-control';
import { Drops } from './js/Drops';
import { DropWords } from './js/DropWords';
import { Environment } from './js/Environment';
import { Gui } from './js/Gui';
import { RainText } from './js/RainText';
import { Text } from './js/Text';
import { createShadowHost, injectStyleLink, injectStyles } from '@/utils/shadow-dom';
import { shadowHostId } from '@/config';

export type DropWord = {
    id: string;
    palavra: string;
};

export type DropWordItem = [DropWords, number, number, boolean];

// wzy弹幕工具类 - 使用Shadow DOM隔离
class WzyTool {
  private mockData: DropWord[] = [
    { id: '1', palavra: '我是来凑数的' },
    { id: '2', palavra: '这个弹幕有点东西' },
    { id: '3', palavra: '❄' },
    { id: '4', palavra: '前方高能预警' },
    { id: '5', palavra: '确认过眼神' },
    { id: '6', palavra: '人间失格' },
    { id: '7', palavra: '愛' }
  ];
  private shadowId = `${shadowHostId}-rainmeter`;

  private animationInterval: number | null = null;
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  // private debug: Debug | null = null;
  private drop_words: DropWord[] = [];
  private the_rain: number | null = null;

  // 新增焦点检测相关属性
  private focusTimeout: number | null = null;
  private isWindowFocused: boolean = true;
  private isAutoRainMode: boolean = false;
  private originalIntensity: number = 0; // 记录原始密度
  private focusLostTime: number = 0; // 记录失去焦点的时间
  private stopGeneratingNewDrops: boolean = false; // 控制是否生成新雨滴

  // 遮罩相关属性
  private overlayElement: HTMLDivElement | null = null;
  private overlayAnimation: Animation | null = null;
  private isOverlayVisible: boolean = false;

  // 主动画循环所需的成员变量
  private rain_text: RainText[] = [];
  private current_text: number = 0;
  private total_texts: number = 0;
  private make_rain_text: boolean = false;

  constructor() {
    // this.debug = new Debug('WzyTool', true);
    maLogger.log('WzyTool实例已创建');
  }

  // 初始化弹幕工具
  public async initialize(): Promise<boolean> {
    // maLogger.log('正在初始化弹幕工具...');

    // 先检查是否已经加载过弹幕工具
    if (document.getElementById(this.shadowId)) {
      // maLogger.log('弹幕工具已经加载');
      return true;
    }

    try {
      // 使用现有工具方法创建Shadow DOM容器
      this.createShadowDom();

      // 在Shadow DOM内部加载样式
      this.loadStylesheetsInShadow();

      addElementToDom({
        tag: 'script',
        attrs: { src: chrome.runtime.getURL('assets/js/runtime/newcount.js') }
      })(this.shadowRoot!);

      // 初始化数据
      this.drop_words = [...this.mockData];

      // 初始化弹幕效果
      setTimeout(() => {
        this.initializeRainEffect();
      }, 500); // 短暂延迟确保DOM准备就绪

      // 监听配置变化
      // this.setupConfigListener();

      // 新增：设置窗口焦点监听器
      this.setupFocusListeners();

      return true;
    } catch (error) {
      maLogger.error('初始化弹幕工具失败:', error);
      return false;
    }
  }

  // 创建Shadow DOM宿主元素（使用工具方法）
  private createShadowDom(): void {
    try {
      // 使用工具类创建Shadow Host
      const { shadowHost, shadowRoot } = createShadowHost(this.shadowId, 'open');
      this.hostElement = shadowHost;
      this.shadowRoot = shadowRoot;

      // 调整宿主元素样式
      this.hostElement.style.position = 'fixed';
      this.hostElement.style.top = '0';
      this.hostElement.style.left = '0';
      this.hostElement.style.width = '100%';
      this.hostElement.style.height = '100%';
      this.hostElement.style.zIndex = '2147483647';
      this.hostElement.style.pointerEvents = 'none';

      // 创建容器用于容纳弹幕内容（使用addElementToDom方法）
      const addContainer = addElementToDom({
        tag: 'div',
        attrs: { id: 'wzy-rain-container' },
        style: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%'
        }
      });
      addContainer(this.shadowRoot!);

      maLogger.log('Shadow DOM创建成功');
    } catch (error) {
      maLogger.error('创建Shadow DOM失败:', error);
      throw error;
    }
  }

  // 在Shadow DOM中加载CSS文件（使用工具方法）
  private loadStylesheetsInShadow(): void {
    if (!this.shadowRoot) {return;}

    // 注册字体
    const fontCSS = `
    @font-face {
	font-family: 'Source Sans Pro';
	font-style: normal;
	font-weight: 400;
	src: url('${chrome.runtime.getURL('static/fonts/font-kit=6xK3dSBYKcSV-LCoeQqfX1RYOo3qOK7h&skey=1e026b1c27170b9b&v=v22')}');
}
    @font-face {
	font-family: 'FontAwesome';
	src: url('${chrome.runtime.getURL('static/fonts/fontawesome-webfont.woff2-v=4.4.0')}');
	font-weight: normal;
	font-style: normal
}
`;
    injectStyles(this.shadowRoot, fontCSS);

    const cssFiles = [
      'static/css/main.css-v=0.0.2.css',
      'static/css/font-awesome.min.css'
    ];

    for (const file of cssFiles) {
      try {
        fetch(chrome.runtime.getURL(file))
          .then(response => response.text())
          .then(cssText => {
            injectStyles(this.shadowRoot!, cssText);
          });
        maLogger.log(`CSS已加载: ${file}`);
      } catch (error) {
        maLogger.error(`加载CSS失败: ${file}`, error);
      }
    }
  }

  // 设置配置监听器，响应popup页面开关变化
  // private setupConfigListener(): void {
  //     try {
  //         // 监听storage变化，当popup页面的开关状态改变时响应
  //         if (chrome.storage && chrome.storage.onChanged) {
  //             chrome.storage.onChanged.addListener((changes, namespace) => {
  //                 if (namespace === 'local' && changes.extensionSettings) {
  //                     const newValue = changes.extensionSettings.newValue;
  //                     // 检查textRain开关状态
  //                     if (newValue && typeof newValue.textRain === 'boolean') {
  //                         if (!newValue.textRain && this.hostElement) {
  //                             // 如果开关关闭，销毁弹幕
  //                             this.destroy();
  //                         }
  //                     }
  //                 }
  //             });
  //         }
  //     } catch (error) {
  //         maLogger.error('设置配置监听器失败:', error);
  //     }
  // }

  // 新增：设置窗口焦点监听器
  private setupFocusListeners(): void {
    try {
      // 监听窗口获得焦点
      window.addEventListener('focus', () => {
        this.handleWindowFocus();
      });

      // 监听窗口失去焦点
      window.addEventListener('blur', () => {
        this.handleWindowBlur();
      });

      // 初始状态检查
      this.isWindowFocused = document.hasFocus();
      maLogger.log(`初始窗口焦点状态: ${this.isWindowFocused}`);
    } catch (error) {
      maLogger.error('设置焦点监听器失败:', error);
    }
  }

  // 处理窗口获得焦点
  private handleWindowFocus(): void {
    maLogger.log('窗口获得焦点');
    this.isWindowFocused = true;

    // 清除之前的定时器
    if (this.focusTimeout !== null) {
      clearTimeout(this.focusTimeout);
      this.focusTimeout = null;
    }

    // 如果当前是自动下雨模式，停止自动模式但保持现有雨滴
    // 不要设置drops = []，让雨滴自然下落到底部
    if (this.isAutoRainMode) {
      maLogger.log('开始逐渐停止雨滴...');
      this.isAutoRainMode = false;
      this.stopGeneratingNewDrops = true;
      // 隐藏遮罩
      this.hideOverlay();
      maLogger.log('退出自动下雨模式，停止生成新雨滴，但保持现有雨滴');
    }
  }

  // 处理窗口失去焦点，测试的时候调整至5s，正式要1分钟起步
  private handleWindowBlur(): void {
    maLogger.log('窗口失去焦点');
    this.isWindowFocused = false;
    this.focusLostTime = Date.now();

    // 设置15秒后开始下雨的定时器
    if (this.focusTimeout !== null) {
      clearTimeout(this.focusTimeout);
    }

    this.focusTimeout = window.setTimeout(() => {
      if (!this.isWindowFocused) {
        this.startAutoRain();
      }
    }, 60 * 1000); // 1分钟
  }

  // 开始自动下雨模式（增大雨滴密度）
  private startAutoRain(): void {
    maLogger.log('启动自动下雨模式，增大雨滴密度');
    this.isAutoRainMode = true;
    this.stopGeneratingNewDrops = false; // 允许生成新雨滴
    // 显示遮罩
    this.showOverlay();
    // 这里会在初始化动画时应用密度变化
  }

  // 创建遮罩元素
  private createOverlay(): void {
    try {
      if (!this.shadowRoot) {
        maLogger.error('无法创建遮罩：ShadowRoot 未初始化');
        return;
      }

      // 创建遮罩元素 - 初始状态完全透明
      this.overlayElement = document.createElement('div');
      this.overlayElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0); // 初始状态完全透明
                pointer-events: none; // 确保不影响网页交互
                z-index: 9997; /* 低于弹幕，确保不遮挡雨滴 */
                transition: background-color 0.5s ease-in-out;
            `;

      // 将遮罩添加到Shadow DOM中
      this.shadowRoot.appendChild(this.overlayElement);
      maLogger.log('遮罩元素创建成功');
    } catch (error) {
      maLogger.error('创建遮罩失败:', error);
    }
  }

  // 显示遮罩（透明度逐渐降低到30%）
  private showOverlay(): void {
    if (!this.overlayElement) {
      maLogger.error('无法显示遮罩：遮罩元素不存在');
      return;
    }

    maLogger.log('显示遮罩，透明度逐渐降低到30%');
    this.isOverlayVisible = true;

    // 使用CSS动画将背景色从透明变为30%不透明
    this.overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  }

  // 隐藏遮罩（透明度逐渐恢复到0%）
  private hideOverlay(): void {
    if (!this.overlayElement) {
      maLogger.error('无法隐藏遮罩：遮罩元素不存在');
      return;
    }

    maLogger.log('隐藏遮罩，透明度逐渐恢复到0%');
    this.isOverlayVisible = false;

    // 使用CSS动画将背景色从30%不透明变为透明
    this.overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  }

  // 初始化弹幕效果
  private initializeRainEffect(): void {
    maLogger.log('初始化弹幕效果...', this.mockData);

    try {
      // 初始化必要的对象
      const gui = new Gui(this);
      const environment = new Environment();

      // 记录原始密度
      this.originalIntensity = environment.getIntensity();

      // 创建遮罩元素（初始状态完全透明）
      this.createOverlay();

      // 确保初始状态下遮罩是隐藏的
      this.isOverlayVisible = false;

      // 修改Environment的initializeCanvas方法，使其在Shadow DOM中创建画布
      const originalInitializeCanvas = environment.initializeCanvas;
      environment.initializeCanvas = () => {
        if (!this.shadowRoot) {return;}

        // 创建画布元素（使用addElementToDom方法）
        const addCanvas = addElementToDom({
          tag: 'canvas',
          attrs: { id: 'rain_processing' },
          style: {
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: '9998' // 确保画布在遮罩之上
          }
        });
        const canvas = addCanvas(this.shadowRoot) as HTMLCanvasElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        });
      };

      const input_text = new Text(this);
      const rain_message = false;

      // 初始化画布（在Shadow DOM中）
      environment.initializeCanvas();

      // 延迟创建雨滴，只有在自动下雨模式下才创建
      let drops: Drops[] = [];
      let drop_word: DropWordItem[] = [];

      // 鼠标移动影响风向
      document.addEventListener('mousemove', function (e) {
        environment.updateCurrentWind(e.clientX);
      });

      // 添加键盘事件监听器，实现按键时高亮对应字符的雨滴
      document.addEventListener('keydown', (e) => {
        const key = e.key.toUpperCase();
        // 只处理26个英文字母
        if (/^[A-Z]$/.test(key)) {
          // 高亮所有匹配字符的雨滴（只保留颜色改变功能，不生成新雨滴）
          for (let i = 0; i < drops.length; i++) {
            if (drops[i] && drops[i].getChar() === key) {
              drops[i].highlight();
            }
          }
        }
      });

      // 获取画布上下文（从Shadow DOM中）
      const rain_canvas = this.shadowRoot?.querySelector('#rain_processing') as HTMLCanvasElement;
      if (!rain_canvas) {
        maLogger.error('找不到rain_processing画布');
        return;
      }
      const rain_context = rain_canvas.getContext('2d');
      if (!rain_context) {
        maLogger.error('无法获取画布上下文');
        return;
      }

      // 初始化动画变量
      const text: string[][] = [];
      const timing: any[] = [];
      const current_text = 0;
      const total_texts = 0;

      // 主动画循环
      this.the_rain = window.setInterval(() => {
        // 检查输入
        // const textInput = gui.getText();
        // if (textInput && textInput.value.trim().length >= 2) {
        //     // 不要调用私有方法confirmReceive()
        //     const analyze_text = textInput.value;
        //     const processedText = input_text.processText(analyze_text);
        //     for (const t of processedText) {
        //         if (t.length > 0) {
        //             this.total_texts++;
        //             const newRainText = new RainText();
        //             newRainText.initializeText(t, environment.getGravity(), environment.getWind());
        //             this.rain_text.push(newRainText);
        //         }
        //     }
        // }

        // 更新状态
        if (this.rain_text[this.current_text]) {
          this.make_rain_text = true;
          maLogger.log(`[RainMeter] 动画循环: make_rain_text=${this.make_rain_text}, current_text=${this.current_text}, rain_text长度=${this.rain_text.length}`);
          if (this.rain_text[this.current_text].endRainText()) {
            this.make_rain_text = false;
            this.current_text++;
            maLogger.log(`[RainMeter] 文本结束，移动到下一个文本实例: ${this.current_text}`);
          }
        }

        // 控制遮罩显示/隐藏：只有在有弹幕显示时才显示遮罩
        const hasActiveRain = this.rain_text.some((text, index) =>
          index < this.current_text && !text.endRainText()
        ) || this.make_rain_text || this.total_texts > this.current_text;

        if (hasActiveRain && !this.isOverlayVisible) {
          this.showOverlay();
        } else if (!hasActiveRain && this.isOverlayVisible) {
          this.hideOverlay();
        }

        // 清除画布
        rain_context.clearRect(0, 0, rain_canvas.width, rain_canvas.height);
        rain_context.textAlign = 'center';
        rain_context.textBaseline = 'middle';

        // 始终保持渲染，即使在窗口获得焦点后，也让现有雨滴自然下落
        if (this.isAutoRainMode || drops.length > 0) {
          // 检查是否需要初始化雨滴（第一次进入自动模式时）
          const currentIntensity = environment.getCurrentIntensity();
          if (this.isAutoRainMode && drops.length === 0 && !this.stopGeneratingNewDrops && currentIntensity > 0) {
            maLogger.log('初始化雨滴');
            // 创建字符雨滴
            drops = [];
            for (let i = 0; i < currentIntensity; i++) {
              drops[i] = new Drops(i, environment.getChars(), environment.getGravity());
              drops[i].initializeDrop();
            }

            // 创建词语雨滴
            drop_word = [];
            const wordRainCount = Math.min(currentIntensity, this.mockData.length);
            for (let i = 0; i < wordRainCount; i++) {
              const dropWordsInstance = new DropWords();
              const current_drop = Math.floor(Math.random() * this.mockData.length);
              dropWordsInstance.initializeText(this.mockData[current_drop].palavra, environment.getGravity(), environment.getWind());
              // 为每个词语雨滴实例添加stop_rain标记，以便后续控制
              (dropWordsInstance as any).stop_rain = false;

              // 使用更随机的延迟计算，避免基于索引的固定间隔导致的规律性分布
              const staggeredDelay = Math.floor(Math.random() * (800 - 60 + 1)) + 60;

              drop_word[i] = [
                dropWordsInstance,
                staggeredDelay, // 使用更合理的延迟值
                0,
                false
              ];
            }
          }

          // 更新环境参数 - 根据焦点状态调整密度
          // 由于Environment类没有setCurrentIntensity方法，我们通过更新强度的方式来调整密度
          if (this.isAutoRainMode && !this.stopGeneratingNewDrops) {
            // 自动下雨模式，增加更新频率来提高密度
            for (let i = 0; i < 3; i++) { // 增加更新次数来提高密度
              environment.updateCurrentIntensity();
            }
            // maLogger.log(`自动下雨模式：增加密度更新频率，当前密度: ${environment.getCurrentIntensity()}`);
          } else {
            // 非自动下雨模式：逐渐降低密度到0
            if (!this.isAutoRainMode) {
              const currentIntensity = environment.getCurrentIntensity();
              if (currentIntensity > 0) {
                // 密度逐渐降低，每次减少2点
                (environment as any).current_intensity = Math.max(0, currentIntensity - 2);
                // maLogger.log(`非自动模式：密度逐渐降低，当前密度: ${environment.getCurrentIntensity()}`);
              } else {
                // 当密度降到0时，停止生成新雨滴
                this.stopGeneratingNewDrops = true;
                // maLogger.log('密度已降至0，停止生成新雨滴');
              }
            }
          }

          const current_intensity = environment.getCurrentIntensity();
          const current_wind = environment.getWind();
          const drop_words_length = Math.min(current_intensity, this.mockData.length);
          // 绘制词语雨滴
          if (drop_words_length > 0 && drop_word.length > 0) {
            for (let z = 0; z < drop_words_length; z++) {
              if (drop_word[z][2] < drop_word[z][1]) {
                drop_word[z][2]++;
              } else {
                drop_word[z][0].updateText();
                const in_text = drop_word[z][0].getText();
                const echo = drop_word[z][0].echoLine();

                for (let i = 0; i < in_text.length; i++) {
                  // 对不起，做不了你的新娘了
                  if (echo && echo[i] != null) {
                    const offset_x = 0;
                    const offset_y = in_text[i][3] / 2 + 10;

                    rain_context.beginPath();
                    rain_context.moveTo(in_text[i][0] + offset_x, in_text[i][1] - offset_y);
                    rain_context.lineTo(echo[i][0] + offset_x, echo[i][1] - offset_y);
                    rain_context.strokeStyle = '#7fa1d3'; // 统一使用浅蓝色作为雨滴尾巴
                    rain_context.stroke();
                  }

                  rain_context.fillStyle = '#888888'; // 使用灰色作为词语雨滴文字颜色
                  rain_context.font = in_text[i][3] + 'pt Source Sans Pro';
                  rain_context.fillText(in_text[i][2], in_text[i][0], in_text[i][1]);
                }
              }

              // 检查词语雨滴是否结束
              const isEnded = drop_word[z][0].endRainText();

              // 只有在允许生成新雨滴且雨滴结束时才重新生成
              // 修改为：当雨停时，不立即移除雨滴，而是不再重新生成，让现有雨滴自然完成下落过程
              if (isEnded) {
                if (!this.stopGeneratingNewDrops) {
                  maLogger.log('创建新的词语雨滴');
                  const newDropWords = new DropWords();
                  const current_drop = Math.floor(Math.random() * this.mockData.length);
                  newDropWords.initializeText(this.mockData[current_drop].palavra, environment.getGravity(), environment.getWind());
                  const resetDelay = Math.floor(Math.random() * 1000) + 50;
                  drop_word[z] = [newDropWords, resetDelay, 0, false];
                } else {
                  // maLogger.log('词语雨滴结束，在雨停模式下不再重新生成，但保留现有雨滴实例');
                  // 不再从数组中移除雨滴，让它们自然完成渲染周期
                  // 只是不再重新生成新的雨滴，这样随着现有雨滴完成下落过程，画面会逐渐变空
                  // 不再执行splice操作，让雨滴实例继续存在直到自然消失
                }
              }
            }
          }

          // 绘制字符雨滴
          for (let i = 0; i < current_intensity; i++) {
            if (drops[i]) {
              drops[i].updateDrop(current_intensity, current_wind);
              const offset_x = 0;
              const offset_y = drops[i].getSize() / 2;
              const echo = drops[i].echoLine();
              if (echo) {
                rain_context.beginPath();
                rain_context.moveTo(drops[i].getX() + offset_x, drops[i].getY() - offset_y);
                rain_context.lineTo(echo[0] + offset_x, echo[1] - offset_y);
                rain_context.strokeStyle = '#7fa1d3'; // 统一使用浅蓝色作为雨滴尾巴
                rain_context.stroke();
              }

              // 使用getCurrentColor方法获取颜色，支持高亮效果
              rain_context.fillStyle = drops[i].getCurrentColor();
              rain_context.font = drops[i].getSize() + 'px Source Sans Pro';
              rain_context.fillText(drops[i].getChar(), drops[i].getX(), drops[i].getY());
            } else if (!this.stopGeneratingNewDrops) {
              // 只在允许生成新雨滴时才创建新的雨滴实例
              maLogger.log('创建新的字符雨滴');
              drops[i] = new Drops(i, environment.getChars(), environment.getGravity());
              drops[i].initializeDrop();
            } else {
              // maLogger.log('发现空雨滴位置，但已停止生成新雨滴');
            }
          }

          // 绘制用户输入的文本（如果有）
          if (this.make_rain_text && this.rain_text[this.current_text]) {
            maLogger.log(`[RainMeter] 渲染文本: current_text=${this.current_text}, end_rain=${this.rain_text[this.current_text].endRainText()}`);
            this.rain_text[this.current_text].updateText();
            const in_text = this.rain_text[this.current_text].getText();
            const echo = this.rain_text[this.current_text].echoLine();

            for (let i = 0; i < in_text.length; i++) {
              if (echo && echo[i] != null) {
                const offset_x = 0;
                const offset_y = in_text[i][3] / 2 + 10;

                rain_context.beginPath();
                rain_context.moveTo(in_text[i][0] + offset_x, in_text[i][1] - offset_y);
                rain_context.lineTo(echo[i]![0] + offset_x, echo[i]![1] - offset_y);
                rain_context.strokeStyle = '#7fa1d3'; // 统一使用浅蓝色作为雨滴尾巴
                rain_context.stroke();
              }

              // 使用RainText中添加的颜色信息来实现渐变效果
              const textColor = in_text[i][4] || '#ffffff'; // 默认使用白色以提高可见度
              rain_context.fillStyle = textColor;
              rain_context.font = 'bold ' + in_text[i][3] + 'pt Source Sans Pro';
              rain_context.fillText(in_text[i][2], in_text[i][0], in_text[i][1]);
            }
          }
        }
      }, 16.6); // 约60fps

      this.startAutoRain();

      // 跳过创建控制面板，避免DOM冲突
      maLogger.log('弹幕效果初始化完成 - 使用Shadow DOM隔离');
    } catch (error) {
      maLogger.error('弹幕效果初始化失败:', error);
    }
  }

  // 添加新的弹幕词语
  public addDropWord(dropWord: DropWord | string): void {
    if (typeof dropWord === 'string') {
      dropWord = { id: Date.now().toString(), palavra: dropWord };
    }
    this.drop_words.push(dropWord);
  }

  // 添加单个字符雨滴 - 已修改为不再生成新雨滴，只保留方法结构以保持兼容性
  public addCharDrop(char: string): void {
    try {
      if (!char || typeof char !== 'string' || char.length !== 1) {
        maLogger.error('[RainMeter] 参数必须是单个字符');
        return;
      }

      // 只保留键盘事件监听器中的颜色改变功能
      maLogger.log(`[RainMeter] 按键触发：${char}，不再生成新雨滴，只改变现有雨滴颜色`);

    } catch (error) {
      maLogger.error('处理按键时出错:', error);
    }
  }

  // 销毁弹幕工具
  public destroy(): void {
    maLogger.log('销毁弹幕工具...');

    // 清除动画定时器
    if (this.the_rain !== null) {
      clearInterval(this.the_rain);
      this.the_rain = null;
    }

    // 清除animationInterval（为了兼容性）
    if (this.animationInterval !== null) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    // 清除焦点检测定时器
    if (this.focusTimeout !== null) {
      clearTimeout(this.focusTimeout);
      this.focusTimeout = null;
    }

    // 取消遮罩动画
    if (this.overlayAnimation) {
      this.overlayAnimation.cancel();
      this.overlayAnimation = null;
    }

    // 移除Shadow DOM宿主元素
    if (this.hostElement) {
      this.hostElement.remove();
      this.hostElement = null;
      this.shadowRoot = null;
    }
  }
}

// 导出WzyTool类
export class WzyToolPublic extends WzyTool { }

// 创建并导出实例
export const wzyTool = new WzyTool();

// 全局弹幕工具实例
let wzyToolInstance: WzyTool | null = null;

// wzy弹幕工具加载函数 (兼容旧代码)
async function loadWzyTool(): Promise<boolean> {
  maLogger.log('正在加载弹幕工具...');
  try {
    // 创建或获取WzyTool实例
    if (!wzyToolInstance) {
      wzyToolInstance = new WzyTool();
    }

    // 初始化弹幕工具
    return await wzyToolInstance.initialize();
  } catch (error) {
    maLogger.error('加载弹幕工具失败:', error);
    return false;
  }
}
