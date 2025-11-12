<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LANGUAGES, type LanguageCode, type SituationSummaryDTO } from '@sbl/shared';
import { getKnownLanguages } from '../../dumb/known-languages-storage';

const route = useRoute();
const router = useRouter();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

const situations = ref<SituationSummaryDTO[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Get active tab from URL query param or default to first known language
const activeTab = computed({
  get: () => (route.query.lang as LanguageCode) || getKnownLanguages()[0] || 'eng',
  set: (lang: LanguageCode) => {
    router.push({ query: { lang } });
  }
});

// Available language tabs (from LANGUAGES object)
const availableTabs = computed(() => {
  return Object.entries(LANGUAGES).map(([code, lang]) => ({
    code: code as LanguageCode,
    name: lang.name,
    emoji: lang.emoji
  }));
});

// Fetch situations when active tab changes
watch(activeTab, async (lang) => {
  await fetchSituations(lang);
}, { immediate: true });

async function fetchSituations(targetLanguage: LanguageCode) {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/situations/summary?targetLanguage=${targetLanguage}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch situations: ${response.status}`);
    }

    const data = await response.json();
    situations.value = data.data || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    situations.value = [];
  } finally {
    isLoading.value = false;
  }
}

// Get preferred description based on user's known languages
function getPreferredDescription(situation: SituationSummaryDTO): string {
  const knownLanguages = getKnownLanguages();

  // Try each language in user's preference order
  for (const langCode of knownLanguages) {
    const desc = situation.descriptions.find(d => d.language === langCode);
    if (desc) return desc.content;
  }

  // Fallback to English
  const engDesc = situation.descriptions.find(d => d.language === 'eng');
  return engDesc?.content || situation.identifier;
}

function getTotalChallenges(situation: SituationSummaryDTO): number {
  return situation.challengeCount.expression + situation.challengeCount.understanding;
}
</script>

<template>
  <section class="space-y-6">
    <h1>Practice Situations</h1>

    <!-- Language Tabs -->
    <div role="tablist" class="tabs tabs-boxed">
      <button
        v-for="tab in availableTabs"
        :key="tab.code"
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === tab.code }"
        @click="activeTab = tab.code"
      >
        <template v-if="tab.emoji">{{ tab.emoji }} </template>{{ tab.name }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-base-content/70">
      <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
      Loading situations…
    </div>

    <!-- Error State -->
    <div v-else-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="situations.length === 0" class="text-center py-12 text-base-content/70">
      <p>No situations available for {{ LANGUAGES[activeTab]?.name || activeTab }}.</p>
    </div>

    <!-- Situations Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="situation in situations"
        :key="situation.identifier"
        class="card shadow hover:shadow-lg transition-shadow"
      >
        <figure v-if="situation.imageLink" class="h-48">
          <img
            :src="situation.imageLink"
            :alt="situation.identifier"
            class="w-full h-full object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </figure>
        <div class="card-body">
          <h3 class="card-title text-base">{{ getPreferredDescription(situation) }}</h3>
          <p class="text-sm text-base-content/70">
            {{ getTotalChallenges(situation) }} challenge{{ getTotalChallenges(situation) !== 1 ? 's' : '' }}
          </p>
          <div class="card-actions justify-end">
            <button class="btn btn-primary btn-sm">Start</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
