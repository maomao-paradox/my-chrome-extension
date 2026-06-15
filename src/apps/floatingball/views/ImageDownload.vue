<template>
    <div class="image-zip-downloader scifi-container" ref="containerRef">
        <header class="scifi-header">
            <div class="scifi-title-wrapper">
                <el-icon class="scifi-icon">
                    <IconDocument />
                </el-icon>
                <h1 class="scifi-title">图片资源压缩下载工具</h1>
            </div>
            <p class="subtitle scifi-subtitle">一键下载页面中的所有图片资源为 ZIP 压缩包</p>
        </header>

        <div class="content">
            <!-- 控制面板 -->
            <div class="control-panel scifi-panel">
                <h2 class="panel-title scifi-panel-title">
                    <el-icon class="scifi-icon">
                        <IconSetting />
                    </el-icon>
                    控制面板
                </h2>

                <div class="control-buttons">
                    <button class="download-btn scifi-btn scifi-btn-primary" :disabled="running || !images.length"
                        @click="onDownload">
                        <el-icon class="scifi-icon">
                            <IconDownload />
                        </el-icon>
                        {{ running ? '打包中…' : `下载图片 (${images.length})` }}
                    </button>
                    <button :disabled="running" class="scifi-btn scifi-btn-secondary" @click="onScan">
                        <el-icon class="scifi-icon">
                            <IconSearch />
                        </el-icon>
                        重新扫描图片
                    </button>
                    <button v-if="images.length" class="delete-all-btn scifi-btn scifi-btn-danger" :disabled="running"
                        @click="removeAllImages">
                        <el-icon class="scifi-icon">
                            <IconDelete />
                        </el-icon>
                        清空列表
                    </button>
                </div>

                <div class="filters">
                    <el-checkbox v-model="includeBase64">包含 Base64 图片</el-checkbox>
                    <el-input v-model="filterText" placeholder="过滤图片URL" clearable
                        style="width: 200px; margin-left: 10px;">
                        <template #prefix>
                            <el-icon class="scifi-icon-small">
                                <IconSearch />
                            </el-icon>
                        </template>
                    </el-input>
                </div>

                <div class="status scifi-status">
                    <h3 class="scifi-status-title">
                        <el-icon class="scifi-icon">
                            <IconInfo />
                        </el-icon>
                        扫描结果
                    </h3>
                    <p>共找到 {{ images.length }} 张图片 ({{ filteredImages.length }} 张显示)</p>
                </div>

                <div class="progress-container scifi-progress-container" v-if="running">
                    <div class="progress-bg">
                        <div class="progress-bar scifi-progress-bar" :style="{ width: progress + '%' }" />
                    </div>
                    <span class="progress-text scifi-progress-text">{{ Math.round(progress) }}%</span>
                </div>
            </div>

            <!-- 图片预览 -->
            <div class="image-gallery scifi-gallery">
                <div v-for="(img, idx) in filteredImages" :key="img.src + idx" class="image-card scifi-card">
                    <div class="scifi-card-bg"></div>
                    <div class="image-wrapper">
                        <img :src="img.src" :alt="`Image ${idx}`" @load="img.loaded = true">
                        <div class="image-overlay scifi-overlay">
                            <button class="delete-btn scifi-icon-btn scifi-icon-btn-danger" @click="removeImage(idx)"
                                title="删除图片">
                                <el-icon class="scifi-icon-small">
                                    <IconDelete />
                                </el-icon>
                            </button>
                            <button class="download-single-btn scifi-icon-btn scifi-icon-btn-primary"
                                @click="downloadSingle(img)" title="单独下载">
                                <el-icon class="scifi-icon-small">
                                    <IconDownload />
                                </el-icon>
                            </button>
                        </div>
                        <div v-if="!img.loaded" class="image-loading scifi-loading">
                            <el-icon class="scifi-icon-large scifi-loading-spin">
                                <IconLoading />
                            </el-icon>
                        </div>
                    </div>
                    <div class="image-info">
                        <span class="image-type" :class="{ 'base64': img.isBase64 }">
                            {{ img.isBase64 ? 'Base64' : 'URL' }}
                        </span>
                        <el-tooltip :content="img.src" placement="top">
                            <span class="image-url">{{ truncateUrl(img.src) }}</span>
                        </el-tooltip>
                    </div>
                </div>

                <div v-if="!filteredImages.length && scanned" class="empty-gallery scifi-empty">
                    <div class="scifi-empty-content">
                        <el-icon class="scifi-icon-large">
                            <IconDocument />
                        </el-icon>
                        <p class="scifi-empty-text">没有找到图片或过滤后无结果</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 使用说明 -->
        <div class="instructions scifi-instructions">
            <h3 class="scifi-instructions-title">
                <el-icon class="scifi-icon">
                    <IconInfo />
                </el-icon>
                使用说明
            </h3>
            <ul>
                <li v-for="(item, index) in instructions" :key="index" class="scifi-instruction-item">
                    {{ item }}
                </li>
            </ul>
        </div>

        <footer class="scifi-footer">
            <div class="scifi-footer-content">
                © 2023 图片资源压缩下载工具 | 基于 JSZip 与 FileSaver.js
            </div>
        </footer>
        <!-- 科幻风格确认对话框 -->
        <SciFiConfirmDialog :visible="dialogVisible" :title="dialogTitle" :message="dialogMessage" confirm-text="确定"
            cancel-text="取消" loading-text="执行中..." @confirm="handleDialogConfirm" @cancel="handleDialogCancel"
            @close="dialogCallback = null" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { IconDownload, IconSearch, IconDelete, IconInfo, IconSetting, IconDocument, IconLoading, IconCircleCheck } from '@icons/index'
