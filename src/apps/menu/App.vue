<script setup lang="ts">
import { Tool } from '@/types'
import { onMounted, ref } from 'vue'
import { toolIcon } from '@/assets/icons'
import { showSuccessMessage } from '@/utils';

interface MenuProps {
	visible: boolean;
	tools: Tool[];
}

const props = defineProps<MenuProps>();

// 限定长度最多为4个
const localTools = ref<Tool[]>([...props.tools!].slice(0, 4))

const menuRef = ref<HTMLDivElement>();
const toggleRef = ref<HTMLDivElement>();
const count = ref<number>(1);
const flag = ref<number>(1);

const emit = defineEmits(['toolClick']);

const handleToolClick = (toolId: string) => {
	maLogger.log(toolId);
	emit('toolClick', toolId);
}
const toggleMenu = () => {
	if (!menuRef.value || !toggleRef.value) {
		return;
	}
	// 获取DOM元素 (对应jQuery选择器)
	maLogger.log(menuRef.value);
	// 获取所有需要添加/移除 ss_animate 的 i 元素
	var iconElements = menuRef.value.querySelectorAll('.tool-item-icon');

	// 初始化旋转角度 (从 data-rot 读取)
	var rot = parseInt(toggleRef.value.getAttribute('data-rot')!) || 0;

	// ----- 点击事件处理 -----
	toggleRef.value.addEventListener('click', function (ev) {
		count.value++;
		// 在10次，20次，30次，40次，50次，60次，70次，80次，90次，100次时，提示成就
		if (count.value >= 10 && count.value % 10 === 0) {
			showSuccessMessage(`达成成就：点击菜单${count.value}次`);
			count.value = 0;
		}
		// 1. 更新旋转角度 (每次减180)
		if (rot == 180) {
			flag.value = -1;
		} else if (rot == -180) {
			flag.value = 1;
		}
		rot += flag.value * 180;
		// 2. 应用旋转到 menu (加单位deg)
		menuRef.value!.style.transform = 'rotate(' + rot + 'deg)';
		// 兼容旧版webkit (非必须, 但保留原逻辑)
		menuRef.value!.style.webkitTransform = 'rotate(' + rot + 'deg)';

		// 3. 根据旋转角度判断奇偶 (rot/180 % 2 == 0 为偶数)
		var isEven = (rot / 180) % 2 === 0;

		// 获取父容器 (toggle.parentElement)
		var parent = toggleRef.value!.parentElement!;

		if (isEven) {
			// 偶数: 添加 ss_active 和 close 类
			parent.classList.add('ss_active');
			toggleRef.value!.classList.add('close');
		} else {
			// 奇数: 移除 ss_active 和 close 类
			parent.classList.remove('ss_active');
			toggleRef.value!.classList.remove('close');
		}

		// 4. 将旋转角度保存回 data-rot (使用 setAttribute)
		toggleRef.value!.setAttribute('data-rot', rot.toString());
	});

	// ----- transitionend 事件处理 (监听菜单旋转结束) -----
	function onTransitionEnd(ev: TransitionEvent) {
		// 只处理 transform 属性的过渡结束 (避免其他属性触发)
		if (ev.propertyName && ev.propertyName !== 'transform' && ev.propertyName !== '-webkit-transform') {
			return;
		}

		// 再次判断奇偶 (与点击逻辑一致)
		var isEven = (rot / 180) % 2 === 0;

		// 遍历所有 i 元素 添加/移除 ss_animate 类
		for (var i = 0; i < iconElements.length; i++) {
			if (isEven) {
				iconElements[i].classList.add('ss_animate');
			} else {
				iconElements[i].classList.remove('ss_animate');
			}
		}
	}
	// 绑定 transitionend 事件 (兼容不同前缀)
	menuRef.value!.addEventListener('transitionend', onTransitionEnd);
	//@ts-ignore
	menuRef.value!.addEventListener('webkitTransitionEnd', onTransitionEnd);
	//@ts-ignore
	menuRef.value!.addEventListener('oTransitionEnd', onTransitionEnd);
};

onMounted(() => {
	toggleMenu();
});

</script>


<template>
	<div class="app-container">
		<div id='ss_menu' ref='menuRef'>
			<template v-for="(tool, index) in localTools" :key="index">
				<div class="tool-item">
					<component :is="toolIcon.get(tool.icon)" class="tool-item-icon" @click="handleToolClick(tool.id)">
					</component>
				</div>
			</template>
			<div class='menu'>
				<div class='share' id='ss_toggle' ref='toggleRef' data-rot='180'>
					<div class='circle'></div>
					<div class='bar'></div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
@use "sass:list";
@use "sass:math";
@use "sass:string";

// ============================================
// 1. 变量定义
// ============================================

