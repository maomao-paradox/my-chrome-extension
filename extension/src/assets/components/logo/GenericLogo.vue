<template>
    <div class="container">
        <div class="letters hidden">
            <div v-for="(letter, index) in logoName.split('')" :key="index" :class="['letter', letter.toUpperCase()]">
                <!-- A letter -->
                <template v-if="letter.toUpperCase() === 'A'">
                    <div class="left"></div>
                    <div class="middle"></div>
                    <div class="right"></div>
                </template>

                <!-- B letter -->
                <template v-else-if="letter.toUpperCase() === 'B'">
                    <div class="left"></div>
                    <div class="top1"></div>
                    <div class="top2"></div>
                    <div class="bottom1"></div>
                    <div class="bottom2"></div>
                </template>

                <!-- C letter -->
                <template v-else-if="letter.toUpperCase() === 'C'">
                    <div class="top-left"></div>
                    <div class="bottom-left"></div>
                    <div class="bottom-right"></div>
                </template>

                <!-- D letter -->
                <template v-else-if="letter.toUpperCase() === 'D'">
                    <div class="left"></div>
                    <div class="top"></div>
                    <div class="bottom"></div>
                </template>

                <!-- E letter -->
                <template v-else-if="letter.toUpperCase() === 'E'">
                    <div class="left"></div>
                    <div class="top"></div>
                    <div class="middle"></div>
                    <div class="bottom"></div>
                </template>

                <!-- F letter -->
                <template v-else-if="letter.toUpperCase() === 'F'">
                    <div class="left"></div>
                    <div class="top"></div>
                    <div class="middle"></div>
                </template>

                <!-- G letter -->
                <template v-else-if="letter.toUpperCase() === 'G'">
                    <div class="top-left"></div>
                    <div class="top-right"></div>
                    <div class="bottom-left"></div>
                    <div class="bottom-right"></div>
                </template>

                <!-- H letter -->
                <template v-else-if="letter.toUpperCase() === 'H'">
                    <div class="left"></div>
                    <div class="middle"></div>
                    <div class="right"></div>
                </template>

                <!-- I letter -->
                <template v-else-if="letter.toUpperCase() === 'I'">
                    <div class="top"></div>
                    <div class="middle"></div>
                    <div class="bottom"></div>
                </template>

                <!-- J letter -->
                <template v-else-if="letter.toUpperCase() === 'J'">
                    <div class="top"></div>
                    <div class="middle"></div>
                    <div class="bottom"></div>
                </template>

                <!-- K letter -->
                <template v-else-if="letter.toUpperCase() === 'K'">
                    <div class="left"></div>
                    <div class="top-right"></div>
                    <div class="bottom-right"></div>
                </template>

                <!-- L letter -->
                <template v-else-if="letter.toUpperCase() === 'L'">
                    <div class="left"></div>
                    <div class="bottom"></div>
                </template>

                <!-- M letter -->
                <template v-else-if="letter.toUpperCase() === 'M'">
                    <div class="left"></div>
                    <div class="middle-left"></div>
                    <div class="middle-right"></div>
                    <div class="right"></div>
                </template>

                <!-- N letter -->
                <template v-else-if="letter.toUpperCase() === 'N'">
                    <div class="left"></div>
                    <div class="middle"></div>
                    <div class="right"></div>
                </template>

                <!-- O letter -->
                <template v-else-if="letter.toUpperCase() === 'O'">
                    <div class="top-left"></div>
                    <div class="top-right"></div>
                    <div class="bottom-left"></div>
                    <div class="bottom-right"></div>
                </template>

                <!-- P letter -->
                <template v-else-if="letter.toUpperCase() === 'P'">
                    <div class="left"></div>
                    <div class="top1"></div>
                    <div class="top2"></div>

                </template>

                <!-- Q letter -->
                <template v-else-if="letter.toUpperCase() === 'Q'">
                    <div class="top-left"></div>
                    <div class="top-right"></div>
                    <div class="bottom-left"></div>
                    <div class="bottom-right"></div>
                    <div class="tail"></div>
                </template>

                <!-- R letter -->
                <template v-else-if="letter.toUpperCase() === 'R'">
                    <div class="left"></div>
                    <div class="top1"></div>
                    <div class="top2"></div>
                    <div class="bottom-right"></div>
                </template>

                <!-- S letter -->
                <template v-else-if="letter.toUpperCase() === 'S'">
                    <div class="top"></div>
                    <div class="middle"></div>
                    <div class="bottom"></div>
                </template>

                <!-- T letter -->
                <template v-else-if="letter.toUpperCase() === 'T'">
                    <div class="top"></div>
                    <div class="middle"></div>
                </template>

                <!-- U letter -->
                <template v-else-if="letter.toUpperCase() === 'U'">
                    <div class="left"></div>
                    <div class="right"></div>
                    <div class="bottom"></div>
                </template>

                <!-- V letter -->
                <template v-else-if="letter.toUpperCase() === 'V'">
                    <div class="left"></div>
                    <div class="right"></div>
                </template>

                <!-- W letter -->
                <template v-else-if="letter.toUpperCase() === 'W'">
                    <div class="left"></div>
                    <div class="middle-left"></div>
                    <div class="middle-right"></div>
                    <div class="right"></div>
                </template>

                <!-- X letter -->
                <template v-else-if="letter.toUpperCase() === 'X'">
                    <div class="left"></div>
                    <div class="right"></div>
                </template>

                <!-- Y letter -->
                <template v-else-if="letter.toUpperCase() === 'Y'">
                    <div class="left"></div>
                    <div class="right"></div>
                    <div class="middle"></div>
                </template>

                <!-- Z letter -->
                <template v-else-if="letter.toUpperCase() === 'Z'">
                    <div class="top"></div>
                    <div class="middle"></div>
                    <div class="bottom"></div>
                </template>

                <!-- Default for unknown characters -->
                <template v-else>
                    <div class="middle"></div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import $ from 'jquery';

