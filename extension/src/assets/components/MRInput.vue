<template>
  <div class="input-wrapper">
    <label v-if="label" :for="id" class="input-label">{{ label }}</label>
    <input
      :id="id"
      :type="type"
      v-model="localValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="['form-input', { 'has-error': error }]"
      @input="handleInput"
      @change="handleChange"
    />
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'input', 'change']);

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const handleInput = (event: Event) => {
  emit('input', event);
};

const handleChange = (event: Event) => {
  emit('change', event);
};
</script>

<style scoped>
.input-wrapper {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: var(--glow-primary);
}

.form-input:disabled {
  background: var(--bg-disabled);
  opacity: 0.6;
  cursor: not-allowed;
}

.form-input.has-error {
  border-color: #FF5252;
}

.error-message {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #FF5252;
}
</style>