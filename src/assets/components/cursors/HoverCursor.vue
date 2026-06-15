<template>
    <div class="container" ref="container">
        <header class="cd-header">
            <div class="header-wrapper">
                <div class="logo-wrap">
                    <a href="#" class="hover-target"><span>your</span>logo</a>
                </div>
                <div class="nav-but-wrap">
                    <div class="menu-icon hover-target">
                        <span class="menu-icon__line menu-icon__line-left"></span>
                        <span class="menu-icon__line"></span>
                        <span class="menu-icon__line menu-icon__line-right"></span>
                    </div>
                </div>
            </div>
        </header>

        <div class="nav">
            <div class="nav__content">
                <ul class="nav__list">
                    <li v-for="(item, index) in menu" :key="index" class="nav__list-item">
                        <a href="#" class="hover-target">{{ item }}</a>
                    </li>
                </ul>
            </div>
        </div>

        <div class="section full-height over-hide">
            <div class="switch-wrap">
                <h1 class="hover-target">overlay menu</h1>
                <div id="switch" class="hover-target">
                    <div id="circle"></div>
                </div>
                <p><span>dark</span> - <span>light</span></p>
            </div>
        </div>

        <div class='cursor' ref="cursor1"></div>
        <div class='cursor2' ref="cursor2"></div>
        <div class='cursor3' ref="cursor3"></div>
    </div>
</template>

<script setup lang="ts">
/* Please ? this if you like it! */

import { onMounted, useTemplateRef, ref } from 'vue'

const menu = ref<string[]>([
    "home",
    "studio",
    "news",
    "contact",
]);

const cursor1 = useTemplateRef("cursor1"),
    cursor2 = useTemplateRef("cursor2"),
    cursor3 = useTemplateRef("cursor3"),
    container = useTemplateRef("container");

function addMouseEvent(element: HTMLElement) {
    element.addEventListener("mouseover", addHover), element.addEventListener("mouseout", removeHover)
}

function addHover() {
    cursor2.value!.classList.add("hover"), cursor3.value!.classList.add("hover")
}
function removeHover() {
    cursor2.value!.classList.remove("hover"), cursor3.value!.classList.remove("hover")
}
onMounted(() => {
    document.querySelector<HTMLElement>('body')?.addEventListener("mousemove", function (event: MouseEvent) {
        cursor1.value!.style.left = event.clientX + "px",
            cursor1.value!.style.top = event.clientY + "px",
            cursor2.value!.style.left = event.clientX + "px",
            cursor2.value!.style.top = event.clientY + "px",
            cursor3.value!.style.left = event.clientX + "px",
            cursor3.value!.style.top = event.clientY + "px"
    });

    removeHover();
    for (var hoverTarget = document.querySelectorAll<HTMLElement>(".hover-target"), a = hoverTarget.length - 1; a >= 0; a--) {
        addMouseEvent(hoverTarget[a])
    }
    //Navigation
    document.querySelector<HTMLElement>('.menu-icon')?.addEventListener('click', function () {
        return container.value!.classList.toggle('nav-active');
    });
    const menuItems = document.querySelectorAll<HTMLElement>('.nav__list-item');
    menuItems[0].classList.add('active-nav');

    const switchEl = document.querySelector<HTMLElement>('#switch');

    switchEl?.addEventListener('click', function () {
        container.value!.classList.toggle("light");
        switchEl.classList.toggle("switched");
    });
}); 
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Montserrat:100,100i,200,200i,300,300i,400,400i,500,500i,600,600i,700,700i,800,800i,900,900i');

.container {
    font-family: 'Montserrat', sans-serif;
    font-weight: 300;
    font-size: 15px;
    line-height: 1.7;
    color: #c4c3ca;
    background-color: #b8d57d;
    overflow-x: hidden;
    -webkit-transition: all 300ms linear;
    transition: all 300ms linear;
}

a {
    cursor: pointer;
}

a:hover {
    text-decoration: none;
}

/* Please ? this if you like it! */

/* #Cursor
================================================== */
.cursor,
.cursor2,
.cursor3 {
    position: fixed;
    border-radius: 50%;
    transform: translateX(-50%) translateY(-50%);
    pointer-events: none;
    left: -100px;
    top: 50%;
    mix-blend-mode: difference;
    -webkit-transition: all 300ms linear;
    transition: all 300ms linear;
}

