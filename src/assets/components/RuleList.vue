<template>
    <div class="card">
        <h2 class="card-title"><span class="icon">📋</span>已配置规则</h2>

        <div v-if="!rules.length" class="empty-state">
            <div class="icon">📭</div>
            <p>尚未添加任何规则</p>
        </div>

        <div v-for="rule in rules" :key="rule.id" class="rule-item">
            <div class="rule-header">
                <div class="rule-title">
                    <span :class="['status', rule.enabled ? '' : 'inactive']"></span>
                    {{ rule.urlPattern }}
                </div>
                <div class="rule-actions">
                    <button @click="toggle(rule.id)" :title="rule.enabled ? '停用规则' : '启用规则'">
                        {{ rule.enabled ? '⏸️' : '▶️' }}
                    </button>
                    <button @click="edit(rule)" title="编辑规则">✏️</button>
                    <button @click="del(rule.id)" title="删除规则">🗑️</button>
                </div>
            </div>

            <div class="rule-details">
                <div class="rule-detail">
                    <h4>响应类型</h4>
                    <div class="rule-content">{{ rule.responseType.toUpperCase() }}</div>
                </div>
                <div class="rule-detail">
                    <h4>修改后的响应：</h4>
                    <div class="rule-content">{{ rule.responseData }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Rule } from '@types/index'

interface RuleProps {
    rules: Rule[]
}

const props = defineProps<RuleProps>()
const rules = ref(props.rules)

const emit = defineEmits(['toggle', 'edit', 'delete'])

const toggle = (id: number) => emit('toggle', id)
const edit = (rule: Rule) => emit('edit', rule)
const del = (id: number) => emit('delete', id)
</script>

<style scoped>
/* 使用全局定义的CSS变量 */

.card {
    background: var(--bg-card) !important;
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    padding: 25px;
    margin-bottom: 25px;
    border: 1px solid var(--border-color);
}

.card-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 1.4rem;
    color: var(--primary-light);
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-light);
}

.card-title .icon {
    background: rgba(22, 93, 255, 0.15);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    color: var(--primary-light);
}

/* 空状态样式 */
.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-tertiary);
}

.empty-state .icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

.empty-state p {
    font-size: 16px;
    margin: 0;
}

/* 规则项样式 */
.rule-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    transition: all var(--transition-fast);
}

.rule-item:hover {
    border-color: var(--primary-light);
    box-shadow: var(--glow-secondary);
}

.rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.rule-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.status {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--secondary);
    box-shadow: 0 0 8px var(--secondary);
}

.status.inactive {
    background: var(--text-tertiary);
    box-shadow: none;
}

.rule-actions {
    display: flex;
    gap: 8px;
}

.rule-actions button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: all var(--transition-fast);
    font-size: 16px;
}

.rule-actions button:hover {
    background: var(--bg-hover);
    transform: scale(1.1);
}

/* 规则详情样式 */
.rule-details {
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
}

.rule-detail {
    margin-bottom: 12px;
}

.rule-detail:last-child {
    margin-bottom: 0;
}

.rule-detail h4 {
    font-size: 13px;
    color: var(--text-tertiary);
    margin-bottom: 6px;
    font-weight: 600;
}

.rule-content {
    font-size: 13px;
    color: var(--text-secondary);
    background: rgba(30, 41, 59, 0.5);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    overflow-y: visible;
    font-family: 'Fira Code', 'Consolas', monospace;
    line-height: 1.4;
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

.instructions {
    background: #e8f0fe;
    border-left: 4px solid var(--primary);
    padding: 20px;
    border-radius: 0 8px 8px 0;
    margin-top: 20px;
}

.instructions h3 {
    margin-bottom: 12px;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 10px;
}

.instructions ol {
    padding-left: 22px;
}

.instructions li {
    margin-bottom: 10px;
    line-height: 1.6;
}

footer {
    text-align: center;
    padding: 20px;
    color: var(--gray);
    font-size: 0.9rem;
    border-top: 1px solid var(--border);
    background: #f8f9fa;
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