import { scanImages, downloadAllImages, downloadSingleImage } from '@/utils/image-zip-download'
import { SciFiConfirmDialog } from '@components/index'
import { ImageInfo } from '@/assets/types/utils'

const containerRef = ref<HTMLElement | null>(null)

const emit = defineEmits(['add-message'])

// 使用说明
const instructions = ref([
    "点击'重新扫描图片'可刷新检测",
    "支持 Base64 图片和普通 URL 图片",
    "可以删除不需要下载的图片",
    "支持单独下载某张图片",
    "点击'下载所有图片'即可打包为 ZIP"
])

// 消息框状态管理
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
let dialogCallback: (() => void) | null = null

// 自定义消息框函数
const $msgbox = (title: string, message: string, confirmCallback: () => void) => {
    dialogTitle.value = title
    dialogMessage.value = message
    dialogCallback = confirmCallback
    dialogVisible.value = true
}

// 处理对话框确认
const handleDialogConfirm = () => {
    if (dialogCallback) {
        dialogCallback()
    }
    dialogVisible.value = false
    dialogCallback = null
}

// 处理对话框取消
const handleDialogCancel = () => {
    dialogVisible.value = false
    dialogCallback = null
}

const images = ref<ImageInfo[]>([])
const progress = ref(0)
const running = ref(false)
const scanned = ref(false)
const includeBase64 = ref(true)
const filterText = ref('')

// 过滤后的图片列表
const filteredImages = computed(() => {
    let result = images.value

    // 过滤 Base64 图片
    if (!includeBase64.value) {
        result = result.filter(img => !img.isBase64)
    }

    // 关键词过滤
    if (filterText.value) {
        const keyword = filterText.value.toLowerCase()
        result = result.filter(img =>
            img.src.toLowerCase().includes(keyword) ||
            (img.alt && img.alt.toLowerCase().includes(keyword))
        )
    }

    return result
})

async function onScan() {
    images.value = scanImages(document) as ImageInfo[]
    scanned.value = true

    if (images.value.length > 0) {
        emit('add-message', {
            message: `找到 ${images.value.length} 张图片`,
            type: "success"
        })
    } else {
        emit('add-message', {
            message: '未找到图片',
            type: "info"
        })
    }
}

async function onDownload() {
    if (!images.value.length) {
        emit('add-message', {
            message: '没有找到可下载的图片！',
            type: "warning"
        })
        return
    }

    running.value = true
    progress.value = 0

    try {
        await downloadAllImages(images.value, {
            onProgress: (p: number) => (progress.value = p),
            fileName: 'page_images.zip'
        })
        emit('add-message', {
            message: '图片打包下载完成！',
            type: "success"
        })
    } catch (e: any) {
        maLogger.error(e)
        emit('add-message', {
            message: '打包失败: ' + e.message,
            type: "error"
        })
    } finally {
        running.value = false
    }
}

