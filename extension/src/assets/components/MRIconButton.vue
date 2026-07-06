<template>
  <button
    class="btn-icon-small"
    :class="{ 'delete-action': variant === 'delete' }"
    :disabled="disabled"
    :title="tooltip"
    @click="$emit('click')"
  >
    {{ icon }}
  </button>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  icon: {
    type: String,
    required: true
  },
  tooltip: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value: string) => ['default', 'delete'].includes(value)
  }
});

const emit = defineEmits(['click']);
</script>

<style scoped>
.btn-icon-small {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.btn-icon-small:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon-small.delete-action:hover:not(:disabled) {
  color: #FF5252 !important;
  background: rgba(255, 82, 82, 0.1) !important;
}

.btn-icon-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>