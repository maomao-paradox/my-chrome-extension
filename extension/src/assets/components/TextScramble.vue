<template>
    <div class="container">
        <div ref="textEl" class="text"></div>
    </div>
</template>

<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue';

// 定义props
const props = defineProps({
  phrases: {
    type: Array < string >,
    default: () => [
      'Neo,',
      'sooner or later',
      'you\'re going to realize',
      'just as I did',
      'that there\'s a difference',
      'between knowing the path',
      'and walking the path'
    ]
  },
  chars: {
    type: String,
    default: '!<>-_\\/[]{}?=+*^?#________'
  },
  speed: {
    type: Number,
    default: 800
  }
});

class TextScramble {
  _el: HTMLElement | null;
  _chars: string;
  _resolve: ((value?: any) => void) | null = null;
  queue: { from: string; to: string; start: number; end: number; char?: string }[] = [];
  frame: number = 0;
  frameRequest: number | null = null;
  constructor(el: HTMLElement | null, chars?: string) {
    this._el = el;
    this._chars = chars || '!<>-_\/[]{}?=+*^?#________';
    this.update = this.update.bind(this);
  }
  setText(newText: string) {
    const oldText = this._el!.innerText;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise(resolve => this._resolve = resolve);
    this.queue = [];
    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random() * 40);
      const end = start + Math.floor(Math.random() * 40);
      this.queue.push({ from, to, start, end });
    }
    cancelAnimationFrame(this.frameRequest!);
    this.frame = 0;
    this.update();
    return promise;
  }
  private update() {
    let output = '';
    let complete = 0;
    for (let i = 0, n = this.queue.length; i < n; i++) {
      let { from, to, start, end, char } = this.queue[i];
      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.randomChar();
          this.queue[i].char = char;
        }
        output += `<span class="dud">${char}</span>`;
      } else {
        output += from;
      }
    }
        this._el!.innerHTML = output;
        if (complete === this.queue.length) {
            this._resolve!();
        } else {
          this.frameRequest = requestAnimationFrame(this.update);
          this.frame++;
        }
  }
  randomChar() {
    return this._chars[Math.floor(Math.random() * this._chars.length)];
  }
}

onMounted(() => {
  const el = document.querySelector < HTMLElement > ('.text');
  maLogger.log(el);
  const fx = new TextScramble(el, props.chars);

  let counter = 0;
  const next = () => {
    fx.setText(props.phrases[counter]).then(() => {
      setTimeout(next, props.speed);
    });
    counter = (counter + 1) % props.phrases.length;
  };

  next();
});
</script>

<style scoped>
@import 'https://fonts.googleapis.com/css?family=Roboto+Mono:100';

html,
body {
    font-family: 'Roboto Mono', monospace;
    background: #212121;
    height: 100%;
}

.container {
    height: 100%;
    width: 100%;
    justify-content: center;
    align-items: center;
    display: flex;
}

.text {
    font-weight: 100;
    font-size: 28px;
    color: #fafafa;
}

.dud {
    color: #757575;
}
</style>
