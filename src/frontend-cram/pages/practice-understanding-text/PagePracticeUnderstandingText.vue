<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSituation } from '../../entities/situation';
import { getGloss } from '../../entities/gloss';
import type { GlossEntity } from '../../entities/gloss/types';
import { generateGlossRevealTasks } from '../../tasks/task-understanding-text-gloss-reveal/generate';
import type { Task, TaskResult } from '../../tasks/types';
import TaskRenderer from '../../tasks/task-understanding-text-gloss-reveal/Render.vue';

const route = useRoute();
const router = useRouter();

const situationId = route.params.situationId as string;

// Data loading state
const resolvedGlosses = ref<GlossEntity[]>([]);
const targetLanguage = ref<string>('');
const situationIdentifier = ref<string>('');
const isLoading = ref(true);
const error = ref<string | null>(null);

// Task orchestration state
const generatedTasks = ref<Task[]>([]);
const currentTaskIndex = ref(0);
const taskResults = ref<TaskResult[]>([]);

// Computed properties
const currentTask = computed(() => generatedTasks.value[currentTaskIndex.value]);
const isComplete = computed(() => currentTaskIndex.value >= generatedTasks.value.length);
const totalTasks = computed(() => generatedTasks.value.length);

onMounted(async () => {
  try {
    isLoading.value = true;
    error.value = null;

    // Fetch situation from Dexie
    const situation = await getSituation(situationId);

    if (!situation) {
      error.value = `Situation "${situationId}" not found. Please download it first.`;
      return;
    }

    situationIdentifier.value = situation.identifier;
    targetLanguage.value = situation.targetLanguage;

    // Check if situation has understanding text glosses
    if (!situation.challengesOfUnderstandingTextIds || situation.challengesOfUnderstandingTextIds.length === 0) {
      error.value = 'This situation has no understanding text glosses.';
      return;
    }

    // Resolve all glosses for understanding challenges
    const glossIds = situation.challengesOfUnderstandingTextIds;
    const glossPromises = glossIds.map(id => getGloss(id));
    const glossResults = await Promise.all(glossPromises);
    resolvedGlosses.value = glossResults.filter((g): g is GlossEntity => g !== undefined);

    // Generate tasks from glosses
    if (resolvedGlosses.value.length === 0) {
      error.value = 'This situation has no glosses to practice.';
      return;
    }

    generatedTasks.value = generateGlossRevealTasks(
      resolvedGlosses.value,
      targetLanguage.value
    );

  } catch (err) {
    console.error('Error loading glosses:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load glosses';
  } finally {
    isLoading.value = false;
  }
});

function handleTaskFinished(result: TaskResult) {
  // Store the result
  taskResults.value.push(result);

  // Move to next task
  currentTaskIndex.value++;
}

function goBack() {
  router.push({ name: 'situations' });
}

function restartPractice() {
  // Reset to first task
  currentTaskIndex.value = 0;
  taskResults.value = [];
}
</script>

<template>
  <!-- Loading State -->
  <div v-if="isLoading" class="flex flex-col items-center justify-center h-screen gap-4">
    <span class="loading loading-spinner loading-lg" aria-hidden="true"></span>
    <p class="text-lg">Loading glosses...</p>
  </div>

  <!-- Error State -->
  <div v-else-if="error" class="flex flex-col items-center justify-center h-screen gap-4 p-4">
    <div role="alert" class="alert alert-error max-w-md">
      <span>{{ error }}</span>
    </div>
    <button @click="goBack" class="btn btn-primary">
      Go Back
    </button>
  </div>

  <!-- Task Renderer -->
  <div v-else-if="!isComplete && currentTask">
    <TaskRenderer
      :task="currentTask"
      @finished="handleTaskFinished"
    />
  </div>

  <!-- Completion Screen -->
  <div v-else-if="isComplete" class="flex flex-col items-center justify-center h-screen gap-6 p-4">
    <div class="text-center space-y-4">
      <h1 class="text-4xl font-bold">Practice Complete! 🎉</h1>
      <p class="text-xl">
        You completed {{ totalTasks }} task{{ totalTasks !== 1 ? 's' : '' }}
      </p>
      <div class="text-base-content/70">
        Situation: <span class="font-semibold">{{ situationIdentifier }}</span>
      </div>

      <!-- Task results summary -->
      <div class="card shadow-lg max-w-md mx-auto">
        <div class="card-body">
          <h3 class="card-title text-lg">Ratings</h3>
          <div class="flex flex-col gap-2">
            <div class="flex justify-between">
              <span>Again (1):</span>
              <span class="badge badge-error">{{ taskResults.filter(r => r.rating === 1).length }}</span>
            </div>
            <div class="flex justify-between">
              <span>Hard (2):</span>
              <span class="badge badge-warning">{{ taskResults.filter(r => r.rating === 2).length }}</span>
            </div>
            <div class="flex justify-between">
              <span>Good (3):</span>
              <span class="badge badge-info">{{ taskResults.filter(r => r.rating === 3).length }}</span>
            </div>
            <div class="flex justify-between">
              <span>Easy (4):</span>
              <span class="badge badge-success">{{ taskResults.filter(r => r.rating === 4).length }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-4">
      <button @click="restartPractice" class="btn btn-outline">
        Practice Again
      </button>
      <button @click="goBack" class="btn btn-primary">
        Back to Situations
      </button>
    </div>
  </div>
</template>
