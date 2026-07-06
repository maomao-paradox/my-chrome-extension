<template>
  <div class="user-config-container">
    <h2>用户配置</h2>
    <div class="item-group" ref="itemGroup">
      <UserCard v-for="(item, user) in configs" :key="user" :username="user" :user-info="item" @delete="handleDelete"
        @save="handleSave" />
    </div>
    <div class="action-buttons">
      <button class="el-button" @click="addUser">添加用户</button>
      <button class="el-button" @click="saveConfig">保存配置</button>
    </div>
  <!-- <div>
      <h4>当前配置：</h4>
      <pre>{{ configs }}</pre>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { UserCard } from '@components/index';

interface UserInfo {
  realname: string;
  password: string;
  role: string;
  enabled: boolean;
}

const g = 'userInfo';

// 组件引用
const itemGroup = ref<HTMLElement | null>(null);

// 响应式数据
const configs = reactive<Record<string, UserInfo>>({
  // Example initial switches
  // "switch-1": { id: "switch-1", value: false, desc: "开关 1" },
  // "switch-2": { id: "switch-2", value: true, desc: "开关 2" }
});

// 添加用户
const addUser = () => {
  const newUser: UserInfo = {
    realname: "测试用户",
    password: "123456",
    role: "",
    enabled: true
  };
  configs["temporary"] = newUser;
};

// 删除用户
const handleDelete = (user: string) => {
  if (configs && configs.hasOwnProperty(user)) {
    delete configs[user];
    maLogger.log("删除配置项：", user);
  }
};

// 保存用户信息
const handleSave = (oldUsername: string, newUsername: string, newConfig: UserInfo) => {
  configs[newUsername] = newConfig;
  if (oldUsername !== newUsername) {
    handleDelete(oldUsername);
  }
};

// 加载配置
const loadConfig = () => {
  maLogger.log("加载配置");
  if (!chrome.storage || !chrome.storage.local) {
    maLogger.error("Chrome storage API is not available.");
    return;
  }
  chrome.storage.local.get(g, (result) => {
    if (chrome.runtime.lastError) {
      maLogger.error(chrome.runtime.lastError);
      return;
    }
    if (result && result[g]) {
      maLogger.log("缓存配置：", result[g]);
      Object.assign(configs, result[g] || {});
    } else {
      maLogger.log("没有找到缓存配置，使用默认配置");
    }
  });
};

// 保存配置
const saveConfig = () => {
  chrome.storage.local.set({ [g]: configs });
};

// 组件挂载后加载配置
onMounted(() => {
  // Initialize switches if needed
  loadConfig();
});
</script>

<style scoped>
h2 {
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}

.user-config-container {
  max-width: 100%;
  padding: 20px 0;
}

.item-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 20px 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.el-button {
  font-family: inherit;
  overflow: visible;
  text-transform: none;
  white-space: nowrap;
  box-sizing: border-box;
  transition: all var(--transition-fast);
  font-weight: 500;
  text-align: center;
  outline: 0;
  background: var(--primary-color);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  border: 1px solid var(--primary-color) !important;
  font-size: 14px;
  margin: 0;
  border-radius: 8px;
  line-height: 28px;
  cursor: pointer;
  width: auto;
  padding: 8px 16px;
}

.el-button:hover {
  background: var(--primary-light);
  border-color: var(--primary-light) !important;
  transform: translateY(-1px);
  box-shadow: var(--glow-primary);
}

/* 响应式布局 */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
  }
  
  .el-button {
    width: 100%;
  }
}
</style>