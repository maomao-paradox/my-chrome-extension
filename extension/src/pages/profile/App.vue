<template>
  <main
    class="profile-page"
    :class="{ 'motion-off': !motionEnabled }"
    :style="pageVars"
    @mousemove="handlePointerMove"
    @mouseleave="resetPointer"
  >
    <div class="cursor-light" aria-hidden="true"></div>

    <nav class="topbar" aria-label="个人主页导航">
      <a
        class="brand"
        href="#home"
        aria-label="回到首页"
        @click.prevent="scrollToSection('home')"
      >
        <span class="brand-mark">K</span>
        <span>KIRA:NOVA</span>
      </a>
      <div class="nav-links">
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="`#${item.id}`"
          @click.prevent="scrollToSection(item.id)"
        >
          {{ item.label }}
        </a>
      </div>
      <div class="topbar-actions">
        <button
          class="motion-toggle"
          type="button"
          :aria-pressed="motionEnabled"
          aria-label="切换页面动效"
          @click="motionEnabled = !motionEnabled"
        >
          {{ motionEnabled ? "动效" : "静态" }}
        </button>
        <a
          class="nav-action"
          href="#contact"
          @click.prevent="scrollToSection('contact')"
          >联系</a
        >
      </div>
    </nav>

    <section id="home" class="hero-section observe-section">
      <div class="hero-media" aria-hidden="true">
        <div class="hero-scanline"></div>
      </div>

      <div class="hero-content">
        <p class="eyebrow">Anime Interface Sorcerer / Motion Lab</p>
        <h1 data-glitch="KIRA:NOVA 在霓虹界面里编排幻想。">
          KIRA:NOVA 在霓虹界面里编排幻想。
        </h1>
        <p class="hero-copy">
          一个脱离现实履历的虚构个人主页：半是动漫角色设定，半是交互实验场。光轨、故障字、漂浮卡片和舞台式滚动共同组成一个可玩的视觉名片。
        </p>

        <div class="hero-actions" aria-label="主要操作">
          <a
            class="primary-action"
            href="#work"
            @click.prevent="scrollToSection('work')"
            >进入展柜</a
          >
          <a
            class="secondary-action"
            href="#skills"
            @click.prevent="scrollToSection('skills')"
            >查看技法</a
          >
          <a class="secondary-action" href="/pages/popup.html" target="_self"
            >进入popup</a
          >
          <a class="secondary-action" href="/pages/options.html" target="_self"
            >进入options</a
          >
          <a class="secondary-action" href="/pages/study.html" target="_self"
            >进入study</a
          >
        </div>
      </div>

      <div class="kinetic-strip" aria-label="视觉关键词">
        <div class="kinetic-track" aria-hidden="true">
          <div v-for="groupIndex in 3" :key="groupIndex" class="kinetic-group">
            <span v-for="word in kineticWords" :key="`${word}-${groupIndex}`">{{
              word
            }}</span>
          </div>
        </div>
      </div>

      <aside class="hero-panel" aria-label="个人状态">
        <div class="panel-row">
          <span>角色定位</span>
          <strong>光效编舞师</strong>
        </div>
        <div class="panel-row">
          <span>舞台风格</span>
          <strong>Cyber Anime</strong>
        </div>
        <div class="panel-meter">
          <span>同步率</span>
          <i></i>
        </div>
      </aside>
    </section>

    <section id="about" class="content-section observe-section">
      <div class="section-heading">
        <p class="eyebrow">Lore</p>
        <h2>这里不写项目经历，只展示一个会动的虚构人格。</h2>
      </div>
      <div class="about-grid">
        <article
          v-for="item in principles"
          :key="item.title"
          class="principle-card"
        >
          <span class="card-index">{{ item.index }}</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section id="work" class="content-section observe-section">
      <div class="section-heading section-heading--inline">
        <div>
          <p class="eyebrow">Showcase</p>
          <h2>每张卡片都是一个可被点亮的幻想场景。</h2>
        </div>
        <div class="project-tabs" aria-label="作品筛选">
          <button
            v-for="project in projects"
            :key="project.id"
            :class="{ active: activeProject === project.id }"
            type="button"
            @click="activeProject = project.id"
          >
            {{ project.short }}
          </button>
        </div>
      </div>

      <div class="project-stage">
        <article
          v-for="project in projects"
          :key="project.id"
          class="project-card"
          :class="{ active: activeProject === project.id }"
          role="button"
          tabindex="0"
          @mouseenter="activeProject = project.id"
          @focus="activeProject = project.id"
          @mousemove="handleCardTilt"
          @mouseleave="clearCardTilt"
          @keydown.enter.prevent="activeProject = project.id"
          @keydown.space.prevent="activeProject = project.id"
        >
          <div class="project-card__top">
            <span>{{ project.year }}</span>
            <strong>{{ project.type }}</strong>
          </div>
          <h3>{{ project.title }}</h3>
          <p>{{ project.description }}</p>
          <div class="project-tags">
            <span v-for="tag in project.tags" :key="tag">{{ tag }}</span>
          </div>
        </article>
      </div>
    </section>

    <section id="skills" class="content-section observe-section">
      <div class="section-heading section-heading--inline">
        <div>
          <p class="eyebrow">Techniques</p>
          <h2>炫技不是堆料，而是让动效、色彩和节奏服务同一种世界观。</h2>
        </div>
        <div class="skill-filter" aria-label="能力分类">
          <button
            v-for="category in skillCategories"
            :key="category"
            :class="{ active: activeSkillCategory === category }"
            type="button"
            @click="activeSkillCategory = category"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <div class="skill-grid">
        <article
          v-for="skill in filteredSkills"
          :key="skill.name"
          class="skill-card"
        >
          <div class="skill-card__label">
            <span>{{ skill.name }}</span>
            <strong>{{ skill.level }}%</strong>
          </div>
          <div class="skill-bar" :style="{ '--level': `${skill.level}%` }">
            <i></i>
          </div>
          <p>{{ skill.note }}</p>
        </article>
      </div>
    </section>

    <section id="contact" class="contact-section observe-section">
      <div>
        <p class="eyebrow">Contact</p>
        <h2>想继续扩展这个幻想舞台？</h2>
        <p>
          下一步可以加入音乐响应、WebGL
          粒子、角色换装或章节式滚动叙事，把主页做成完整互动短片。
        </p>
      </div>
      <div class="contact-actions">
        <a href="mailto:hello@manteia.dev">hello@manteia.dev</a>
        <a href="https://github.com/" target="_blank" rel="noreferrer"
          >GitHub</a
        >
      </div>
    </section>
  </main>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

