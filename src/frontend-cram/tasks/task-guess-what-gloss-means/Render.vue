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
const userGuess = ref('');
const showTranslation = ref(false);

const canReveal = computed(() => {
  return userGuess.value.trim().length > 0;
});

const actionControls = computed<ActionControl[]>(() => {
  if (!showTranslation.value) {
    if (canReveal.value) {
      return [
        {
          id: 'reveal',
          label: 'Reveal Translation',
          type: 'button',
          position: 'central-footer'
        }
      ];
    }
    return [];
  } else {
    return [
      {
        id: 'done',
        label: 'Done',
        type: 'button',
        position: 'central'
      }
    ];
  }
});

const handleAction = async (actionId: string) => {
  if (actionId === 'reveal') {
    showTranslation.value = true;
  } else if (actionId === 'done') {
    await handleDone();
  } else if (actionId === 'skip') {
    emit('finished');
  }
};

const handleDone = async () => {
  if (!gloss.value) return;

  try {
    // If no progress exists, initialize Ebisu model
    if (!gloss.value.progressEbisu) {
      await updateGlossProgress(gloss.value.id!, [3, 3, 24], new Date());
    }

    emit('finished');
  } catch (error) {
    console.error('Failed to update gloss progress:', error);
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
            :hide-translations="!showTranslation"
            :show-all-notes-immediately="showTranslation"
          />

          <div v-if="showTranslation && userGuess.trim()" class="mt-6">
            <div class="divider text-lg font-medium">Your Guess</div>
            <div class="text-xl p-4 bg-base-200 rounded-lg italic">
              {{ userGuess }}
            </div>
          </div>

          <div v-if="!showTranslation" class="mt-6">
            <fieldset class="fieldset">
              <label for="user-guess" class="label">Type what you think this means:</label>
              <textarea
                id="user-guess"
                v-model="userGuess"
                class="textarea textarea-bordered w-full"
                rows="3"
                placeholder="Type what you think this sentence means..."
              ></textarea>
            </fieldset>
          </div>
        </div>

        <div v-else class="text-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <ActionBar :controls="actionControls" @action="handleAction" />
  </div>
</template>
