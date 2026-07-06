<template>
  <div class="browser-var-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>浏览器变量查看器</span>
          <el-button size="small" type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>
      
      <div class="description">
        <p>此工具可以帮助您查看和修改浏览器环境中的变量。请输入变量路径（例如：window.localStorage 或 document.cookie）来获取变量值。</p>
        <p class="tips">
          <i class="el-icon-info"></i> 提示：修改某些系统变量可能会影响浏览器或网页的正常运行，请谨慎操作。
        </p>
      </div>
      
      <BrowserVarInspector />
      
      <div v-if="lastUpdate" class="update-info">
        <el-alert :message="lastUpdate" type="success" show-icon :closable="false" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElCard, ElAlert ,ElButton,ElMessage} from 'element-plus';
import BrowserVarInspector from '@/pages/sidepanel/views/BrowserVarInspector.vue';

// 响应式数据
const lastUpdate = ref<string>('');

// 处理变量更新
const handleUpdate = (newValue: any) => {
  maLogger.log('变量已更新:', newValue);
  lastUpdate.value = '变量已成功更新';
  // 3秒后清除更新提示
  setTimeout(() => {
    lastUpdate.value = '';
  }, 3000);
};

// 保存配置
const saveConfig = () => {
  // 这里可以实现保存配置的逻辑
  // 使用全局消息提示，需要确保应用中已配置
  // @ts-ignore
  if (window.$message) {
    // @ts-ignore
    window.$message.success('配置已保存');
  } else {
    maLogger.log('配置已保存');
  }
};
</script>

<style scoped>
.browser-var-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.description {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.description p {
  margin-bottom: 10px;
  color: #606266;
  line-height: 1.6;
}

.description p:last-child {
  margin-bottom: 0;
}

.tips {
  font-size: 12px;
  color: #909399 !important;
}

.update-info {
  margin-top: 20px;
}
</style>