const navItems = [
  { id: "about", label: "设定" },
  { id: "work", label: "展柜" },
  { id: "skills", label: "技法" },
];

const kineticWords = [
  "NEON",
  "AURA",
  "GLITCH",
  "MANGA",
  "HOLO",
  "RHYTHM",
  "PRISM",
  "NOVA",
];

const principles = [
  {
    index: "01",
    title: "霓虹人格",
    description:
      "角色不是头像，而是一套视觉语法：高反差轮廓、扫描光、能量环和带有节拍感的文字。",
  },
  {
    index: "02",
    title: "舞台叙事",
    description:
      "页面像一段开场动画，先给冲击力，再把设定、场景和技法拆成可探索的章节。",
  },
  {
    index: "03",
    title: "可控炫技",
    description:
      "动效集中在主视觉、卡片和滚动入场，不让每个元素同时抢戏，保留静态模式作为出口。",
  },
];

const projects = [
  {
    id: "shrine",
    short: "SHR",
    year: "Scene 01",
    type: "Neon Shrine",
    title: "电子神社",
    description:
      "雨夜屋檐、赛博御守和漂浮符文组成的入口场景，适合做滚动首屏或音乐启动页。",
    tags: ["Scanline", "Glow", "Parallax"],
  },
  {
    id: "duel",
    short: "DUEL",
    year: "Scene 02",
    type: "Prism Duel",
    title: "棱镜决斗场",
    description:
      "卡片悬浮、边框脉冲和角色能量条同步变化，像一套轻量级网页战斗 UI。",
    tags: ["Tilt", "Pulse", "HUD"],
  },
  {
    id: "metro",
    short: "MET",
    year: "Scene 03",
    type: "Moon Metro",
    title: "月面电车",
    description:
      "银色轨道、窗外城市和字符雨从远景穿过，强调速度感和漫画分镜式构图。",
    tags: ["Kinetic Type", "Depth", "Story"],
  },
];

