<template>
  <div class="markdown-editor">
    <!-- 分栏编辑模式 -->
    <div v-if="mode === 'split'" class="editor-container">
      <div class="editor-section">
        <textarea v-model="markdownText" class="editor-textarea" placeholder="输入Markdown内容..." @input="handleInput" />
      </div>
      <div class="preview-section">
        <div class="preview-content" v-html="previewHtml"></div>
      </div>
    </div>

    <!-- 仅预览模式 -->
    <div v-else-if="mode === 'preview'" class="preview-only">
      <div class="preview-content" v-html="previewHtml"></div>
    </div>

    <!-- 仅编辑模式 -->
    <div v-else class="edit-only">
      <textarea v-model="markdownText" class="editor-textarea" placeholder="输入Markdown内容..." @input="handleInput" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

// 定义Props类型
interface MarkdownOptions {
  html?: boolean;
  linkify?: boolean;
  typographer?: boolean;
  [key: string]: any;
}

type EditorMode = 'split' | 'preview' | 'edit';

interface Props {
  value: string;
  mode: EditorMode;
  options?: MarkdownOptions;
}

// 定义Props
const props = withDefaults(defineProps<Props>(), {
  value: '',
  mode: 'split'
});

// 定义事件
const emit = defineEmits<{
  (e: 'input', value: string): void;
  (e: 'change', value: string): void;
}>();

// 响应式数据
const markdownText = ref(props.value);
const mdRenderer = ref<MarkdownIt | null>(null);

// 初始化渲染器
const initRenderer = () => {
  mdRenderer.value = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    ...props.options
  });
};

// 计算属性：渲染后的HTML
const previewHtml = computed(() => {
  if (!markdownText.value || !mdRenderer.value) return '';
  const html = mdRenderer.value.render(markdownText.value);
  return DOMPurify.sanitize(html);
});

// 处理输入事件
const handleInput = () => {
  emit('input', markdownText.value);
  emit('change', markdownText.value);
};

// 监听value变化
watch(() => props.value, (newVal) => {
  if (newVal !== markdownText.value) {
    markdownText.value = newVal;
  }
});

// 组件挂载时初始化渲染器
onMounted(() => {
  initRenderer();
});
</script>

<style scoped>
:deep(p) {
  margin-block-start: 1em;
  margin-block-end: -1em;
}

.markdown-editor {
  width: 100%;
  height: 100%;
}

.editor-container {
  display: flex;
  height: 600px;
  gap: 20px;
}

.editor-section,
.preview-section {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  padding: 15px;
  border: none;
  resize: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
}

.preview-content {
  padding: 15px;
  height: 100%;
  overflow-y: auto;
}

/* Markdown 样式 */
.preview-content h1,
.preview-content h2,
.preview-content h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.preview-content p {
  margin: 16px 0;
}

.preview-content code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
}

.preview-content pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
}

.preview-content blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0;
}

.preview-content table {
  border-collapse: collapse;
  margin: 16px 0;
}

.preview-content table th,
.preview-content table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.preview-content img {
  max-width: 100%;
}
</style>
