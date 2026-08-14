<template>
  <div class="page-container">
    <div class="page-header">
      <h2>标签管理</h2>
      <el-button type="primary" @click="openCreate">＋ 新增标签</el-button>
    </div>

    <div class="card">
      <div class="card-title">
        场景标签
        <span class="tip-text">用于标记消费场景，记账时可多选，流水页可按标签筛选</span>
      </div>
      <div v-if="!tagStore.tags.length" class="empty-tip">暂无标签，点击右上角创建</div>
      <div class="tag-grid">
        <div v-for="t in tagStore.tags" :key="t.id" class="tag-card">
          <span class="tag-icon">{{ t.icon }}</span>
          <span class="tag-name">{{ t.name }}</span>
          <div class="tag-actions">
            <el-button link type="primary" size="small" @click="openEdit(t)">编辑</el-button>
            <el-popconfirm title="确认删除该标签？" @confirm="removeTag(t.id)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showDialog" :title="editing ? '编辑标签' : '新增标签'" width="380px">
      <el-form label-width="70px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：旅行" maxlength="20" />
        </el-form-item>
        <el-form-item label="图标">
          <EmojiPicker v-model="form.icon" placeholder="点击选择 Emoji" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useTagStore } from '@/stores/tag';
import type { Tag } from '@shared/types';
import EmojiPicker from '@/components/EmojiPicker.vue';

const ledgerStore = useLedgerStore();
const tagStore = useTagStore();

const showDialog = ref(false);
const editing = ref<Tag | null>(null);
const form = reactive({ name: '', icon: '🏷️' });

function openCreate() {
  editing.value = null;
  form.name = '';
  form.icon = '🏷️';
  showDialog.value = true;
}

function openEdit(t: Tag) {
  editing.value = t;
  form.name = t.name;
  form.icon = t.icon;
  showDialog.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入标签名称');
    return;
  }
  const id = ledgerStore.currentId;
  if (!id) return;
  try {
    if (editing.value) {
      await tagStore.update(editing.value.id, { name: form.name.trim(), icon: form.icon });
    } else {
      await tagStore.create({ ledger_id: id, name: form.name.trim(), icon: form.icon });
    }
    ElMessage.success('保存成功');
    showDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function removeTag(id: number) {
  try {
    await tagStore.remove(id);
    ElMessage.success('删除成功');
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

onMounted(async () => {
  const id = ledgerStore.currentId;
  if (id) await tagStore.load(id);
});
</script>

<style scoped>
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.tip-text {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.tag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.tag-card {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  gap: 10px;
  transition: box-shadow 0.2s;
}
.tag-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.tag-icon {
  font-size: 22px;
}
.tag-name {
  flex: 1;
  font-weight: 500;
}
.empty-tip {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 40px 0;
}
</style>