const skills = [
  {
    category: "视觉",
    name: "赛博动漫配色",
    level: 94,
    note: "深黑底、青蓝边光、品红高光和少量琥珀提示形成统一舞台。",
  },
  {
    category: "视觉",
    name: "SVG 角色造型",
    level: 88,
    note: "用矢量发束、轮廓光和服装切面建立不依赖图片的主视觉。",
  },
  {
    category: "动效",
    name: "视差与漂浮层",
    level: 92,
    note: "鼠标位置驱动舞台层次，制造轻量但明显的空间感。",
  },
  {
    category: "动效",
    name: "故障与扫描线",
    level: 84,
    note: "控制频率和透明度，保留动漫开场感，避免持续眩目。",
  },
  {
    category: "结构",
    name: "响应式舞台",
    level: 86,
    note: "桌面双栏冲击力，移动端收拢为单栏角色海报。",
  },
  {
    category: "结构",
    name: "可访问动效开关",
    level: 90,
    note: "静态模式与 reduced-motion 共同兜底，让炫技仍然可退出。",
  },
];

const activeProject = ref(projects[0].id);
const activeSkillCategory = ref("全部");
const motionEnabled = ref(true);
const pointerX = ref(50);
const pointerY = ref(24);

const skillCategories = computed(() => [
  "全部",
  ...Array.from(new Set(skills.map((skill) => skill.category))),
]);

const filteredSkills = computed(() => {
  if (activeSkillCategory.value === "全部") {
    return skills;
  }
  return skills.filter((skill) => skill.category === activeSkillCategory.value);
});

const pageVars = computed(() => ({
  "--pointer-x": `${pointerX.value}%`,
  "--pointer-y": `${pointerY.value}%`,
  "--ship-x": motionEnabled.value
    ? `${(pointerX.value - 50) * -0.18}px`
    : "0px",
  "--ship-y": motionEnabled.value ? `${(pointerY.value - 50) * -0.1}px` : "0px",
}));

const handlePointerMove = (event: MouseEvent) => {
  if (!motionEnabled.value) {
    return;
  }
  pointerX.value = (event.clientX / window.innerWidth) * 100;
  pointerY.value = (event.clientY / window.innerHeight) * 100;
};

const resetPointer = () => {
  pointerX.value = 50;
  pointerY.value = 24;
};

const scrollToSection = (sectionId: string) => {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  const topbarOffset = 84;
  const targetTop =
    target.getBoundingClientRect().top + window.scrollY - topbarOffset;

  window.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: motionEnabled.value ? "smooth" : "auto",
  });
};

const handleCardTilt = (event: MouseEvent) => {
  if (!motionEnabled.value) {
    return;
  }
  const card = event.currentTarget as HTMLElement;
  const rect = card.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
  card.style.setProperty("--tilt-x", `${y}deg`);
  card.style.setProperty("--tilt-y", `${x}deg`);
};

const clearCardTilt = (event: MouseEvent) => {
  const card = event.currentTarget as HTMLElement;
  card.style.setProperty("--tilt-x", "0deg");
  card.style.setProperty("--tilt-y", "0deg");
};

let observer: IntersectionObserver | undefined;

onMounted(() => {
  motionEnabled.value = !window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.18 },
  );

  document.querySelectorAll(".observe-section").forEach((section) => {
    observer?.observe(section);
  });
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<style lang="scss" scoped>
:global(body) {
  overflow-x: hidden;
}

