<template>
  <div class="bg-primary border-b-10 border-b-secondary p-4 mb-4 text-white flex flex-row gap-2 items-center">
    <div>
      <button @click="emit('exit')" class="btn btn-ghost btn-sm text-white">
        <LogOut :size="24" />
      </button>
    </div>
    <h2 class="text-3xl font-bold">{{ prompt }}</h2>
  </div>
</template>

<script setup lang="ts">
import { LogOut } from 'lucide-vue-next';

defineProps<{
  prompt: string;
}>();

const emit = defineEmits<{
  exit: [];
}>();
</script>
