<template>
    <div id="hero-slides" ref="heroRef">
        <div id="header">
            <div id="logo"></div>
            <div id="menu" ref="menuRef">
                <div id="hamburger">
                    <div v-for="(slice, index) in 3" :key="index" class="slice"></div>
                </div>
            </div>
        </div>
        <div id="slides-cont">
            <div v-for="(button, index) in ['next', 'prev']" :id="button" :key="index" class="button"></div>
            <div id="slides" ref="slidesRef">
                <div v-for="(slide, index) in props.slides" :key="index" class="slide"
                    :style="{ backgroundImage: `url(${slide.url})` }">
                    <div class="number">{{ index + 1 }}</div>
                    <div class="body">
                        <div class="location">{{ slide.author }}</div>
                        <div class="headline">{{ slide.description }}</div>
                        <a href="#">
                            <div class="link">View on Unsplash</div>
                        </a>
                    </div>
                </div>
            </div>
            <div v-for="(button, index) in ['next-catch', 'prev-catch']" :id="button" :key="index"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Slide {
    url: string;
    author: string;
    description: string;
}

interface Props {
    slides?: Slide[];
    autoPlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoPlay: true,
  slides: () => {
    const slide = {
      url: 'https://www.dmoe.cc/random.php',
      author: 'Benjamin Hung',
      description: 'Photo by Benjamin Hung'
    };

    const slides: Slide[] = [];

    for (let i = 0; i < 10; i++) {
      slides.push({
        ...slide,
        url: slide.url + '?t=' + i.toString()
      });
    }
    return slides;
  }
});

const heroRef = ref<HTMLElement>();
const menuRef = ref<HTMLElement>();
const slidesRef = ref<HTMLElement>();
const currentPage = ref(0);
const slidesPerPage = () => window.innerWidth > 1700 ? 4 : window.innerWidth > 1200 ? 3 : 2;
const maxPageCount = () => Math.max(0, (props.slides.length / slidesPerPage()) - 1);

function goToPage(pageNumber = 0) {
  maLogger.log('正在前往页面', pageNumber);
  currentPage.value = Math.min(maxPageCount(), Math.max(0, pageNumber));
  maLogger.log(currentPage.value);
  heroRef.value?.style.setProperty('--page', currentPage.value.toString());
}

function sleep(time: number) {
  return new Promise(res => setTimeout(res, time));
}

function hoverSlide(index: number) {
  if (index >= 0 && index < props.slides.length) {
    slidesRef.value?.children[index].classList.add('hover');
  }
}

function unhoverSlide(index: number) {
  if (index >= 0 && index < props.slides.length) {
    slidesRef.value?.children[index].classList.remove('hover');
  }
}
function handleResize() {
  // 重新计算当前页面，确保在窗口大小变化时保持正确的页面
  goToPage(currentPage.value);
}
const currentlyDemoing = ref<boolean>(false);
async function demo() {
  maLogger.log('demo', currentlyDemoing.value);
  if (currentlyDemoing.value) {
    return;
  }
  maLogger.log(currentPage.value);
  currentlyDemoing.value = true;
  if (currentPage.value !== 0) {
    goToPage(0);
    await sleep(800);
  }
  const slidesPerPageValue = slidesPerPage();
  const pageSeq_ = { 2: [1, 2, 1], 3: [1, 2, 0], 4: [1, 1, 0] };
  const pageSeq = pageSeq_[slidesPerPageValue] || pageSeq_[4];
  const slideSeq_ = { 2: [2, 4, 3], 3: [3, 6, 2], 4: [3, 6, 2] };
  const slideSeq = slideSeq_[slidesPerPageValue] || slideSeq_[2];
  await sleep(300);
  goToPage(pageSeq[0]);
  await sleep(500);
  hoverSlide(slideSeq[0]);
  await sleep(1200);
  goToPage(pageSeq[1]);
  unhoverSlide(slideSeq[0]);
  await sleep(500);
  hoverSlide(slideSeq[1]);
  await sleep(1200);
  goToPage(pageSeq[2]);
  unhoverSlide(slideSeq[1]);
  await sleep(300);
  hoverSlide(slideSeq[2]);
  await sleep(1600);
  goToPage(0);
  unhoverSlide(slideSeq[2]);
  currentlyDemoing.value = false;
}

