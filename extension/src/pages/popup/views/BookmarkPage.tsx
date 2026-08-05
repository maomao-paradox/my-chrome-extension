/**
 * @author Zero
 * @version v2.0.0
 * @license MIT
 * @file src/pages/popup/views/BookmarkPage.tsx
 * @description React 版书签管理页面 - 管理片段笔记，快速回溯对应页面
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SearchOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  LinkOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import TableContainer from '../components/TableContainer';
import { Bookmark } from '@/types/components';
import { BookmarkStorage } from '@/services/bookmarkStorage';
import './bookmark-page.scss';

/**
 * 书签管理页面组件
 */
export const BookmarkPage: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bookmarkToDelete, setBookmarkToDelete] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterKeyword, setFilterKeyword] = useState('');

  /** 规范化的筛选关键词 */
  const normalizedFilterKeyword = useMemo(
    () => filterKeyword.trim().toLowerCase(),
    [filterKeyword],
  );

  /** 筛选后的书签列表 */
  const filteredBookmarks = useMemo(() => {
    const keyword = normalizedFilterKeyword;
    if (!keyword) return bookmarks;

    return bookmarks.filter((bookmark) => {
      const domain = getDomainLabel(bookmark.url);
      return [bookmark.text, bookmark.title || '', bookmark.url, domain].some(
        (value) => value.toLowerCase().includes(keyword),
      );
    });
  }, [bookmarks, normalizedFilterKeyword]);

  /** 筛选摘要文本 */
  const filterSummary = useMemo(() => {
    if (!normalizedFilterKeyword) {
      return `共 ${bookmarks.length} 个锚点`;
    }
    return `筛选结果 ${filteredBookmarks.length} / ${bookmarks.length}`;
  }, [normalizedFilterKeyword, bookmarks.length, filteredBookmarks.length]);

  /** 加载书签列表 */
  const loadBookmarks = useCallback(async (): Promise<void> => {
    try {
      const loadedBookmarks = await BookmarkStorage.getBookmarks();
      loadedBookmarks.sort((a, b) => b.timestamp - a.timestamp);
      setBookmarks(loadedBookmarks);
    } catch (error) {
      maLogger.error('加载锚点失败:', error);
    }
  }, []);

  /** 打开书签 */
  const openBookmark = useCallback((bookmark: Bookmark) => {
    if (!chrome.runtime) {
      console.warn('chrome.runtime is not available in this environment');
      return;
    }
    if (!bookmark.url) {
      console.warn('bookmark.url is not available');
      return;
    }
    chrome.runtime.sendMessage({
      type: 'OPEN_BOOKMARK',
      payload: bookmark,
      target: 'background',
    });
  }, []);

  /** 确认删除书签 */
  const confirmDelete = useCallback((id: string) => {
    setBookmarkToDelete(id);
    setShowDeleteConfirm(true);
  }, []);

  /** 删除书签 */
  const deleteBookmark = useCallback(async (): Promise<void> => {
    if (!bookmarkToDelete) return;

    try {
      await BookmarkStorage.deleteBookmark(bookmarkToDelete);
      await loadBookmarks();
      setShowDeleteConfirm(false);
    } catch (error) {
      maLogger.error('删除锚点失败:', error);
    }
  }, [bookmarkToDelete, loadBookmarks]);

  /** 导出书签 */
  const exportBookmarks = useCallback(async (): Promise<void> => {
    try {
      const bookmarksToExport = await BookmarkStorage.getBookmarks();
      const bookmarksData = JSON.stringify(bookmarksToExport, null, 2);
      const blob = new Blob([bookmarksData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      maLogger.error('导出锚点失败:', error);
    }
  }, []);

  /** 触发导入 */
  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 读取文件内容 */
  const readFileAsText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  /** 解析书签数据 */
  const parseBookmarks = useCallback((content: string): Bookmark[] => {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      throw new Error('无效的锚点数据格式');
    }
    return data as Bookmark[];
  }, []);

  /** 保存导入的书签 */
  const saveImportedBookmarks = useCallback(async (importedBookmarks: Bookmark[]): Promise<void> => {
    for (const item of importedBookmarks) {
      if (item.text && item.url) {
        await BookmarkStorage.saveBookmark({ ...item });
      }
    }
  }, []);

  /** 导入书签 */
  const importBookmarks = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const importedBookmarks = parseBookmarks(content);
      await saveImportedBookmarks(importedBookmarks);
      await loadBookmarks();
      if (event.target) event.target.value = '';
    } catch (error) {
      maLogger.error('导入锚点失败:', error);
    }
  }, [readFileAsText, parseBookmarks, saveImportedBookmarks, loadBookmarks]);

  /** 截断 URL */
  const truncateUrl = useCallback((url: string, maxLength: number = 40): string => {
    if (url.length <= maxLength) return url;
    return `${url.substring(0, maxLength)}...`;
  }, []);

  /** 获取域名标签 */
  const getDomainLabel = useCallback((url: string): string => {
    try {
      const { hostname } = new URL(url);
      return hostname || '未知站点';
    } catch {
      return '未知站点';
    }
  }, []);

  /** 格式化日期 */
  const formatDate = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }, []);

  /** 初始化加载书签 */
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  return (
    <TableContainer
      density="compact"
      sectionGap="8px"
      contentGap="8px"
      heroGap="8px"
      rightMaxWidth="88px"
      titleFontWeight="500"
      headLeft={
        <>
          <p className="section-kicker">Quick Access</p>
          <h2 className="section-title">锚点管理</h2>
          <p className="section-subtitle">
            已保存的片段会按时间倒序排列，支持本地导入与导出。
          </p>
        </>
      }
      headRight={<div className="section-badge">{bookmarks.length} 个</div>}
    >
      <section className="filter-panel">
        <label className="filter-panel-input-shell">
          <SearchOutlined className="filter-panel-icon" />
          <input
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            type="search"
            className="filter-panel-input"
            placeholder="筛选锚点文本、页面标题、链接或域名"
          />
          {filterKeyword && (
            <button
              type="button"
              className="filter-panel-clear"
              title="清空筛选"
              onClick={() => setFilterKeyword('')}
            >
              <CloseOutlined />
            </button>
          )}
        </label>
        <div className="filter-meta">{filterSummary}</div>
        <div className="section-actions" aria-label="锚点数据操作">
          <button
            className="toolbar-btn toolbar-btn--export"
            title="导出锚点"
            aria-label="导出锚点"
            onClick={exportBookmarks}
          >
            <ExportOutlined />
          </button>
          <button
            className="toolbar-btn toolbar-btn--import"
            title="导入锚点"
            aria-label="导入锚点"
            onClick={triggerImport}
          >
            <ImportOutlined />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            accept=".json"
            onChange={importBookmarks}
          />
        </div>
      </section>

      <div className="bookmark-list">
        {bookmarks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <PushpinOutlined />
            </div>
            <p className="empty-title">还没有保存锚点</p>
            <p className="empty-hint">
              选中文本后点击页面工具栏中的锚点按钮，即可在这里回看。
            </p>
          </div>
        )}

        {bookmarks.length > 0 && filteredBookmarks.length === 0 && (
          <div className="empty-state empty-state--filtered">
            <div className="empty-icon">
              <SearchOutlined />
            </div>
            <p className="empty-title">没有找到匹配的锚点</p>
            <p className="empty-hint">换个关键词试试，或清空筛选条件查看全部锚点。</p>
          </div>
        )}

        {filteredBookmarks.map((bookmark) => (
          <article key={bookmark.id} className="bookmark-item">
            <div className="bookmark-text" title={bookmark.text}>
              {bookmark.text}
            </div>

            <div className="bookmark-meta-row">
              <div className="bookmark-meta">
                <div className="bookmark-title" title={bookmark.title || '未命名页面'}>
                  {bookmark.title || '未命名页面'}
                </div>
                <div className="bookmark-url" title={bookmark.url}>
                  {truncateUrl(bookmark.url)}
                </div>
              </div>

              <div className="bookmark-actions">
                <button
                  className="icon-btn icon-btn--open"
                  title="打开锚点"
                  onClick={() => openBookmark(bookmark)}
                >
                  <LinkOutlined />
                </button>
                <button
                  className="icon-btn icon-btn--delete"
                  title="删除锚点"
                  onClick={() => confirmDelete(bookmark.id)}
                >
                  <DeleteOutlined />
                </button>
              </div>
            </div>

            <div className="bookmark-footer">
              <span className="bookmark-domain">{getDomainLabel(bookmark.url)}</span>
              <span className="bookmark-date">{formatDate(bookmark.timestamp)}</span>
            </div>
          </article>
        ))}
      </div>

      {showDeleteConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-dialog-content">
            <div className="confirm-dialog-badge">Delete Anchor</div>
            <h3>确认删除这个锚点？</h3>
            <p>删除后无法恢复，但不会影响原页面内容。</p>
            <div className="confirm-dialog-actions">
              <button
                className="dialog-btn dialog-btn--ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                取消
              </button>
              <button
                className="dialog-btn dialog-btn--danger"
                onClick={deleteBookmark}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </TableContainer>
  );
};

export default BookmarkPage;
