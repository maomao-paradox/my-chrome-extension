<template>
    <div class="section-container" :class="`section-container--${density}`" :style="containerStyle">
        <section class="section-hero">
            <div class="section-hero__left">
                <slot name="head__left"></slot>
            </div>
            <div class="section-hero__right">
                <slot name="head__right"></slot>
            </div>
        </section>

        <section class="section-content">
            <slot name="default"></slot>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';

const props = withDefaults(defineProps<{
    density?: 'default' | 'compact';
    sectionGap?: string;
    contentGap?: string;
    heroGap?: string;
    rightMaxWidth?: string;
    titleFontSize?: string;
    titleFontWeight?: string | number;
    textFontSize?: string;
}>(), {
    density: 'default',
    sectionGap: '14px',
    contentGap: '14px',
    heroGap: '12px',
    rightMaxWidth: '50%',
    titleFontSize: '16px',
    titleFontWeight: 500,
    textFontSize: '12px',
});

const containerStyle = computed<CSSProperties>(() => ({
    '--table-section-gap': props.sectionGap,
    '--table-content-gap': props.contentGap,
    '--table-hero-gap': props.heroGap,
    '--table-right-max-width': props.rightMaxWidth,
    '--table-title-font-size': props.titleFontSize,
    '--table-title-font-weight': String(props.titleFontWeight),
    '--table-text-font-size': props.textFontSize,
}));
</script>

<style scoped lang="scss">
@font-face {
    font-family: 'AaDracula';
    src: url('/static/fonts/AaDracula.woff2') format('woff2'),
        url('/static/fonts/AaDracula.woff') format('woff');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}

.section-container,
.section-content {
    display: flex;
    flex-direction: column;
}

.section-container {
    gap: var(--table-section-gap);
}

.section-content {
    gap: var(--table-content-gap);
}

.section-container--compact {
    .section-hero {
        align-items: center;
    }
}

.section-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--table-hero-gap);

    &__left {
        min-width: 0;

        :deep(h1),
        :deep(h3),
        :deep(h2) {
            font-family: "AaDracula", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: var(--table-title-font-size);
            font-weight: var(--table-title-font-weight);
        }

        :deep(p) {
            font-size: var(--table-text-font-size);
        }
    }

    &__right {
        flex-shrink: 0;
        max-width: var(--table-right-max-width);
    }
}
</style>
