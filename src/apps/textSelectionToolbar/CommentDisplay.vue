<template>
    <div v-if="visible" class="comment-display-overlay" @click.self="handleClose">
      <div class="comment-display" :style="{ left: position.x + 'px', top: position.y + 'px' }">
        <div class="comment-display-header">
          <h4 class="comment-display-title">留言内容</h4>
          <button class="comment-display-close" type="button" aria-label="关闭留言内容" @click="handleClose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="comment-display-body">
          <div class="comment-original-text">
            <span class="label">原文</span>
            <p class="text">{{ comment.text }}</p>
          </div>
          
          <div class="comment-content">
            <span class="label">留言</span>
            <p class="text">{{ comment.comment }}</p>
          </div>
          
          <div class="comment-meta">
            <span class="timestamp">{{ formatTime(comment.timestamp) }}</span>
          </div>
        </div>
        
        <div class="comment-display-footer">
          <button class="btn btn-edit" type="button" @click="handleEdit">编辑</button>
          <button class="btn btn-close" type="button" @click="handleClose">关闭</button>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import type { Comment } from '@/services/commentStorage';

interface CommentDisplayProps {
  visible: boolean;
  comment: Comment;
  position: { x: number; y: number };
}

const props = defineProps<CommentDisplayProps>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit'): void;
}>();

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

const handleClose = () => {
  emit('close');
};

const handleEdit = () => {
  emit('edit');
};
</script>

<style scoped lang="scss">
.comment-display-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 9999998;
  cursor: default;
}

.comment-display {
  --display-primary: #0d9488;
  --display-primary-strong: #0f766e;
  --display-accent: #f97316;
  --display-text: #134e4a;
  --display-muted: #475569;
  --display-border: rgba(15, 118, 110, 0.18);

  position: fixed;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  width: 340px;
  max-width: calc(100vw - 24px);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.22), 0 4px 16px rgba(13, 148, 136, 0.12);
  border: 1px solid var(--display-border);
  overflow: hidden;
  z-index: 9999999;
  animation: popIn 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;
  color: var(--display-text);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.comment-display-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(15, 118, 110, 0.12);
  background: linear-gradient(180deg, #ffffff, #f0fdfa);
}

.comment-display-title {
  font-size: 14px;
  font-weight: 750;
  color: var(--display-text);
  margin: 0;
}

.comment-display-close {
  background: #ecfeff;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--display-muted);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.comment-display-close:hover {
  background: #fff7ed;
  border-color: rgba(249, 115, 22, 0.28);
  color: #c2410c;
}

.comment-display-close:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

.comment-display-body {
  padding: 16px;
}

.comment-original-text,
.comment-content {
  margin-bottom: 12px;
}

.label {
  font-size: 11px;
  font-weight: 700;
  color: var(--display-muted);
  display: block;
  margin-bottom: 4px;
}

.text {
  font-size: 13px;
  color: #0f172a;
  margin: 0;
  word-break: break-word;
  line-height: 1.5;
}

.comment-original-text .text {
  color: var(--display-muted);
  font-style: italic;
}

.comment-content .text {
  background: #f0fdfa;
  padding: 10px;
  border-radius: 8px;
  border-left: 3px solid var(--display-primary);
}

.comment-meta {
  padding-top: 8px;
  border-top: 1px solid rgba(15, 118, 110, 0.12);
}

.timestamp {
  font-size: 11px;
  color: var(--display-muted);
}

.comment-display-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(15, 118, 110, 0.12);
  background: #ffffff;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.btn-edit {
  background: var(--display-primary);
  color: #ffffff;
  box-shadow: 0 7px 16px rgba(13, 148, 136, 0.2);
}

.btn-edit:hover {
  background: var(--display-primary-strong);
  transform: translateY(-1px);
}

.btn-close {
  background: #f8fafc;
  border-color: rgba(15, 118, 110, 0.12);
  color: var(--display-muted);
}

.btn-close:hover {
  border-color: rgba(13, 148, 136, 0.22);
  color: var(--display-text);
}

.btn:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .comment-display,
  .comment-display-close,
  .btn {
    animation: none;
    transition: none;
  }
}
</style>
