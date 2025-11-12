<script setup lang="ts">
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-vue-next';
import type { ToastData } from './index';

interface Props {
  toast: ToastData;
}

interface Emits {
  (e: 'close', id: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const close = () => {
  emit('close', props.toast.id);
};

const getAlertClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'alert-success';
    case 'error':
      return 'alert-error';
    case 'warning':
      return 'alert-warning';
    case 'info':
      return 'alert-info';
    default:
      return 'alert-info';
  }
};

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return CheckCircle;
    case 'error':
      return XCircle;
    case 'warning':
      return AlertTriangle;
    case 'info':
      return Info;
    default:
      return Info;
  }
};
</script>

<template>
  <div 
    class="alert shadow-lg mb-2 transform transition-all duration-300 ease-in-out animate-in slide-in-from-right"
    :class="getAlertClass(toast.type)"
  >
    <component :is="getIcon(toast.type)" class="w-5 h-5 shrink-0" />
    
    <div class="flex-1 min-w-0">
      <div v-if="toast.title" class="font-semibold ">
        {{ toast.title }}
      </div>
      <div class="">
        {{ toast.message }}
      </div>
    </div>
    
    <button 
      @click="close"
      class="btn btn-ghost btn-sm btn-circle ml-2"
      aria-label="Close notification"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>

<style scoped>
@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-in {
  animation-fill-mode: both;
}

.slide-in-from-right {
  animation: slide-in-from-right 0.3s ease-out;
}
</style>