.profile-page {
  --bg: #090914;
  --panel: rgba(18, 18, 37, 0.78);
  --panel-solid: #121225;
  --line: rgba(1, 205, 254, 0.22);
  --text: #fff8ff;
  --muted: #b9b2d8;
  --soft: #efe8ff;
  --accent: #01cdfe;
  --accent-soft: #72f7ff;
  --pink: #ff71ce;
  --purple: #9f66ff;
  --amber: #ffd166;
  --green: #05ffa1;
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(1, 205, 254, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 113, 206, 0.06) 1px, transparent 1px),
    radial-gradient(
      circle at 14% 18%,
      rgba(255, 113, 206, 0.2),
      transparent 24%
    ),
    radial-gradient(
      circle at 82% 10%,
      rgba(1, 205, 254, 0.18),
      transparent 28%
    ),
    linear-gradient(135deg, #090914 0%, #15102a 42%, #090914 100%);
  background-size:
    72px 72px,
    72px 72px,
    auto,
    auto,
    auto;
  color: var(--text);
}

.cursor-light {
  position: fixed;
  left: var(--pointer-x);
  top: var(--pointer-y);
  z-index: 1;
  width: 420px;
  height: 420px;
  pointer-events: none;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(1, 205, 254, 0.18),
    rgba(255, 113, 206, 0.13) 38%,
    transparent 68%
  );
  mix-blend-mode: screen;
  opacity: 0.75;
  transition: opacity 180ms ease;
}

.topbar,
.hero-section,
.content-section,
.contact-section {
  position: relative;
  z-index: 2;
}

.topbar {
  position: fixed;
  top: 16px;
  left: 50%;
  width: min(1120px, calc(100% - 32px));
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 10px 0 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(9, 9, 20, 0.72);
  box-shadow:
    0 20px 60px rgba(1, 205, 254, 0.12),
    0 20px 60px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.brand,
.nav-links,
.nav-action,
.motion-toggle,
.hero-actions a,
.contact-actions a {
  display: inline-flex;
  align-items: center;
}

.brand {
  gap: 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
}

.brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(1, 205, 254, 0.58);
  border-radius: 7px;
  background: linear-gradient(
    135deg,
    rgba(1, 205, 254, 0.28),
    rgba(255, 113, 206, 0.16)
  );
  color: var(--accent-soft);
  box-shadow: 0 0 20px rgba(1, 205, 254, 0.18);
}

.nav-links {
  gap: 4px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);

  a {
    min-width: 64px;
    padding: 8px 12px;
    border-radius: 6px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition:
      color 180ms ease,
      background 180ms ease;

    &:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.08);
    }
  }
}

.nav-action {
  justify-content: center;
  min-width: 76px;
  min-height: 38px;
  border-radius: 7px;
  background: var(--text);
  color: #090914;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.motion-toggle {
  justify-content: center;
  min-width: 68px;
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--soft);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 180ms ease,
    border-color 180ms ease,
    color 180ms ease;

  &:hover {
    border-color: rgba(1, 205, 254, 0.42);
    background: rgba(1, 205, 254, 0.13);
    color: var(--text);
  }
}

.hero-section {
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  grid-template-columns: minmax(0, 820px) 310px;
  align-items: center;
  justify-content: center;
  gap: 42px;
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 220px 0 40px;
}

.hero-media {
  position: absolute;
  inset: 0 calc(50% - 50vw);
  z-index: -1;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(780px, 78vw);
    aspect-ratio: 1;
    border: 1px solid rgba(1, 205, 254, 0.18);
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(1, 205, 254, 0.14), transparent 42%),
      conic-gradient(
        from 90deg,
        rgba(1, 205, 254, 0.36),
        rgba(255, 113, 206, 0.18),
        rgba(5, 255, 161, 0.14),
        rgba(1, 205, 254, 0.36)
      );
    opacity: 0.52;
    filter: blur(0.2px);
    transform: translate(-50%, -50%) rotate(0deg);
    animation: centralHalo 18s ease-in-out infinite;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        90deg,
        rgba(9, 9, 20, 0.94) 0%,
        rgba(9, 9, 20, 0.38) 46%,
        rgba(9, 9, 20, 0.9) 100%
      ),
      linear-gradient(180deg, rgba(9, 9, 20, 0.1), #090914 94%);
  }
}

.anime-stage {
  position: absolute;
  right: clamp(-90px, 3vw, 80px);
  bottom: 4vh;
  width: min(520px, 44vw);
  aspect-ratio: 0.82;
  transform: translate3d(var(--ship-x), var(--ship-y), 0);
  transition: transform 180ms ease-out;
}

