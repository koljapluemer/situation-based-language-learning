<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Task } from '../../tasks/types';
import type { GlossEntity } from '../../entities/gloss/types';
import type { ActionControl } from '../../dumb/ActionBar.vue';
import { updateGlossProgress } from '../../entities/gloss';
import GlossRenderer from '../../features/gloss-view/GlossRenderer.vue';
import ActionBar from '../../dumb/ActionBar.vue';
import Instruction from '../../dumb/Instruction.vue';

interface Props {
  task: Task;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  finished: [];
  exit: [];
}>();

const gloss = ref<GlossEntity | null>(null);

const actionControls = computed<ActionControl[]>(() => [
  {
    type: 'button',
    id: 'done',
    label: 'Done',
    position: 'central'
  }
]);

const handleDone = async () => {
  if (!gloss.value) return;

  try {
    // Initialize Ebisu model: [alpha, beta, t] = [3, 3, 24]
    // This represents initial uncertainty with 24-hour half-life
    await updateGlossProgress(gloss.value.id!, [3, 3, 24], new Date());
    emit('finished');
  } catch (error) {
    console.error('Failed to initialize gloss progress:', error);
    emit('finished');
  }
};

function handleAction(controlId: string) {
  if (controlId === 'done') handleDone();
  else if (controlId === 'skip') emit('finished');
}

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

    <!-- Scrollable content area -->
    <div class="flex-1 overflow-auto min-h-0">
      <div class="container mx-auto p-4">
        <div v-if="gloss">
          <GlossRenderer :gloss="gloss" show-language show-all-notes-immediately />
        </div>

        <div v-else>
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- ActionBar always at bottom -->
    <ActionBar :controls="actionControls" @action="handleAction" />
  </div>
</template>
