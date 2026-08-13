<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-start"
    :width="340"
    trigger="click"
    popper-class="emoji-picker-popper"
  >
    <template #reference>
      <el-input
        :model-value="modelValue"
        :placeholder="placeholder"
        maxlength="4"
        @update:model-value="onInput"
        @focus="visible = true"
      >
        <template #prepend>
          <span class="emoji-preview">{{ modelValue || '❓' }}</span>
        </template>
      </el-input>
    </template>

    <div class="emoji-picker">
      <div class="emoji-tabs" role="tablist">
        <button
          v-for="g in groups"
          :key="g.name"
          type="button"
          class="emoji-tab"
          :class="{ active: activeGroup === g.name }"
          :title="g.name"
          @click="activeGroup = g.name"
        >
          {{ g.icon }}
        </button>
      </div>
      <div class="emoji-grid" @wheel="onGridWheel">
        <button
          v-for="e in currentEmojis"
          :key="e"
          type="button"
          class="emoji-item"
          :class="{ selected: e === modelValue }"
          :title="e"
          @click="pick(e)"
        >
          {{ e }}
        </button>
      </div>
      <div class="emoji-footer">
        <span class="emoji-count">共 {{ totalCount }} 个图标 · {{ currentEmojis.length }} 个当前分类</span>
        <el-button v-if="modelValue" link type="danger" size="small" @click="pick('')">清除图标</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const visible = ref(false);
const activeGroup = ref('常用');

const groups = [
  {
    name: '常用',
    icon: '⭐',
    emojis: ['📒', '📁', '💰', '💳', '🏠', '🍚', '🚗', '🛒', '💊', '🎮', '📱', '💻', '🎁', '✈️', '🏥', '☕'],
  },
  {
    name: '食物',
    icon: '🍔',
    emojis: [
      '🍚', '🍜', '🍔', '🍟', '🍕', '🥪', '🍞', '🥐', '🥟', '🍗', '🍖', '🥩', '🍤', '🍣', '🍱',
      '🥗', '🍎', '🍇', '🍊', '🍌', '🍉', '🍰', '🍦', '🍿', '🍺', '☕', '🥤', '🍵', '🍷', '🧃',
    ],
  },
  {
    name: '交通',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🚓', '🚑', '🚐', '🚚', '🚛', '🚲', '🛵', '🏍️', '🚇', '🚄',
      '🚅', '✈️', '⛽', '🅿️', '🚢', '🚤', '🚃', '🚦', '🧳', '🛴',
    ],
  },
  {
    name: '购物',
    icon: '🛍️',
    emojis: [
      '🛒', '🛍️', '👗', '👕', '👖', '👟', '👠', '👜', '👛', '🎒', '💄', '💍', '⌚', '📱', '💻',
      '🖥️', '🎧', '🎁', '🧸', '🧻', '🧴', '🧼', '🪥',
    ],
  },
  {
    name: '居家',
    icon: '🏠',
    emojis: [
      '🏠', '🏡', '🛏️', '🛋️', '🪑', '🚪', '🪟', '🚿', '🛁', '🧹', '🧺', '💡', '🔧', '🔨', '🪴',
      '🍳', '🧊', '🕯️', '🖼️', '📺', '❄️', '🔥',
    ],
  },
  {
    name: '娱乐',
    icon: '🎬',
    emojis: [
      '🎬', '🎤', '🎧', '🎮', '🎲', '🎯', '🎳', '🎰', '🎡', '🎢', '🎠', '⛳', '🏊', '🏀', '⚽',
      '🎾', '🏸', '🏓', '🥊', '🧗', '🎨', '🎹', '🎸', '🥁', '📷', '🎪',
    ],
  },
  {
    name: '健康',
    icon: '💊',
    emojis: [
      '💊', '🏥', '🩺', '💉', '🧪', '🚑', '😷', '🧘', '🏃', '💪', '🥦', '🦷', '👀', '🩹', '🧬',
      '🫀', '🫁', '🧠', '🍎', '❤️',
    ],
  },
  {
    name: '学习',
    icon: '📚',
    emojis: [
      '📚', '📖', '📕', '📗', '📘', '📙', '📝', '✏️', '🖊️', '🖋️', '📌', '📏', '📐', '🔬', '🔭',
      '🎓', '🎒', '📋', '🗂️', '📂', '💻', '🖥️',
    ],
  },
  {
    name: '收入',
    icon: '💰',
    emojis: ['💰', '💵', '💴', '💶', '💷', '🪙', '🏦', '💳', '📈', '💼', '🧧', '💸', '💎', '🥇', '📊', '🏆'],
  },
  {
    name: '账户',
    icon: '🏦',
    emojis: ['💳', '🏦', '💰', '🪙', '👛', '🧾', '🏧', '📱', '💻', '💼', '🥇', '🔑', '💵', '🪪', '📲', '🛡️'],
  },
];

const currentEmojis = computed(() => groups.find((g) => g.name === activeGroup.value)?.emojis ?? []);
const totalCount = computed(() => groups.reduce((s, g) => s + g.emojis.length, 0));

function onInput(v: string) {
  emit('update:modelValue', v);
}

function pick(e: string) {
  emit('update:modelValue', e);
  visible.value = false;
}

/** 阻止滚轮事件穿透到页面，避免面板抖动/页面跟着滚动 */
function onGridWheel(e: WheelEvent) {
  e.stopPropagation();
  const el = e.currentTarget as HTMLElement;
  const canUp = el.scrollTop > 0;
  const canDown = el.scrollTop + el.clientHeight < el.scrollHeight;
  const up = e.deltaY < 0;
  const down = e.deltaY > 0;
  if ((up && !canUp) || (down && !canDown)) {
    e.preventDefault();
  }
}
</script>

<style scoped>
.emoji-preview {
  font-size: 16px;
  line-height: 1;
}
.emoji-picker {
  padding: 4px;
}
.emoji-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: thin;
}
.emoji-tab {
  border: none;
  background: transparent;
  font-size: 16px;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s;
}
.emoji-tab:hover {
  background: var(--el-fill-color-light);
}
.emoji-tab.active {
  background: var(--el-fill-color);
  box-shadow: inset 0 0 0 1px var(--el-border-color);
}
/* 固定高度：保证内部始终可滚动，且切换分类时面板高度不变（消除抖动） */
.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  height: 210px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.emoji-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: background 0.15s, transform 0.1s;
}
.emoji-item:hover {
  background: var(--el-fill-color-light);
  transform: scale(1.1);
}
.emoji-item.selected {
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}
.emoji-footer {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.emoji-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
