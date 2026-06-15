<template>
    <div class="scene">
        <div ref="carousel" class="carousel">
            <div v-for="(i, index) in props.cells" :key="index" class="carousel__cell">
                {{ i }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted ,computed} from 'vue'
const carousel = ref<HTMLElement | null>(null);

interface CarouselSceneProps {
    cells: number | object[];
    orientation: 'vertical' | 'horizontal';
}

const props = withDefaults(defineProps<CarouselSceneProps>(), {
    orientation: 'horizontal',
    cells: 9
})

function rotateCarousel() {
    if (!carousel.value) return;
    
    // 确保selectedIndex是整数，并且在合理范围内
    selectedIndex.value = Math.floor(selectedIndex.value);
    
    var angle = theta.value * selectedIndex.value * -1;
    carousel.value.style.transform = 'translateZ(' + -radius.value + 'px) ' +
        rotateFn.value + '(' + angle + 'deg)';
    
    // 当只有2个卡片时，确保只有正面的卡片是不透明的
    var cells = carousel.value.querySelectorAll('.carousel__cell') as NodeListOf<HTMLElement>;
    var cellCount = Array.isArray(props.cells) ? props.cells.length : props.cells;
    
    if (cellCount === 2) {
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (i < cellCount) {
                // 计算当前卡片的角度
                var cellAngle = theta.value * i;
                // 计算与当前旋转角度的差值
                var angleDiff = Math.abs((angle + cellAngle) % 360);
                // 如果差值小于90度，说明在正面，设置为不透明
                if (angleDiff < 90 || angleDiff > 270) {
                    cell.style.opacity = '1';
                } else {
                    // 否则设置为透明
                    cell.style.opacity = '0';
                }
            }
        }
    }
}

const rotateFn = computed(() => props.orientation === 'horizontal' ? 'rotateY' : 'rotateX');
const selectedIndex = ref(0);
const radius = ref(288); // 默认半径值
const theta = ref(40); // 默认角度间隔（360/9）

onMounted(() => {
    if (!carousel.value) {
        return
    }
    maLogger.log('CarouselScene mounted')

    var cells = carousel.value.querySelectorAll('.carousel__cell') as NodeListOf<HTMLElement>;
    var cellCount = Array.isArray(props.cells) ? props.cells.length : props.cells;
    var cellWidth = carousel.value.offsetWidth;
    var cellHeight = carousel.value.offsetHeight;
    
    // 定义颜色数组
    const colors = [
        'hsla(0, 100%, 50%, 0.8)',    // 红色
        'hsla(40, 100%, 50%, 0.8)',   // 橙色
        'hsla(80, 100%, 50%, 0.8)',   // 黄色
        'hsla(120, 100%, 50%, 0.8)',  // 绿色
        'hsla(160, 100%, 50%, 0.8)',  // 青色
        'hsla(200, 100%, 50%, 0.8)',  // 蓝色
        'hsla(240, 100%, 50%, 0.8)',  // 紫色
        'hsla(280, 100%, 50%, 0.8)',  // 粉紫色
        'hsla(320, 100%, 50%, 0.8)'   // 粉色
    ];
    
    // 计算theta和radius
    theta.value = 360 / cellCount;
    var cellSize = props.orientation === 'horizontal' ? cellWidth : cellHeight;
    radius.value = Math.round((cellSize / 2) / Math.tan(Math.PI / cellCount));
    
    // 初始化所有单元格的位置和颜色
    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (i < cellCount) {
            if (props.orientation === 'vertical') {
                var cellAngle = -theta.value * i;
            }
            else {
                var cellAngle = theta.value * i;
            }
            cell.style.transform = rotateFn.value + '(' + cellAngle + 'deg) translateZ(' + radius.value + 'px)';
            // 设置背景颜色
            const colorIndex = i % colors.length;
            cell.style.background = colors[colorIndex];
            
            // 初始化透明度
            if (cellCount === 2) {
                // 对于2个卡片，只有第一个卡片（索引0）初始为不透明
                if (i === 0) {
                    cell.style.opacity = '1';
                } else {
                    cell.style.opacity = '0';
                }
            } else {
                // 对于其他数量的卡片，都初始为不透明
                cell.style.opacity = '1';
            }
        } else {
            cell.style.opacity = '0';
            cell.style.transform = 'none';
        }
    }

    // 鼠标滚轮事件，向前滚动
    carousel.value.addEventListener('wheel', function (e) {
        e.preventDefault(); // 阻止默认滚动行为
        
        // 根据滚轮方向调整selectedIndex
        if (e.deltaY < 0) {
            // 向下滚动，切换到下一个
            if (props.orientation === 'vertical') {
                selectedIndex.value++;
            } else {
                selectedIndex.value--;
            }
        } else {
            // 向上滚动，切换到上一个
            if (props.orientation === 'vertical') {
                selectedIndex.value--;
            } else {
                selectedIndex.value++;
            }
        }
        
        rotateCarousel();
    });
})
</script>

<style>
* {
    box-sizing: border-box;
}

body {
    font-family: sans-serif;
    text-align: center;
    background: #222;
}
</style>
<style scoped>
.scene {
    border: 1px solid #CCC;
    margin: 40px 0;
    position: relative;
    width: 210px;
    height: 140px;
    margin: 80px auto;
    perspective: 1000px;
}

.carousel {
    width: 100%;
    height: 100%;
    position: absolute;
    transform: translateZ(-288px);
    transform-style: preserve-3d;
    transition: transform 1s;
}

.carousel__cell {
    position: absolute;
    width: 190px;
    height: 120px;
    left: 10px;
    top: 10px;
    border: 2px solid black;
    line-height: 116px;
    font-size: 80px;
    font-weight: bold;
    color: white;
    text-align: center;
    transition: transform 1s, opacity 1s;
}

.carousel-options {
    text-align: center;
    position: relative;
    z-index: 2;
    background: hsla(0, 0%, 100%, 0.8);
}

.button {
    margin: 0 8px;
}

.previous-button {
    background: hsla(0, 100%, 50%, 0.8);
}

.next-button {
    background: hsla(120, 100%, 50%, 0.8);
}
</style>