<template>
  <TableContainer density="compact" section-gap="8px" content-gap="8px" hero-gap="8px" right-max-width="88px"
    title-font-weight="500">
    <template #head__left>
      <p class="section-kicker">Quick Access</p>
      <h2 class="section-title">锚点管理</h2>
      <p class="section-subtitle">已保存的片段会按时间倒序排列，支持本地导入与导出。</p>
    </template>
    <template #head__right>
      <div class="section-badge">{{ bookmarks.length }} 个</div>
    </template>
    <template #default>
      <section class="filter-panel">
        <label class="filter-panel-input-shell">
          <IconSearch class="filter-panel-icon" />
          <input v-model.trim="filterKeyword" type="search" class="filter-panel-input"
            placeholder="筛选锚点文本、页面标题、链接或域名" />
          <button v-if="filterKeyword" type="button" class="filter-panel-clear" title="清空筛选"
            @click="filterKeyword = ''">
            <IconClose />
          </button>
        </label>
        <div class="filter-meta">
          {{ filterSummary }}
        </div>
        <div class="section-actions" aria-label="锚点数据操作">
          <button class="toolbar-btn toolbar-btn--export" title="导出锚点" aria-label="导出锚点" @click="exportBookmarks">
            <IconDownload />
          </button>
          <button class="toolbar-btn toolbar-btn--import" title="导入锚点" aria-label="导入锚点" @click="triggerImport">
            <IconUpload />
          </button>
          <input ref="fileInput" type="file" class="visually-hidden" accept=".json" @change="importBookmarks" />
        </div>
      </section>

      <div class="bookmark-list">
        <div v-if="bookmarks.length === 0" class="empty-state">
          <div class="empty-icon">
            <IconBookmark />
          </div>
          <p class="empty-title">还没有保存锚点</p>
          <p class="empty-hint">选中文本后点击页面工具栏中的锚点按钮，即可在这里回看。</p>
        </div>

        <div v-else-if="filteredBookmarks.length === 0" class="empty-state empty-state--filtered">
          <div class="empty-icon">
            <IconSearch />
          </div>
          <p class="empty-title">没有找到匹配的锚点</p>
          <p class="empty-hint">换个关键词试试，或清空筛选条件查看全部锚点。</p>
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
              <button class="icon-btn icon-btn--open" title="打开锚点" @click="openBookmark(bookmark)">
                <IconOpen />
              </button>
              <button class="icon-btn icon-btn--delete" title="删除锚点" @click="confirmDelete(bookmark.id)">
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
        <div class="confirm-dialog-content">
          <div class="confirm-dialog-badge">Delete Anchor</div>
          <h3>确认删除这个锚点？</h3>
          <p>删除后无法恢复，但不会影响原页面内容。</p>
          <div class="confirm-dialog-actions">
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
import { Bookmark } from '@/types/components/index.js';
import { BookmarkStorage } from '@/services/bookmarkStorage';
import { IconDelete, IconOpen, IconBookmark, IconUpload, IconDownload, IconSearch, IconClose } from '@icons/index';
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
      domain
    ].some((value) => value.toLowerCase().includes(keyword));
  });
});
const filterSummary = computed(() => {
  if (!normalizedFilterKeyword.value) {
    return `共 ${bookmarks.value.length} 个锚点`;
  }

  return `筛选结果 ${filteredBookmarks.value.length} / ${bookmarks.value.length}`;
});

