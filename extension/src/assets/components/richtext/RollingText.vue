<template>
    <a ref="rollingTextRef" class="rolling-text" href="#">
        <div class='block'>
            <span v-for="(letter, i) in props.text" :key="i" class="letter"
                :style="{ transitionDelay: i * 0.015 + 's' }">
                {{ letter.trim() === '' ? '\xa0' : letter }}
            </span>
        </div>
        <div class='block-shadow'>
            <span v-for="(letter, i) in props.text" :key="i" class="letter"
                :style="{ transitionDelay: i * 0.015 + 's' }">
                {{ letter.trim() === '' ? '\xa0' : letter }}
            </span>
        </div>
    </a>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface RollingTextProps {
    text: string;
}

const props = defineProps<RollingTextProps>();

const rollingTextRef = ref<HTMLAnchorElement>();

onMounted(() => {
  // for presentation purpose
  setTimeout(() => {
    rollingTextRef.value?.classList.add('play');
  }, 600);

  rollingTextRef.value?.addEventListener('mouseover', () => {
    rollingTextRef.value?.classList.remove('play');
  });
});

onUnmounted(() => {
  rollingTextRef.value?.removeEventListener('mouseover', () => {
    rollingTextRef.value?.classList.remove('play');
  });
});
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap");

html,
body {
    width: 100%;
    height: 100%;
    background-color: #f5f6f3;
}

body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0;
}
</style>

<style scoped>
.rolling-text {
    display: inline-block;
    font-family: 'Playfair Display', serif;
    font-size: 48px;
    line-height: 72px;
    letter-spacing: 24px;
    height: 72px;
    text-decoration: none;
    overflow: hidden;
    color: #1a1a1a;
}

.rolling-text:hover .letter,
.rolling-text.play .letter {
    transform: translateY(-100%);
}

.rolling-text .block-shadow .letter {
    color: #4de21f;
}

.rolling-text .letter {
    display: inline-block;
    transition: transform 0.6s cubic-bezier(0.76, 0, 0.24, 1);
}

/* 移除硬编码的 transition-delay，改为在 JavaScript 中动态设置 */
</style>