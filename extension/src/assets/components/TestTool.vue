<template>
  <div class="card">
    <h2 class="card-title"><span class="icon">🔍</span>测试 XHR 拦截</h2>

    <div class="form-group">
      <label>测试 URL</label>
      <input v-model="url" placeholder="输入要测试的URL" />
    </div>

    <div class="btn-group">
      <button class="btn btn-primary" @click="send">🚀 发送测试请求</button>
      <button class="btn btn-outline" @click="clear">🧹 清除控制台</button>
    </div>

    <div class="form-group" style="margin-top: 25px">
      <label>响应结果</label>
      <textarea v-model="output" readonly style="min-height:200px;background:#f8f9fa;overflow-y:visible" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const url    = ref('https://jsonplaceholder.typicode.com/todos/1');
const output = ref('');

function send () {
  if (!url.value) {return alert('请输入测试 URL');}
  output.value = '发送请求中...';
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url.value);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      let res = `=== 响应信息 ===\nURL: ${url.value}\n状态: ${xhr.status} ${xhr.statusText}\n响应头: ${xhr.getAllResponseHeaders()}\n\n=== 响应数据 ===\n`;
      try {
        res += JSON.stringify(JSON.parse(xhr.responseText), null, 2);
      } catch {
        res += xhr.responseText;
      }
      output.value = res;
    }
  };
  xhr.send();
}

function clear () { output.value = ''; }
</script>

<style scoped>
:root {
    --primary: #4285f4;
    --primary-dark: #3367d6;
    --secondary: #34a853;
    --danger: #ea4335;
    --warning: #fbbc05;
    --dark: #202124;
    --light: #f8f9fa;
    --gray: #5f6368;
    --border: #dadce0;
    --card-bg: #ffffff;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Segoe UI', 'Noto Sans SC', sans-serif;
    background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
    color: var(--dark);
    line-height: 1.6;
    min-width: 500px;
    padding: 20px;
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    overflow: hidden;
}

header {
    background: linear-gradient(120deg, var(--primary), #5a8dee);
    color: white;
    padding: 25px 30px;
    text-align: center;
}

h1 {
    font-size: 2.2rem;
    margin-bottom: 10px;
    font-weight: 700;
}

.subtitle {
    font-size: 1.1rem;
    opacity: 0.9;
    max-width: 600px;
    margin: 0 auto;
}

.main-content {
    padding: 25px 30px;
}

.card {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    padding: 25px;
    margin-bottom: 25px;
    border: 1px solid var(--border);
}

.card-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 1.4rem;
    color: var(--primary);
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border);
}

.card-title .icon {
    background: rgba(66, 133, 244, 0.15);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
}

.form-group {
    margin-bottom: 22px;
}

label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--dark);
    font-size: 1rem;
}

.input-group {
    position: relative;
}

input,
textarea,
select {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.3s;
    background: white;
    color: var(--dark);
    font-family: inherit;
}

input:focus,
textarea:focus,
select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.2);
}

textarea {
    min-height: 120px;
    resize: vertical;
    font-family: 'Fira Code', 'Consolas', monospace;
    line-height: 1.5;
}

.checkbox-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
}

.checkbox-group input {
    width: auto;
}

.btn-group {
    display: flex;
    gap: 15px;
    margin-top: 10px;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    border: none;
    flex: 1;
}

.btn-primary {
    background: var(--primary);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.btn-secondary {
    background: var(--secondary);
    color: white;
}

.btn-secondary:hover {
    background: #2e8b46;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
}

.btn-outline {
    background: transparent;
    border: 1px solid var(--primary);
    color: var(--primary);
}

.btn-outline:hover {
    background: rgba(66, 133, 244, 0.1);
}

.rules-container {
    margin-top: 20px;
}

.empty-state {
    text-align: center;
    padding: 30px;
    color: var(--gray);
}

.empty-state .icon {
    font-size: 3.5rem;
    color: #e8eaed;
    margin-bottom: 15px;
}

.rule-item {
    background: #f8fbff;
    border-left: 4px solid var(--primary);
    padding: 20px;
    margin-bottom: 15px;
    border-radius: 0 8px 8px 0;
    position: relative;
    transition: all 0.3s;
    border: 1px solid #e3eeff;
}

.rule-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(66, 133, 244, 0.15);
}

.rule-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 15px;
    align-items: center;
}

.rule-title {
    font-weight: 600;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.1rem;
}

.rule-title .status {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--secondary);
}

.rule-title .status.inactive {
    background: var(--danger);
}

.rule-actions {
    display: flex;
    gap: 8px;
}

.rule-actions button {
    background: rgba(66, 133, 244, 0.1);
    color: var(--primary);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.rule-actions button:hover {
    background: var(--primary);
    color: white;
}

.rule-details {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
}

@media (min-width: 768px) {
    .rule-details {
        grid-template-columns: 1fr 1fr;
    }
}

.rule-detail {
    background: white;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid var(--border);
}

.rule-detail h4 {
    margin-bottom: 10px;
    color: var(--gray);
    font-size: 0.9rem;
    font-weight: 600;
}

.rule-content {
    font-family: 'Fira Code', 'Consolas', monospace;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 0.9rem;
    line-height: 1.5;
    max-height: 150px;
    overflow: auto;
    padding: 5px;
    background: #fafafa;
    border-radius: 4px;
}

.tabs {
    display: flex;
    margin-bottom: 25px;
    border-bottom: 1px solid var(--border);
}

.tab {
    padding: 12px 25px;
    cursor: pointer;
    font-weight: 600;
    color: var(--gray);
    transition: all 0.3s;
    position: relative;
}

.tab.active {
    color: var(--primary);
}

.tab.active:after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--primary);
    border-radius: 3px 3px 0 0;
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

</style>