interface GenericLogoProps {
    logoName: string;
    startDelay?: number;
}

const props = withDefaults(defineProps<GenericLogoProps>(), {
  logoName: 'LOGO',
  startDelay: 2000
});

onMounted(() => {
  maLogger.log('GenericLogo mounted');

  $('html, body, .container').on('click', function () {
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
    }, props.startDelay + 20 * $(value).index());
    setTimeout(function () {
      $(value).addClass('active');
    }, props.startDelay + 500 + 200 * $(value).index());
    setTimeout(function () {
      $(value).removeClass('active');
    }, props.startDelay + 2000 + 200 * $(value).index());
  });
});
</script>

<!-- <style>
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
</style> -->

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
    /* 间距增加 */
    letter-spacing: 50px;
}

.letter {
    /* 字母间距 */
    /* border-color: blue;
    border-width: 2px;
    border-style: solid; */

    margin-right: 20px;
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

.letter div {
    margin-left: -10px;
    background: black;
    position: absolute;
    width: 20%;
    height: 100%;
    left: 50%;
}

.letter:hover>*,
.letter.active>* {
    box-shadow: rgba(100, 100, 100, 0.6) 5px 5px 10px;
}

/* A letter */
.letter.A .middle {
    height: 20px;
    top: 55%;
    position: absolute;
}

.letter.A:hover .left,
.letter.A.active .left {
    left: 30%;
    -webkit-transform: skewX(-10deg);
    transform: skewX(-10deg);
}

.letter.A:hover .right,
.letter.A.active .right {
    left: 70%;
    -webkit-transform: skewX(10deg);
    transform: skewX(10deg);
}

.letter.A:hover .middle,
.letter.A.active .middle {
    width: 50%;
    left: 30%;
}

/* B letter */
.letter.B .top1,
.letter.B .top2,
.letter.B .bottom1,
.letter.B .bottom2 {
    height: 25%;
}

.letter.B .top2 {
    top: 25%;
}

.letter.B .bottom1 {
    bottom: 25%;
}

.letter.B .bottom2 {
    bottom: 0%;
}

.letter.B:hover .top1,
.letter.B:hover .bottom1,
.letter.B.active .top1,
.letter.B.active .bottom1 {
    left: 60px;
    -webkit-transform: skewX(36deg);
    transform: skewX(36deg);
}

.letter.B:hover .top2,
.letter.B:hover .bottom2,
.letter.B.active .top2,
.letter.B.active .bottom2 {
    left: 60px;
    -webkit-transform: skewX(-36deg);
    transform: skewX(-36deg);
}

.letter.B:hover .left,
.letter.B.active .left {
    left: 25px;
}

.letter.B:hover .top,
.letter.B.active .top,
.letter.B:hover .middle,
.letter.B.active .middle,
.letter.B:hover .bottom,
.letter.B.active .bottom {
    width: 50px;
    left: 10px;
}

/* C letter */
.letter.C .top-left {
    height: 50%;
}

.letter.C .bottom-left,
.letter.C .bottom-right {
    bottom: 0;
    height: 50%;
}

.letter.C .bottom-right {
    left: 50%;
}

.letter.C:hover .top-left,
.letter.C:hover .bottom-right,
.letter.C.active .top-left,
.letter.C.active .bottom-right {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.C:hover .bottom-left,
.letter.C.active .bottom-left {
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

.letter.C:hover .top-left,
.letter.C.active .top-left,
.letter.C:hover .bottom-left,
.letter.C.active .bottom-left {
    left: 30%;
}

.letter.C:hover .bottom-right,
.letter.C.active .bottom-right,
.letter.C:hover .bottom-right,
.letter.C.active .bottom-right {
    left: 70%;
}

/* D letter */
.letter.D .top,
.letter.D .bottom {
    height: 50%;
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

/* E letter */
.letter.E .top,
.letter.E .middle,
.letter.E .bottom {
    height: 20px;
}

.letter.E .middle {
    margin-top: -10px;
    top: 50%;
}

.letter.E .bottom {
    bottom: 0%;
}

.letter.E:hover .top,
.letter.E:hover .middle,
.letter.E:hover .bottom,
.letter.E.active .top,
.letter.E.active .middle,
.letter.E.active .bottom {
    width: 80%;
    left: 20%;
}

.letter.E:hover .left,
.letter.E.active .left {
    left: 20%;
}

/* F letter */
.letter.F .top,
.letter.F .middle {
    height: 20px;
}

.letter.F .middle {
    top: 50%;
}

.letter.F:hover .top,
.letter.F:hover .middle,
.letter.F.active .top,
.letter.F.active .middle {
    width: 80%;
    left: 20%;
}

.letter.F:hover .left,
.letter.F.active .left {
    left: 20%;
}

/* G letter */
.letter.G .top-left {
    height: 50%;
}

.letter.G .bottom-left,
.letter.G .bottom-right {
    height: 50%;
    bottom: 0;
}

.letter.G .top-right {
    height: 20px;
    top: 50%;
    margin-top: -10px;
}

.letter.G:hover .top-left,
.letter.G.active .top-left {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.G:hover .bottom-right,
.letter.G.active .bottom-right {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.G:hover .bottom-left,
.letter.G.active .bottom-left {
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

.letter.G:hover .top-left,
.letter.G:hover .bottom-left,
.letter.G.active .top-left,
.letter.G.active .bottom-left {
    left: 30%;
}

.letter.G:hover .top-right,
.letter.G.active .top-right {
    width: 50%;
    left: 60%;
    border-bottom-right-radius: 50px;
}

.letter.G:hover .bottom-right,
.letter.G.active .bottom-right {
    left: 70%;
}

/* H letter */
.letter.H .middle {
    height: 10%;
    top: 50%;
    margin-top: -10px;
}

.letter.H:hover .left,
.letter.H.active .left {
    left: 15%;
}

.letter.H:hover .right,
.letter.H.active .right {
    left: 85%;
}

.letter.H:hover .middle,
.letter.H.active .middle {
    width: 60px;
    left: 50%;
    margin-left: -30px;
}

/* I letter */
.letter.I .top,
.letter.I .bottom {
    height: 20px;
}

.letter.I .bottom {
    bottom: 0%;
}

.letter.I:hover .top,
.letter.I:hover .bottom,
.letter.I.active .top,
.letter.I.active .bottom {
    width: 50%;
    margin-left: -25%;
}

/* J letter */
.letter.J .top,
.letter.J .bottom {
    height: 20px;
}

.letter.J .bottom {
    bottom: 0%;
}

.letter.J:hover .top,
.letter.J.active .top {
    width: 70%;
    left: 25%;
}

.letter.J:hover .bottom,
.letter.J.active .bottom {
    width: 30%;
    left: 25%;
}

/* K letter */
.letter.K .top-right,
.letter.K .bottom-right {
    height: 50%;
}

.letter.K .bottom-right {
    bottom: 0;
}

.letter.K:hover .top-right,
.letter.K.active .top-right {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.K:hover .bottom-right,
.letter.K.active .bottom-right {
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

.letter.K:hover .left,
.letter.K.active .left {
    left: 25%;
}

.letter.K:hover .top-right,
.letter.K:hover .bottom-right,
.letter.K.active .top-right,
.letter.K.active .bottom-right {
    left: 60%;
}

/* L letter */
.letter.L .bottom {
    bottom: 0%;
    height: 20px;
}

.letter.L:hover .left,
.letter.L.active .left {
    left: 20%;
}

.letter.L:hover .bottom,
.letter.L.active .bottom {
    width: 80%;
    left: 20%;
}

/* M letter */
.letter.M .middle-left,
.letter.M .middle-right {
    height: 60%;
}

.letter.M:hover .left,
.letter.M.active .left {
    left: 10%;
}

.letter.M:hover .right,
.letter.M.active .right {
    left: 90%;
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
    left: 70%;
    -webkit-transform: skewX(-18deg);
    transform: skewX(-18deg);
}

/* N letter */
.letter.N:hover .middle,
.letter.N.active .middle {
    /* left: 50%; */
    -webkit-transform: skewX(-18deg);
    transform: skewX(-18deg);
}

.letter.N:hover .left,
.letter.N.active .left {
    left: 10%;
}

.letter.N:hover .right,
.letter.N.active .right {
    left: 90%;
}

/* O letter */
.letter.O .top-left,
.letter.O .top-right,
.letter.O .bottom-left,
.letter.O .bottom-right {
    height: 50%;
}

.letter.O div[class*="bottom-"] {
    bottom: 0;
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
    left: 70%;
}

/* P letter */
.letter.P .top1,
.letter.P .top2 {
    height: 25%;
}

.letter.P .top2 {
    top: 25%;
}

.letter.P:hover .top1,
.letter.P.active .top1 {
    left: 60%;
    -webkit-transform: skewX(36deg);
    transform: skewX(36deg);
}

.letter.P:hover .top2,
.letter.P.active .top2 {
    left: 60%;
    -webkit-transform: skewX(-36deg);
    transform: skewX(-36deg);
}

.letter.P:hover .left,
.letter.P.active .left {
    left: 20%;
}


/* Q letter */
.letter.Q .top-left,
.letter.Q .top-right,
.letter.Q .bottom-left,
.letter.Q .bottom-right {
    height: 50%;
}

.letter.Q div[class*="bottom-"] {
    bottom: 0;
}

.letter.Q .tail {
    height: 50%;
    bottom: 0;
}

.letter.Q:hover .top-left,
.letter.Q:hover .bottom-right,
.letter.Q.active .top-left,
.letter.Q.active .bottom-right {
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.Q:hover .top-right,
.letter.Q:hover .bottom-left,
.letter.Q.active .top-right,
.letter.Q.active .bottom-left {
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

.letter.Q:hover div[class$="-left"],
.letter.Q.active div[class$="-left"] {
    left: 30%;
}

.letter.Q:hover div[class$="-right"],
.letter.Q.active div[class$="-right"] {
    left: 70%;
}

.letter.Q:hover .tail,
.letter.Q.active .tail {
    left: 70%;
    transform: rotate(-20deg);
}

/* R letter */
.letter.R .top1,
.letter.R .top2 {
    height: 25%;
}

.letter.R .top2 {
    top: 25%;
}

.letter.R .bottom-right {
    height: 50%;
    bottom: 0%;
}

.letter.R:hover .top1,
.letter.R.active .top1 {
    left: 60%;
    -webkit-transform: skewX(36deg);
    transform: skewX(36deg);
}

.letter.R:hover .top2,
.letter.R.active .top2 {
    left: 60%;
    -webkit-transform: skewX(-36deg);
    transform: skewX(-36deg);
}

.letter.R:hover .left,
.letter.R.active .left {
    left: 25px;
}

.letter.R:hover .bottom-right,
.letter.R.active .bottom-right {
    left: 60%;
    transform: skewX(18deg);
}

/* S letter */
.letter.S .middle {
    height: 20px;
    top: 50%;
    margin-top: -10px;
}

.letter.S .top,
.letter.S .bottom {
    height: calc(50% - 10px);
}

.letter.S .bottom {
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
    left: 70px;
    -webkit-transform: skewX(-24deg);
    transform: skewX(-24deg);
}

/* T letter */
.letter.T .top {
    height: 20px;
}

.letter.T:hover .top,
.letter.T.active .top {
    width: 80%;
    margin-left: -40px;
}

/* U letter */
.letter.U .bottom {
    height: 20px;
    bottom: 0%;
}

.letter.U:hover .left,
.letter.U.active .left {
    left: 15%;
}

.letter.U:hover .right,
.letter.U.active .right {
    left: 85%;
}

.letter.U:hover .bottom,
.letter.U.active .bottom {
    width: 90%;
    left: 15%;
}

/* V letter */
.letter.V:hover .left,
.letter.V.active .left {
    left: 30%;
    transform: skewX(10deg);
}

.letter.V:hover .right,
.letter.V.active .right {
    left: 70%;
    transform: skewX(-10deg);
}

/* W letter */
.letter.W .middle-left,
.letter.W .middle-right {
    height: 50%;
    bottom: 0;
}

.letter.W:hover .left,
.letter.W.active .left {
    left: 10%;
}

.letter.W:hover .right,
.letter.W.active .right {
    left: 90%;
}

.letter.W:hover .middle-left,
.letter.W.active .middle-left {
    left: 30%;
    -webkit-transform: skewX(-20deg);
    transform: skewX(-20deg);
}

.letter.W:hover .middle-right,
.letter.W.active .middle-right {
    left: 70%;
    -webkit-transform: skewX(20deg);
    transform: skewX(20deg);
}

/* X letter */
.letter.X:hover .left,
.letter.X.active .left {
    transform: skewX(18deg);
}

.letter.X:hover .right,
.letter.X.active .right {
    transform: skewX(-18deg);
}

/* Y letter */
.letter.Y .left,
.letter.Y .right,
.letter.Y .middle {
    height: 50%;
}

.letter.Y .middle {
    top: 50%;
}

.letter.Y:hover .left,
.letter.Y.active .left {
    left: 30%;
    transform: skewX(22deg);
}

.letter.Y:hover .right,
.letter.Y.active .right {
    left: 70%;
    transform: skewX(-22deg);
}

/* Z letter */
.letter.Z .top {
    height: 20px;
}

.letter.Z .bottom {
    bottom: 0%;
    height: 20px;
}

.letter.Z:hover .top,
.letter.Z:hover .bottom,
.letter.Z.active .top,
.letter.Z.active .bottom {
    width: 80%;
    left: 20%;
}

.letter.Z:hover .middle,
.letter.Z.active .middle {
    margin-top: 20%;
    height: 80%;
    transform: skewX(-20.5deg);
}
</style>