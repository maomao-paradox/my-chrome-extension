<template>
  <TableContainer>
    <template #head__left>
      <p class="section-kicker">Quick Access</p>
      <h2 class="section-title">书签管理</h2>
      <p class="section-subtitle">已保存的片段会按时间倒序排列，支持本地导入与导出。</p>
    </template>
    <template #head__right>
      <div class="section-badge">{{ bookmarks.length }} 条</div>
    </template>
    <template #default>
      <section class="filter-panel">
        <label class="filter-input-shell">
          <span class="filter-icon">
            <IconSearch />
          </span>
          <input v-model.trim="filterKeyword" type="search" class="filter-input" placeholder="筛选书签文本、页面标题、链接或域名" />
          <button v-if="filterKeyword" type="button" class="filter-clear" @click="filterKeyword = ''">
            清空
          </button>
        </label>
        <div class="section-actions">
          <button class="toolbar-btn toolbar-btn--export" @click="exportBookmarks" title="导出书签">
            <IconDownload />
            <span>导出</span>
          </button>
          <button class="toolbar-btn toolbar-btn--import" @click="triggerImport" title="导入书签">
            <IconUpload />
            <span>导入</span>
          </button>
          <input type="file" ref="fileInput" class="visually-hidden" accept=".json" @change="importBookmarks" />
          <div class="filter-meta">
            {{ filterSummary }}
          </div>
        </div>
      </section>

      <div class="bookmark-list">
        <div v-if="bookmarks.length === 0" class="empty-state">
          <div class="empty-icon">
            <IconBookmark />
          </div>
          <p class="empty-title">还没有保存书签</p>
          <p class="empty-hint">选中文本后点击页面工具栏中的书签按钮，即可在这里回看。</p>
        </div>

        <div v-else-if="filteredBookmarks.length === 0" class="empty-state empty-state--filtered">
          <div class="empty-icon">
            <IconSearch />
          </div>
          <p class="empty-title">没有找到匹配的书签</p>
          <p class="empty-hint">换个关键词试试，或清空筛选条件查看全部书签。</p>
        </div>

        <article v-for="bookmark in filteredBookmarks" :key="bookmark.id" class="bookmark-item">
          <div class="bookmark-text" :title="bookmark.text">{{ bookmark.text }}</div>

          <div class="bookmark-meta-row">
            <div class="bookmark-meta">
              <div class="bookmark-title" :title="bookmark.title || '未命名页面'">
                {{ bookmark.title || '未命名页面' }}
              </div>
              <div class="bookmark-url" :title="bookmark.url">{{ truncateUrl(bookmark.url) }}</div>
            </div>

            <div class="bookmark-actions">
              <button class="icon-btn icon-btn--open" @click="openBookmark(bookmark)" title="打开书签">
                <IconOpen />
              </button>
              <button class="icon-btn icon-btn--delete" @click="confirmDelete(bookmark.id)" title="删除书签">
                <IconDelete />
              </button>
            </div>
          </div>

          <div class="bookmark-footer">
            <span class="bookmark-domain">{{ getDomainLabel(bookmark.url) }}</span>
            <span class="bookmark-date">{{ formatDate(bookmark.timestamp) }}</span>
          </div>
        </article>
      </div>

      <div v-if="showDeleteConfirm" class="confirm-dialog">
        <div class="confirm-content">
          <div class="confirm-badge">Delete Bookmark</div>
          <h3>确认删除这个书签？</h3>
          <p>删除后无法恢复，但不会影响原页面内容。</p>
          <div class="confirm-actions">
            <button class="dialog-btn dialog-btn--ghost" @click="showDeleteConfirm = false">取消</button>
            <button class="dialog-btn dialog-btn--danger" @click="deleteBookmark">删除</button>
          </div>
        </div>
      </div>
    </template>
  </TableContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Bookmark } from '@/assets/types/components';
import { BookmarkStorage } from '@/services/bookmarkStorage';
import { IconDelete, IconOpen, IconBookmark, IconUpload, IconDownload, IconSearch } from '@icons/index';
import TableContainer from './TableContainer.vue';

