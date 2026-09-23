<script setup>
import { computed, useAttrs } from 'vue';
import { ui, closeModal } from '../ui.js';
import Icon from './Icon.vue';

const attrs = useAttrs();
const props = defineProps({
  title: { type: String, default: '' },
  wide: { type: Boolean, default: false },
  showClose: { type: Boolean, default: true },
});
const visible = computed(() => !!ui.modal || !!ui.confirm);
</script>

<template>
  <!-- 确认框 -->
  <div v-if="ui.confirm" class="modal-mask open" @click.self="ui.confirm = null">
    <div class="modal glass-strong" role="dialog">
      <div class="modal-head"><h3>{{ ui.confirm.title }}</h3></div>
      <div class="modal-body"><p class="confirm-msg" v-html="ui.confirm.msg"></p></div>
      <div class="modal-foot"><div class="btn-row">
        <button class="btn btn-ghost" @click="ui.confirm = null">取消</button>
        <button class="btn" :class="ui.confirm.danger ? 'btn-danger' : 'btn-primary'"
                @click="() => { const fn = ui.confirm.onOk; ui.confirm = null; fn && fn(); }">
          {{ ui.confirm.okText }}
        </button>
      </div></div>
    </div>
  </div>
  <!-- 通用组件弹窗 -->
  <div v-else-if="ui.modal" class="modal-mask open" @click.self="closeModal()">
    <div class="modal glass-strong" :class="{ 'modal-wide': ui.modal.wide }" role="dialog">
      <div class="modal-head">
        <h3>{{ ui.modal.title }}</h3>
        <button v-if="ui.modal.title || ui.modal.component" class="icon-btn" @click="closeModal()"><Icon name="X" :size="14" /></button>
      </div>
      <component :is="ui.modal.component" v-bind="ui.modal.props" />
    </div>
  </div>
</template>
