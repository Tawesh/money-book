<template>
  <div class="lock-screen">
    <div class="lock-card">
      <div class="lock-icon">💰</div>
      <h2 class="lock-title">MoneyBook</h2>
      <p class="lock-sub">请输入密码解锁</p>
      <div class="lock-form">
        <el-input
          v-model="password"
          type="password"
          placeholder="输入解锁密码"
          size="large"
          show-password
          class="lock-input"
          @keyup.enter="unlock"
        />
        <el-button type="primary" size="large" class="lock-btn" :loading="loading" @click="unlock">
          解锁
        </el-button>
      </div>
      <p v-if="error" class="lock-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const emit = defineEmits<{ unlocked: [] }>();

const password = ref('');
const loading = ref(false);
const error = ref('');

async function unlock() {
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const ok = await window.moneyBook.system.unlock(password.value);
    if (ok) {
      ElMessage.success('欢迎回来');
      emit('unlocked');
    } else {
      error.value = '密码错误，请重试';
      password.value = '';
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2d3d 0%, #2b3a4a 100%);
}
.lock-card {
  width: 380px;
  box-sizing: border-box;
  text-align: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 48px 40px;
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}
.lock-icon {
  font-size: 56px;
}
.lock-title {
  color: #fff;
  font-size: 24px;
  margin: 12px 0 4px;
}
.lock-sub {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin-bottom: 24px;
}
.lock-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lock-input {
  width: 100%;
}
.lock-btn {
  width: 100%;
  margin: 0;
}
.lock-error {
  color: #f56c6c;
  margin-top: 12px;
  font-size: 13px;
}
</style>