.anime-stage::before {
  content: "";
  position: absolute;
  left: 4%;
  right: 2%;
  bottom: 3%;
  height: 34%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse,
    rgba(1, 205, 254, 0.32),
    rgba(255, 113, 206, 0.16) 42%,
    transparent 68%
  );
  filter: blur(10px);
}

.stage-ring {
  position: absolute;
  inset: 9% 5% 11%;
  border: 1px solid rgba(1, 205, 254, 0.5);
  border-radius: 44% 56% 52% 48%;
  box-shadow:
    0 0 30px rgba(1, 205, 254, 0.18),
    inset 0 0 26px rgba(255, 113, 206, 0.12);
}

.stage-ring--outer {
  animation: ringSpin 14s ease-in-out infinite;
}

.stage-ring--inner {
  inset: 18% 14% 20%;
  border-color: rgba(255, 113, 206, 0.52);
  animation: ringSpin 10s ease-in-out infinite reverse;
}

.stage-spark {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background: var(--accent-soft);
  box-shadow: 0 0 18px var(--accent);
  transform: rotate(45deg);
}

.stage-spark--one {
  top: 17%;
  left: 14%;
  animation: sparkFloat 2.4s ease-in-out infinite;
}

.stage-spark--two {
  top: 28%;
  right: 8%;
  background: var(--pink);
  box-shadow: 0 0 18px var(--pink);
  animation: sparkFloat 2.8s ease-in-out infinite 180ms;
}

.stage-spark--three {
  right: 20%;
  bottom: 18%;
  background: var(--green);
  box-shadow: 0 0 18px var(--green);
  animation: sparkFloat 2.2s ease-in-out infinite 320ms;
}

.avatar-portrait {
  position: absolute;
  left: 50%;
  bottom: 3%;
  width: 78%;
  max-height: 92%;
  overflow: visible;
  filter: drop-shadow(0 30px 45px rgba(0, 0, 0, 0.42))
    drop-shadow(0 0 18px rgba(1, 205, 254, 0.16));
  transform: translateX(-50%);
  animation: avatarFloat 4s ease-in-out infinite;
}

.avatar-shadow {
  fill: rgba(1, 205, 254, 0.12);
}

.avatar-hair-back,
.avatar-bang {
  fill: url("#hairGradient");
  filter: url("#portraitGlow");
}

.avatar-neck,
.avatar-face {
  fill: #ffd7c8;
  stroke: rgba(255, 248, 255, 0.52);
  stroke-width: 2;
}

.avatar-eye {
  fill: var(--accent);
  filter: drop-shadow(0 0 6px var(--accent));
  animation: eyeBlink 4.8s ease-in-out infinite;
  transform-origin: center;
}

.avatar-mouth,
.avatar-line,
.avatar-cable {
  fill: none;
  stroke: rgba(255, 248, 255, 0.82);
  stroke-width: 4;
  stroke-linecap: round;
}

.avatar-jacket {
  fill: url("#jacketGradient");
  stroke: rgba(1, 205, 254, 0.42);
  stroke-width: 2;
}

.avatar-lapel {
  fill: rgba(255, 113, 206, 0.24);
  stroke: rgba(255, 113, 206, 0.6);
  stroke-width: 2;
}

.avatar-cable {
  stroke: var(--accent);
  stroke-dasharray: 8 16;
  animation: cableFlow 1.2s ease-in-out infinite;
}

.stage-card {
  position: absolute;
  min-width: 118px;
  padding: 11px 12px;
  border: 1px solid rgba(1, 205, 254, 0.38);
  border-radius: 8px;
  background: rgba(9, 9, 20, 0.72);
  box-shadow: 0 0 28px rgba(1, 205, 254, 0.12);
  backdrop-filter: blur(12px);
  animation: cardDrift 3.4s ease-in-out infinite;

  span,
  strong {
    display: block;
  }

  span {
    color: var(--muted);
    font-size: 11px;
    font-weight: 900;
  }

  strong {
    color: var(--text);
    font-size: 18px;
  }
}

.stage-card--left {
  left: 1%;
  top: 27%;
}

.stage-card--right {
  right: -2%;
  bottom: 22%;
  border-color: rgba(255, 113, 206, 0.42);
  animation-delay: 280ms;
}