onMounted(() => {
  if (!heroRef.value || !menuRef.value || !slidesRef.value) {return;}

  const next = ['next', 'next-catch'].map(n => document.getElementById(n));
  const prev = ['prev', 'prev-catch'].map(n => document.getElementById(n));

  maLogger.log('next', next);
  maLogger.log('prev', prev);

  next.forEach(n => n?.addEventListener('click', () => !currentlyDemoing.value && goToPage(currentPage.value + 1)));
  prev.forEach(n => n?.addEventListener('click', () => !currentlyDemoing.value && goToPage(currentPage.value - 1)));
  menuRef.value?.addEventListener('click', demo);
  window.addEventListener('resize', handleResize);

  sleep(100).then(demo);
});
// 清理事件监听器
onUnmounted(() => {
  const next = ['next', 'next-catch'].map(n => document.getElementById(n));
  const prev = ['prev', 'prev-catch'].map(n => document.getElementById(n));
  const currentlyDemoing = false;
  next.forEach(n => n?.removeEventListener('click', () => !currentlyDemoing && goToPage(currentPage.value + 1)));
  prev.forEach(n => n?.removeEventListener('click', () => !currentlyDemoing && goToPage(currentPage.value - 1)));
  menuRef.value?.removeEventListener('click', demo);
  window.removeEventListener('resize', handleResize);
});

</script>

<style>
body {
    --slides-per-page: 2;
    margin: 0;
    overflow: hidden;
    height: 100vh;
    font-family: 'Roboto Condensed', sans-serif;
    color: white;
}

a {
    text-decoration: none;
    color: inherit;
}
</style>

<style scoped>
@import url("https://fonts.googleapis.com/css?family=Roboto:100,100i,400,900,800i");

#hero-slides {
    --page: 0;
    height: 100vh;
    background: #25303c;
    background: linear-gradient(90deg, #3e4751 0%, #25303c 100%);
}

#hero-slides #header {
    height: 12vh;
    line-height: 12vh;
    padding: 0 3vw;
    position: relative;
}

#hero-slides #header #logo {
    font-size: 2.5vh;
    font-style: italic;
}

#hero-slides #header #logo:before {
    content: 'The';
    text-transform: uppercase;
    font-weight: 100;
    margin-right: 0.4em;
}

#hero-slides #header #logo:after {
    content: 'Wall';
    text-transform: uppercase;
    font-weight: 800;
}

#hero-slides #header #menu {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    cursor: pointer;
    padding: 0 3vw;
}

#hero-slides #header #menu:before {
    font-size: 1.75vh;
    content: 'Play Demo';
    margin-right: 0.5em;
    text-transform: uppercase;
}

#hero-slides #header #menu #hamburger {
    display: inline-block;
}

#hero-slides #header #menu #hamburger .slice {
    background: white;
    height: 0.2vh;
    width: 1vw;
}

#hero-slides #header #menu #hamburger .slice:not(:last-child) {
    margin-bottom: 0.5vh;
}

#hero-slides #slides-cont {
    position: relative;
    --button-height: 6vh;
    --button-spacing: 0.2vh;
}

#hero-slides #slides-cont .button {
    width: 5vw;
    height: var(--button-height);
    background: #0d96f2;
    position: absolute;
    right: 5.375vw;
    top: 38vh;
    z-index: 100;
    cursor: pointer;
}

#hero-slides #slides-cont .button:before,
#hero-slides #slides-cont .button:after {
    line-height: var(--button-height);
    position: absolute;
    margin-left: -0.25vw;
    pointer-events: none;
    -webkit-transform: scale(0.75, 1.5);
    transform: scale(0.75, 1.5);
    transition: 125ms ease-in-out;
}

#hero-slides #slides-cont .button:before {
    left: 50%;
}

#hero-slides #slides-cont .button:after {
    opacity: 0;
}

#hero-slides #slides-cont .button:hover:before,
#hero-slides #slides-cont .button:hover:after {
    transition: 250ms ease-in-out;
}

#hero-slides #slides-cont .button:hover:before {
    opacity: 0;
}

