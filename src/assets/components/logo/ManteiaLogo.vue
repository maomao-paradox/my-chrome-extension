<template>
    <div class="container">
        <div class="letters hidden">
            <div class="letter M">
                <div class="left"></div>
                <div class="middle-left"></div>
                <div class="middle-right"></div>
                <div class="right"></div>
            </div>
            <div class="letter A">
                <div class="left"></div>
                <div class="middle"></div>
                <div class="right"></div>
            </div>
            <div class="letter N">
                <div class="left"></div>
                <div class="middle"></div>
                <div class="right"></div>
            </div>
            <div class="letter T">
                <div class="top"></div>
                <div class="middle"></div>
            </div>
            <div class="letter E">
                <div class="left"></div>
                <div class="top"></div>
                <div class="middle"></div>
                <div class="bottom"></div>
            </div>
            <div class="letter I">
                <div class="top"></div>
                <div class="middle"></div>
                <div class="bottom"></div>
            </div>
            <div class="letter A">
                <div class="left"></div>
                <div class="middle"></div>
                <div class="right"></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import $ from 'jquery'
var startDelay = 2000;

onMounted(() => {
    maLogger.log('ManteiaLogo mounted')

    $("html, body, .container").click(function () {
        if ($(".letter").hasClass("active")) {
            $(".letter").removeClass("active");
        } else {
            $(".letter").addClass("active");
        }
    });

    $(".letter").each(function (key, value) {
        $(value).height(20);
        $(".letters").hide().removeClass("hidden").fadeIn("slow");
        setTimeout(function () {
            $(value).height(200);
        }, startDelay + 20 * $(value).index());
        setTimeout(function () {
            $(value).addClass("active");
        }, startDelay + 3000 + 200 * $(value).index());
    });

    setTimeout(function () {
        $(".letter").removeClass("active");
    }, startDelay + 2500);

    setTimeout(function () {
        $(".letter").addClass("active");
    }, startDelay + 500);

    setTimeout(function () {
        $(".letter").removeClass("active");
    }, 10000);
})
</script>

<style>
html,
body {
    padding: 0;
    margin: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    text-align: center;
}

body {
    background-color: #F3F3F3
}
</style>

<style scoped>
.hidden {
    visibility: hidden;
}

.container {
    padding: 20px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    text-align: center;
}

.letters {
    position: absolute;
    top: 50%;
    left: 50%;
    -webkit-transform: translate(-50%, -50%);
    transform: translate(-50%, -50%);
    white-space: nowrap;
}

.letter {
    width: 100px;
    height: 200px;
    position: relative;
    display: inline-block;
    transition: all 0.2s ease-out;
}

.letter * {
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    -webkit-transform-style: preserve-3d;
    transform-style: preserve-3d;
}

.letter>* {
    transition: all 0.2s ease-out;
}

.letter:hover>*,
.letter.active>* {
    box-shadow: rgba(100, 100, 100, 0.6) 5px 5px 10px;
}

/* M letter */
.letter.M .left,
.letter.M .right {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.M .left {
    left: 50%;
    margin-left: -10px;
}

.letter.M .right {
    right: 50%;
    margin-right: -10px;
}

.letter.M .middle-left,
.letter.M .middle-right {
    position: absolute;
    width: 20px;
    height: 60%;
    top: 0;
    /* margin-top: 10px; */
    background: black;
}

.letter.M .middle-left {
    left: 50%;
    /* -webkit-transform: skewX(20deg);
    transform: skewX(20deg); */
    margin-left: -10px;
}

.letter.M .middle-right {
    /* -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg); */
    right: 50%;
    margin-right: -10px;
}

.letter.M:hover .left,
.letter.M.active .left {
    left: 10px;
}

.letter.M:hover .right,
.letter.M.active .right {
    right: 10px;
}

.letter.M:hover .middle-left,
.letter.M.active .middle-left {
    /* height: 65%; */
    /* margin-top: 25px; */
    left: 30%;
    -webkit-transform: skewX(18deg);
    transform: skewX(18deg);
}

.letter.M:hover .middle-right,
.letter.M.active .middle-right {
    /* height: 50%; */
    /* margin-top: 25px; */
    right: 30%;
    -webkit-transform: skewX(-18deg);
    transform: skewX(-18deg);
}

/* A letter */
.letter.A .left,
.letter.A .right {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.A .left {
    left: 50%;
    margin-left: -10px;
}

.letter.A .right {
    right: 50%;
    margin-right: -10px;
}

.letter.A .middle {
    width: 20px;
    height: 20px;
    background-color: black;
    top: 50%;
    margin-top: 10px;
    left: 50%;
    margin-left: -10%;
    position: absolute;
}

.letter.A:hover .left {
    left: 30px;
    -webkit-transform: skewX(-10deg);
    transform: skewX(-10deg);
}

.letter.A:hover .right {
    right: 30px;
    -webkit-transform: skewX(10deg);
    transform: skewX(10deg);
}

.letter.A:hover .middle {
    width: 50px;
    left: 50%;
    margin-left: -25px;
}

/* N letter */
.letter.N .left,
.letter.N .right {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.N .middle {
    left: 50%;
    margin-left: -10px;
    width: 20px;
    height: 100%;
    background-color: black;
    position: absolute;
}

.letter.N:hover .middle,
.letter.N.active .middle {
    /* left: 50%; */
    -webkit-transform: skewX(-18deg);
    transform: skewX(-18deg);
}

.letter.N .left {
    left: 50%;
    margin-left: -10px;
}

.letter.N .right {
    right: 50%;
    margin-right: -10px;
}

.letter.N:hover .left,
.letter.N.active .left {
    left: 10px;
}

.letter.N:hover .right,
.letter.N.active .right {
    right: 10px;
}

/* T letter */
.letter.T .top {
    position: absolute;
    left: 50%;
    margin-left: -10px;
    width: 20px;
    height: 20px;
    background: black;
    top: 0;
}

.letter.T .middle {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
    left: 50%;
    margin-left: -10px;
}

.letter.T:hover .top,
.letter.T.active .top {
    width: 80%;
    margin-left: -40px;
}

.letter.T:hover .middle,
.letter.T.active .middle {
    margin-left: -10px;
}

/* E letter */
.letter.E .top,
.letter.E .middle,
.letter.E .bottom,
.letter.E .left {
    position: absolute;
    width: 20px;
    height: 20px;
    margin-left: -10px;
    background: black;
    left: 50%;
}

.letter.E .left {
    height: 100%;
}

.letter.E .top {
    top: 0%;
}

.letter.E .middle {
    top: 50%;
}

.letter.E .bottom {
    bottom: 0%;
}

.letter.E:hover .top,
.letter.E:hover .middle,
.letter.E:hover .bottom {
    width: 80%;
    left: 20%;
}

.letter.E:hover .left {
    left: 20%;
}

/* I letter */
.letter.I .middle,
.letter.I .top,
.letter.I .bottom {
    position: absolute;
    width: 20px;
    height: 20px;
    background: black;
    left: 50%;
    margin-left: -10px;
}

.letter.I .top {
    top: 0%;
}

.letter.I .bottom {
    bottom: 0%;
}

.letter.I .middle {
    height: 100%;
}

.letter.I:hover .top,
.letter.I:hover .bottom {
    width: 50%;
    margin-left: -25%;
}
</style>