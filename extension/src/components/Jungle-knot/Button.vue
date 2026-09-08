<template>
  <div class="operation-button">
    <div class="operation-button__bg"></div>
    <div class="operation-button__title">
      <slot>
        <span>按钮</span>
      </slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
* {
  --button-border-color: #ffffff7e;
  --shadow-color: #4cafaa7e;
}

.operation-button {
  position: relative;
  width: 150px;
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: transform 0.3s;
  color: #fff;
  text-align: center;
  box-sizing: border-box;
  border-right: 1px solid var(--button-border-color);
  border-bottom: none;
  border-top: none;
  border-left: none;
  box-shadow: 0px 1px 1px var(--shadow-color);

  &:hover {
    transform: translateY(-5px);
  }

  &__bg {
    width: 100%;
    height: 100%;
    position: absolute;
    display: inline-block;

    /* 1. 主体背景：左下白 -> 右上黑，25%~35% 急速过渡 */
    background: linear-gradient(
      70deg,
      #ffffff 0%,
      #ffffff 20%,
      #000000 35%,
      #000000 100%
    );

    font-family: Arial, sans-serif;
    font-weight: bold;

    /* 预留顶部空间，并增加内边距 */
    padding: 10% 10% 5%;
    min-width: 50%;
    min-height: 80%;

    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
      content: "OPERATION";
      position: absolute;
      filter: invert(1);
      top: 0;
      left: 0;
      right: 0;
      height: 25%; /* 标签条高度 */

      /* ✨ 核心改动：背景色采用反向颜色渐变 */
      background-color: black;
      mix-blend-mode: difference;

      font-family: "Times New Roman", Times, serif;
      font-weight: normal;
      font-size: 11px;
      line-height: 12px;
      letter-spacing: 1px;
      z-index: 1;
    }
  }

  &__title {
    position: relative;
    padding-top: 10px;
    font-size: 28px;
    letter-spacing: 2px;
    color: #ffffff; /* 主体文字用深色，因为在白底上 */
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3);
  }
}
</style>