// 单独下载图片
async function downloadSingle(img: ImageInfo) {
    try {
        await downloadSingleImage(img.src, img.name)
        emit('add-message', {   
            message: '图片下载完成！',
            type: "success"
        })
    } catch (error: any) {
        emit('add-message', {   
            message: '下载失败: ' + error.message,
            type: "error"
        })
        maLogger.error('下载错误:', error)
    }
}

// 移除单张图片
function removeImage(index: number) {
    $msgbox('确定删除',
        '确定要删除这张图片吗？',
        () => {
            images.value.splice(index, 1)
            emit('add-message', {   
                message: '图片已删除',
                type: "success"
            })
        })
}

// 移除所有图片
function removeAllImages() {
    if (!images.value.length) return

    $msgbox('确定删除',
        '确定要清空所有图片吗？',
        () => {
            images.value = []
            emit('add-message', {   
                message: '已清空所有图片',
                type: "success"
            })
        })
}

// 截断长URL显示
function truncateUrl(url: string, maxLength: number = 30): string {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
}

onMounted(onScan)
</script>

<style scoped>
/* 组件局部样式变量 */
.image-zip-downloader {
    --scifi-primary: #3b82f6;
    --scifi-secondary: #8b5cf6;
    --scifi-accent: #10b981;
    --scifi-danger: #ef4444;
    --scifi-bg: #050a14;
    --scifi-card-bg: #0a1122;
    --scifi-text: #ffffff;
    --scifi-text-secondary: #e0e7ff;
    --scifi-text-tertiary: #c7d2fe;
    --scifi-border: #2563eb;
    --scifi-glow: 0 0 8px rgba(59, 130, 246, 0.5);
    --scifi-glow-secondary: 0 0 12px rgba(139, 92, 246, 0.5);
}

/* 图标样式 */
.scifi-icon {
    width: auto;
    height: auto;
    display: inline-block;
    margin-right: 6px;
    color: var(--scifi-primary);
    font-size: 20px;
}

.scifi-icon-small {
    width: auto;
    height: auto;
    display: inline-block;
    margin-right: 4px;
    color: var(--scifi-primary);
    font-size: 16px;
}

.scifi-icon-large {
    width: auto;
    height: auto;
    display: inline-block;
    color: var(--scifi-primary);
    font-size: 24px;
}

/* 图标样式调整 */
.scifi-icon,
.scifi-icon-small,
.scifi-icon-large {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: auto !important;
    height: auto !important;
}

.scifi-icon svg,
.scifi-icon-small svg,
.scifi-icon-large svg {
    width: auto !important;
    height: auto !important;
    font-size: inherit !important;
    fill: currentColor !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* 调整 Element Plus 图标的默认大小 */
.el-icon {
    width: auto !important;
    height: auto !important;
    font-size: inherit !important;
}

.el-icon svg {
    width: auto !important;
    height: auto !important;
    font-size: inherit !important;
}

/* 图标按钮内的 Element Plus 图标调整 */
.scifi-icon-btn .el-icon {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 20px !important;
}

.scifi-icon-btn .el-icon svg {
    width: 20px !important;
    height: 20px !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: inherit !important;
}

.scifi-loading-spin {
    animation: scifiSpin 1s linear infinite;
}

.image-zip-downloader {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, var(--scifi-bg) 0%, #0f172a 100%);
    color: var(--scifi-text);
    border-radius: 12px;
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.2);
}

/* 科幻风格图标容器 */
.scifi-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 2px var(--scifi-primary));
    position: relative;
}

.scifi-icon::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120%;
    height: 120%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.scifi-icon:hover::after {
    opacity: 1;
}

/* 科幻风格头部 */
.scifi-header {
    text-align: center;
    margin-bottom: 40px;
    padding: 30px 20px;
    background: rgba(10, 17, 34, 0.7);
    border-radius: 12px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    backdrop-filter: blur(10px);
}

.scifi-title-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 15px;
}

