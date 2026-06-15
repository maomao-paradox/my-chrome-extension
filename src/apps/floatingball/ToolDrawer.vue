<!-- MADrawer.vue -->
<template>
    <!-- 右上角的消息弹窗通知中心 -->
    <div class="notification-center" v-if="internalVisible">
        <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge" type="danger">
            <el-button circle size="default" class="notification-btn" @click="showNotifications = !showNotifications">
                <template #icon><el-icon>
                        <Bell />
                    </el-icon></template>
            </el-button>
        </el-badge>

        <transition name="notification-pop">
            <div v-if="showNotifications" class="notification-panel" @click.outside="showNotifications = false">
                <div class="notification-header">
                    <span class="notification-title">消息中心</span>
                    <el-button link type="info" size="small" @click="clearAllNotifications">全部已读</el-button>
                </div>
                <div class="notification-list" :class="{ 'notification-empty': notifications.length === 0 }">
                    <div v-if="notifications.length === 0" class="empty-state">
                        <el-icon size="42">
                            <CircleCheck />
                        </el-icon>
                        <span>暂无新消息</span>
                    </div>
                    <div v-for="(item, idx) in notifications" :key="idx" class="notification-card"
                        :class="[item.type, { 'is-unread': !item.read }]" @click="markAsRead(idx)">
                        <div class="card-icon">
                            <el-icon v-if="item.type === 'success'" size="18">
                                <CircleCheck />
                            </el-icon>
                            <el-icon v-else-if="item.type === 'warning'" size="18">
                                <Warning />
                            </el-icon>
                            <el-icon v-else-if="item.type === 'error'" size="18">
                                <CircleClose />
                            </el-icon>
                            <el-icon v-else size="18">
                                <InfoFilled />
                            </el-icon>
                        </div>
                        <div class="card-content">
                            <div class="card-title">{{ item.title }}</div>
                            <div class="card-desc" v-if="item.message">{{ item.message }}</div>
                            <div class="card-time">{{ formatTime(item.timestamp) }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    </div>

    <el-drawer v-model="internalVisible" :direction="direction" :resizable="resizable" :title="drawerTitle"
        :modal="modal" :close-on-click-modal="closeOnClickModal" :custom-class="drawerClass"
        :overlay-class="drawerOverlayClass" @closed="handleClosed">
        <div class="drawer-content-wrapper">
            <component v-if="toolComponent" :is="toolComponent" @add-message="addNotification" />
            <Static404 v-else />
        </div>
    </el-drawer>
</template>

<script setup lang="ts">
import toolMap from "./views/index"
import { computed, ref } from 'vue'
import { Static404 } from '@components/index'
import { Tool } from "@/assets/types"
import { Bell, CircleCheck, Warning, CircleClose, InfoFilled } from '@element-plus/icons-vue'

interface Notification {
    id?: number
    title: string
    message?: string
    type: 'success' | 'info' | 'warning' | 'error'
    read: boolean
    timestamp: Date
}

const notifications = ref<Notification[]>([])
const showNotifications = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const addNotification = (opts: Partial<Notification> & { title: string }) => {
    notifications.value.unshift({
        title: opts.title,
        message: opts.message,
        type: opts.type || 'info',
        read: false,
        timestamp: new Date()
    })
}

const markAsRead = (idx: number) => {
    if (notifications.value[idx]) notifications.value[idx].read = true
}

const clearAllNotifications = () => {
    notifications.value.forEach(n => n.read = true)
}

const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return date.toLocaleDateString()
}

interface DrawerProps {
    visible?: boolean
    title?: string
    direction?: "rtl" | "ltr" | "ttb" | "btt"
    resizable?: boolean
    modal?: boolean
    closeOnClickModal?: boolean
    customClass?: string
    overlayClass?: string
    useMask?: boolean
    activeTool?: Tool | null
    clickMask?: () => void
    closeDrawer?: () => void
}

// Props定义
const props = withDefaults(defineProps<DrawerProps>(), {
    visible: false,
    title: '',
    direction: 'rtl',
    resizable: false,
    modal: true,
    closeOnClickModal: true,
    customClass: '',
    overlayClass: '',
    useMask: false,
    activeTool: null
})