.hero-scanline {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(1, 205, 254, 0.13) 50%,
    transparent 100%
  );
  background-size: 100% 160px;
  opacity: 0.32;
  animation: scanline 680ms ease-out 1 both;
}

.hero-content {
  grid-column: 1;
  grid-row: 1;
  max-width: 780px;
  padding-bottom: 0;
}

.eyebrow {
  margin: 0 0 16px;
  color: var(--amber);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-family: "ProfilePoppins", "ProfileQuicksand", "PingFang SC", sans-serif;
  position: relative;
  max-width: 760px;
  margin-bottom: 20px;
  font-size: clamp(44px, 7vw, 86px);
  line-height: 0.98;
  letter-spacing: 0;
  text-shadow: 0 0 26px rgba(1, 205, 254, 0.16);
}

h1::before,
h1::after {
  content: attr(data-glitch);
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}

h1::before {
  color: var(--accent);
  transform: translate(2px, -1px);
}

h1::after {
  color: var(--pink);
  transform: translate(-2px, 1px);
}

.profile-page:not(.motion-off) h1:hover::before,
.profile-page:not(.motion-off) h1:hover::after {
  animation: titleGlitch 360ms steps(2, end) 1;
}

h2 {
  font-family: "ProfilePoppins", "ProfileQuicksand", "PingFang SC", sans-serif;
  max-width: 760px;
  margin-bottom: 0;
  font-size: clamp(30px, 4vw, 52px);
  line-height: 1.06;
  letter-spacing: 0;
}

h3 {
  margin-bottom: 10px;
  font-size: 21px;
  line-height: 1.2;
}

.hero-copy {
  max-width: 620px;
  margin-bottom: 30px;
  color: var(--soft);
  font-size: 18px;
  line-height: 1.72;
}

.kinetic-strip {
  grid-column: 1 / -1;
  grid-row: 2;
  justify-self: center;
  width: 100vw;
  margin-top: 28px;
  padding: 10px 0;
  overflow: hidden;
  border-block: 1px solid rgba(1, 205, 254, 0.14);
  background:
    linear-gradient(
      90deg,
      rgba(1, 205, 254, 0.08),
      rgba(255, 113, 206, 0.06),
      rgba(1, 205, 254, 0.08)
    ),
    rgba(9, 9, 20, 0.34);
  mask-image: linear-gradient(
    90deg,
    transparent,
    #000 10%,
    #000 90%,
    transparent
  );

  &:hover,
  &:focus-within {
    .kinetic-track {
      animation-play-state: paused;
    }
  }
}

.kinetic-track {
  display: flex;
  width: max-content;
  animation: marqueeSlide 18s linear infinite;
}

.kinetic-group {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  padding-right: 12px;

  span {
    flex: 0 0 auto;
    min-width: 116px;
    padding: 9px 14px;
    border: 1px solid rgba(1, 205, 254, 0.18);
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.045);
    color: var(--accent-soft);
    font-size: 12px;
    font-weight: 900;
    text-align: center;
    text-shadow: 0 0 14px rgba(1, 205, 254, 0.42);
  }

  span:nth-child(2n) {
    color: var(--pink);
    text-shadow: 0 0 14px rgba(255, 113, 206, 0.42);
  }
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  a {
    justify-content: center;
    min-width: 132px;
    min-height: 46px;
    padding: 0 18px;
    border-radius: 8px;
    font-weight: 900;
    text-decoration: none;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;

    &:hover {
      transform: translateY(-2px);
    }
  }
}

.primary-action {
  background: var(--accent);
  box-shadow:
    0 18px 42px rgba(1, 205, 254, 0.24),
    0 0 26px rgba(1, 205, 254, 0.18);
  color: #050511;
}

.secondary-action {
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.hero-panel {
  grid-column: 2;
  grid-row: 1;
  margin-bottom: 0;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.26);
}

.panel-row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);

  span {
    color: var(--muted);
    font-size: 13px;
  }

  strong {
    font-size: 14px;
  }
}

