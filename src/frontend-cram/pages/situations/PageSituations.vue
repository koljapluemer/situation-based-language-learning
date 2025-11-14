<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LANGUAGES, type LanguageCode, type SituationSummaryDTO } from '@sbl/shared';
import { getKnownLanguages } from '../../dumb/known-languages-storage';
import { downloadSituation, downloadAllSituations } from '../../features/situation-download';
import { situationExists } from '../../entities/situation';
import { Download } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

const situations = ref<SituationSummaryDTO[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const downloadingSituationId = ref<string | null>(null);
const downloadingAll = ref(false);
const downloadProgress = ref({ current: 0, total: 0 });
const downloadedSituations = ref<Set<string>>(new Set());

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
    const fetched: SituationSummaryDTO[] = data.data || [];
    const userNativeLanguages = getKnownLanguages();
    if (userNativeLanguages.length) {
      const allowed = new Set(userNativeLanguages);
      situations.value = fetched.filter(s => allowed.has(s.nativeLanguage));
    } else {
      situations.value = fetched;
    }
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
  return engDesc?.content || situation.id;
}

function getTotalChallenges(situation: SituationSummaryDTO): number {
  return situation.challengeCount.expression + situation.challengeCount.understanding;
}

// Check which situations are already downloaded
async function checkDownloadedSituations() {
  const downloaded = new Set<string>();
  for (const situation of situations.value) {
    const exists = await situationExists(situation.id);
    if (exists) {
      downloaded.add(situation.id);
    }
  }
  downloadedSituations.value = downloaded;
}

// Download a single situation
async function handleDownloadSituation(id: string) {
  downloadingSituationId.value = id;
  error.value = null;

  try {
    await downloadSituation(id);
    downloadedSituations.value.add(id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Download failed';
  } finally {
    downloadingSituationId.value = null;
  }
}

// Practice: download if needed, then start
async function handlePractice(id: string) {
  // Download if not already downloaded
  if (!downloadedSituations.value.has(id)) {
    await handleDownloadSituation(id);

    // Check if download failed
    if (error.value) {
      return;
    }
  }

  // Navigate to practice
  router.push({ name: 'practice-understanding-text', params: { situationId: id } });
}

// Download all situations for current language
async function handleDownloadAll() {
  downloadingAll.value = true;
  error.value = null;
  downloadProgress.value = { current: 0, total: 0 };

  try {
    const nativeLanguages = getKnownLanguages();
    await downloadAllSituations(
      activeTab.value,
      nativeLanguages,
      (current, total) => {
        downloadProgress.value = { current, total };
      }
    );
    // Refresh downloaded status
    await checkDownloadedSituations();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Download failed';
  } finally {
    downloadingAll.value = false;
    downloadProgress.value = { current: 0, total: 0 };
  }
}

// Watch situations changes to check download status
watch(situations, () => {
  checkDownloadedSituations();
}, { deep: true });
</script>

<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <h1>Practice Situations</h1>
      <button
        v-if="situations.length > 0"
        @click="handleDownloadAll"
        :disabled="downloadingAll || isLoading"
        class="btn btn-outline btn-sm gap-2"
      >
        <Download :size="16" />
        <span v-if="!downloadingAll">Download All</span>
        <span v-else>
          Downloading {{ downloadProgress.current }}/{{ downloadProgress.total }}
        </span>
      </button>
    </div>

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
        :key="situation.id"
        class="card shadow hover:shadow-lg transition-shadow"
      >
        <figure v-if="situation.imageLink" class="h-48">
          <img
            :src="situation.imageLink"
            :alt="situation.id"
            class="w-full h-full object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </figure>
        <div class="card-body">
          <h3 class="card-title text-base">{{ getPreferredDescription(situation) }}</h3>
          <p class="text-sm text-base-content/70">
            {{ getTotalChallenges(situation) }} challenge{{ getTotalChallenges(situation) !== 1 ? 's' : '' }}
          </p>
          <div class="text-xs text-base-content/70 flex items-center gap-2">
            <span class="font-semibold uppercase">Native:</span>
            <span class="inline-flex items-center gap-1">
              <span v-if="LANGUAGES[situation.nativeLanguage]?.emoji" aria-hidden="true">
                {{ LANGUAGES[situation.nativeLanguage]?.emoji }}
              </span>
              {{ LANGUAGES[situation.nativeLanguage]?.name ?? situation.nativeLanguage }}
              <span class="text-[10px] uppercase text-base-content/50">({{ situation.nativeLanguage }})</span>
            </span>
          </div>
          <div class="card-actions justify-end gap-2">
            <!-- Re-download button (only if already downloaded) -->
            <button
              v-if="downloadedSituations.has(situation.id)"
              @click="handleDownloadSituation(situation.id)"
              :disabled="downloadingSituationId === situation.id"
              class="btn btn-ghost btn-sm btn-square"
              title="Re-download"
            >
              <Download :size="16" v-if="downloadingSituationId !== situation.id" />
              <span v-else class="loading loading-spinner loading-xs"></span>
            </button>

            <!-- Practice button (downloads if needed, then starts) -->
            <button
              @click="handlePractice(situation.id)"
              :disabled="downloadingSituationId === situation.id"
              class="btn btn-primary btn-sm"
            >
              <span v-if="downloadingSituationId !== situation.id">Practice</span>
              <span v-else class="loading loading-spinner loading-xs"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
