<template>
  <div class="flex gap-2 justify-center">
    <button @click="emit('rating', 1)" class="btn btn-error">{{ $t('practice.tasks.rating.again') }}</button>
    <button @click="emit('rating', 2)" class="btn btn-warning">{{ $t('practice.tasks.rating.hard') }}</button>
    <button @click="emit('rating', 3)" class="btn btn-info">{{ $t('practice.tasks.rating.good') }}</button>
    <button @click="emit('rating', 4)" class="btn btn-success">{{ $t('practice.tasks.rating.easy') }}</button>
  </div>
</template>

<script setup lang="ts">
import type { Rating } from 'ts-fsrs';

const emit = defineEmits<{
  rating: [rating: Rating];
}>();
</script>