.panel-meter {
  padding-top: 18px;

  span {
    display: block;
    margin-bottom: 10px;
    color: var(--muted);
    font-size: 13px;
  }

  i {
    position: relative;
    display: block;
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);

    &::after {
      content: "";
      position: absolute;
      inset: 0 18% 0 0;
      border-radius: inherit;
      background: linear-gradient(
        90deg,
        var(--accent),
        var(--accent-soft),
        var(--amber)
      );
      animation: meterPulse 420ms ease-out 1 both;
    }
  }
}

.content-section,
.contact-section {
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: 84px 0;
}

.section-heading {
  margin-bottom: 28px;
}

.section-heading--inline {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
}

.about-grid,
.project-stage,
.skill-grid {
  display: grid;
  gap: 16px;
}

.about-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.principle-card,
.project-card,
.skill-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(24, 32, 34, 0.76);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
}

.principle-card {
  min-height: 260px;
  padding: 22px;
  transition:
    transform 220ms ease,
    border-color 220ms ease,
    background 220ms ease;

  &:hover {
    border-color: rgba(1, 205, 254, 0.42);
    background: rgba(25, 20, 48, 0.92);
    transform: translateY(-6px);
  }

  p {
    margin-bottom: 0;
    color: var(--muted);
    line-height: 1.72;
  }
}

.card-index {
  display: inline-block;
  margin-bottom: 68px;
  color: var(--accent-soft);
  font-size: 13px;
  font-weight: 900;
}

.project-tabs,
.skill-filter {
  display: inline-flex;
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);

  button {
    min-width: 64px;
    min-height: 36px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-weight: 900;
    cursor: pointer;
    transition:
      color 180ms ease,
      background 180ms ease,
      box-shadow 180ms ease;

    &.active,
    &:hover {
      background: var(--text);
      color: var(--bg);
      box-shadow: 0 10px 28px rgba(250, 250, 250, 0.12);
    }
  }
}

.project-stage {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  perspective: 1200px;
}

.project-card {
  --tilt-x: 0deg;
  --tilt-y: 0deg;
  min-height: 360px;
  padding: 22px;
  cursor: pointer;
  transform: rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    opacity 180ms ease;

  &.active {
    border-color: rgba(1, 205, 254, 0.52);
    background:
      linear-gradient(180deg, rgba(1, 205, 254, 0.16), transparent 52%),
      rgba(25, 20, 48, 0.94);
  }

  &:not(.active) {
    opacity: 0.72;
  }

  p {
    color: var(--muted);
    line-height: 1.7;
  }
}

.project-card__top,
.skill-card__label {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 52px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.project-card__top strong {
  color: var(--green);
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 28px;

  span {
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: var(--soft);
    font-size: 12px;
    font-weight: 800;
  }
}

.skill-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.skill-card {
  padding: 20px;

  p {
    margin: 14px 0 0;
    color: var(--muted);
    line-height: 1.6;
  }
}

.skill-card__label {
  margin-bottom: 14px;
  text-transform: none;

  span {
    color: var(--text);
    font-size: 15px;
  }

  strong {
    color: var(--amber);
  }
}

.skill-bar {
  height: 9px;
  overflow: hidden;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);

  i {
    display: block;
    width: var(--level);
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      var(--accent),
      var(--accent-soft),
      var(--green)
    );
    transform-origin: left;
    animation: skillReveal 460ms ease both;
  }
}

.contact-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
  align-items: center;
  margin-bottom: 48px;
  padding: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(1, 205, 254, 0.16), rgba(255, 113, 206, 0.1)),
    var(--panel-solid);

  p:not(.eyebrow) {
    max-width: 620px;
    margin: 18px 0 0;
    color: var(--soft);
    line-height: 1.7;
  }
}

.contact-actions {
  display: grid;
  gap: 12px;

  a {
    justify-content: space-between;
    min-height: 50px;
    padding: 0 16px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    color: var(--text);
    font-weight: 900;
    text-decoration: none;
    transition:
      transform 180ms ease,
      background 180ms ease;

    &::after {
      content: "↗";
      font-size: 14px;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateX(4px);
    }
  }
}

