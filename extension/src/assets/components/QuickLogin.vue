<template>
    <div class="quick-login-wrapper">
        <el-select v-model="selectedUser" placeholder="快捷切换账号" size="small" style="width: 100%;"
            @change="handleSelectChange">
            <el-option v-for="(item, username) in userList" :key="username" :label="`[${item.role}]${item.realname}`"
                :value="username" :disabled="!item.enabled" />
        </el-select>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface UserInfo {
    realname: string;
    password: string;
    role: string;
    enabled: boolean;
}

interface Props {
    userList: Record<string, UserInfo>;
}

const props = withDefaults(defineProps<Props>(), {
  userList: () => {
    return {
      'mpadmin': {
        realname: '超级管理员',
        password: 'admin123',
        role: '管理员',
        enabled: true
      }
    };
  }
});

const selectedUser = ref('');

const handleSelectChange = (username: string) => {
  const user = props.userList[username];
  if (user) {
    chrome.runtime.sendMessage({
      type: 'quickLogin',
      payload: {
        username: username,
        password: user.password
      },
      target: 'background'
    }, (response) => {
      // 处理响应
    });
  }
};
</script>

<style scoped>
.quick-login-wrapper {
    width: auto;
    margin: 12px 0;
}
</style>