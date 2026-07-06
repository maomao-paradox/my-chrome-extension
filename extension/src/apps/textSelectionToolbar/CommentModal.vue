<template>
    <div v-if="visible" class="comment-modal-overlay" @click.self="handleClose">
      <div class="comment-modal">
        <div class="comment-modal-header">
          <h3 class="comment-modal-title">{{ isEdit ? '编辑留言' : '添加留言' }}</h3>
          <button class="comment-modal-close" type="button" aria-label="关闭留言弹窗" @click="handleClose">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="comment-modal-body">
          <div class="comment-selected-text">
            <span class="label">选中文本</span>
            <p class="text-content">{{ selectedText }}</p>
          </div>
          
          <div class="comment-input-group">
            <label class="label" for="comment-modal-textarea">留言内容</label>
            <textarea 
              id="comment-modal-textarea"
              v-model="commentContent" 
              class="comment-textarea" 
              placeholder="请输入留言内容..."
              rows="4"
              maxlength="500"
            ></textarea>
            <span class="char-count">{{ commentContent.length }}/500</span>
          </div>
        </div>
        
        <div class="comment-modal-footer">
          <button v-if="isEdit" class="btn btn-danger" type="button" @click="handleDelete">删除留言</button>
          <button class="btn btn-secondary" type="button" @click="handleClose">取消</button>
          <button class="btn btn-primary" type="button" :disabled="!commentContent.trim()" @click="handleSave">
            {{ isEdit ? '保存修改' : '添加留言' }}
          </button>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface CommentModalProps {
  visible: boolean;
  selectedText: string;
  commentId?: string;
  existingComment?: string;
}

const props = withDefaults(defineProps<CommentModalProps>(), {
  commentId: '',
  existingComment: ''
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: { text: string; comment: string; commentId?: string }): void;
  (e: 'delete', commentId: string): void;
}>();

const commentContent = ref('');
const isEdit = ref(false);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.existingComment && props.commentId) {
      commentContent.value = props.existingComment;
      isEdit.value = true;
    } else {
      commentContent.value = '';
      isEdit.value = false;
    }
  }
});

const handleClose = () => {
  emit('close');
};

const handleSave = () => {
  if (!commentContent.value.trim()) return;
  
  emit('save', {
    text: props.selectedText,
    comment: commentContent.value.trim(),
    commentId: props.commentId
  });
};

const handleDelete = () => {
  if (props.commentId) {
    emit('delete', props.commentId);
  }
};
</script>

<style scoped lang="scss">
.comment-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.comment-modal {
  --comment-primary: #0d9488;
  --comment-primary-strong: #0f766e;
  --comment-accent: #f97316;
  --comment-text: #134e4a;
  --comment-muted: #475569;
  --comment-border: rgba(15, 118, 110, 0.18);

  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.26), 0 4px 18px rgba(13, 148, 136, 0.12);
  border: 1px solid var(--comment-border);
  overflow: hidden;
  animation: slideUp 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", Arial, sans-serif;
  color: var(--comment-text);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.comment-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(15, 118, 110, 0.12);
  background: linear-gradient(180deg, #ffffff, #f0fdfa);
}

.comment-modal-title {
  font-size: 16px;
  font-weight: 750;
  color: var(--comment-text);
  margin: 0;
}

.comment-modal-close {
  background: #ecfeff;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--comment-muted);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.comment-modal-close:hover {
  background: #fff7ed;
  border-color: rgba(249, 115, 22, 0.28);
  color: #c2410c;
}

.comment-modal-close:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

.comment-modal-body {
  padding: 20px;
}

.comment-selected-text {
  margin-bottom: 20px;
}

.comment-input-group {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 12px;
  font-weight: 700;
  color: var(--comment-muted);
  margin-bottom: 8px;
  display: block;
}

.text-content {
  background: #f8fafc;
  border: 1px solid rgba(15, 118, 110, 0.14);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #0f172a;
  margin: 0;
  word-break: break-word;
  max-height: 100px;
  overflow-y: auto;
}

.comment-textarea {
  background: #ffffff;
  border: 1px solid rgba(15, 118, 110, 0.18);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #0f172a;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.comment-textarea:focus {
  outline: none;
  border-color: var(--comment-primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.14);
}

.comment-textarea::placeholder {
  color: #94a3b8;
}

.char-count {
  font-size: 12px;
  color: var(--comment-muted);
  margin-top: 6px;
  text-align: right;
}

.comment-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(15, 118, 110, 0.12);
  background: #ffffff;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.btn-secondary {
  background: #f8fafc;
  border-color: rgba(15, 118, 110, 0.12);
  color: var(--comment-muted);
}

.btn-secondary:hover {
  border-color: rgba(13, 148, 136, 0.22);
  color: var(--comment-text);
}

.btn-primary {
  background: var(--comment-primary);
  color: white;
  box-shadow: 0 8px 18px rgba(13, 148, 136, 0.22);
}

.btn-primary:hover:not(:disabled) {
  background: var(--comment-primary-strong);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(13, 148, 136, 0.28);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-danger {
  background: #fef2f2;
  border-color: rgba(220, 38, 38, 0.18);
  color: #b91c1c;
  margin-right: auto;
}

.btn-danger:hover {
  background: #fee2e2;
  border-color: rgba(220, 38, 38, 0.28);
}

.btn:focus-visible {
  outline: 2px solid rgba(249, 115, 22, 0.8);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .comment-modal-footer {
    flex-wrap: wrap;
  }

  .btn {
    flex: 1 1 auto;
  }

  .btn-danger {
    flex-basis: 100%;
    margin-right: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comment-modal-overlay,
  .comment-modal {
    animation: none;
  }

  .comment-modal-close,
  .comment-textarea,
  .btn {
    transition: none;
  }
}
</style>