const emit = defineEmits<{
    'update:visible': [value: boolean]
    'close-drawer': []
}>()

// 内部可见性状态，用于双向绑定
const internalVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => {
        emit('update:visible', value)
        if (!value) {
            emit('close-drawer')
        }
    }
})

// 抽屉标题
const drawerTitle = computed(() => props.activeTool ? props.activeTool.label : props.title ?? "未命名的工具")
const drawerClass = computed(() => ['mria-tool-drawer', props.customClass].filter(Boolean).join(' '))
const drawerOverlayClass = computed(() => ['mria-tool-drawer-overlay', props.overlayClass].filter(Boolean).join(' '))

// 处理抽屉关闭事件
const handleClosed = () => {
    emit('close-drawer')
    emit('update:visible', false)
}

// 计算要显示的工具组件
const toolComponent = computed(() => {
    // 为 toolMap 添加类型定义
    const typedToolMap: Record<string, any> = toolMap;

    // 简化逻辑，提高可读性
    if (!props.activeTool) {
        return Static404;
    }

    const toolId = props.activeTool.id;
    return typedToolMap[toolId] || Static404;
})

// 如果需要暴露给模板的方法或数据
defineExpose({
    visible: internalVisible,
    toolComponent,
    addNotification, notifications, clearAllNotifications
})
</script>

<style scoped>
/* 无遮罩样式 - 允许点击外部 */
:deep(.el-overlay.no-mask-drawer) {
    pointer-events: none !important;
}

:deep(.mria-tool-drawer-overlay) {
    background:
        radial-gradient(circle at 14% 20%, rgba(56, 189, 248, 0.12), transparent 26%),
        radial-gradient(circle at 82% 16%, rgba(245, 158, 11, 0.1), transparent 22%),
        rgba(4, 8, 18, 0.46);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

/* 抽屉内容恢复交互 */
:deep(.no-mask-drawer .el-drawer__body) {
    pointer-events: auto;
}

:deep(.mria-tool-drawer) {
    position: relative;
    width: min(560px, calc(100vw - 24px)) !important;
    max-width: 560px;
    min-width: 420px;
    color: #f8fbff;
    background:
        linear-gradient(160deg, rgba(10, 19, 37, 0.96), rgba(11, 18, 31, 0.76)),
        linear-gradient(135deg, rgba(125, 211, 252, 0.08), rgba(251, 191, 36, 0.04));
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
        -22px 0 60px rgba(0, 0, 0, 0.34),
        inset 1px 0 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    overflow: hidden;
    animation: drawerSlideIn 0.34s ease-out;
}

:deep(.mria-tool-drawer::before) {
    content: '';
    position: absolute;
    top: -80px;
    left: -40px;
    width: 220px;
    height: 220px;
    background: radial-gradient(circle, rgba(125, 211, 252, 0.22), transparent 68%);
    filter: blur(12px);
    pointer-events: none;
}

:deep(.mria-tool-drawer::after) {
    content: '';
    position: absolute;
    right: -60px;
    bottom: -80px;
    width: 240px;
    height: 240px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.12), transparent 72%);
    filter: blur(12px);
    pointer-events: none;
}

:deep(.mria-tool-drawer .el-drawer__header) {
    position: relative;
    margin-bottom: 0;
    padding: 28px 22px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
        rgba(8, 14, 26, 0.32);
}

:deep(.mria-tool-drawer .el-drawer__header)::before {
    content: 'UTILITY DRAWER';
    position: absolute;
    top: 10px;
    left: 22px;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.24em;
    color: rgba(216, 227, 242, 0.5);
}

:deep(.mria-tool-drawer .el-drawer__title) {
    color: #f8fbff;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.01em;
}

:deep(.mria-tool-drawer .el-drawer__headerbtn) {
    top: 18px;
    right: 18px;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(216, 227, 242, 0.74);
    transition: all 0.2s ease;
}

:deep(.mria-tool-drawer .el-drawer__headerbtn:hover) {
    color: #f8fbff;
    background: rgba(125, 211, 252, 0.12);
    border-color: rgba(125, 211, 252, 0.2);
    transform: translateY(-1px);
}