// 颜色变量
$colors: (
	'bg-1': #f0efee,
	'bg-2': #f9f9f9,
	'bg-3': #e8e8e8,
	'bg-4': #2f3238,
	'bg-5': #df6659,
	'bg-6': #2fa8ec,
	'bg-7': #d0d6d6,
	'bg-8': #3d4444,
	'bg-9': #ef3f52,
	'bg-10': #64448f,
	'bg-11': #3755ad,
	'bg-12': #3498DB,
);

// 尺寸变量
$menu-size: 60px;
$menu-radius: math.div($menu-size, 2);
$menu-item-offset: 160px;
$menu-angle-step: 30deg;

// 颜色变量
$menu-color: #fff;
$menu-bg: #00796B;
$menu-bg-hover: #009688;
$menu-shadow: 0 3px 10px rgba(0, 0, 0, 0.23), 0 3px 10px rgba(0, 0, 0, 0.16);

// 字体变量
$font-stack: "Segoe UI", "Lucida Grande", Helvetica, Arial, "Microsoft YaHei", FreeSans, Arimo, "Droid Sans", "wenquanyi micro hei", "Hiragino Sans GB", "Hiragino Sans GB W3", "FontAwesome", sans-serif;

// 过渡变量
$transition-duration: 1s;
$transition-ease: ease;

// ============================================
// 2. 混合宏 (Mixins)
// ============================================

// 清除浮动
@mixin clearfix {

	&:before,
	&:after {
		content: " ";
		display: table;
	}

	&:after {
		clear: both;
	}
}

// 旋转
@mixin rotate($deg) {
	-webkit-transform: rotate($deg);
	-moz-transform: rotate($deg);
	-ms-transform: rotate($deg);
	-o-transform: rotate($deg);
	transform: rotate($deg);
}

// 缩放
@mixin scale($factor) {
	-webkit-transform: scale($factor);
	-moz-transform: scale($factor);
	-ms-transform: scale($factor);
	-o-transform: scale($factor);
	transform: scale($factor);
}

// 平移
@mixin translateY($value) {
	-webkit-transform: translateY($value);
	-moz-transform: translateY($value);
	-ms-transform: translateY($value);
	-o-transform: translateY($value);
	transform: translateY($value);
}

// 变换原点
@mixin transform-origin($x, $y) {
	-webkit-transform-origin: $x $y;
	-moz-transform-origin: $x $y;
	-ms-transform-origin: $x $y;
	-o-transform-origin: $x $y;
	transform-origin: $x $y;
}

// 过渡
@mixin transition($properties...) {
	-webkit-transition: $properties;
	-moz-transition: $properties;
	transition: $properties;
}

// 圆角
@mixin border-radius($radius) {
	border-radius: $radius;
}

// 盒子阴影
@mixin box-shadow($shadow...) {
	box-shadow: $shadow;
}

// 定位居中
@mixin center-position($top: 50%, $left: 50%) {
	top: $top;
	left: $left;
}

// 响应式断点
@mixin respond-to($breakpoint) {
	@if $breakpoint =='large' {
		@media screen and (max-width: 50em) {
			@content;
		}
	}

	@else if $breakpoint =='medium' {
		@media screen and (max-width: 40em) {
			@content;
		}
	}

	@else if $breakpoint =='small' {
		@media screen and (max-width: 30em) {
			@content;
		}
	}
}

// ============================================
// 4. 重置样式
// ============================================

*,
*:after,
*:before {
	-webkit-box-sizing: border-box;
	-moz-box-sizing: border-box;
	box-sizing: border-box;
}

// ============================================
// 5. 通用类
// ============================================

.clearfix {
	@include clearfix;
}

.app-container {
	width: 100%;
	height: 100%;
	margin: 0 auto;
	text-align: center;
	overflow: hidden;
}


// 背景颜色类
@each $key, $value in $colors {
	.bgcolor-#{string.slice($key, 4)} {
		background: $value;

		@if $key =='bg-4' or $key =='bg-8' or $key =='bg-9' or $key =='bg-10' or $key =='bg-11' or $key =='bg-12' {
			color: #fff;
		}

		@if $key =='bg-5' {
			color: #521e18;
		}
	}
}

// ============================================
// 12. 响应式设计
// ============================================

@include respond-to('large') {
	.htmleaf-header {
		padding: 3em 10% 4em;

		h1 {
			font-size: 2em;
		}
	}
}

@include respond-to('medium') {
	.htmleaf-header h1 {
		font-size: 1.5em;
	}
}

@include respond-to('small') {
	.htmleaf-header h1 {
		font-size: 1.2em;
	}
}

// ============================================
// 13. 弹跳动画
// ============================================

// ============================================
// 弹跳动画
// ============================================
@-webkit-keyframes badbounce {

	0%,
	100% {
		transform: translateY(0px);
	}

	10% {
		transform: translateY(6px);
	}

	30% {
		transform: translateY(-4px);
	}

	70% {
		transform: translateY(3px);
	}

	90% {
		transform: translateY(-2px);
	}
}

