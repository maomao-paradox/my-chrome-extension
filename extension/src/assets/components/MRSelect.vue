<template>
  <div class="select-wrapper">
    <label v-if="label" :for="id" class="select-label">{{ label }}</label>
    <select
      :id="id"
      v-model="localValue"
      :disabled="disabled"
      :class="['form-input', { 'has-error': error }]"
      @change="handleChange"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Option = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: "",
  },
  options: {
    type: Array as () => Option[],
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: "",
  },
  id: {
    type: String,
    default: "",
  },
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const handleChange = (event: Event) => {
  emit("change", event);
};
</script>

<style scoped>
.select-wrapper {
  margin-bottom: 16px;
}

.select-label {
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
  border-color: #ff5252;
}

.error-message {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #ff5252;
}
</style>