:deep(.mria-tool-drawer .el-drawer__body) {
    position: relative;
    padding: 16px;
    color: #e2e8f0;
    background: transparent;
    overflow-y: auto;
    max-height: calc(100vh - 112px);
}

:deep(.mria-tool-drawer ::-webkit-scrollbar) {
    width: 8px;
}

:deep(.mria-tool-drawer ::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
}

:deep(.mria-tool-drawer ::-webkit-scrollbar-thumb) {
    background: rgba(148, 163, 184, 0.36);
    border-radius: 999px;
}

:deep(.mria-tool-drawer ::-webkit-scrollbar-thumb:hover) {
    background: rgba(148, 163, 184, 0.56);
}

@keyframes drawerSlideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }

    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@media (max-width: 768px) {
    :deep(.mria-tool-drawer) {
        min-width: 100%;
        width: 100% !important;
        max-width: 100%;
    }

    :deep(.mria-tool-drawer .el-drawer__body) {
        padding: 15px;
    }

    :deep(.mria-tool-drawer .el-drawer__header) {
        padding: 24px 16px 14px;
    }
}

.drawer-content-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: auto;
    border-radius: 20px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015)),
        rgba(7, 13, 25, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 12px 26px rgba(0, 0, 0, 0.16);
}

:deep(.drawer-content-wrapper > *) {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    box-sizing: border-box;
}

:deep(.not-found-container) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    color: rgba(216, 227, 242, 0.7);
    text-align: center;
}

.notification-center {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 9999;
}

.notification-btn {
    --el-button-size: 44px !important;
    width: 44px !important;
    height: 44px !important;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.12), rgba(251, 191, 36, 0.08)), rgba(15, 23, 42, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    color: rgba(248, 251, 255, 0.88);
    transition: all 0.24s ease-out;
}

.notification-btn:hover {
    color: #7dd3fc;
    background: linear-gradient(135deg, rgba(125, 211, 252, 0.22), rgba(251, 191, 36, 0.14)), rgba(15, 23, 42, 0.85);
    border-color: rgba(125, 211, 252, 0.3);
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.26), 0 0 18px rgba(125, 211, 252, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.notification-panel {
    position: absolute;
    top: 54px;
    right: 0;
    width: min(360px, calc(100vw - 32px));
    border-radius: 18px;
    overflow: hidden;
    color: #e2e8f0;
    background:
        linear-gradient(160deg, rgba(10, 19, 37, 0.97), rgba(11, 18, 31, 0.82)),
        linear-gradient(135deg, rgba(125, 211, 252, 0.12), rgba(251, 191, 36, 0.06));
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
        0 22px 60px rgba(0, 0, 0, 0.36),
        0 0 0 1px rgba(125, 211, 252, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
}

.notification-title {
    font-weight: 700;
    font-size: 14px;
    color: rgba(248, 251, 255, 0.9);
    letter-spacing: 0.02em;
}

.notification-list {
    max-height: min(420px, 60vh);
    overflow-y: auto;
    padding: 8px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: rgba(148, 163, 184, 0.6);
}

.notification-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px;
    margin-bottom: 6px;
    border-radius: 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.notification-card.is-unread {
    background: rgba(125, 211, 252, 0.06);
    border-color: rgba(125, 211, 252, 0.12);
}

.notification-card.success .card-icon {
    color: #4ade80;
}

.notification-card.warning .card-icon {
    color: #fbbf24;
}

.notification-card.error .card-icon {
    color: #f87171;
}

.notification-card.info .card-icon {
    color: #60a5fa;
}

.card-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
}

.card-content {
    flex: 1;
    min-width: 0;
}

.card-title {
    font-weight: 600;
    font-size: 13px;
    color: rgba(248, 251, 255, 0.92);
    margin-bottom: 2px;
}

.card-desc {
    font-size: 12px;
    color: rgba(148, 163, 184, 0.7);
    line-height: 1.5;
}

.card-time {
    font-size: 11px;
    color: rgba(148, 163, 184, 0.5);
    margin-top: 4px;
}

.notification-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
}

::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 999px;
}

::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.24);
    border-radius: 999px;
}

.notification-pop-enter-active,
.notification-pop-leave-active {
    transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-pop-enter-from,
.notification-pop-leave-to {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
}
</style>