#hero-slides #slides-cont .button:hover:after {
    left: 50% !important;
    opacity: 1;
}

#hero-slides #slides-cont #next {
    margin-top: calc(-1 * (var(--button-height) + var(--button-spacing)));
}

#hero-slides #slides-cont #next:before,
#hero-slides #slides-cont #next:after {
    content: '>';
}

#hero-slides #slides-cont #next:after {
    left: 30%;
}

#hero-slides #slides-cont #next:hover:before {
    left: 70%;
}

#hero-slides #slides-cont #prev {
    margin-top: var(--button-spacing);
    opacity: calc(var(--page) + 0.5);
    transition: 500ms opacity;
}

#hero-slides #slides-cont #prev:before,
#hero-slides #slides-cont #prev:after {
    content: '<';
}

#hero-slides #slides-cont #prev:after {
    left: 70%;
}

#hero-slides #slides-cont #prev:hover:before {
    left: 30%;
}

#hero-slides #slides-cont #next-catch,
#hero-slides #slides-cont #prev-catch {
    width: 10vw;
    height: 76vh;
    position: absolute;
    top: 0;
    z-index: 90;
}

#hero-slides #slides-cont #next-catch {
    right: 0;
}

#hero-slides #slides-cont #prev-catch {
    left: 0;
}

#hero-slides #slides {
    --slides-height: 76vh;
    width: auto;
    height: var(--slides-height);
    padding: 0 10vw;
    font-size: 0;
    white-space: nowrap;
    position: absolute;
    -webkit-transform: translate3D(calc(var(--page) * -80vw), 0, 0);
    transform: translate3D(calc(var(--page) * -80vw), 0, 0);
    transition: 1500ms -webkit-transform cubic-bezier(0.7, 0, 0.3, 1);
    transition: 1500ms transform cubic-bezier(0.7, 0, 0.3, 1);
    transition: 1500ms transform cubic-bezier(0.7, 0, 0.3, 1), 1500ms -webkit-transform cubic-bezier(0.7, 0, 0.3, 1);
}

#hero-slides #slides .slide {
    display: inline-block;
    vertical-align: top;
    font-size: 1.5vw;
    width: 24em;
    height: var(--slides-height);
    margin: 0 1.333em;
    background: #101419;
    color: white;
    background-size: cover;
    background-position: center;
    white-space: normal;
    word-break: break-word;
    position: relative;
}

#hero-slides #slides .slide:before {
    content: '';
    display: block;
    background: linear-gradient(180deg, rgba(86, 97, 108, 0) 0%, rgba(33, 52, 69, 0.7) 100%);
    opacity: 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

#hero-slides #slides .slide .number {
    position: absolute;
    top: 2em;
    left: 2em;
    -webkit-filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.5));
    filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.5));
}

#hero-slides #slides .slide .number,
#hero-slides #slides .slide .number:before,
#hero-slides #slides .slide .number:after {
    vertical-align: middle;
}

#hero-slides #slides .slide .number:before,
#hero-slides #slides .slide .number:after {
    display: inline-block;
    content: '';
    height: 0.133em;
    margin-top: -0.2em;
    background: white;
}

#hero-slides #slides .slide .number:before {
    width: 0;
    margin-left: 0;
}

#hero-slides #slides .slide .number:after {
    width: 3em;
    margin-left: 1em;
}

#hero-slides #slides .slide .body {
    position: absolute;
    bottom: 2em;
    left: 2em;
    right: 2em;
}

#hero-slides #slides .slide .location,
#hero-slides #slides .slide .headline {
    position: relative;
    bottom: 0;
    cursor: default;
}

#hero-slides #slides .slide:before,
#hero-slides #slides .slide .number:before,
#hero-slides #slides .slide .number:after,
#hero-slides #slides .slide .location,
#hero-slides #slides .slide .headline,
#hero-slides #slides .slide .link {
    transition: 375ms cubic-bezier(0.7, 0, 0.3, 1);
}

#hero-slides #slides .slide .location {
    font-weight: 100;
    margin-bottom: 1.5em;
    transition-delay: 60ms;
}

