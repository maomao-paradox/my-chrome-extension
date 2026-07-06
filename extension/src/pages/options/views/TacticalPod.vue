<template>
  <div class="tactical-pod" :class="[`status-${pod.status}`, { active: isActive }]">
    <div class="pod-corner tl"></div>
    <div class="pod-corner tr"></div>
    <div class="pod-corner bl"></div>
    <div class="pod-corner br"></div>
    
    <div class="pod-header">
      <div class="pod-indicator" :class="pod.status"></div>
      <span class="pod-icon">{{ pod.icon }}</span>
      <span class="pod-title">{{ pod.title }}</span>
    </div>
    
    <div class="pod-content">
      <div class="pod-data" v-for="(value, key) in pod.data" :key="key">
        <span class="data-label">{{ formatLabel(String(key)) }}</span>
        <span class="data-value">{{ value }}</span>
      </div>
    </div>
    
    <div class="pod-scanline"></div>
    
    <div class="pod-hex-stream">
      <span v-for="i in 4" :key="i" class="hex-code">0x{{ generateHex() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Pod {
  id: string;
  title: string;
  icon: string;
  position: { [key: string]: string };
  anchorIndex: number;
  status: 'normal' | 'warning' | 'critical';
  data: { [key: string]: any };
}

const props = defineProps<{
  pod: Pod;
}>();

const isActive = ref(false);

const formatLabel = (key: string): string => {
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const generateHex = (): string => {
  return Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0');
};
</script>

<style scoped>
.tactical-pod {
  position: relative;
  width: 180px;
  min-height: 120px;
  background: rgba(0, 20, 40, 0.85);
  border: 1px solid rgba(0, 255, 255, 0.3);
  clip-path: polygon(
    0 10px,
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px)
  );
  padding: 12px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tactical-pod::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 255, 0.02) 2px,
    rgba(0, 255, 255, 0.02) 4px
  );
  pointer-events: none;
  animation: scanlineMove 4s linear infinite;
}

@keyframes scanlineMove {
  0% { transform: translateY(0); }
  100% { transform: translateY(4px); }
}

.tactical-pod:hover {
  background: rgba(0, 40, 70, 0.9);
  border-color: rgba(0, 255, 255, 0.6);
  box-shadow: 
    0 0 30px rgba(0, 255, 255, 0.3),
    inset 0 0 20px rgba(0, 255, 255, 0.1);
}

.tactical-pod.active {
  background: rgba(0, 60, 100, 0.9);
  border-color: rgba(0, 255, 255, 0.8);
  box-shadow: 
    0 0 40px rgba(0, 255, 255, 0.4),
    inset 0 0 30px rgba(0, 255, 255, 0.15);
}

.tactical-pod.status-warning {
  border-color: rgba(255, 170, 0, 0.5);
}

.tactical-pod.status-warning:hover {
  border-color: rgba(255, 170, 0, 0.8);
  box-shadow: 
    0 0 30px rgba(255, 170, 0, 0.3),
    inset 0 0 20px rgba(255, 170, 0, 0.1);
}

.tactical-pod.status-critical {
  border-color: rgba(255, 51, 0, 0.5);
  animation: criticalPulse 1s ease-in-out infinite;
}

@keyframes criticalPulse {
  0%, 100% { 
    box-shadow: 0 0 20px rgba(255, 51, 0, 0.3);
  }
  50% { 
    box-shadow: 0 0 40px rgba(255, 51, 0, 0.6);
  }
}

.pod-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  opacity: 0.6;
  transition: all 0.3s ease;
}

.tactical-pod:hover .pod-corner {
  opacity: 1;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
}

.pod-corner.tl {
  top: 0;
  left: 0;
  border-top: 2px solid #00ffff;
  border-left: 2px solid #00ffff;
}

.pod-corner.tr {
  top: 0;
  right: 0;
  border-top: 2px solid #00ffff;
  border-right: 2px solid #00ffff;
}

.pod-corner.bl {
  bottom: 0;
  left: 0;
  border-bottom: 2px solid #00ffff;
  border-left: 2px solid #00ffff;
}

.pod-corner.br {
  bottom: 0;
  right: 0;
  border-bottom: 2px solid #00ffff;
  border-right: 2px solid #00ffff;
}

.pod-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
  margin-bottom: 10px;
}

.pod-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00ff88;
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
  animation: indicatorPulse 2s ease-in-out infinite;
}

.pod-indicator.warning {
  background: #ffaa00;
  box-shadow: 0 0 10px rgba(255, 170, 0, 0.8);
}

.pod-indicator.critical {
  background: #ff3300;
  box-shadow: 0 0 10px rgba(255, 51, 0, 0.8);
  animation: indicatorCritical 0.5s ease-in-out infinite;
}

@keyframes indicatorPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes indicatorCritical {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.2); }
}

.pod-icon {
  font-size: 14px;
}

.pod-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #00ffff;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.pod-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pod-data {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-label {
  font-size: 9px;
  color: #0099aa;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.data-value {
  font-size: 12px;
  font-weight: 600;
  color: #00d4ff;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
}

.pod-scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.3), transparent);
  animation: scanlineSweep 3s linear infinite;
  pointer-events: none;
}

@keyframes scanlineSweep {
  0% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

.pod-hex-stream {
  position: absolute;
  bottom: 4px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 7px;
  color: rgba(0, 102, 136, 0.4);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.05em;
  overflow: hidden;
}

.hex-code {
  animation: hexFlicker 4s ease-in-out infinite;
}

.hex-code:nth-child(2) { animation-delay: 0.5s; }
.hex-code:nth-child(3) { animation-delay: 1s; }
.hex-code:nth-child(4) { animation-delay: 1.5s; }

@keyframes hexFlicker {
  0%, 90%, 100% { opacity: 0.3; }
  95% { opacity: 0.6; }
}
</style>
