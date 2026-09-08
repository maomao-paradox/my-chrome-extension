<template>
    <div class="container">
        <div class="letters hidden">
            <div class="letter S">
                <div class="top"></div>
                <div class="middle"></div>
                <div class="bottom"></div>
            </div>
            <div class="letter H">
                <div class="left"></div>
                <div class="middle"></div>
                <div class="right"></div>
            </div>
            <div class="letter A">
                <div class="left"></div>
                <div class="middle"></div>
                <div class="right"></div>
            </div>
            <div class="letter D">
                <div class="left"></div>
                <div class="top"></div>
                <div class="bottom"></div>
            </div>
            <div class="letter O">
                <div class="top-left"></div>
                <div class="top-right"></div>
                <div class="bottom-left"></div>
                <div class="bottom-right"></div>
            </div>
            <div class="letter W">
                <div class="left"></div>
                <div class="middle-left"></div>
                <div class="middle-right"></div>
                <div class="right"></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import $ from 'jquery';
const startDelay = 2000;

onMounted(() => {
  maLogger.log('Shadow mounted');

  $('html, body, .container').click(function () {
    if ($('.letter').hasClass('active')) {
      $('.letter').removeClass('active');
    } else {
      $('.letter').addClass('active');
    }
  });

  $('.letter').each(function (key, value) {
    $(value).height(20);
    $('.letters').hide().removeClass('hidden').fadeIn('slow');
    setTimeout(function () {
      $(value).height(200);
    }, startDelay + 20 * $(value).index());
    setTimeout(function () {
      $(value).addClass('active');
    }, startDelay + 3000 + 200 * $(value).index());
  });

  setTimeout(function () {
    $('.letter').removeClass('active');
  }, startDelay + 2500);

  setTimeout(function () {
    $('.letter').addClass('active');
  }, startDelay + 500);

  setTimeout(function () {
    $('.letter').removeClass('active');
  }, 10000);
});
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
    /* background-color: gray; */
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

.letter.S .middle {
    width: 20px;
    height: 20px;
    background-color: black;
    top: 50%;
    margin-top: -10px;
    left: 50%;
    margin-left: -10px;
    position: absolute;
}

.letter.S .top,
.letter.S .bottom {
    width: 20px;
    height: calc(50% - 10px);
    background-color: black;
    position: absolute;
}

.letter.S .top {
    left: 50%;
    margin-left: -10px;
    top: 0;
}

.letter.S .bottom {
    right: 50%;
    margin-right: -10px;
    bottom: 0;
}

.letter.S:hover .middle,
.letter.S.active .middle {
    width: 100%;
    left: 0;
    margin-left: 0;
}

.letter.S:hover .top,
.letter.S.active .top {
    left: 30px;
    -webkit-transform: skewX(-24deg);
    transform: skewX(-24deg);
}

.letter.S:hover .bottom,
.letter.S.active .bottom {
    right: 30px;
    -webkit-transform: skewX(-24deg);
    transform: skewX(-24deg);
}

.letter.H .left,
.letter.H .right {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.H .left {
    left: 50%;
    margin-left: -10px;
}

.letter.H .right {
    right: 50%;
    margin-right: -10px;
}

.letter.H .middle {
    width: 20px;
    height: 20px;
    background-color: black;
    top: 50%;
    margin-top: -10px;
    left: 50%;
    margin-left: -10%;
    position: absolute;
}

.letter.H:hover .left,
.letter.H.active .left {
    left: 10px;
}

.letter.H:hover .right,
.letter.H.active .right {
    right: 10px;
}

.letter.H:hover .middle,
.letter.H.active .middle {
    width: 60px;
    left: 50%;
    margin-left: -30px;
}

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
    margin-top: -10px;
    left: 50%;
    margin-left: -10%;
    position: absolute;
}

.letter.A:hover .left,
.letter.A.active .left {
    left: 30px;
    -webkit-transform: skewX(-10deg);
    transform: skewX(-10deg);
}

.letter.A:hover .right,
.letter.A.active .right {
    right: 30px;
    -webkit-transform: skewX(10deg);
    transform: skewX(10deg);
}

.letter.A:hover .middle,
.letter.A.active .middle {
    width: 50px;
    left: 50%;
    margin-left: -25px;
}

.letter.D .left {
    left: 50%;
    margin-left: -10px;
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.D .top,
.letter.D .bottom {
    left: 50%;
    margin-left: -10px;
    width: 20px;
    height: 50%;
    background-color: black;
    position: absolute;
}

.letter.D .top {
    top: 0;
}

.letter.D .bottom {
    bottom: 0;
}

.letter.D:hover .left,
.letter.D.active .left {
    left: 0;
    margin-left: 0;
}

.letter.D:hover .top,
.letter.D.active .top {
    width: 25px;
    left: 46.5%;
    -webkit-transform: skewX(36deg);
    transform: skewX(36deg);
}

.letter.D:hover .bottom,
.letter.D.active .bottom {
    width: 25px;
    left: 46.5%;
    -webkit-transform: skewX(-36deg);
    transform: skewX(-36deg);
}

.letter.O .top-left,
.letter.O .top-right,
.letter.O .bottom-left,
.letter.O .bottom-right {
    position: absolute;
    width: 20px;
    height: 50%;
    background: black;
}

.letter.O div[class*="top-"] {
    top: 0;
}

.letter.O div[class*="bottom-"] {
    bottom: 0;
}

.letter.O div[class$="-left"] {
    left: 50%;
    margin-left: -10px;
}

.letter.O div[class$="-right"] {
    right: 50%;
    margin-right: -10px;
}

.letter.O:hover .top-left,
.letter.O:hover .bottom-right,
.letter.O.active .top-left,
.letter.O.active .bottom-right {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.O:hover .top-right,
.letter.O:hover .bottom-left,
.letter.O.active .top-right,
.letter.O.active .bottom-left {
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

.letter.O:hover div[class$="-left"],
.letter.O.active div[class$="-left"] {
    left: 30%;
}

.letter.O:hover div[class$="-right"],
.letter.O.active div[class$="-right"] {
    right: 30%;
}

.letter.W .left,
.letter.W .right {
    position: absolute;
    width: 20px;
    height: 100%;
    background: black;
}

.letter.W .left {
    left: 50%;
    margin-left: -10px;
}

.letter.W .right {
    right: 50%;
    margin-right: -10px;
}

.letter.W .middle-left,
.letter.W .middle-right {
    position: absolute;
    width: 20px;
    height: 50%;
    bottom: 0;
    background: black;
}

.letter.W .middle-left {
    left: 50%;
    margin-left: -10px;
}

.letter.W .middle-right {
    right: 50%;
    margin-right: -10px;
}

.letter.W:hover .left,
.letter.W.active .left {
    left: 10px;
}

.letter.W:hover .right,
.letter.W.active .right {
    right: 10px;
}

.letter.W:hover .middle-left,
.letter.W.active .middle-left {
    left: 30%;
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.W:hover .middle-right,
.letter.W.active .middle-right {
    right: 30%;
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}
</style>