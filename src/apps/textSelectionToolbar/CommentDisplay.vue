<template>
    <div v-if="visible" class="comment-display-overlay" @click.self="handleClose">
      <div class="comment-display" :style="{ left: position.x + 'px', top: position.y + 'px' }">
        <div class="comment-display-header">
          <h4 class="comment-display-title">留言内容</h4>
          <button class="comment-display-close" @click="handleClose">
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
          <button class="btn btn-edit" @click="handleEdit">编辑</button>
          <button class="btn btn-close" @click="handleClose">关闭</button>
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

<style scoped>
.comment-display-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 9999998;
  cursor: default;
}

.comment-display {
  position: fixed;
  background: #1e232e;
  border-radius: 12px;
  width: 340px;
  max-width: 90vw;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  z-index: 9999999;
  animation: popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.comment-display-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
}

.comment-display-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.comment-display-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
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
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 4px;
}

.text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  word-break: break-word;
  line-height: 1.5;
}

.comment-original-text .text {
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.comment-content .text {
  background: rgba(99, 102, 241, 0.1);
  padding: 10px;
  border-radius: 8px;
  border-left: 3px solid #6366f1;
}

.comment-meta {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.comment-display-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-edit {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.btn-edit:hover {
  background: rgba(99, 102, 241, 0.3);
}

.btn-close {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>