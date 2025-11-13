<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { ChevronRight, ChevronDown, Edit, ExternalLink } from "lucide-vue-next";
import { LANGUAGES, type SituationDTO, type LocalizedString, type LanguageCode } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import ChallengeItemExpression from "./ChallengeItemExpression.vue";
import ChallengeItemUnderstanding from "./ChallengeItemUnderstanding.vue";
import ModalAddExpressionChallenge from "../../features/challenge-expression-add/ModalAddExpressionChallenge.vue";
import ModalAddUnderstandingChallenge from "../../features/challenge-understanding-add/ModalAddUnderstandingChallenge.vue";
import ModalEditSituation from "../../features/situation-edit/ModalEditSituation.vue";
import { useModalEditSituation } from "../../features/situation-edit/index";
import LanguageSelect from "../../dumb/LanguageSelect.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const situationId = route.params.id as string;

const showExpressionModal = ref(false);
const showUnderstandingModal = ref(false);
const expressionSectionOpen = ref(true);
const understandingSectionOpen = ref(true);
const selectedNativeLanguage = ref<LanguageCode>("eng");

const { open: openEditModal } = useModalEditSituation();

// Fetch situation with TanStack Query
const { data: situation, isLoading, error, refetch } = useQuery({
  queryKey: ["situation", situationId],
  queryFn: async () => {
    const response = await fetch(`${API_BASE_URL}/situations/${situationId}?language=eng`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Situation not found");
      }
      if (response.status === 409) {
        throw new Error("Conflict: This situation was modified by another user. Please refresh.");
      }
      throw new Error(`Failed to load situation: ${response.status}`);
    }
    const payload = await response.json();
    return payload.data as SituationDTO;
  },
  refetchOnWindowFocus: true,
  staleTime: 30 * 1000,
});

const languageInfo = computed(() => {
  const code = situation.value?.targetLanguage;
  return code ? LANGUAGES[code] ?? null : null;
});

function goBack() {
  router.push({ name: "situations-list" });
}

function openExpressionModal() {
  showExpressionModal.value = true;
}

function openUnderstandingModal() {
  showUnderstandingModal.value = true;
}

async function handleChallengeAdded() {
  // Invalidate and refetch the situation
  await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
  toast.success("Challenge added successfully");
}

async function handleChallengeDeleted() {
  await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
  toast.success("Challenge deleted successfully");
}

async function handleChallengeUpdated() {
  await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
  toast.success("Challenge updated successfully");
}

function handleEditSituation() {
  if (!situation.value) return;
  openEditModal(situation.value);
}

