<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSituation } from '../../entities/situation';
import { getGloss, getGlossesByIds, getRecallProbability } from '../../entities/gloss';
import type { GlossEntity } from '../../entities/gloss/types';
import type { Task } from '../../tasks/types';
import { generateGlossTryToRemember } from '../../tasks/task-gloss-try-to-remember/generate';
import { generateGlossReveal } from '../../tasks/task-gloss-reveal/generate';
import { generateGuessWhatGlossMeans } from '../../tasks/task-guess-what-gloss-means/generate';
import GlossTryToRememberRender from '../../tasks/task-gloss-try-to-remember/Render.vue';
import GlossRevealRender from '../../tasks/task-gloss-reveal/Render.vue';
import GuessWhatGlossMeansRender from '../../tasks/task-guess-what-gloss-means/Render.vue';

const route = useRoute();
const router = useRouter();

const situationId = route.params.situationId as string;

// Data loading state
const allGlosses = ref<Map<string, GlossEntity>>(new Map());
const challengeGlossIds = ref<string[]>([]);
const targetLanguage = ref<string>('');
const situationIdentifier = ref<string>('');
const isLoading = ref(true);
const error = ref<string | null>(null);

// Task orchestration state
const currentTask = ref<Task | null>(null);
const lastPracticedGlossId = ref<string | null>(null);
const isComplete = ref(false);

// Computed: Check if all challenge glosses are ready (recall > 0.95)
const allGlossesReady = computed(() => {
  // If no challenge glosses, not ready
  if (challengeGlossIds.value.length === 0) return false;

  for (const glossId of challengeGlossIds.value) {
    const gloss = allGlosses.value.get(glossId);
    if (!gloss) return false; // Missing gloss means not ready
    if (getRecallProbability(gloss) < 0.95) {
      return false;
    }
  }
  return true;
});

/**
 * Recursively collect all gloss IDs including contained glosses
 */
async function collectAllGlossIds(glossIds: string[]): Promise<Set<string>> {
  const collected = new Set<string>();
  const toProcess = [...glossIds];

  while (toProcess.length > 0) {
    const id = toProcess.pop()!;
    if (collected.has(id)) continue;

    collected.add(id);

    const gloss = await getGloss(id);
    if (gloss && gloss.containsIds.length > 0) {
      toProcess.push(...gloss.containsIds);
    }
  }

  return collected;
}

/**
 * Check if all dependencies (contains) of a gloss have recall >= 0.8
 */
function areDependenciesMet(gloss: GlossEntity): boolean {
  if (gloss.containsIds.length === 0) return true;

  for (const depId of gloss.containsIds) {
    const depGloss = allGlosses.value.get(depId);
    if (!depGloss) return false;
    if (getRecallProbability(depGloss) < 0.8) {
      return false;
    }
  }

  return true;
}

/**
 * Select next gloss to practice
 */
function selectNextGloss(): GlossEntity | null {
  const eligibleGlosses: GlossEntity[] = [];

  // Find all glosses that need practice and have dependencies met
  for (const gloss of allGlosses.value.values()) {
    // Skip if this is a challenge gloss (they're only for the final test)
    if (challengeGlossIds.value.includes(gloss.id!)) continue;

    // Skip if this was the last practiced gloss
    if (gloss.id === lastPracticedGlossId.value) continue;

    // Skip if recall is already high enough
    if (getRecallProbability(gloss) >= 0.95) continue;

    // Check if dependencies are met
    if (!areDependenciesMet(gloss)) continue;

    eligibleGlosses.push(gloss);
  }

  if (eligibleGlosses.length === 0) return null;

  // Randomize selection
  const randomIndex = Math.floor(Math.random() * eligibleGlosses.length);
  return eligibleGlosses[randomIndex];
}

/**
 * Generate next task based on current state
 */
