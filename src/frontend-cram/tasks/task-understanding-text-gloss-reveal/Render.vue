<template>
  <div class="flex flex-col h-screen">
    <!-- Instruction Header -->
    <Instruction :prompt="task.prompt" @exit="handleExit" />

    <!-- Content Area - Scrollable -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="max-w-2xl mx-auto space-y-4">
        <!-- Gloss Content Card -->
        <div class="card shadow-lg">
          <div class="card-body">
            <!-- Question State (before reveal) -->
            <div v-if="!isRevealed" class="text-center space-y-4">
              <div class="badge badge-primary">{{ gloss.language }}</div>
              <div class="text-5xl font-bold">{{ gloss.content }}</div>
              <div class="text-sm text-base-content/70">
                Click "Reveal" to see the meaning
              </div>
            </div>

            <!-- Answer State (after reveal) -->
            <div v-else class="space-y-4">
              <div class="badge badge-primary">{{ gloss.language }}</div>
              <div class="text-3xl font-bold text-center">{{ gloss.content }}</div>

              <!-- Transcriptions -->
              <div v-if="gloss.transcriptions.length > 0" class="space-y-2">
                <div class="text-sm font-semibold text-base-content/70">Transcription:</div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(transcription, index) in gloss.transcriptions"
                    :key="index"
                    class="badge badge-outline"
                  >
                    {{ transcription }}
                  </span>
                </div>
              </div>

              <!-- Notes -->
              <div v-if="gloss.notes.length > 0" class="space-y-2">
                <div class="text-sm font-semibold text-base-content/70">Notes:</div>
                <div class="space-y-1">
                  <div
                    v-for="(note, index) in gloss.notes"
                    :key="index"
                    class="text-sm bg-base-200 p-2 rounded"
                  >
                    {{ note.content }}
                  </div>
                </div>
              </div>

              <!-- Translation IDs info (simplified for POC) -->
              <div v-if="gloss.translationIds.length > 0" class="text-sm text-base-content/70">
                {{ gloss.translationIds.length }} translation{{ gloss.translationIds.length !== 1 ? 's' : '' }} available
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar Footer -->
    <ActionBar
      :controls="actionBarControls"
      :hide-skip-button="true"
      @action="handleAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Task, TaskResult } from '../types';
import type { GlossEntity } from '../../entities/gloss/types';
import Instruction from '../../dumb/Instruction.vue';
import ActionBar, { type ActionControl } from '../../dumb/ActionBar.vue';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  finished: [result: TaskResult];
}>();

// Extract gloss from task data
const gloss = computed<GlossEntity>(() => props.task.data.gloss);

// Task state
const isRevealed = ref(false);

// Action bar controls - change based on reveal state
const actionBarControls = computed<ActionControl[]>(() => {
  if (!isRevealed.value) {
    // Show "Reveal" button
    return [
      {
        id: 'reveal',
        type: 'button',
        label: 'Reveal',
        position: 'central',
      },
    ];
  } else {
    // Show rating buttons
    return [
      {
        id: 'rating-1',
        type: 'button',
        label: 'Again',
        position: 'central-footer',
      },
      {
        id: 'rating-2',
        type: 'button',
        label: 'Hard',
        position: 'central-footer',
      },
      {
        id: 'rating-3',
        type: 'button',
        label: 'Good',
        position: 'central-footer',
      },
      {
        id: 'rating-4',
        type: 'button',
        label: 'Easy',
        position: 'central-footer',
      },
    ];
  }
});

function handleAction(controlId: string) {
  if (controlId === 'reveal') {
    isRevealed.value = true;
  } else if (controlId.startsWith('rating-')) {
    const rating = parseInt(controlId.split('-')[1]);
    emit('finished', {
      taskId: props.task.id,
      rating,
    });
  }
}

function handleExit() {
  // Exit without completing the task
  emit('finished', {
    taskId: props.task.id,
  });
}
</script>