const bookmarks = ref<Bookmark[]>([]);
const showDeleteConfirm = ref(false);
const bookmarkToDelete = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null);
const filterKeyword = ref('');

const normalizedFilterKeyword = computed(() => filterKeyword.value.trim().toLowerCase());
const filteredBookmarks = computed(() => {
  const keyword = normalizedFilterKeyword.value;

  if (!keyword) {
    return bookmarks.value;
  }

  return bookmarks.value.filter((bookmark) => {
    const domain = getDomainLabel(bookmark.url);
    return [
      bookmark.text,
      bookmark.title || '',
      bookmark.url,
      domain,
    ].some((value) => value.toLowerCase().includes(keyword));
  });
});
const filterSummary = computed(() => {
  if (!normalizedFilterKeyword.value) {
    return `共 ${bookmarks.value.length} 条书签`;
  }

  return `筛选结果 ${filteredBookmarks.value.length} / ${bookmarks.value.length}`;
});

const loadBookmarks = async () => {
  try {
    const loadedBookmarks = await BookmarkStorage.getBookmarks();
    loadedBookmarks.sort((a, b) => b.timestamp - a.timestamp);
    bookmarks.value = loadedBookmarks;
  } catch (error) {
    maLogger.error('加载书签失败:', error);
  }
};

const openBookmark = (bookmark: Bookmark) => {
  chrome.runtime.sendMessage({ type: 'OPEN_BOOKMARK', payload: bookmark, target: 'background' });
};

const confirmDelete = (id: string) => {
  bookmarkToDelete.value = id;
  showDeleteConfirm.value = true;
};

const deleteBookmark = async () => {
  if (!bookmarkToDelete.value) return;

  try {
    await BookmarkStorage.deleteBookmark(bookmarkToDelete.value);
    await loadBookmarks();
    showDeleteConfirm.value = false;
  } catch (error) {
    maLogger.error('删除书签失败:', error);
  }
};

const exportBookmarks = async () => {
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
    maLogger.error('导出书签失败:', error);
  }
};

const triggerImport = () => {
  fileInput.value?.click();
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const parseBookmarks = (content: string): Bookmark[] => {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) {
    throw new Error('无效的书签数据格式');
  }
  return data as Bookmark[];
};

const saveImportedBookmarks = async (bookmarks: Bookmark[]): Promise<void> => {
  for (const item of bookmarks) {
    if (item.text && item.url) {
      await BookmarkStorage.saveBookmark({
        ...item
      });
    }
  }
};

const importBookmarks = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const content = await readFileAsText(file);
    const importedBookmarks = parseBookmarks(content);
    await saveImportedBookmarks(importedBookmarks);
    await loadBookmarks();
    target.value = '';
  } catch (error) {
    maLogger.error('导入书签失败:', error);
  }
};

const truncateUrl = (url: string, maxLength: number = 40) => {
  if (url.length <= maxLength) return url;
  return `${url.substring(0, maxLength)}...`;
};

const getDomainLabel = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return hostname || '未知站点';
  } catch {
    return '未知站点';
  }
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

onMounted(() => {
  loadBookmarks();
});
</script>

<style scoped>
.section-kicker {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--popup-accent);
}

.section-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--popup-text-primary);
}

.section-subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--popup-text-muted);
}

.section-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--popup-text-primary);
  background: var(--popup-accent-gradient);
  border: 1px solid var(--popup-border-strong);
}

.section-actions {
  display: flex;
  gap: inherit;
  width: auto;
}

.filter-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-input-shell {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid var(--popup-border);
  background: var(--popup-card-bg);
  box-shadow:
    var(--popup-shadow-soft),
    var(--popup-inset-highlight);
}

.filter-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--popup-accent);
}

.filter-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.filter-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--popup-text-primary);
  font-size: 13px;
  outline: none;
}

.filter-input::placeholder {
  color: var(--popup-text-subtle);
}

