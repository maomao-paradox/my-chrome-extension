<template>
    <Draggable :initial-position="'center'" :enable-adsorption="false">
        <div v-show="visible" class="ma-collapse-container" ref="containerRef">
            <!-- 拖动区域 -->
            <div class="drag-area">
                <!-- 顶部的标题 -->
                <div class="title-wrapper">
                    {{ props.title }}
                    <!-- 关闭按钮 -->
                    <div class="close-btn-wrapper">
                        <el-button type="text" size="small" @click.stop="close" class="close-btn">
                            <el-icon>
                                <close />
                            </el-icon>
                        </el-button>
                    </div>
                </div>

                <div v-if="toolId === 'hello'" key="hello">
                    <div class="context-hello">
                        <span>这里有一个BUG，好痛！</span>
                    </div>
                </div>
                <div v-else class="demo-collapse">
                    <el-collapse accordion>
                        <el-collapse-item v-for="item in menuItems" :key="item.id" :name="item.label">
                            <template #title="{ isActive }">
                                <div :class="['item-wrapper', { 'is-active': isActive }]">
                                    {{ item.label }}
                                </div>
                            </template>
                            <div class="content-row">
                                <div class="description-text">
                                    {{ item.details || item.label }}
                                </div>
                                <!-- 跳转按钮 -->
                                <el-button type="primary" size="small" @click.stop="handleClick(item)"
                                    class="execute-button">
                                    执行
                                </el-button>
                            </div>
                        </el-collapse-item>
                    </el-collapse>
                </div>
            </div>
        </div>
    </Draggable>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import { Tool } from '@/types'
import { ref } from 'vue'
import Draggable from '@/plugins/floatingball/Draggable.vue'

// 定义props类型
interface Props {
    title: string;
    visible?: boolean;
    menuItems: Tool[];
    toolId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible', 'item-click', 'close']);

// 处理点击事件
const handleClick = (item: Tool) => {
    // 发送消息到后台脚本
    chrome.runtime.sendMessage({
        type: 'CONTEXT_MENU_CLICK',
        payload: {
            itemId: item.id,
            itemLabel: item.label,
            toolId: props.toolId
        },
        target: "background"
    })
    // 触发item-click事件，将点击的item传递给父组件
    emit('item-click', item);
};

// 提供关闭方法
const close = () => {
    emit('close');
    emit('update:visible', false);
};

</script>

<style scoped>
/* 整体容器样式 */
.ma-collapse-container {
    width: 300px;
    /* 使用极低的alpha值，确保明显的透明效果 */
    background: rgba(255, 255, 255, 0.2);
    /* backdrop-filter必须设置，且需要浏览器支持 */
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    /* 移除边框，让透明效果更明显 */
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    /* 确保文本颜色继承 */
    color: #2d3748;
    /* 确保元素是块级且有正确的堆叠上下文 */
    display: block;
    isolation: isolate;
}

/* 拖动区域样式 */
.drag-area {
    /* 拖动区域也使用极低的alpha值 */
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    user-select: none;
    transition: all 0.2s ease;
    /* 确保文本颜色 */
    color: #2d3748;
}

.drag-area:hover {
    background: rgba(255, 255, 255, 0.4);
}

/* 标题样式 */
.title-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    justify-content: space-between;
    /* 加深标题文字颜色 */
    color: #2d3748;
    font-weight: 600;
    /* 增大字号 */
    font-size: 16px;
}

/* 折叠块的标题样式 */
.item-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    user-select: none;
    justify-content: space-between;
    /* 加深标题文字颜色 */
    color: #1a2538;
    font-weight: 600;
    /* 增大字号 */
    font-size: 14px;
}

/* 关闭按钮容器 */
.close-btn-wrapper {
    margin-left: auto;
}

/* 关闭按钮样式 */
.close-btn {
    padding: 0;
    margin: 0;
    height: 28px;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    /* 使用更明显的颜色 */
    color: #2d3748;
    transition: all 0.2s ease;
    border-radius: 4px;
}

.close-btn:hover {
    color: #e53e3e;
    background: rgba(255, 77, 79, 0.2);
    transform: scale(1.1);
}

.close-btn :deep(.el-icon) {
    font-size: 16px;
    font-weight: bold;
}

/* 演示折叠面板样式 */
.demo-collapse {
    max-height: 400px;
    /* 超过最大高度适用滚动 */
    overflow-y: auto;
    overflow-x: hidden;
    /* 隐藏滚动条 */
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 16px;
    /* 确保折叠面板内容区域有文本颜色 */
    color: #2d3748;
    /* 折叠面板内容区域保持不透明 */
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
}

/* Chrome, Safari and Opera 隐藏滚动条 */
.demo-collapse::-webkit-scrollbar {
    display: none;
}

/* 内容行样式 */
.content-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0;
    padding: 8px 16px;
    flex-wrap: wrap;
}

/* 描述文本样式 */
.description-text {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    /* 加深描述文本颜色 */
    color: #373c46;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 执行按钮样式 */
.execute-button {
    flex-shrink: 0;
    height: 28px;
    font-size: 12px;
    padding: 0 12px;
    margin: 0;
    /* 添加边框 */
    border: 1px solid var(--el-color-primary);
    border-radius: 4px;
    transition: all 0.2s ease;
}

.execute-button:hover {
    border-color: var(--el-color-primary-dark-2);
    box-shadow: 0 2px 8px rgba(48, 105, 242, 0.3);
}

/* 欢迎区域样式 */
.context-hello {
    padding: 20px;
    text-align: center;
    font-size: 16px;
    color: #f8fafc;
    background: linear-gradient(90deg, #3b83f6af, #8a5cf6b0);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 确保Element Plus组件继承文本颜色 */
:deep(.el-collapse) {
    color: #2d3748;
}

:deep(.el-collapse-item__header) {
    color: #2d3748 !important;
}

:deep(.el-collapse-item__content) {
    color: #4a5568;
}
</style>