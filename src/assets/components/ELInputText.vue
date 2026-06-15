<template>
    <div>
        <label>{{ label }}</label>
        <input type="text" v-model="value" />
    </div>
</template>

<script setup lang="ts">
// 定义类型
interface Props {
  value?: string;
  label?: string;
}

// 定义props和emits
defineProps<Props>();
defineEmits<{
  'update:value': [value: string];
}>();
</script>