async function generateNextTask() {
  console.log('[generateNextTask] Starting', {
    allGlossesReady: allGlossesReady.value,
    challengeGlossCount: challengeGlossIds.value.length,
    totalGlossCount: allGlosses.value.size
  });

  // If all glosses are ready, present final challenge
  if (allGlossesReady.value) {
    console.log('[generateNextTask] All glosses ready, presenting final challenge');
    // Pick a random challenge gloss for the final test
    const randomIndex = Math.floor(Math.random() * challengeGlossIds.value.length);
    const challengeGlossId = challengeGlossIds.value[randomIndex];
    const gloss = allGlosses.value.get(challengeGlossId);

    if (gloss) {
      currentTask.value = generateGuessWhatGlossMeans(gloss);
      return;
    }
  }

  // Select next gloss to practice
  const nextGloss = selectNextGloss();
  console.log('[generateNextTask] Selected next gloss:', nextGloss?.id, nextGloss?.content);

  if (!nextGloss) {
    // No more glosses to practice but not all are ready - should not happen
    // but handle gracefully
    console.log('[generateNextTask] No eligible glosses found, marking complete');
    isComplete.value = true;
    return;
  }

  // Determine which task type to use
  if (!nextGloss.progressEbisu) {
    // First time seeing this gloss
    console.log('[generateNextTask] First time - try to remember');
    currentTask.value = generateGlossTryToRemember(nextGloss);
  } else {
    // Already seen, use reveal task
    console.log('[generateNextTask] Already seen - reveal task');
    currentTask.value = generateGlossReveal(nextGloss);
  }

  lastPracticedGlossId.value = nextGloss.id!;
}

/**
 * Handle task completion
 */
async function handleTaskFinished() {
  // Reload the gloss that was just practiced to get updated progress
  if (lastPracticedGlossId.value) {
    const updatedGloss = await getGloss(lastPracticedGlossId.value);
    if (updatedGloss) {
      allGlosses.value.set(updatedGloss.id!, updatedGloss);
    }
  }

  // Check if we just completed the final challenge
  if (currentTask.value?.taskType === 'guess-what-gloss-means' && allGlossesReady.value) {
    isComplete.value = true;
    return;
  }

  // Generate next task
  await generateNextTask();
}

/**
 * Handle exit from task
 */
function handleTaskExit() {
  router.push({ name: 'situations' });
}

function goBack() {
  router.push({ name: 'situations' });
}

function restartPractice() {
  isComplete.value = false;
  lastPracticedGlossId.value = null;
  generateNextTask();
}

onMounted(async () => {
  try {
    isLoading.value = true;
    error.value = null;

    // Fetch situation from Dexie
    const situation = await getSituation(situationId);

    console.log('[onMounted] Loaded situation:', JSON.stringify(situation, null, 2));

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

    challengeGlossIds.value = situation.challengesOfUnderstandingTextIds;
    console.log('[onMounted] Challenge gloss IDs:', challengeGlossIds.value);

    // Recursively collect all glosses including dependencies
    const allGlossIdsSet = await collectAllGlossIds(challengeGlossIds.value);
    const allGlossIdArray = Array.from(allGlossIdsSet);
    console.log('[onMounted] All gloss IDs (including dependencies):', allGlossIdArray);

    // Load all glosses
    const loadedGlosses = await getGlossesByIds(allGlossIdArray);
    console.log('[onMounted] Loaded glosses count:', loadedGlosses.length);

    // Store in map for easy lookup
    for (const gloss of loadedGlosses) {
      if (gloss.id) {
        allGlosses.value.set(gloss.id, gloss);
        console.log('[onMounted] Gloss:', gloss.id, gloss.content, 'progressEbisu:', gloss.progressEbisu);
      }
    }

    if (allGlosses.value.size === 0) {
      error.value = 'This situation has no glosses to practice.';
      return;
    }

    // Generate first task
    await generateNextTask();

  } catch (err) {
    console.error('Error loading glosses:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load glosses';
  } finally {
    isLoading.value = false;
  }
});
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
  <div v-else-if="!isComplete && currentTask" class="h-screen">
    <GlossTryToRememberRender
      v-if="currentTask.taskType === 'gloss-try-to-remember'"
      :key="currentTask.id"
      :task="currentTask"
      @finished="handleTaskFinished"
      @exit="handleTaskExit"
    />
    <GlossRevealRender
      v-else-if="currentTask.taskType === 'gloss-reveal'"
      :key="currentTask.id"
      :task="currentTask"
      @finished="handleTaskFinished"
      @exit="handleTaskExit"
    />
    <GuessWhatGlossMeansRender
      v-else-if="currentTask.taskType === 'guess-what-gloss-means'"
      :key="currentTask.id"
      :task="currentTask"
      @finished="handleTaskFinished"
      @exit="handleTaskExit"
    />
  </div>

  <!-- Completion Screen -->
  <div v-else-if="isComplete" class="flex flex-col items-center justify-center h-screen gap-6 p-4">
    <div class="text-center space-y-4">
      <h1>Practice Complete!</h1>
      <p class="text-xl">
        You completed practice for {{ situationIdentifier }}
      </p>
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