.scifi-header h1 {
    font-size: 2rem;
    margin: 0;
    background: linear-gradient(90deg, var(--scifi-primary) 0%, var(--scifi-secondary) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    position: relative;
    font-weight: 700;
    color: var(--scifi-primary);
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
    filter: none;
}

.scifi-header h1::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 2px;
    background: linear-gradient(90deg, var(--scifi-primary) 0%, var(--scifi-secondary) 100%);
    filter: blur(2px);
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.5);
}

.subtitle {
    font-size: 1rem;
    opacity: 0.9;
    color: var(--scifi-text-secondary);
    max-width: 600px;
    margin: 12px auto 0;
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
    line-height: 1.5;
    font-weight: 500;
}

.content {
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    margin-bottom: 30px;
    justify-content: center;
}

/* 科幻风格控制面板 */
.scifi-panel {
    background: rgba(10, 17, 34, 0.8);
    border-radius: 12px;
    padding: 25px;
    width: 320px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.scifi-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, var(--scifi-primary) 50%, transparent 100%);
}

.scifi-panel-title {
    font-size: 1.2rem;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--scifi-text);
    font-weight: 600;
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.scifi-panel-title::after {
    content: '';
    flex: 1;
    height: 1px;
    margin-left: 8px;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.7) 0%, transparent 100%);
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.control-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 15px;
}

/* 科幻风格按钮 */
.scifi-btn {
    padding: 12px 18px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: rgba(10, 17, 34, 0.8);
    color: var(--scifi-text);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    font-weight: 500;
    text-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
}

.scifi-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
    transition: left 0.5s ease;
}

.scifi-btn:hover::before {
    left: 100%;
}

.scifi-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.scifi-btn:active:not(:disabled) {
    transform: translateY(1px);
}

.scifi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
}

/* 按钮类型 */
.scifi-btn-primary {
    border-color: var(--scifi-primary);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.scifi-btn-primary:hover:not(:disabled) {
    border-color: var(--scifi-secondary);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%);
}

.scifi-btn-secondary {
    border-color: rgba(59, 130, 246, 0.5);
}

/* 移除Element Plus对话框样式，使用自定义的SciFiConfirmDialog组件 */

.scifi-btn-secondary:hover:not(:disabled) {
    border-color: var(--scifi-primary);
}

.scifi-btn-danger {
    border-color: var(--scifi-danger);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
}

.scifi-btn-danger:hover:not(:disabled) {
    border-color: var(--scifi-danger);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
}

.filters {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 10px;
}

/* 科幻风格状态信息 */
.scifi-status {
    margin-bottom: 15px;
    padding: 12px;
    border-radius: 6px;
    background: rgba(10, 17, 34, 0.7);
    text-align: center;
    border: 1px solid rgba(59, 130, 246, 0.2);
}

.scifi-status-title {
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 1rem;
    color: var(--scifi-text);
    font-weight: 500;
    text-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
}

.scifi-status p {
    color: var(--scifi-text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
    text-shadow: 0 0 6px rgba(59, 130, 246, 0.2);
    font-weight: 500;
}

/* 科幻风格进度条 */
.scifi-progress-container {
    width: 100%;
    height: 28px;
    position: relative;
    border-radius: 14px;
    margin-bottom: 20px;
}

.progress-bg {
    width: 100%;
    height: 100%;
    background: rgba(10, 17, 34, 0.7);
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.scifi-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--scifi-primary) 0%, var(--scifi-secondary) 100%);
    border-radius: 14px;
    transition: width 0.3s ease;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
    position: relative;
    overflow: hidden;
}

.scifi-progress-bar::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    animation: progressShine 2s infinite;
}

@keyframes progressShine {
    0% {
        left: -100%;
    }

    100% {
        left: 100%;
    }
}

.scifi-progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--scifi-text);
    font-size: 14px;
    font-weight: bold;
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
    letter-spacing: 0.5px;
}

/* 科幻风格图片库 */
.scifi-gallery {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
    min-height: 300px;
}

/* 科幻风格图片卡片 */
.scifi-card {
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
    position: relative;
    border: 1px solid rgba(59, 130, 246, 0.2);
    background: var(--scifi-card-bg);
    backdrop-filter: blur(5px);
}

.scifi-card-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
    z-index: 0;
}

