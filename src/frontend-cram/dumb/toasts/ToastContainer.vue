<script setup lang="ts">
import { useToastState } from './index';
import ToastItem from './ToastItem.vue';

const { toasts, remove } = useToastState();

const closeToast = (id: string) => {
  remove(id);
};
</script>

<template>
  <teleport to="body">
    <div 
      class="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2 pointer-events-none"
      role="region" 
      aria-label="Notifications"
    >
      <transition-group 
        name="toast" 
        tag="div"
        class="space-y-2"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto"
        >
          <ToastItem 
            :toast="toast" 
            @close="closeToast"
          />
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .fixed.top-4.right-4 {
    top: 1rem;
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
}
</style>