.cursor {
    background-color: #fff;
    height: 0;
    width: 0;
    z-index: 99999;
}

.cursor2,
.cursor3 {
    height: 36px;
    width: 36px;
    z-index: 99998;
    -webkit-transition: all 0.3s ease-out;
    transition: all 0.3s ease-out
}

.cursor2.hover,
.cursor3.hover {
    -webkit-transform: scale(2) translateX(-25%) translateY(-25%);
    transform: scale(2) translateX(-25%) translateY(-25%);
    border: none
}

.cursor2 {
    border: 2px solid #fff;
    box-shadow: 0 0 22px rgba(255, 255, 255, 0.6);
}

.cursor2.hover {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
}

@media screen and (max-width: 1200px) {

    .cursor,
    .cursor2,
    .cursor3 {
        display: none
    }
}

/* #Primary style
================================================== */

.section {
    position: relative;
    width: 100%;
    display: block;
}

.over-hide {
    overflow: hidden;
}

.full-height {
    height: 100vh;
}

/* #Navigation
================================================== */

.cd-header {
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 100;
}

.header-wrapper {
    position: relative;
    width: calc(100% - 100px);
    margin-left: 50px;
}

.logo-wrap {
    position: absolute;
    display: block;
    left: 0;
    top: 40px;
    cursor: pointer;
}

.logo-wrap a {
    cursor: pointer;
    font-family: 'Montserrat', sans-serif;
    font-weight: 900;
    font-size: 20px;
    line-height: 20px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #fff;
    transition: all 0.3s ease-out;
}

.logo-wrap a span {
    color: #8167a9;
}

.logo-wrap a:hover {
    opacity: 0.9;
}

.nav-but-wrap {
    position: relative;
    display: inline-block;
    float: right;
    padding-left: 15px;
    padding-top: 15px;
    margin-top: 26px;
    transition: all 0.3s ease-out;
}

.menu-icon {
    height: 30px;
    width: 30px;
    position: relative;
    z-index: 2;
    cursor: pointer;
    display: block;
}

.menu-icon__line {
    height: 2px;
    width: 30px;
    display: block;
    background-color: #fff;
    margin-bottom: 7px;
    cursor: pointer;
    -webkit-transition: background-color .5s ease, -webkit-transform .2s ease;
    transition: background-color .5s ease, -webkit-transform .2s ease;
    transition: transform .2s ease, background-color .5s ease;
    transition: transform .2s ease, background-color .5s ease, -webkit-transform .2s ease;
}

.menu-icon__line-left {
    width: 16.5px;
    -webkit-transition: all 200ms linear;
    transition: all 200ms linear;
}

.menu-icon__line-right {
    width: 16.5px;
    float: right;
    -webkit-transition: all 200ms linear;
    -moz-transition: all 200ms linear;
    -o-transition: all 200ms linear;
    -ms-transition: all 200ms linear;
    transition: all 200ms linear;
}

.menu-icon:hover .menu-icon__line-left,
.menu-icon:hover .menu-icon__line-right {
    width: 30px;
}

.nav {
    position: fixed;
    z-index: 98;
}

.nav:before,
.nav:after {
    content: "";
    position: fixed;
    width: 100vw;
    height: 100vh;
    background: rgba(20, 21, 26, 0.6);
    border-bottom-left-radius: 200%;
    z-index: -1;
    -webkit-transition: -webkit-transform cubic-bezier(0.77, 0, 0.175, 1) 0.6s, border-radius linear 0.8s;
    transition: -webkit-transform cubic-bezier(0.77, 0, 0.175, 1) 0.6s, border-radius linear 0.8s;
    transition: transform cubic-bezier(0.77, 0, 0.175, 1) 0.6s, border-radius linear 0.8s;
    transition: transform cubic-bezier(0.77, 0, 0.175, 1) 0.6s, -webkit-transform cubic-bezier(0.77, 0, 0.175, 1) 0.6s, border-radius linear 0.8s;
    -webkit-transform: translateX(100%) translateY(-100%);
    transform: translateX(100%) translateY(-100%);
}

.nav:after {
    background: rgba(9, 9, 12, 1);
    -webkit-transition-delay: 0s;
    transition-delay: 0s;
}

.nav:before {
    -webkit-transition-delay: .2s;
    transition-delay: .2s;
}

