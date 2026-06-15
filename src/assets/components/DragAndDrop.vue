<template>
  <div class="drop-area" @dragover.prevent @drop="handleDrop" @dragenter.prevent>
    <p>拖拽文件到此处或点击上传</p>
    <input type="file" @change="handleFileChange" ref="fileInput" style="display: none;" multiple>
    <el-button type="primary" @click="openFilePicker">
      上传文件<el-icon class="el-icon--right">
        <Upload />
      </el-icon>
    </el-button>
    <div v-for="file in files" :key="file.name">
      {{ file.name }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Upload } from '@element-plus/icons-vue';

// 响应式数据
const files = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

// 方法定义
function handleDrop(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.files) {
    const droppedFiles = event.dataTransfer.files;
    handleFiles(droppedFiles);
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    const selectedFiles = input.files;
    handleFiles(selectedFiles);

    // 读取第一个文件内容并打印
    const selectedFile = selectedFiles[0];
    if (selectedFile) {
      const name = selectedFile.name;
      maLogger.log('Selected files:', name);
      const reader = new FileReader();
      reader.readAsText(selectedFile);
      reader.onload = function (e) {
        const scriptContent = e.target?.result as string;
        maLogger.log(scriptContent);
        // isValidJS(scriptContent) ? chrome.runtime.sendMessage({
        //   action: "executeScript",
        //   data: {
        //     type: "code",
        //     content: scriptContent
        //   }
        // }):ElMessageBox("不是有效的JS脚本");
      };
    }
  }
}

function handleFiles(fileList: FileList) {
  for (let i = 0; i < fileList.length; i++) {
    files.value.push(fileList[i]);
    // 这里可以添加上传逻辑，例如调用上传方法
    // uploadFile(fileList[i]);
  }
}

function openFilePicker() {
  fileInput.value?.click();
}

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // 上传文件接口
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      maLogger.log('文件上传成功');
      // 处理成功响应
    } else {
      maLogger.error('文件上传失败');
      // 处理错误响应
    }
  } catch (error) {
    maLogger.error('上传过程中发生错误:', error);
    // 处理错误
  }
}
</script>

<style scoped>
.drop-area {
  width: 300px;
  height: 200px;
  border: 2px dashed #ccc;
  text-align: center;
  padding: 20px;
}

.drop-area:hover {
  border-color: #aaa;
}
</style>