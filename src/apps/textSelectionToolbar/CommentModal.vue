<template>
    <div v-if="visible" class="comment-modal-overlay" @click.self="handleClose">
      <div class="comment-modal">
        <div class="comment-modal-header">
          <h3 class="comment-modal-title">{{ isEdit ? '编辑留言' : '添加留言' }}</h3>
          <button class="comment-modal-close" @click="handleClose">
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
            <span class="label">留言内容</span>
            <textarea 
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
          <button v-if="isEdit" class="btn btn-danger" @click="handleDelete">删除留言</button>
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" :disabled="!commentContent.trim()" @click="handleSave">
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

<style scoped>
.comment-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
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
  background: #1e232e;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.comment-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
}

.comment-modal-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.comment-modal-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
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
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.text-content {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  word-break: break-word;
  max-height: 100px;
  overflow-y: auto;
}

.comment-textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.comment-textarea:focus {
  outline: none;
  border-color: #6366f1;
}

.comment-textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.char-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
  text-align: right;
}

.comment-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.3);
}
</style>