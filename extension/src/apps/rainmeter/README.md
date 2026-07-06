# 雨滴模块

该模块提供类似Rainmeter的桌面美化和信息展示功能，可以在浏览器页面上显示各种系统信息和自定义小部件。

## 功能特点
- 系统资源监控（CPU、内存、网络）
- 时间和日期显示
- 天气预报信息
- 自定义小部件和布局
- 支持主题切换

## 目录结构
- `api/`: 与外部服务交互的接口
- `css/`: 样式文件
- `js/`: JavaScript功能实现
- `font/`: 字体文件

## 使用方法

导入并初始化雨滴模块：

```javascript
import { rainmeter } from '@/apps';

// 初始化雨滴
rainmeter.init({
  position: 'bottom-right', // 显示位置
  theme: 'dark',           // 主题选择
  widgets: ['clock', 'system', 'weather'] // 启用的小部件
});

// 显示/隐藏雨滴面板
rainmeter.toggleVisibility();

// 更新特定小部件
rainmeter.updateWidget('weather', { location: 'Beijing' });
```

## 支持的小部件
- `clock`: 时钟和日期显示
- `system`: 系统资源监控
- `weather`: 天气预报信息
- `notes`: 便签功能
- `calendar`: 日历视图

## 自定义样式
可以通过修改`css/`目录下的文件来自定义外观和样式。