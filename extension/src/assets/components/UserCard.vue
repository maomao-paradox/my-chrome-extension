<!-- 信息卡片，数据结构为{username:{realname:string,password:string}}, 卡片包含编辑和删除按钮, vue模板实现 -->
<template>
    <div class="el-item-card">
        <div class="card-chunk">
            <input :disabled="!isEditing" v-model="realname" @change="updateUsername" />
        </div>
        <div v-show="isEditing" class="card-chunk">
            <input placeholder="请输入用户名" v-model="newUsername" />
            <input placeholder="请输入密码" v-model="password" />
        </div>
        <div v-show="isEditing" class="card-chunk">
            <select v-model="role">
                <option disabled value="">请选择</option>
                <option>医生</option>
                <option>助理医生</option>
                <option>物理师</option>
                <option>护士</option>
                <option>定位技师</option>
                <option>治疗技师</option>
                <option>主任医生</option>
                <option>物理主任</option>
            </select>
        </div>
        <div class="card-chunk">
            <button v-show="showEditButton" class="edit-button" @click="editItem">编辑</button>
            <button v-show="showDeleteButton" class="delete-button" @click="deleteItem">删除</button>
            <button v-show="showSaveButton" class="save-button" @click="save">保存</button>
            <button v-show="showCancelButton" class="cancel-button" @click="cancel">取消</button>
            <!-- 禁用和启用的开关 -->
            <MASwitch v-model="enabled" @update="(value: boolean) => { enabled = value; save() }" />

        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { MASwitch } from '@components/index';

interface UserInfo {
    realname: string;
    password: string;
    role: string;
    enabled: boolean;
}

interface Props {
    userInfo: UserInfo;
    username: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    delete: [username: string];
    save: [oldUsername: string, newUsername: string, userInfo: UserInfo];
}>();

// 响应式数据
const realname = ref(props.userInfo.realname || '');
const password = ref(props.userInfo.password || '');
const role = ref(props.userInfo.role || '');
const newUsername = ref(props.username);
const enabled = ref(props.userInfo.enabled !== undefined && props.userInfo.enabled !== null && typeof props.userInfo.enabled === "boolean" ? props.userInfo.enabled : true);
const showDeleteButton = ref(true);
const showEditButton = ref(true);
const isEditing = ref(false);
const showSaveButton = ref(false);
const showCancelButton = ref(false);

// 监听props变化，更新本地数据
watch(() => props.userInfo, (newUserInfo) => {
    realname.value = newUserInfo.realname || '';
    password.value = newUserInfo.password || '';
    role.value = newUserInfo.role || '';
    enabled.value = newUserInfo.enabled !== undefined && newUserInfo.enabled !== null && typeof newUserInfo.enabled === "boolean" ? newUserInfo.enabled : true;
}, { deep: true });

watch(() => props.username, (newUsernameValue) => {
    newUsername.value = newUsernameValue;
});

// 方法
async function updateUsername() {
    chrome.runtime.sendMessage({
        action: "getPinyin",
        data: realname.value
    }, (response) => {
        if (response && response.success) {
            newUsername.value = response.data;
        } else {
            maLogger.error("获取拼音失败:", response);
        }
    });
}

function editItem() {
    isEditing.value = true;
    showSaveButton.value = true;
    showCancelButton.value = true;
    showEditButton.value = false;
    showDeleteButton.value = false;
}

function deleteItem() {
    emit('delete', props.username);
}

function save() {
    emit('save', props.username, newUsername.value, {
        "realname": realname.value,
        "password": password.value,
        "role": role.value,
        "enabled": enabled.value,
    });
    isEditing.value = false;
    showSaveButton.value = false;
    showCancelButton.value = false;
    showEditButton.value = true;
    showDeleteButton.value = true;
}

function cancel() {
    isEditing.value = false;
    showSaveButton.value = false;
    showCancelButton.value = false;
    showEditButton.value = true;
    showDeleteButton.value = true;
}
</script>

<style scoped>
.el-item-card {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    margin: 10px 0;
    background: var(--bg-card);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    transition: all var(--transition-fast);
}

.el-item-card:hover {
    box-shadow: var(--shadow-lg), var(--glow-primary);
    border-color: var(--primary-light);
}

.card-chunk {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex: 1 1 100%;
    min-width: 0;
}

input,
select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    flex: 1;
    transition: all var(--transition-fast);
    min-width: 0;
}

input:focus,
select:focus {
    border-color: var(--primary-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2);
    outline: none;
}

input::placeholder {
    color: var(--text-tertiary);
}

button {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 500;
    min-width: 80px;
}

.edit-button {
    background: var(--primary-color);
    color: white;
}

.edit-button:hover {
    background: var(--primary-light);
    transform: translateY(-1px);
    box-shadow: var(--glow-primary);
}

.save-button {
    background: var(--primary-color);
    color: white;
}

.save-button:hover {
    background: var(--primary-light);
    transform: translateY(-1px);
    box-shadow: var(--glow-primary);
}

.delete-button {
    background: #f56c6c;
    color: white;
}

.delete-button:hover {
    background: #f78989;
    transform: translateY(-1px);
}

.cancel-button {
    background: var(--border-color);
    color: var(--text-primary);
}

.cancel-button:hover {
    background: var(--text-tertiary);
    transform: translateY(-1px);
}

/* 禁用状态下的卡片样式 */
.el-item-card:has(.ma-switch[checked="false"]) {
    opacity: 0.6;
    border-color: var(--border-light);
}

/* 响应式布局 */
@media (max-width: 768px) {
    .el-item-card {
        flex-direction: column;
        align-items: stretch;
    }
    
    .card-chunk {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    
    button {
        width: 100%;
    }
}
</style>