#hero-slides #slides .slide .headline {
    font-size: 2.667em;
    font-weight: 900;
    transition-delay: 50ms;
}

#hero-slides #slides .slide .link {
    display: inline-block;
    background: #0d96f2;
    padding: 0.5em 1.25em;
    font-size: 1.33em;
    opacity: 0;
    position: absolute;
    bottom: -2em;
    pointer-events: none;
    transition-delay: 25ms;
}

#hero-slides #slides .slide.hover:before,
#hero-slides #slides .slide:hover:before {
    opacity: 1;
}

#hero-slides #slides .slide.hover:before,
#hero-slides #slides .slide.hover .number:before,
#hero-slides #slides .slide.hover .number:after,
#hero-slides #slides .slide.hover .location,
#hero-slides #slides .slide.hover .headline,
#hero-slides #slides .slide.hover .link,
#hero-slides #slides .slide:hover:before,
#hero-slides #slides .slide:hover .number:before,
#hero-slides #slides .slide:hover .number:after,
#hero-slides #slides .slide:hover .location,
#hero-slides #slides .slide:hover .headline,
#hero-slides #slides .slide:hover .link {
    transition: 500ms cubic-bezier(0.7, 0, 0.3, 1);
}

#hero-slides #slides .slide.hover .number:before,
#hero-slides #slides .slide:hover .number:before {
    width: 3em;
    margin-right: 1em;
}

#hero-slides #slides .slide.hover .number:after,
#hero-slides #slides .slide:hover .number:after {
    width: 0;
    margin-right: 0;
}

#hero-slides #slides .slide.hover .location,
#hero-slides #slides .slide:hover .location {
    transition-delay: 0;
    bottom: 4em;
}

#hero-slides #slides .slide.hover .headline,
#hero-slides #slides .slide:hover .headline {
    transition-delay: 100ms;
    bottom: 1.5em;
}

#hero-slides #slides .slide.hover .link,
#hero-slides #slides .slide:hover .link {
    bottom: 0;
    opacity: 1;
    transition-delay: 250ms;
    pointer-events: auto;
}

#hero-slides #footer {
    height: 12vh;
    font-size: 1vh;
}

#hero-slides #footer #dribbble {
    border-radius: 2vh;
    position: absolute;
    bottom: 4vh;
    right: 4vh;
    transition: 300ms cubic-bezier(0.7, 0, 0.3, 1);
    padding-left: 1.5vh;
}

#hero-slides #footer #dribbble:before,
#hero-slides #footer #dribbble:after {
    vertical-align: middle;
    transition: inherit;
}

#hero-slides #footer #dribbble:before {
    display: inline;
    content: 'View original Dribbble';
    font-size: 2vh;
    opacity: 0;
    -webkit-transform: translate3D(-200px, 0, 0);
    transform: translate3D(-200px, 0, 0);
}

#hero-slides #footer #dribbble:after {
    content: '';
    display: inline-block;
    width: 4vh;
    height: 4vh;
    margin-left: 1vh;
    background-image: url(https://alca.tv/static/u/82fde61b-28ef-4f17-976e-8f1abb5a1165.png);
    background-size: contain;
    background-position: center;
}

#hero-slides #footer #dribbble.hover,
#hero-slides #footer #dribbble:hover {
    background: #e94e89;
}

#hero-slides #footer #dribbble.hover:before,
#hero-slides #footer #dribbble:hover:before {
    opacity: 1;
    -webkit-transform: translate3D(0, 0, 0);
    transform: translate3D(0, 0, 0);
    transition-delay: 50ms;
}

#hero-slides #footer #dribbble.hover:after,
#hero-slides #footer #dribbble:hover:after {
    -webkit-filter: saturate(0%) contrast(200%) brightness(200%) invert(100%);
    filter: saturate(0%) contrast(200%) brightness(200%) invert(100%);
}

@media (min-width: 1200px) and (max-width: 1699px) {
    body {
        --slides-per-page: 3;
    }

    #hero-slides #slides .slide {
        font-size: 1vw;
    }
}

@media (min-width: 1700px) {
    body {
        --slides-per-page: 4;
    }

    #hero-slides #slides .slide {
        font-size: 0.75vw;
    }
}
</style>