<template>
  <div class="page-container">
    <div class="page-header">
      <h2>分类管理</h2>
      <el-button type="primary" @click="openCreate('expense')">＋ 新增支出分类</el-button>
      <el-button type="success" @click="openCreate('income')">＋ 新增收入分类</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="card">
          <div class="card-title">支出分类</div>
          <div class="cat-list">
            <div v-for="c in expenseCats" :key="c.id" class="cat-row">
              <span class="cat-icon">{{ c.icon }}</span>
              <span class="cat-name">{{ c.name }}</span>
              <div class="cat-actions">
                <el-button link type="primary" size="small" @click="openEdit(c)">编辑</el-button>
                <el-popconfirm title="确认删除该分类？" @confirm="removeCategory(c.id)">
                  <template #reference>
                    <el-button link type="danger" size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <div class="card-title">收入分类</div>
          <div class="cat-list">
            <div v-for="c in incomeCats" :key="c.id" class="cat-row">
              <span class="cat-icon">{{ c.icon }}</span>
              <span class="cat-name">{{ c.name }}</span>
              <div class="cat-actions">
                <el-button link type="primary" size="small" @click="openEdit(c)">编辑</el-button>
                <el-popconfirm title="确认删除该分类？" @confirm="removeCategory(c.id)">
                  <template #reference>
                    <el-button link type="danger" size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="showDialog" :title="editing ? '编辑分类' : '新增分类'" width="380px">
      <el-form label-width="70px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="分类名称" />
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
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useLedgerStore } from '@/stores/ledger';
import { useCategoryStore } from '@/stores/category';
import type { Category, CategoryKind } from '@shared/types';
import EmojiPicker from '@/components/EmojiPicker.vue';

const ledgerStore = useLedgerStore();
const categoryStore = useCategoryStore();

const showDialog = ref(false);
const editing = ref<Category | null>(null);
const form = reactive({ name: '', icon: '📁', kind: 'expense' as CategoryKind });

const expenseCats = computed(() => categoryStore.categories.filter((c) => c.kind === 'expense' && !c.parent_id));
const incomeCats = computed(() => categoryStore.categories.filter((c) => c.kind === 'income' && !c.parent_id));

function openCreate(kind: CategoryKind) {
  editing.value = null;
  form.name = '';
  form.icon = '📁';
  form.kind = kind;
  showDialog.value = true;
}

function openEdit(c: Category) {
  editing.value = c;
  form.name = c.name;
  form.icon = c.icon;
  form.kind = c.kind;
  showDialog.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  const id = ledgerStore.currentId;
  if (!id) return;
  try {
    if (editing.value) {
      await categoryStore.update(editing.value.id, { name: form.name.trim(), icon: form.icon });
    } else {
      await categoryStore.create({ ledger_id: id, name: form.name.trim(), icon: form.icon, kind: form.kind });
    }
    ElMessage.success('保存成功');
    showDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function removeCategory(id: number) {
  await categoryStore.remove(id);
  ElMessage.success('删除成功');
}

onMounted(async () => {
  const id = ledgerStore.currentId;
  if (id) await categoryStore.load(id);
});
</script>

<style scoped>
.card-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.cat-list {
  display: flex;
  flex-direction: column;
}
.cat-row {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid var(--color-border);
}
.cat-icon {
  font-size: 20px;
  margin-right: 10px;
}
.cat-name {
  flex: 1;
}
.cat-actions {
  display: flex;
}
</style>
