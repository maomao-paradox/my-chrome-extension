/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/components/TableContainer.tsx
 * @description React 版表格容器组件 - 提供统一的布局容器
 */
import React from 'react';
import './table-container.scss';

export interface TableContainerProps {
  /** 密度模式 */
  density?: 'default' | 'compact';
  /** 区块间距 */
  sectionGap?: string;
  /** 内容间距 */
  contentGap?: string;
  /** 标题区域间距 */
  heroGap?: string;
  /** 右侧最大宽度 */
  rightMaxWidth?: string;
  /** 标题字体大小 */
  titleFontSize?: string;
  /** 标题字体粗细 */
  titleFontWeight?: string | number;
  /** 正文字体大小 */
  textFontSize?: string;
  /** 左侧头部内容 */
  headLeft?: React.ReactNode;
  /** 右侧头部内容 */
  headRight?: React.ReactNode;
  /** 默认插槽内容 */
  children?: React.ReactNode;
}

/**
 * 表格容器组件
 * 提供统一的页面布局结构
 */
export const TableContainer: React.FC<TableContainerProps> = ({
  density = 'default',
  sectionGap = '14px',
  contentGap = '14px',
  heroGap = '12px',
  rightMaxWidth = '50%',
  titleFontSize = '16px',
  titleFontWeight = 500,
  textFontSize = '12px',
  headLeft,
  headRight,
  children,
}) => {
  /** CSS 变量样式 */
  const containerStyle: React.CSSProperties = {
    '--table-section-gap': sectionGap,
    '--table-content-gap': contentGap,
    '--table-hero-gap': heroGap,
    '--table-right-max-width': rightMaxWidth,
    '--table-title-font-size': titleFontSize,
    '--table-title-font-weight': String(titleFontWeight),
    '--table-text-font-size': textFontSize,
  } as React.CSSProperties;

  return (
    <div
      className={`section-container section-container--${density}`}
      style={containerStyle}
    >
      <section className="section-hero">
        <div className="section-hero__left">{headLeft}</div>
        <div className="section-hero__right">{headRight}</div>
      </section>

      <section className="section-content">{children}</section>
    </div>
  );
};

export default TableContainer;
