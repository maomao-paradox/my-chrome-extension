<template>
    <div class="section-container">
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

<style scoped>
.section-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.section-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
}

.section-hero__right {
    max-width: 50%;
}

.section-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
</style>
