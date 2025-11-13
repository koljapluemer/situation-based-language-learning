<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSituation, resolveGlossesForChallenge } from '../../entities/situation';
import type { ChallengeOfUnderstandingTextEntity } from '../../entities/situation/types';
import type { GlossEntity } from '../../entities/gloss/types';

const route = useRoute();
const router = useRouter();

const situationId = route.params.situationId as string;

const challenge = ref<ChallengeOfUnderstandingTextEntity | null>(null);
const resolvedGlosses = ref<GlossEntity[]>([]);
const situationIdentifier = ref<string>('');
const isLoading = ref(true);
const error = ref<string | null>(null);

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

    // Check if situation has understanding text challenges
    if (!situation.challengesOfUnderstandingText || situation.challengesOfUnderstandingText.length === 0) {
      error.value = 'This situation has no understanding text challenges.';
      return;
    }

    // Select a random challenge
    const challenges = situation.challengesOfUnderstandingText;
    const randomIndex = Math.floor(Math.random() * challenges.length);
    challenge.value = challenges[randomIndex];

    // Resolve glosses
    resolvedGlosses.value = await resolveGlossesForChallenge(challenge.value.glossIds);

  } catch (err) {
    console.error('Error loading challenge:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load challenge';
  } finally {
    isLoading.value = false;
  }
});

function goBack() {
  router.push({ name: 'situations' });
}

// Format JSON for display
const debugData = ref<{ challenge: any; resolvedGlosses: any } | null>(null);

// Update debug data when challenge or glosses change
onMounted(() => {
  if (challenge.value) {
    debugData.value = {
      challenge: challenge.value,
      resolvedGlosses: resolvedGlosses.value,
    };
  }
});
</script>

<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <h1>Practice Understanding Text</h1>
      <button @click="goBack" class="btn btn-outline btn-sm">
        Back to Situations
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-base-content/70">
      <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
      Loading challenge...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="space-y-4">
      <div role="alert" class="alert alert-error">
        <span>{{ error }}</span>
      </div>
      <button @click="goBack" class="btn btn-primary">
        Go Back
      </button>
    </div>

    <!-- Success State -->
    <div v-else-if="challenge" class="space-y-6">
      <!-- Situation Info -->
      <div class="text-sm text-base-content/70">
        Situation: <span class="font-semibold">{{ situationIdentifier }}</span>
      </div>

      <!-- Challenge Display -->
      <div class="card shadow">
        <div class="card-body">
          <h2 class="card-title">Challenge</h2>

          <!-- Language Badge -->
          <div class="flex items-center gap-2">
            <span class="badge badge-primary">{{ challenge.language }}</span>
          </div>

          <!-- Challenge Text -->
          <div class="text-lg font-medium mt-4">
            {{ challenge.text }}
          </div>

          <!-- Gloss Count -->
          <div class="text-sm text-base-content/70 mt-2">
            {{ challenge.glossIds.length }} gloss{{ challenge.glossIds.length !== 1 ? 'es' : '' }}
          </div>
        </div>
      </div>

      <!-- Debug Data -->
      <div class="card shadow">
        <div class="card-body">
          <h3 class="card-title text-base">Debug Data</h3>
          <div class="text-sm text-base-content/70 mb-2">
            Raw challenge and resolved gloss data:
          </div>
          <pre class="bg-base-200 p-4 rounded-lg overflow-x-auto text-xs">{{ JSON.stringify({ challenge, resolvedGlosses }, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>
