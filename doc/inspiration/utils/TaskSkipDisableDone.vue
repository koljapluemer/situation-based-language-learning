<template>
  <div class="flex gap-2 mt-6 justify-end">
    <button 
      v-if="showSkip"
      @click="$emit('skip')" 
      class="btn btn-outline"
    >
      {{ skipLabel }}
    </button>
    
    <button 
      v-if="showSkipAndDisable"
      @click="$emit('skipAndDisable')" 
      class="btn btn-outline"
    >
      {{ $t('practice.tasks.skipDisable') }}
    </button>
    
    <button 
      v-if="showDone"
      @click="$emit('done')" 
      :disabled="doneDisabled" 
      class="btn btn-primary"
    >
      {{ doneLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  showSkip?: boolean;
  showSkipAndDisable?: boolean;
  showDone?: boolean;
  skipLabel?: string;
  doneLabel?: string;
  doneDisabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  showSkip: true,
  showSkipAndDisable: true,
  showDone: true,
  skipLabel: 'Skip',
  doneLabel: 'Done',
  doneDisabled: false
});

defineEmits<{
  skip: [];
  skipAndDisable: [];
  done: [];
}>();
</script>
