<template>

  <h2>前端配置</h2>
  <div class="item-group" ref="itemGroup">
    <UserCard v-for="(item, user) in configs" :key="user" :username="user" :user-info="item" @delete="handleDelete"
      @save="handleSave" />
    <!-- <button v-if="item.id" @click="removeSwitch(k)">删除用户</button> -->
  </div>
  <div>
    <button class="el-button" @click="addUser">添加用户</button>
  </div>
  <div>
    <button class="el-button" @click="saveConfig">保存配置</button>
  </div>

</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { UserCard } from '@components/index';
import { ElMessage } from 'element-plus';

// 定义存储键名
const g = 'userInfo';

// 组件引用
const itemGroup = ref<HTMLElement | null>(null);

// 定义用户信息类型
interface UserInfo {
  realname: string;
  password: string;
  role: string;
  enabled: boolean;
}

// 用户配置
const configs = reactive<Record<string, UserInfo>>({});

// 前端配置项
const frontEndConfig = reactive({
  "baseUrl": "https://192.168.10.92",
  "api": "https://192.168.10.92/api",
  "DataSystemApi": "https://192.168.10.92/api",
  "InfoSystemApi": "https://192.168.10.92/api",
  "FlowSystemApi": "https://192.168.10.92/mriaapi",
  "DicomApi": "https://192.168.10.92/dicomapi",
  "socket": "wss://192.168.10.92",
  "MdtApi": "https://192.168.10.92/mdtapi/api",
  "MonitorApi": "http://192.168.10.92",
  "MdtUploadApi": "https://192.168.10.92",
  "lang": "zh",
  "logo": true,
  "title": "放射治疗信息管理软件",
  "name": "MANTEIA_92",
  "screenHospitalName": "MANTEIA_92",
  "version": "1.0",
  "versionRelease": "1.0.10.1",
  "needHamburger": true,
  "needCAauth": true,
  "needDashboard": false,
  "needRemoteControl": true,
  "needHospital": true,
  "developMode": false,
  "appointmentTimeGap": "00:10",
  "appointmentTimeDuration": "00:02",
  "queueScreenPlan": "gama",
  "allowLinacPicture": false,
  "needCheckMedicalOrder": false,
  "showSyncPlanBtn": false,
  "requestTokenName": "access_token",
  "requestUserCode": "action_user_code",
  "requestUserName": "action_user_name",
  "requestHospitalCode": "hospital_code",
  "actionCodeName": "action_client_code",
  "actionCodeValue": "PC",
  "menuCode": "menu_code",
  "menuName": "menu_name",
  "useMosaiqSystem": false,
  "useGroup": false,
  "medicalRecordDoc": false,
  "hasReadSecurity": false,
  "isSimply": false,
  "authConfig": "https://192.168.10.92:8010",
  "selfCheckinFaceSocket": "https://192.168.10.81:8044",
  "calendarCellHeight": 30,
  "calendarTimePeriodReserveHeight": 30,
  "calendarTimePeriodCellHeight": 142,
  "lsfFilePath": "c:/ZMPrintService/mold_label.lsf",
  "labelPrinterWsServer": "ws://127.0.0.1:1808",
  "dicomTableDisplacement": 0,
  "feePrintPaperSize": "A5",
  "globalTaskNotificationClose": true
});

// 添加用户
const addUser = () => {
  ElMessage({ message: "保存成功", type: "success" });
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
  loadConfig();
});
</script>

<style>
.item-group {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  margin: 5px 5px 5px 5px;
}

.el-button {
  font-family: inherit;
  overflow: visible;
  text-transform: none;
  white-space: nowrap;
  box-sizing: border-box;
  transition: .1s;
  font-weight: 500;
  text-align: center;
  outline: 0;
  background: #fff;
  display: flex;
  -webkit-box-pack: center;
  justify-content: center;
  color: #4d9bd5;
  border: 1px solid #4d9bd5 !important;
  font-size: 12px;
  margin: 5px 0 0 0;
  border-radius: 4px;
  line-height: 22px;
  cursor: pointer;
  width: auto;
}
</style>