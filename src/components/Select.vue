<!-- Select.vue — 通用下拉选择（玻璃拟态，替代原生 <select>）
     用法: <Select v-model="val" :options="[{ value, label }]" block? />
     支持：点击外部/Esc/滚动关闭、↑↓ 键导航、Enter 选中、右缘自动右对齐、下缘自动上弹 -->
<script setup>
import { computed, ref, nextTick, onBeforeUnmount } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  block: { type: Boolean, default: false },    // 占满整行（对应原 select full）
});
const emit = defineEmits(['update:modelValue']);

const root = ref(null);
const triggerRef = ref(null);
const menu = ref(null);
const open = ref(false);
const hoverIdx = ref(-1);
const alignRight = ref(false);
const openUp = ref(false);
const menuStyle = ref({}); // fixed 定位坐标（Teleport 到 body，不受滚动容器裁剪）

const curLabel = computed(() => {
  const hit = props.options.find((o) => o.value === props.modelValue);
  return hit ? hit.label : String(props.modelValue ?? '');
});

async function toggle() {
  if (open.value) { close(); return; }
  open.value = true;
  hoverIdx.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue));
  menuStyle.value = { visibility: 'hidden' }; // 先隐藏量尺寸，再定位显示
  await nextTick();
  // 按触发器几何定位（fixed）：右缘溢出 → 右对齐；下缘溢出 → 向上弹；并钳制不超出视口
  const t = triggerRef.value?.getBoundingClientRect();
  const m = menu.value?.getBoundingClientRect();
  if (t && m) {
    const GAP = 5;
    const openUpward = t.bottom + m.height + GAP > window.innerHeight - 8;
    const left = Math.max(8, Math.min(t.left, window.innerWidth - m.width - 8));
    const top = openUpward ? Math.max(8, t.top - m.height - GAP) : t.bottom + GAP;
    menuStyle.value = { left: left + 'px', top: top + 'px', visibility: 'visible' };
  } else {
    menuStyle.value = { visibility: 'visible' };
  }
}
function choose(opt) {
  emit('update:modelValue', opt.value);
  close();
}
function close() { open.value = false; hoverIdx.value = -1; }
function onOutside(e) { if (root.value && !root.value.contains(e.target)) close(); }
function onScroll(e) { if (menu.value && !menu.value.contains(e.target)) close(); }
function onKeydown(e) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); toggle(); }
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); hoverIdx.value = (hoverIdx.value + 1) % props.options.length; }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hoverIdx.value = (hoverIdx.value - 1 + props.options.length) % props.options.length; }
  else if (e.key === 'Enter') { e.preventDefault(); const opt = props.options[hoverIdx.value]; if (opt) choose(opt); }
  else if (e.key === 'Escape' || e.key === 'Tab') { close(); }
}
document.addEventListener('pointerdown', onOutside);
window.addEventListener('scroll', onScroll, true);
window.addEventListener('resize', close);
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', close);
});
</script>

<template>
  <div ref="root" class="sel" :class="{ 'sel-block': block }" @keydown="onKeydown">
    <button type="button" ref="triggerRef" class="sel-trigger" :class="{ on: open }" @click="toggle">
      <span class="sel-label">{{ curLabel }}</span>
      <Icon name="ChevronDown" :size="13" class="sel-caret" />
    </button>
    <Teleport to="body">
      <div v-if="open" ref="menu" class="sel-menu" :style="menuStyle"
           :class="{ 'align-right': alignRight, 'open-up': openUp }">
        <div v-for="(o, i) in options" :key="o.value" class="sel-opt" :class="{ selected: o.value === modelValue, hover: i === hoverIdx }"
             @click="choose(o)" @mouseenter="hoverIdx = i">
          <Icon name="Check" :size="12" class="opt-check" />
          <span class="opt-label">{{ o.label }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
/* 不用 scoped：菜单 Teleport 到 body，scoped 属性选择器够不到 */
.sel { position: relative; display: inline-flex; min-width: 0; }
.sel-block { width: 100%; }
.sel-trigger {
  display: inline-flex; align-items: center; gap: 6px; max-width: 210px;
  border: 1px solid var(--stroke); background: var(--chip-bg); color: var(--text-2);
  border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  font-family: var(--font); white-space: nowrap; transition: all 0.15s;
}
.sel-trigger:hover, .sel-trigger.on { color: var(--text); border-color: var(--stroke-soft); background: var(--hover); }
.sel-block .sel-trigger { width: 100%; border-radius: 10px; }
.sel-label { overflow: hidden; text-overflow: ellipsis; }
.sel-caret { flex-shrink: 0; color: var(--text-3); transition: transform 0.15s; }
.sel-trigger.on .sel-caret { transform: rotate(180deg); }
.sel-menu {
  position: fixed; min-width: 100px; width: max-content;
  background: var(--glass-strong); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--stroke-soft); border-radius: 12px; box-shadow: var(--shadow-lg);
  padding: 4px; z-index: 300; max-height: 264px; overflow-y: auto;
}
.sel-menu.align-right { text-align: left; }
.sel-opt {
  display: flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 8px;
  font-size: 12.5px; font-weight: 600; color: var(--text-2); cursor: pointer; white-space: nowrap;
}
.sel-opt.hover { background: var(--hover); color: var(--text); }
.sel-opt.selected { color: var(--accent); }
.opt-check { visibility: hidden; flex-shrink: 0; }
.sel-opt.selected .opt-check { visibility: visible; }
</style>
