<template>
  <div>
    <el-form label-width="80">
      <el-form-item label="输入">
        <el-input v-model="raw" type="textarea" :rows="8" placeholder="粘贴JSON"/>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fmt">格式化</el-button>
        <el-button @click="min">压缩</el-button>
      </el-form-item>
      <el-form-item label="结果">
        <el-input v-model="out" type="textarea" :rows="10" readonly/>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

// 响应式数据
const raw = ref<string>('{"name":"tom","age":18,"skills":["js","css"]}');
const out = ref<string>('');

// 格式化JSON
const fmt = (): void => {
  try {
    const parsed = JSON.parse(raw.value);
    out.value = JSON.stringify(parsed, null, 2);
  } catch (e) {
    ElMessage.error('JSON格式错误');
  }
};

// 压缩JSON
const min = (): void => {
  try {
    const parsed = JSON.parse(raw.value);
    out.value = JSON.stringify(parsed);
  } catch (e) {
    ElMessage.error('JSON格式错误');
  }
};
</script>