.nav__content {
    position: fixed;
    visibility: hidden;
    top: 50%;
    margin-top: 20px;
    -webkit-transform: translate(0%, -50%);
    transform: translate(0%, -50%);
    width: 100%;
    text-align: center;
}

.nav__list {
    position: relative;
    padding: 0;
    margin: 0;
    z-index: 2;
}

.nav__list-item {
    position: relative;
    display: block;
    -webkit-transition-delay: 0.8s;
    transition-delay: 0.8s;
    opacity: 0;
    text-align: center;
    color: #fff;
    overflow: hidden;
    font-family: 'Montserrat', sans-serif;
    font-size: 8vh;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: 3px;
    -webkit-transform: translate(100px, 0%);
    transform: translate(100px, 0%);
    -webkit-transition: opacity .2s ease, -webkit-transform .3s ease;
    transition: opacity .2s ease, -webkit-transform .3s ease;
    transition: opacity .2s ease, transform .3s ease;
    transition: opacity .2s ease, transform .3s ease, -webkit-transform .3s ease;
    margin-top: 0;
    margin-bottom: 0;
}

.nav__list-item a {
    position: relative;
    text-decoration: none;
    color: rgba(255, 255, 255, 0.6);
    overflow: hidden;
    cursor: pointer;
    padding-left: 5px;
    padding-right: 5px;
    font-weight: 900;
    z-index: 2;
    display: inline-block;
    text-transform: uppercase;
    -webkit-transition: all 200ms linear;
    transition: all 200ms linear;
}

.nav__list-item a:after {
    position: absolute;
    content: '';
    top: 50%;
    margin-top: -2px;
    left: 50%;
    width: 0;
    height: 0;
    opacity: 0;
    background-color: #8167a9;
    z-index: 1;
    -webkit-transition: all 200ms linear;
    transition: all 200ms linear;
}

.nav__list-item a:hover:after {
    height: 4px;
    opacity: 1;
    left: 0;
    width: 100%;
}

.nav__list-item a:hover {
    color: rgba(255, 255, 255, 1);
}

.nav__list-item.active-nav a {
    color: rgba(255, 255, 255, 1);
}

.nav__list-item.active-nav a:after {
    height: 4px;
    opacity: 1;
    left: 0;
    width: 100%;
}

.container.nav-active .nav__content {
    visibility: visible;
}

.container.nav-active .menu-icon__line {
    background-color: #fff;
    -webkit-transform: translate(0px, 0px) rotate(-45deg);
    transform: translate(0px, 0px) rotate(-45deg);
}

.container.nav-active .menu-icon__line-left {
    width: 15px;
    -webkit-transform: translate(2px, 4px) rotate(45deg);
    transform: translate(2px, 4px) rotate(45deg);
}

.container.nav-active .menu-icon__line-right {
    width: 15px;
    float: right;
    -webkit-transform: translate(-3px, -3.5px) rotate(45deg);
    transform: translate(-3px, -3.5px) rotate(45deg);
}

.container.nav-active .menu-icon:hover .menu-icon__line-left,
.container.nav-active .menu-icon:hover .menu-icon__line-right {
    width: 15px;
}

.container.nav-active .nav {
    visibility: visible;
}

.container.nav-active .nav:before,
.container.nav-active .nav:after {
    -webkit-transform: translateX(0%) translateY(0%);
    transform: translateX(0%) translateY(0%);
    border-radius: 0;
}

.container.nav-active .nav:after {
    -webkit-transition-delay: .1s;
    transition-delay: .1s;
}

.container.nav-active .nav:before {
    -webkit-transition-delay: 0s;
    transition-delay: 0s;
}

.container.nav-active .nav__list-item {
    opacity: 1;
    -webkit-transform: translateX(0%);
    transform: translateX(0%);
    -webkit-transition: opacity .3s ease, color .3s ease, -webkit-transform .3s ease;
    transition: opacity .3s ease, color .3s ease, -webkit-transform .3s ease;
    transition: opacity .3s ease, transform .3s ease, color .3s ease;
    transition: opacity .3s ease, transform .3s ease, color .3s ease, -webkit-transform .3s ease;
}

.container.nav-active .nav__list-item:nth-child(0) {
    -webkit-transition-delay: 0.7s;
    transition-delay: 0.7s;
}

.container.nav-active .nav__list-item:nth-child(1) {
    -webkit-transition-delay: 0.8s;
    transition-delay: 0.8s;
}

