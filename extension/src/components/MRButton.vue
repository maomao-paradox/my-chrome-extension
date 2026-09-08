<template>
  <button
    :class="['btn', `btn-${type}`, { 'btn-sm': size === 'small' }]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <span v-if="icon" class="btn-icon">{{ icon }}</span>
    <span v-if="$slots.default"><slot></slot></span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps({
  type: {
    type: String,
    default: "primary",
    validator: (value: string) =>
      ["primary", "secondary", "danger", "outline"].includes(value),
  },
  size: {
    type: String,
    default: "medium",
    validator: (value: string) => ["small", "medium"].includes(value),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["click"]);
</script>

<style scoped>
.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn.btn-sm {
  padding: 8px 12px;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-md), var(--glow-primary);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-hover);
  border-color: var(--border-color);
  color: var(--primary-light);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(22, 93, 255, 0.15);
  border-color: var(--primary-light);
}

.btn-danger {
  background: rgba(255, 82, 82, 0.1);
  border-color: rgba(255, 82, 82, 0.3);
  color: #ff5252;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.2);
  border-color: #ff5252;
}

.btn-outline {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary-light);
  color: var(--primary-light);
  background: var(--bg-hover);
}

.btn-icon {
  font-size: 14px;
}
</style>
