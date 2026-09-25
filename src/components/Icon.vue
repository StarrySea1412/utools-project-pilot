<script setup>
// Icon.vue — lucide 静态映射：只打包这里列出的图标，避免全量引入
import { computed } from 'vue';
import {
  Plane, Bell, SunMoon, Settings, Plus, Search, SearchX, RefreshCw, Play, Square,
  FolderOpen, FolderInput, Terminal, ArrowUpRight, MoreHorizontal, ChevronDown, ChevronUp,
  Zap, Timer, Sparkles, X, Check, Plug, Compass, Lightbulb, ListTodo, Rocket,
  Trash2, Pencil, LayoutGrid, Grid3x3, List, Copy, Eraser, Info, TriangleAlert,
  Undo2, ArrowLeft, ArrowDown, ArrowUp, Moon, CircleCheck, CircleDot, Inbox, GitBranch,
  Bot, Folder, File, Eye, ListChecks, ScrollText, Wrench, ShieldAlert, CalendarClock,
  DatabaseBackup, Download, Upload, FileWarning, Pin, Keyboard,
} from 'lucide-vue-next';

const MAP = {
  Plane, Bell, SunMoon, Settings, Plus, Search, SearchX, RefreshCw, Play, Square,
  FolderOpen, FolderInput, Terminal, ArrowUpRight, MoreHorizontal, ChevronDown, ChevronUp,
  Zap, Timer, Sparkles, X, Check, Plug, Compass, Lightbulb, ListTodo, Rocket,
  Trash2, Pencil, LayoutGrid, Grid3x3, List, Copy, Eraser, Info, TriangleAlert,
  Undo2, ArrowLeft, ArrowDown, ArrowUp, Moon, CircleCheck, CircleDot, Inbox, GitBranch,
  Bot, Folder, File, Eye, ListChecks, ScrollText, Wrench, ShieldAlert, CalendarClock,
  DatabaseBackup, Download, Upload, FileWarning, Pin, Keyboard,
};

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 14 },
});
const comp = computed(() => MAP[props.name] || Info);
</script>

<template>
  <component :is="comp" :size="size" :stroke-width="2" class="lucide-icon" aria-hidden="true" />
</template>