.container.nav-active .nav__list-item:nth-child(2) {
    -webkit-transition-delay: 0.9s;
    transition-delay: 0.9s;
}

.container.nav-active .nav__list-item:nth-child(3) {
    -webkit-transition-delay: 1s;
    transition-delay: 1s;
}

.container.nav-active .nav__list-item:nth-child(4) {
    -webkit-transition-delay: 1.1s;
    transition-delay: 1.1s;
}

.container.nav-active .nav__list-item:nth-child(5) {
    -webkit-transition-delay: 1.2s;
    transition-delay: 1.2s;
}

.container.nav-active .nav__list-item:nth-child(6) {
    -webkit-transition-delay: 1.3s;
    transition-delay: 1.3s;
}

.container.nav-active .nav__list-item:nth-child(7) {
    -webkit-transition-delay: 1.4s;
    transition-delay: 1.4s;
}

.container.nav-active .nav__list-item:nth-child(8) {
    -webkit-transition-delay: 1.5s;
    transition-delay: 1.5s;
}

.container.nav-active .nav__list-item:nth-child(9) {
    -webkit-transition-delay: 1.6s;
    transition-delay: 1.6s;
}

.container.nav-active .nav__list-item:nth-child(10) {
    -webkit-transition-delay: 1.7s;
    transition-delay: 1.7s;
}

.switch-wrap {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 10;
    transform: translateY(-50%);
    width: 100%;
    -webkit-transition: all 500ms linear;
    transition: all 500ms linear;
    margin: 0 auto;
    text-align: center;
}

.switch-wrap h1 {
    font-weight: 900;
    font-size: 46px;
    line-height: 1;
    color: #fff;
    text-align: center;
    text-transform: uppercase;
    margin-bottom: 40px;
    -webkit-transition: all 300ms linear;
    transition: all 300ms linear;
}

@media screen and (max-width: 580px) {
    .switch-wrap h1 {
        font-size: 32px;
    }
}

.switch-wrap p {
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 1px;
    line-height: 1;
    color: #8167a9;
    text-align: center;
    margin-top: 15px;
}

.switch-wrap p span {
    position: relative;
}

.switch-wrap p span:before {
    position: absolute;
    content: '';
    width: 100%;
    height: 2px;
    background-color: #fff;
    left: 0;
    bottom: -4px;
    -webkit-transition: all 300ms linear;
    transition: all 300ms linear;
}

.switch-wrap p span:nth-child(2):before {
    opacity: 0;
}

#switch,
#circle {
    cursor: pointer;
    -webkit-transition: all 300ms linear;
    transition: all 300ms linear;
}

#switch {
    width: 60px;
    height: 8px;
    margin: 0 auto;
    text-align: center;
    border: 2px solid #000;
    border-radius: 27px;
    background: #8167a9;
    position: relative;
    display: inline-block;
}

#circle {
    position: absolute;
    top: -11px;
    left: -13px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    box-shadow: 0 4px 4px rgba(26, 53, 71, 0.25), 0 0 0 1px rgba(26, 53, 71, 0.07);
    background: #fff;
}

.switched {
    border-color: #8167a9 !important;
    background: #000 !important;
}

.switched #circle {
    left: 43px;
    background: #000;
}

/* #Light
================================================== */

.container.light {
    background-color: #fff;
}

.container.light .cursor,
.container.light .cursor2,
.container.light .cursor3 {
    mix-blend-mode: normal;
}

.container.light .cursor2 {
    border: 2px solid #1f2029;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
}

.container.light .cursor2.hover {
    background: rgba(0, 0, 0, 0.06);
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.1);
    border-color: transparent;
}

.container.light .logo-wrap a {
    color: #1f2029;
}

.container.light .menu-icon__line {
    background-color: #1f2029;
}

.container.light .nav:before {
    background: rgba(235, 235, 235, 0.6);
}

.container.light .nav:after {
    background: rgba(250, 250, 250, 1);
}

.container.light .nav__list-item a {
    color: rgba(0, 0, 0, 0.6);
}

.container.light .nav__list-item a:hover {
    color: #1f2029;
}

.container.light .nav__list-item.active-nav a {
    color: #1f2029;
}

.container.light .switch-wrap h1 {
    color: #000;
}

.container.light .switch-wrap p span:nth-child(2):before {
    opacity: 1;
    background-color: #000;
}

.container.light .switch-wrap p span:nth-child(1):before {
    opacity: 0;
}
</style>