const loadBookmarks = async () => {
  try {
    const loadedBookmarks = await BookmarkStorage.getBookmarks();
    loadedBookmarks.sort((a, b) => b.timestamp - a.timestamp);
    bookmarks.value = loadedBookmarks;
  } catch (error) {
    maLogger.error('加载锚点失败:', error);
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
  if (!bookmarkToDelete.value) {return;}

  try {
    await BookmarkStorage.deleteBookmark(bookmarkToDelete.value);
    await loadBookmarks();
    showDeleteConfirm.value = false;
  } catch (error) {
    maLogger.error('删除锚点失败:', error);
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
    maLogger.error('导出锚点失败:', error);
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
    throw new Error('无效的锚点数据格式');
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
  if (!file) {return;}

  try {
    const content = await readFileAsText(file);
    const importedBookmarks = parseBookmarks(content);
    await saveImportedBookmarks(importedBookmarks);
    await loadBookmarks();
    target.value = '';
  } catch (error) {
    maLogger.error('导入锚点失败:', error);
  }
};

const truncateUrl = (url: string, maxLength: number = 40) => {
  if (url.length <= maxLength) {return url;}
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

<style lang="scss" scoped>
$transition-base: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;

@mixin flex-center {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@mixin button-base($padding: 0 10px, $border-radius: 12px) {
  min-height: 30px;
  padding: $padding;
  border: 1px solid var(--popup-border);
  border-radius: $border-radius;
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: $transition-base, color 0.2s ease;
}

@mixin hover-lift {
  &:hover {
    transform: translateY(-1px);
    background: var(--popup-control-hover-bg);
  }
}

.section-kicker {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--popup-accent);
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--popup-text-primary);
}

.section-subtitle {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--popup-text-muted);
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.section-badge {
  flex-shrink: 0;
  @include flex-center;
  min-width: 52px;
  min-height: 30px;
  padding: 0 9px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--popup-text-primary);
  background: var(--popup-accent-gradient);
  border: 1px solid var(--popup-border-strong);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.filter-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 7px;
  padding: 8px;
  border-radius: 15px;
  border: 1px solid var(--popup-border);
  background: var(--popup-panel-bg);
  box-shadow: var(--popup-shadow-soft), var(--popup-inset-highlight);

  &-input-shell {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 0 9px;
    border-radius: 11px;
    border: 1px solid var(--popup-border-muted);
    background: var(--popup-control-bg);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

    &:focus-within {
      border-color: var(--popup-border-strong);
      background: var(--popup-control-bg-strong);
    }
  }

  &-icon {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    @include flex-center;
    color: var(--popup-accent);
  }

  &-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--popup-text-primary);
    font-size: 12px;
    line-height: 1;
    outline: none;

    &::placeholder {
      color: var(--popup-text-subtle);
    }
  }

  &-clear {
    flex-shrink: 0;
    @include flex-center;
    width: 22px;
    height: 22px;
    min-height: 22px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--popup-text-subtle);
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;

    &:hover {
      background: var(--popup-control-hover-bg);
      color: var(--popup-text-primary);
    }

    :deep(svg) {
      width: 12px;
      height: 12px;
    }
  }

  &-meta {
    flex-shrink: 0;
    max-width: 88px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--popup-text-muted);
    white-space: nowrap;
  }
}

.toolbar-btn {
  @include flex-center;
  width: 32px;
  height: 32px;
  padding: 0;
  @include button-base(0, 11px);

  >svg {
    width: 15px;
    height: 15px;
  }

  @include hover-lift;

  &--export {
    &:hover {
      border-color: var(--popup-success-border);
      color: var(--popup-success-text);
    }
  }

  &--import {
    &:hover {
      border-color: var(--popup-border-strong);
      color: var(--popup-accent);
    }
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.bookmark {
  &-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &-item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 10px 10px 10px 12px;
    border-radius: 15px;
    background: var(--popup-card-bg);
    border: 1px solid var(--popup-border);
    box-shadow: var(--popup-shadow-soft), var(--popup-inset-highlight);
    transition: $transition-base, box-shadow 0.2s ease;

    &::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      border-radius: 15px 0 0 15px;
      background: var(--popup-accent-line-gradient);
      opacity: 0.9;
    }

    &:hover {
      transform: translateY(-1px);
      border-color: var(--popup-border-strong);
      box-shadow: var(--popup-shadow-panel), var(--popup-inset-highlight);
    }
  }

  &-text {
    display: -webkit-box;
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.42;
    color: var(--popup-text-primary);
    word-break: break-word;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  &-meta {
    min-width: 0;
    flex: 1;
  }

  &-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 700;
    color: var(--popup-text-secondary);
  }

  &-url {
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    color: var(--popup-text-subtle);
  }

  &-actions {
    display: flex;
    gap: 6px;
  }

  &-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  &-domain,
  &-date {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    line-height: 1.2;
    color: var(--popup-text-subtle);
    white-space: nowrap;
  }

  &-domain {
    @include flex-center;
    max-width: 55%;
    min-height: 20px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--popup-control-bg);
  }

  &-date {
    flex-shrink: 0;
  }

  &-comments {
    padding: 12px;
    border-radius: 12px;
    background: var(--popup-card-bg-muted);
    margin-top: 8px;
  }

  &-comment-input {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    padding: 8px;
    border-radius: 12px;
    background: var(--popup-control-bg);
  }
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--popup-text-muted);
}

