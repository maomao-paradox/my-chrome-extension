# 钢琴音效模块

该模块提供在浏览器中模拟钢琴音效的功能，用户可以通过键盘或鼠标点击来演奏简单的钢琴曲。

## 功能特点
- 键盘按键映射到钢琴音符
- 鼠标点击播放音效
- 可调整音量和音色
- 支持简单的音符录制和回放

## 使用方法

导入并初始化钢琴音效模块：

```javascript
import { pianoEffect } from '@/apps';

// 初始化钢琴音效
pianoEffect.init();

// 播放指定音符
pianoEffect.playNote('C4');

// 停止所有播放的音符
pianoEffect.stopAll();

// 调整音量
pianoEffect.setVolume(0.7); // 0.0 - 1.0
```

## 键盘映射
- A-Z键映射到不同音符
- 数字键可切换八度
- 空格键：停止所有音符

## 自定义配置
- `showKeyboard`: 是否显示虚拟键盘
- `octaveRange`: 音域范围
- `soundFont`: 音效字体选择