async function handleUpdateSituation(identifier: string, descriptions: LocalizedString[], imageLink?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/situations/${situationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier,
        descriptions,
        imageLink,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: This identifier already exists or the situation was modified by another user");
      }
      throw new Error(`Failed to update situation: ${response.status}`);
    }

    await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
    toast.success("Situation updated successfully");

    // If identifier changed, navigate to new URL
    if (identifier !== situationId) {
      router.push({ name: "situation-view", params: { id: identifier } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Failed to update situation: ${message}`);
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between gap-4">
      <h1>Situation Details</h1>
      <button class="btn btn-outline btn-sm" type="button" @click="goBack">
        Back to List
      </button>
    </header>

    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-base-content/70">
      <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
      Loading situation…
    </div>

    <div v-else-if="error" role="alert" class="alert alert-error">
      <span>{{ error instanceof Error ? error.message : 'Failed to load situation' }}</span>
    </div>

    <div v-else-if="situation" class="space-y-6">
      <!-- Situation Info -->
      <div class="card shadow">
        <div class="card-body">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <h2 class="card-title">{{ situation.identifier }}</h2>
              <p class="mt-1 text-sm text-base-content/70 flex items-center gap-2">
                <span class="font-medium uppercase text-xs tracking-wide text-base-content/70">
                  Target language:
                </span>
                <span class="inline-flex items-center gap-1">
                  <span v-if="languageInfo?.emoji" aria-hidden="true">{{ languageInfo?.emoji }}</span>
                  {{ languageInfo?.name ?? situation.targetLanguage }}
                  <span class="text-xs uppercase text-base-content/60">({{ situation.targetLanguage }})</span>
                </span>
              </p>
              <div v-if="situation.descriptions.length" class="space-y-1 mt-2">
                <p v-for="desc in situation.descriptions" :key="desc.language" class="text-sm">
                  <span class="font-medium uppercase text-xs tracking-wide text-base-content/70">
                    {{ desc.language }}:
                  </span>
                  {{ desc.content }}
                </p>
              </div>
            </div>
            <button @click="handleEditSituation" class="btn btn-ghost btn-sm" type="button" title="Edit situation">
              <Edit :size="16" />
            </button>
          </div>

          <!-- Image Display -->
          <div v-if="situation.imageLink" class="mt-4 space-y-2">
            <div class="relative">
              <img :src="situation.imageLink" :alt="`Image for ${situation.identifier}`"
                class="w-full max-w-md rounded-lg shadow-sm"
                @error="($event.target as HTMLImageElement).style.display = 'none'" />
            </div>
            <a :href="situation.imageLink" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink :size="14" />
              {{ situation.imageLink }}
            </a>
          </div>
        </div>
      </div>

      <!-- Native Language Filter -->
      <div class="flex flex-wrap items-end gap-4">
        <fieldset class="fieldset max-w-xs">
          <label for="native-language" class="label">Native Language</label>
          <LanguageSelect id="native-language" v-model="selectedNativeLanguage" />
        </fieldset>
      </div>

      <!-- Challenges of Expression -->
      <div class="card shadow">
        <div class="card-body">
          <details :open="expressionSectionOpen"
            @toggle="expressionSectionOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="flex items-center gap-2 cursor-pointer list-none">
              <ChevronRight :size="20" v-if="!expressionSectionOpen" />
              <ChevronDown :size="20" v-else />
              <h3 class="text-lg font-bold">Challenges of Expression</h3>
            </summary>

            <div class="mt-4 space-y-3">
              <div v-if="situation.challengesOfExpression.length === 0" class="text-center py-4 text-base-content/70">
                No expression challenges yet
              </div>
              <div v-else class="space-y-1">
                <ChallengeItemExpression v-for="(challenge, index) in situation.challengesOfExpression" :key="index"
                  :challenge="challenge" :situation-id="situationId" :index="index"
                  :native-language="selectedNativeLanguage" @deleted="handleChallengeDeleted"
                  @updated="handleChallengeUpdated" />
              </div>
              <div>
                <button @click="openExpressionModal" class="btn btn-outline btn-sm justify-start" type="button">
                  Add expression challenge
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- Challenges of Understanding Text -->
      <div class="card shadow">
        <div class="card-body">
          <details :open="understandingSectionOpen"
            @toggle="understandingSectionOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="flex items-center gap-2 cursor-pointer list-none">
              <ChevronRight :size="20" v-if="!understandingSectionOpen" />
              <ChevronDown :size="20" v-else />
              <h3 class="text-lg font-bold">Challenges of Understanding Text</h3>
            </summary>

            <div class="mt-4 space-y-3">
              <div v-if="situation.challengesOfUnderstandingText.length === 0"
                class="text-center py-4 text-base-content/70">
                No understanding challenges yet
              </div>
              <div v-else class="space-y-1">
                <ChallengeItemUnderstanding v-for="(challenge, index) in situation.challengesOfUnderstandingText"
                  :key="index" :challenge="challenge" :situation-id="situationId" :index="index"
                  :target-language="situation.targetLanguage" :native-language="selectedNativeLanguage"
                  @deleted="handleChallengeDeleted" @updated="handleChallengeUpdated" />
              </div>
              <div>
                <button @click="openUnderstandingModal" class="btn btn-outline btn-sm justify-start" type="button">
                  Add understanding challenge
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <ModalAddExpressionChallenge v-if="situation" :show="showExpressionModal" :situation-id="situationId"
      @close="showExpressionModal = false" @added="handleChallengeAdded" />

    <ModalAddUnderstandingChallenge v-if="situation" :show="showUnderstandingModal" :situation-id="situationId"
      @close="showUnderstandingModal = false" @added="handleChallengeAdded" />

    <ModalEditSituation @update="handleUpdateSituation" />
  </section>
</template>
