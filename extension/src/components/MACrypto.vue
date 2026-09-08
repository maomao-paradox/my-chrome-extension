<template>
  <el-dialog v-model="dialogVisible" :close-on-click-modal="false" :close-on-press-escape="false" width="600px"
    top="50px" :append-to-body="true" :lock-scroll="false">
    <el-form label-width="80">
      <el-form-item label="密钥">
        <el-input v-model="key" placeholder="16位字符" />
      </el-form-item>
      <el-form-item label="模式">
        <el-radio-group v-model="mode">
          <el-radio label="encrypt">加密</el-radio>
          <el-radio label="decrypt">解密</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="输入">
        <el-input v-model="input" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="go">{{ mode === 'encrypt' ? '加密' : '解密' }}</el-button>
      </el-form-item>
      <el-form-item label="输出">
        <el-input v-model="output" type="textarea" :rows="4" readonly />
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CryptoJS from 'crypto-js';

// 响应式数据
const key = ref<string>('1234567890123456');
const input = ref<string>('Hello 世界');
const output = ref<string>('');
const mode = ref<'encrypt' | 'decrypt'>('encrypt');
const dialogVisible = ref<boolean>(false);

// 执行加密/解密
const go = (): void => {
  if (mode.value === 'encrypt') {
    output.value = CryptoJS.AES.encrypt(input.value, key.value).toString();
  } else {
    const bytes = CryptoJS.AES.decrypt(input.value, key.value);
    output.value = bytes.toString(CryptoJS.enc.Utf8);
  }
};

// 暴露属性和方法
defineExpose({
  visible: dialogVisible,
  go
});
</script>