.scifi-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
    border-color: var(--scifi-primary);
}

.scifi-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--scifi-primary), transparent);
    z-index: 2;
    transform: scaleX(0.8);
    transition: all 0.3s ease;
}

.scifi-card:hover::before {
    height: 2px;
    background: linear-gradient(90deg, var(--scifi-primary), var(--scifi-secondary));
    transform: scaleX(1);
    box-shadow: var(--scifi-glow);
}

.image-wrapper {
    position: relative;
    width: 100%;
    height: 150px;
    overflow: hidden;
    z-index: 1;
}

.image-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: rgba(10, 17, 34, 0.5);
    transition: transform 0.5s ease;
}

.scifi-card:hover .image-wrapper img {
    transform: scale(1.05);
}

/* 科幻风格覆盖层 */
.scifi-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.8));
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(2px);
    z-index: 2;
}

.scifi-card:hover .scifi-overlay {
    opacity: 1;
}

/* 科幻风格图标按钮 */
.scifi-icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(10, 17, 34, 0.8);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.scifi-icon-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s ease;
}

.scifi-icon-btn:hover::before {
    left: 100%;
}

.scifi-icon-btn-primary {
    border-color: var(--scifi-primary);
}

.scifi-icon-btn-primary:hover {
    background: rgba(59, 130, 246, 0.2);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

.scifi-icon-btn-danger {
    border-color: var(--scifi-danger);
}

.scifi-icon-btn-danger:hover {
    background: rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
}

.image-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.8);
}

.loading-icon {
    font-size: 24px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.image-info {
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    position: relative;
    z-index: 1;
}

.image-type {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--scifi-primary);
    color: white;
    margin-right: 8px;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 700;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.image-type.base64 {
    background: var(--scifi-accent);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
}

.image-url {
    font-size: 13px;
    color: var(--scifi-text-secondary);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 8px;
    font-family: 'Courier New', monospace;
    line-height: 1.4;
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.2);
    font-weight: 500;
}

.scifi-empty {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    padding: 30px;
    background: rgba(10, 17, 34, 0.7);
    border-radius: 12px;
    border: 1px dashed rgba(59, 130, 246, 0.3);
}

.scifi-empty-content {
    text-align: center;
}

.scifi-empty-text {
    margin-top: 15px;
    color: var(--scifi-text-secondary);
    font-size: 1.2rem;
    line-height: 1.5;
}

.scifi-instructions {
    background: rgba(10, 17, 34, 0.8);
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 30px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
    backdrop-filter: blur(5px);
    position: relative;
    overflow: hidden;
}

.scifi-instructions::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--scifi-primary), transparent);
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.scifi-instructions-title {
    font-size: 1.2rem;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--scifi-text);
    font-weight: 600;
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.scifi-instructions-title::after {
    content: '';
    flex: 1;
    height: 1px;
    margin-left: 8px;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.7), transparent);
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.scifi-instructions ul {
    list-style: none;
    padding: 0;
}

.scifi-instruction-item {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--scifi-text);
    padding: 8px 0;
    position: relative;
    transition: transform 0.3s ease;
    font-size: 1rem;
    line-height: 1.5;
    text-shadow: 0 0 6px rgba(59, 130, 246, 0.2);
    font-weight: 500;
}

.scifi-instruction-item:hover {
    transform: translateX(5px);
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
}

.scifi-icon-check {
    color: var(--scifi-accent);
    filter: drop-shadow(0 0 4px var(--scifi-accent));
    flex-shrink: 0;
    width: 20px;
    height: 20px;
}

.scifi-footer {
    text-align: center;
    opacity: 0.9;
    padding: 15px;
    color: var(--scifi-text-secondary);
    border-top: 1px solid rgba(59, 130, 246, 0.2);
    margin-top: 20px;
    position: relative;
}

.scifi-footer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--scifi-primary), transparent);
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.scifi-footer-content {
    font-size: 0.9rem;
    letter-spacing: 0.6px;
    line-height: 1.5;
    text-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
    font-weight: 500;
}

@media (max-width: 768px) {
    .content {
        flex-direction: column;
    }

    .control-panel {
        width: 100%;
    }

    .image-gallery {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }

    .filters {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>