.comments-icon {
  width: 16px;
  height: 16px;
}

.comments-count {
  font-size: 12px;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-item {
  padding: 10px;
  border-radius: 10px;
  background: var(--popup-control-bg);
}

.comment-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--popup-text-secondary);
  word-break: break-word;
}

.comment-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.comment-date {
  font-size: 11px;
  color: var(--popup-text-subtle);
}

.comment-delete {
  @include flex-center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--popup-text-subtle);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease, color 0.2s ease;

  &:hover {
    opacity: 1;
    color: var(--popup-danger-strong);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.comment-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--popup-border);
  border-radius: 10px;
  background: var(--popup-card-bg);
  color: var(--popup-text-primary);
  font-size: 13px;
  outline: none;

  &::placeholder {
    color: var(--popup-text-subtle);
  }
}

.comment-submit {
  @include flex-center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: var(--popup-button-bg);
  color: var(--popup-text-on-accent);
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 18px;
  border-radius: 15px;
  border: 1px dashed var(--popup-border);
  background: var(--popup-card-bg-muted);
  text-align: center;

  &--filtered {
    .empty-icon {
      color: var(--popup-accent);
      background: var(--popup-accent-gradient);
    }
  }

  &-icon {
    @include flex-center;
    width: 46px;
    height: 46px;
    margin-bottom: 12px;
    border-radius: 15px;
    color: var(--popup-accent);
    background: var(--popup-accent-gradient);
    box-shadow: var(--popup-inset-highlight);

    :deep(svg) {
      width: 19px;
      height: 19px;
    }
  }

  &-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--popup-text-primary);
  }

  &-hint {
    margin: 7px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--popup-text-muted);
  }
}

.icon-btn {
  @include flex-center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--popup-border-muted);
  border-radius: 10px;
  background: var(--popup-control-bg);
  color: var(--popup-text-secondary);
  cursor: pointer;
  transition: $transition-base, color 0.2s ease;

  >svg {
    width: 14px;
    height: 14px;
  }

  @include hover-lift;

  &--open {
    &:hover {
      color: var(--popup-accent);
      border-color: var(--popup-border-strong);
    }
  }

  &--delete {
    &:hover {
      color: var(--popup-danger-strong);
      border-color: var(--popup-danger-border);
    }
  }
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

  &-content {
    width: min(100%, 292px);
    padding: 18px;
    border-radius: 18px;
    border: 1px solid var(--popup-danger-border);
    background: var(--popup-dialog-bg);
    box-shadow: var(--popup-shadow-strong);

    h3 {
      margin: 14px 0 8px;
      font-size: 17px;
      font-weight: 700;
      color: var(--popup-danger-text);
    }

    p {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--popup-text-muted);
    }
  }

  &-badge {
    @include flex-center;
    width: fit-content;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--popup-danger-border);
    background: var(--popup-danger-bg);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--popup-danger-text);
  }

  &-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }
}


.dialog-btn {
  min-height: 36px;
  border-radius: 12px;
  border: 1px solid var(--popup-border);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: $transition-base;

  &:hover {
    transform: translateY(-1px);
  }

  &--ghost {
    background: var(--popup-control-bg);
    color: var(--popup-text-secondary);

    &:hover {
      border-color: var(--popup-border-strong);
      background: var(--popup-control-hover-bg);
    }
  }

  &--danger {
    background: var(--popup-danger-button-bg);
    color: var(--popup-text-on-accent);
    border-color: var(--popup-danger-border);

    &:hover {
      border-color: var(--popup-danger-border);
      box-shadow: var(--popup-shadow-accent);
    }
  }
}

.toolbar-btn:focus-visible,
.icon-btn:focus-visible,
.dialog-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--popup-focus-ring);
}

@media (max-width: 360px) {
  .filter-panel {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .filter-meta {
    grid-column: 1 / -1;
    grid-row: 2;
    max-width: none;
  }
}
</style>
