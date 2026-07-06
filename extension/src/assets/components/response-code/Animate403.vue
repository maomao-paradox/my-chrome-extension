<template>
    <div class="container">
        <h1>403</h1>
        <div ref="divRef" class="content">
            <p>> <span>ERROR CODE</span>: "<i>HTTP 403 Forbidden</i>"</p>
            <p>> <span>ERROR DESCRIPTION</span>: "<i>Access Denied. You Do Not Have The Permission To Access This Page
                    On
                    This Server</i>"</p>
            <p>> <span>ERROR POSSIBLY CAUSED BY</span>: [<b>execute access forbidden, read access forbidden, write
                    access
                    forbidden, ssl required, ssl 128 required, ip address rejected, client certificate required, site
                    access
                    denied, too many users, invalid configuration, password change, mapper denied access, client
                    certificate
                    revoked, directory listing denied, client access licenses exceeded, client certificate is untrusted
                    or
                    invalid, client certificate has expired or is not yet valid, passport logon failed, source access
                    denied, infinite depth is denied, too many requests from the same client ip</b>...]</p>
            <p>> <span>SOME PAGES ON THIS SERVER THAT YOU DO HAVE PERMISSION TO ACCESS</span>: [<a href="/">Home
                    Page</a>,
                <a href="/">About Us</a>, <a href="/">Contact Us</a>, <a href="/">Blog</a>...]
            </p>
            <p>> <span>HAVE A NICE DAY SIR AXLEROD :-)</span></p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const divRef = ref<HTMLDivElement | null>(null)
let intervalId: number | null = null

onMounted(() => {
    maLogger.log('403 mounted')
    if (!divRef.value) {
        return
    }

    const str = divRef.value.innerHTML.toString();
    let i = 0;
    divRef.value.innerHTML = "";

    const timer = setTimeout(() => {
        intervalId = window.setInterval(() => {
            i++;
            if (divRef.value) {
                divRef.value.innerHTML = str.slice(0, i) + "|";
                if (i === str.length) {
                    if (intervalId) {
                        clearInterval(intervalId);
                    }
                    if (divRef.value) {
                        divRef.value.innerHTML = str;
                    }
                }
            }
        }, 10);
    }, 0);
})

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId);
    }
})

</script>


<style scoped>
@import url("https://fonts.googleapis.com/css?family=Share+Tech+Mono|Montserrat:700");

.container {
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    font: inherit;
    vertical-align: baseline;
    box-sizing: border-box;
    color: inherit;
    position: relative;
    height: 100vh;
    width: 100vw;
    background-image: linear-gradient(120deg, #4f0088 0%, #000000 100%);
}

h1 {
    font-size: 45vw;
    text-align: center;
    position: fixed;
    width: 100vw;
    z-index: 1;
    color: #ffffff26;
    text-shadow: 0 0 50px rgba(0, 0, 0, 0.07);
    top: 50%;
    -webkit-transform: translateY(-50%);
    transform: translateY(-50%);
    font-family: "Montserrat", monospace;
}

.content {
    background: rgba(0, 0, 0, 0);
    width: 70vw;
    position: relative;
    top: 50%;
    -webkit-transform: translateY(-50%);
    transform: translateY(-50%);
    margin: 0 auto;
    padding: 30px 30px 10px;
    box-shadow: 0 0 150px -20px rgba(0, 0, 0, 0.5);
    z-index: 3;
}

.content p {
    font-family: "Share Tech Mono", monospace;
    color: #f5f5f5;
    margin: 0 0 20px;
    font-size: 17px;
    line-height: 1.2;
}

.content span {
    color: #f0c674;
}

.content i {
    color: #8abeb7;
}

.content a {
    text-decoration: none;
}

.content b {
    color: #81a2be;
}

.avatar {
    position: fixed;
    bottom: 15px;
    right: -100px;
    -webkit-animation: slide 0.5s 4.5s forwards;
    animation: slide 0.5s 4.5s forwards;
    display: block;
    z-index: 4;
}

.avatar img {
    border-radius: 100%;
    width: 44px;
    border: 2px solid white;
}

@-webkit-keyframes slide {
    from {
        right: -100px;
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
        opacity: 0;
    }

    to {
        right: 15px;
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
        opacity: 1;
    }
}

@keyframes slide {
    from {
        right: -100px;
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
        opacity: 0;
    }

    to {
        right: 15px;
        -webkit-transform: rotate(0deg);
        transform: rotate(0deg);
        opacity: 1;
    }
}
</style>