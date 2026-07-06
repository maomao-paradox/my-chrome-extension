<template>
  <div class="mt-input el-input el-input--suffix" style="width:255px; position:relative; top: 10px; left: 5px;">
    <input type="text" :placeholder="placeholder" class="el-input__inner el-icon-search" :value="searchValue"
      @input="handleSearch">
    <span class="el-input__suffix el-input__icon el-icon-search"></span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// 定义防抖函数的类型
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  if (typeof func !== "function") {
    throw new Error("func is not a function");
  }
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    //@ts-ignore
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// 定义props类型
interface Props {
  placeholder?: string;
  handleInput: (e: Event) => void;
}

// 定义props和初始化默认值
const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入搜索内容'
});

// 响应式数据
const searchValue = ref('');

// 处理搜索输入
function handleSearch(e: Event) {
  const input = e.target as HTMLInputElement;
  searchValue.value = input.value;
  debounce(props.handleInput, 300)(e);
}
</script>