.filter-clear {
  flex-shrink: 0;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--popup-border);
  border-radius: 999px;
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.filter-clear:hover {
  transform: translateY(-1px);
  border-color: var(--popup-border-strong);
  background: var(--popup-control-hover-bg);
}

.filter-meta {
  position: relative;
  left: 96px;
  padding-bottom: 7px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--popup-text-muted);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 14px;
  border: 1px solid var(--popup-border);
  border-radius: 14px;
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.toolbar-btn:hover {
  transform: translateY(-1px);
  background: var(--popup-control-hover-bg);
}

.toolbar-btn--export:hover {
  border-color: var(--popup-success-border);
  color: var(--popup-success-text);
}

.toolbar-btn--import:hover {
  border-color: var(--popup-border-strong);
  color: var(--popup-accent);
}

.visually-hidden {
  display: none;
}

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  border-radius: 22px;
  border: 1px dashed var(--popup-border);
  background: var(--popup-card-bg-muted);
  text-align: center;
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  border-radius: 20px;
  color: var(--popup-accent);
  background: var(--popup-accent-gradient);
  box-shadow: var(--popup-inset-highlight);
}

.empty-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--popup-text-primary);
}

.empty-hint {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--popup-text-muted);
}

.empty-state--filtered .empty-icon {
  color: var(--popup-accent);
  background: var(--popup-accent-gradient);
}

.bookmark-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  background: var(--popup-card-bg);
  border: 1px solid var(--popup-border);
  box-shadow:
    var(--popup-shadow-soft),
    var(--popup-inset-highlight);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.bookmark-item::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: 20px 0 0 20px;
  background: var(--popup-accent-line-gradient);
  opacity: 0.9;
}

.bookmark-item:hover {
  transform: translateY(-1px);
  border-color: var(--popup-border-strong);
  box-shadow:
    var(--popup-shadow-panel),
    var(--popup-inset-highlight);
}

.bookmark-text {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.6;
  color: var(--popup-text-primary);
  word-break: break-word;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.bookmark-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.bookmark-meta {
  min-width: 0;
  flex: 1;
}

.bookmark-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--popup-text-secondary);
}

.bookmark-url {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--popup-text-subtle);
}

.bookmark-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--popup-border);
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.icon-btn:hover {
  transform: translateY(-1px);
  background: var(--popup-control-hover-bg);
}

.icon-btn--open:hover {
  color: var(--popup-accent);
  border-color: var(--popup-border-strong);
}

.icon-btn--delete:hover {
  color: var(--popup-danger-strong);
  border-color: var(--popup-danger-border);
}

.bookmark-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.bookmark-domain,
.bookmark-date {
  font-size: 12px;
  color: var(--popup-text-subtle);
}

.bookmark-domain {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--popup-control-bg);
}

.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--popup-bg-primary) 72%, transparent);
  backdrop-filter: blur(8px);
}

.confirm-content {
  width: min(100%, 320px);
  padding: 22px;
  border-radius: 22px;
  border: 1px solid var(--popup-danger-border);
  background: var(--popup-dialog-bg);
  box-shadow: var(--popup-shadow-strong);
}

.confirm-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--popup-danger-border);
  background: var(--popup-danger-bg);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--popup-danger-text);
}

.confirm-content h3 {
  margin: 16px 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: var(--popup-danger-text);
}

.confirm-content p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--popup-text-muted);
}

.confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.dialog-btn {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid var(--popup-border);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.dialog-btn:hover {
  transform: translateY(-1px);
}

.dialog-btn--ghost {
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
}

.dialog-btn--ghost:hover {
  border-color: var(--popup-border-strong);
  background: var(--popup-control-hover-bg);
}

.dialog-btn--danger {
  background: var(--popup-danger-button-bg);
  color: var(--popup-text-on-accent);
  border-color: var(--popup-danger-border);
}

.dialog-btn--danger:hover {
  border-color: var(--popup-danger-border);
  box-shadow: var(--popup-shadow-accent);
}

@media (max-width: 640px) {
  .filter-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-meta {
    align-self: flex-end;
  }
}
</style>
