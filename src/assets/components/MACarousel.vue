<template>
    <div class="dialog-wrapper" v-if="visible">
        <!-- 遮罩层 -->
        <div class="dialog-mask" @click="handleMaskClick"></div>
        <!-- 轮播容器 -->
        <div class="carousel-container">
            <el-carousel ref="carouselRef" :interval="4000" type="card" height="300px" @wheel="handleWheel">
                <el-carousel-item v-for="tool, index in tools" :key="tool.id" @click="() => { handleClickTool(tool) }"
                    class="carousel-item"
                    :style="{ backgroundColor: bgColors[index], backgroundImage: `url(${tool.image})` }">
                    <div v-if="tool.id === 'hello'" key="hello">
                        <div class="context-hello">
                            <span>这里有一个BUG，痛い！</span>
                        </div>
                    </div>
                    <div v-else key="tool" class="carousel-content">
                        <h3 class="carousel-title">{{ tool.label }}</h3>
                        <p class="carousel-details">{{ tool.details }}</p>
                    </div>
                </el-carousel-item>
            </el-carousel>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Tool } from "@/assets/types"

const visible = defineModel<boolean>('visible', {
    default: false
})

interface MACarouselProps {
    tools?: Tool[]
    visible?: boolean
}

const props = withDefaults(defineProps<MACarouselProps>(), {
    tools: () => [
        { id: '1', label: '工具A', icon: 'el-icon-tool' },
        { id: '2', label: '工具B', icon: 'el-icon-tool' },
    ]
})

// 响应式数据
const carouselRef = ref<any>(null)

// 轮播卡片背景色数组
const bgColors = [
    '#3498db', // 蓝色
    '#e74c3c', // 红色
    '#2ecc71', // 绿色
    '#f39c12', // 橙色
    '#9b59b6', // 紫色
    '#1abc9c'  // 青色
]

// 处理鼠标滚轮事件
const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (event.deltaY > 0) {
        // 向下滚动，下一页
        carouselRef.value?.next()
    } else {
        // 向上滚动，上一页
        carouselRef.value?.prev()
    }
}

const emit = defineEmits<{
    'click-tool': [tool: Tool]
}>()

// 处理遮罩层点击事件，关闭对话框
const handleMaskClick = () => {
    visible.value = false
}

const handleClickTool = (tool: Tool) => {
    if (typeof tool.onClick === 'function') {
        tool.onClick()
    } else {
        emit('click-tool', tool)
    }
    visible.value = false
    // maLogger.info("点击了工具：", tool.label)
}
</script>

<style scoped>
.dialog-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 遮罩层样式 */
.dialog-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    z-index: 1;
    cursor: auto;
}

/* 轮播容器样式 */
.carousel-container {
    position: relative;
    width: 100%;
    max-height: 60dvh;
    max-width: 60dvw;
    z-index: 2;
    overflow: hidden;
}

.carousel-content {
    /* 纵向排列，居中对齐 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    font-size: 16px;
    color: #f8fafc;
    background: linear-gradient(90deg, #3b83f6af, #8a5cf6b0);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 轮播项样式 */
.carousel-item {
    /* 上下布局 */
    flex-direction: column;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
}

/* 修复卡片式轮播的宽度问题，确保卡片不超出容器 */
:deep(.el-carousel--card) .el-carousel__item {
    width: 100% !important;
    max-width: 30dvw;
    max-height: 40dvh;
    z-index: 1;
    transition: all 0.3s ease;
}

/* 轮播标题样式 */
.carousel-title {
    color: white;
    font-size: 32px;
    font-weight: bold;
    text-align: center;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    margin: 0 0 15px 0;
    padding: 20px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    backdrop-filter: blur(10px);
}

/* 轮播详情样式 */
.carousel-details {
    color: white;
    font-size: 16px;
    line-height: 1.6;
    text-align: center;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
    margin: 0;
    padding: 15px 20px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    backdrop-filter: blur(10px);
    max-width: 90%;
    opacity: 0.95;
    transition: all 0.3s ease;
}

/* 修复卡片轮播的层级问题，确保当前卡片显示在最前面 */
:deep(.el-carousel--card) .el-carousel__item.is-active {
    z-index: 10;
    transform: scale(1.05);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

:deep(.el-carousel--card) .el-carousel__item:not(.is-active) {
    transform: scale(0.95);
    opacity: 0.8;
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
</style>