@-moz-keyframes badbounce {

	0%,
	100% {
		transform: translateY(0px);
	}

	10% {
		transform: translateY(6px);
	}

	30% {
		transform: translateY(-4px);
	}

	70% {
		transform: translateY(3px);
	}

	90% {
		transform: translateY(-2px);
	}
}

@keyframes badbounce {

	0%,
	100% {
		transform: translateY(0px);
	}

	10% {
		transform: translateY(6px);
	}

	30% {
		transform: translateY(-4px);
	}

	70% {
		transform: translateY(3px);
	}

	90% {
		transform: translateY(-2px);
	}
}

.ss_animate {
	-webkit-animation: badbounce 1s linear;
	-moz-animation: badbounce 1s linear;
	animation: badbounce 1s linear;
}

// ============================================
// 15. 菜单系统 (核心)
// ============================================

#ss_menu {
	bottom: 30px;
	width: $menu-size;
	height: $menu-size;
	color: $menu-color;
	position: fixed;
	@include transition(all $transition-duration $transition-ease);
	right: 30px;
	@include rotate(180deg);
	opacity: 0.5;

	&:hover {
		opacity: 1;		
	}

	// 主菜单按钮
	>.menu {
		display: block;
		position: absolute;
		@include border-radius(50%);
		width: $menu-size;
		height: $menu-size;
		text-align: center;
		@include box-shadow($menu-shadow);
		color: $menu-color;
		@include transition(all $transition-duration $transition-ease);

		// 分享图标容器
		.share {
			width: 100%;
			height: 100%;
			position: absolute;
			left: 0px;
			top: 0px;
			@include rotate(180deg);
			@include transition(all $transition-duration $transition-ease);

			// 三个圆点
			.circle {
				@include transition(all $transition-duration $transition-ease);
				position: absolute;
				width: 12px;
				height: 12px;
				@include border-radius(50%);
				background: $menu-color;
				top: 50%;
				margin-top: -6px;
				left: 12px;
				opacity: 1;

				&:after,
				&:before {
					@include transition(all $transition-duration $transition-ease);
					content: '';
					opacity: 1;
					display: block;
					position: absolute;
					width: 12px;
					height: 12px;
					@include border-radius(50%);
					background: $menu-color;
				}

				&:after {
					left: 20.78461px;
					top: 12.0px;
				}

				&:before {
					left: 20.78461px;
					top: -12.0px;
				}
			}

			// 汉堡菜单条纹
			.bar {
				@include transition(all $transition-duration $transition-ease);
				width: 24px;
				height: 3px;
				background: $menu-color;
				position: absolute;
				top: 50%;
				margin-top: -1.5px;
				left: 18px;
				@include transform-origin(0%, 50%);
				@include rotate(30deg);

				&:before {
					@include transition(all $transition-duration $transition-ease);
					content: '';
					width: 24px;
					height: 3px;
					background: $menu-color;
					position: absolute;
					left: 0px;
					@include transform-origin(0%, 50%);
					@include rotate(-60deg);
				}
			}

			// 关闭状态
			&.close {
				.circle {
					opacity: 0;
				}

				.bar {
					top: 50%;
					margin-top: -1.5px;
					left: 50%;
					margin-left: -12px;
					@include transform-origin(50%, 50%);
					@include rotate(405deg);

					&:before {
						@include transform-origin(50%, 50%);
						@include rotate(-450deg);
					}
				}
			}
		}

		// 活动状态
		&.ss_active {
			background: $menu-bg;
			@include scale(0.7);
		}
	}

	// 子菜单项
	>div {
		-webkit-box-sizing: border-box;
		-moz-box-sizing: border-box;
		box-sizing: border-box;
		position: absolute;
		width: $menu-size;
		height: $menu-size;
		font-size: math.div($menu-size, 2);
		text-align: center;
		background: $menu-bg;
		@include border-radius(50%);
		display: table;

		.tool-item-icon {
			display: table-cell;
			vertical-align: middle;
		}

		&:hover {
			background: $menu-bg-hover;
			cursor: pointer;
		}
	}

	// 子菜单定位（六边形布局）
	$positions: (
		1: (0px, -$menu-item-offset),
		2: (-$menu-item-offset * 0.5, -$menu-item-offset * 0.8660254),
		3: (-$menu-item-offset * 0.8660254, -$menu-item-offset * 0.5),
		4: (-$menu-item-offset, 0px)
	);

@each $index, $pos in $positions {
	$top: list.nth($pos, 1);
	$left: list.nth($pos, 2);

	div:nth-child(#{$index}) {
		top: $top;
		left: $left;
	}
}
}
</style>