.observe-section {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 420ms ease,
    transform 420ms ease;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scanline {
  from {
    background-position: 0 -220px;
  }

  to {
    background-position: 0 36vh;
  }
}

@keyframes centralHalo {
  0%,
  100% {
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
    opacity: 0.42;
  }

  50% {
    transform: translate(-50%, -50%) rotate(18deg) scale(1.04);
    opacity: 0.62;
  }
}

@keyframes ringSpin {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
    border-radius: 44% 56% 52% 48%;
  }

  50% {
    transform: rotate(14deg) scale(1.04);
    border-radius: 56% 44% 48% 52%;
  }
}

@keyframes sparkFloat {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(45deg);
    opacity: 0.72;
  }

  50% {
    transform: translate3d(0, -14px, 0) rotate(135deg);
    opacity: 1;
  }
}

@keyframes avatarFloat {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }

  50% {
    transform: translateX(-50%) translateY(-10px);
  }
}

@keyframes eyeBlink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }

  94% {
    transform: scaleY(0.18);
  }
}

@keyframes cableFlow {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: -24;
  }
}

@keyframes cardDrift {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@keyframes titleGlitch {
  0% {
    clip-path: inset(0 0 82% 0);
    opacity: 0.7;
  }

  35% {
    clip-path: inset(34% 0 42% 0);
    opacity: 0.9;
  }

  70% {
    clip-path: inset(72% 0 8% 0);
    opacity: 0.8;
  }

  100% {
    clip-path: inset(0 0 0 0);
    opacity: 0;
  }
}

@keyframes marqueeSlide {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-33.3333%);
  }
}

@keyframes meterPulse {
  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(6%);
  }
}

@keyframes skillReveal {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
}

@media (max-width: 920px) {
  .topbar {
    top: 10px;
    width: calc(100% - 20px);
  }

  .nav-links {
    display: none;
  }

  .hero-section,
  .contact-section {
    grid-template-columns: 1fr;
  }

  .hero-section {
    align-items: center;
    width: min(100% - 28px, 680px);
    min-height: 100vh;
    min-height: 100svh;
    padding-top: 96px;
    padding-bottom: 36px;
  }

  .hero-content {
    grid-column: 1;
    grid-row: auto;
    padding-bottom: 0;
  }

  .hero-panel {
    grid-column: 1;
    grid-row: auto;
    margin-bottom: 0;
  }

  .kinetic-strip {
    grid-row: auto;
  }

  .content-section,
  .contact-section {
    width: min(100% - 28px, 680px);
    padding-top: 64px;
    padding-bottom: 64px;
  }

  .section-heading--inline {
    align-items: start;
    flex-direction: column;
  }

  .about-grid,
  .project-stage,
  .skill-grid {
    grid-template-columns: 1fr;
  }

  .project-card,
  .principle-card {
    min-height: auto;
  }

  .card-index,
  .project-card__top {
    margin-bottom: 32px;
  }

  .anime-stage {
    right: -30vw;
    bottom: 8vh;
    width: min(540px, 94vw);
    opacity: 0.58;
  }
}

@media (max-width: 560px) {
  .topbar {
    height: 54px;
  }

  .brand span:last-child {
    display: none;
  }

  .nav-action {
    min-width: 68px;
  }

  .motion-toggle {
    min-width: 58px;
  }

  h1 {
    font-size: 42px;
  }

  h2 {
    font-size: 30px;
  }

  .hero-copy {
    font-size: 16px;
  }

  .project-tabs,
  .skill-filter {
    width: 100%;
    overflow-x: auto;
  }

  .contact-section {
    padding: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }

  .cursor-light {
    display: none;
  }
}

.motion-off {
  .cursor-light,
  .hero-scanline {
    display: none;
  }

  .hero-media::before {
    animation: none;
  }

  .project-card {
    transform: none;
  }

  .observe-section {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .skill-bar i,
  .panel-meter i::after,
  .stage-ring,
  .stage-spark,
  .avatar-portrait,
  .avatar-eye,
  .avatar-cable,
  .stage-card,
  .kinetic-track {
    animation: none;
  }
}

.brand,
.nav-links a,
.nav-action,
.motion-toggle,
.hero-actions a,
.project-tabs button,
.skill-filter button,
.project-card,
.contact-actions a {
  &:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 3px;
  }
}
</style>
