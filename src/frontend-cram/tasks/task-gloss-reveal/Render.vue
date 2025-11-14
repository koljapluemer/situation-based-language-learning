<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Task } from '../../tasks/types';
import type { GlossEntity } from '../../entities/gloss/types';
import type { ActionControl } from '../../dumb/ActionBar.vue';
import { updateGlossProgress } from '../../entities/gloss';
import GlossRenderer from '../../features/gloss-view/GlossRenderer.vue';
import ActionBar from '../../dumb/ActionBar.vue';
import Instruction from '../../dumb/Instruction.vue';
import * as ebisu from 'ebisu-js';

interface Props {
  task: Task;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  finished: [];
  exit: [];
}>();

const gloss = ref<GlossEntity | null>(null);
const isRevealed = ref(false);

// ActionBar controls
const actionControls = computed<ActionControl[]>(() => {
  if (!isRevealed.value) {
    return [
      {
        id: 'reveal',
        label: 'Reveal',
        type: 'button',
        position: 'central'
      }
    ];
  } else {
    return [
      { id: 'rating-1', label: 'Again (1)', type: 'button', position: 'central' },
      { id: 'rating-2', label: 'Hard (2)', type: 'button', position: 'central' },
      { id: 'rating-3', label: 'Good (3)', type: 'button', position: 'central' },
      { id: 'rating-4', label: 'Easy (4)', type: 'button', position: 'central' }
    ];
  }
});

const handleRating = async (rating: number) => {
  if (!gloss.value || !gloss.value.progressEbisu) return;

  try {
    // Update Ebisu model using ebisu.updateRecall
    const { model, lastReviewed } = gloss.value.progressEbisu;
    const hoursSinceReview = (Date.now() - lastReviewed.getTime()) / (1000 * 60 * 60);

    // Map rating 1-4 to success probability: 1=0.2, 2=0.4, 3=0.7, 4=0.95
    const successProbMap = { 1: 0.2, 2: 0.4, 3: 0.7, 4: 0.95 };
    const successProb = successProbMap[rating as keyof typeof successProbMap] || 0.5;

    // Update the model
    const newModel = ebisu.updateRecall(model, successProb, 1, hoursSinceReview);

    await updateGlossProgress(gloss.value.id!, newModel, new Date());
    emit('finished');
  } catch (error) {
    console.error('Failed to update gloss progress:', error);
    emit('finished');
  }
};

const handleAction = (controlId: string) => {
  if (controlId === 'reveal') {
    isRevealed.value = true;
  } else if (controlId.startsWith('rating-')) {
    const rating = parseInt(controlId.split('-')[1]);
    handleRating(rating);
  } else if (controlId === 'skip') {
    emit('finished');
  }
};

function handleExit() {
  emit('exit');
}

onMounted(() => {
  // Extract gloss from task data
  if (props.task.data?.gloss) {
    gloss.value = props.task.data.gloss;
  }
});
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <Instruction :prompt="task.prompt" @exit="handleExit" />

    <div class="flex-1 overflow-auto min-h-0">
      <div class="container mx-auto p-4">
        <div v-if="gloss">
          <GlossRenderer
            :gloss="gloss"
            :hide-translations="!isRevealed"
            :show-all-notes-immediately="isRevealed"
          />
        </div>

        <div v-else>
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- ActionBar -->
    <ActionBar :controls="actionControls" @action="handleAction" />
  </div>
</template>
