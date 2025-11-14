<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/vue-query";
import { ChevronRight, ChevronDown, Edit, ExternalLink, Trash2, Plus, Sparkles } from "lucide-vue-next";
import { LANGUAGES, type SituationDTO, type LocalizedString, type GlossDTO } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import ModalEditSituation from "../../features/situation-edit/ModalEditSituation.vue";
import { useModalEditSituation } from "../../features/situation-edit/index";
import GlossModal from "../../features/gloss-manage/GlossModal.vue";
import GlossTreeNode from "../../features/gloss-tree/GlossTreeNode.vue";
import ModalGenerateUnderstandingChallenges from "../../features/ai-challenges/ModalGenerateUnderstandingChallenges.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const situationId = route.params.id as string;

const showGlossModalExpression = ref(false);
const showGlossModalUnderstanding = ref(false);
const showAIGenerateModal = ref(false);
const expressionSectionOpen = ref(true);
const understandingSectionOpen = ref(true);

const { open: openEditModal } = useModalEditSituation();

// Fetch situation with TanStack Query
const situationQueryKey = computed(() => ["situation", situationId]);

const { data: situation, isLoading, error } = useQuery({
  queryKey: situationQueryKey,
  queryFn: async ({ queryKey }) => {
    const [, id] = queryKey as [string, string];
    const response = await fetch(`${API_BASE_URL}/situations/${id}`);
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
const nativeLanguageInfo = computed(() => {
  const code = situation.value?.nativeLanguage;
  return code ? LANGUAGES[code] ?? null : null;
});
const primaryDescription = computed(() => {
  if (!situation.value) return "";
  return (
    situation.value.descriptions.find(desc => desc.language === "eng")?.content ??
    situation.value.descriptions[0]?.content ??
    ""
  );
});

function goBack() {
  router.push({ name: "situations-list" });
}

function openGlossModalExpression() {
  showGlossModalExpression.value = true;
}

function openGlossModalUnderstanding() {
  showGlossModalUnderstanding.value = true;
}

function openAIGenerateModal() {
  showAIGenerateModal.value = true;
}

function handleAIGenerated() {
  queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
  showAIGenerateModal.value = false;
  toast.success("AI-generated challenges added successfully");
}

async function handleGlossAdded(gloss: GlossDTO, type: "expression" | "understanding") {
  if (!situation.value) return;

  try {
    const currentIds = type === "expression"
      ? situation.value.challengesOfExpression.map(g => g.id)
      : situation.value.challengesOfUnderstandingText.map(g => g.id);

    // Add gloss ID if not already present
    if (currentIds.includes(gloss.id)) {
      toast.info("This gloss is already attached");
      return;
    }

    const newIds = [...currentIds, gloss.id];
    const field = type === "expression"
      ? "challengesOfExpressionIds"
      : "challengesOfUnderstandingTextIds";

    const response = await fetch(`${API_BASE_URL}/situations/${situationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: newIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add gloss: ${response.status}`);
    }

    await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
    toast.success("Gloss added successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Failed to add gloss: ${message}`);
  }
}

const removeGlossMutation = useMutation({
  mutationFn: async ({ glossId, type }: { glossId: string; type: "expression" | "understanding" }) => {
    if (!situation.value) throw new Error("Situation not found");

    const currentIds = type === "expression"
      ? situation.value.challengesOfExpression.map(g => g.id)
      : situation.value.challengesOfUnderstandingText.map(g => g.id);

    const newIds = currentIds.filter(id => id !== glossId);
    const field = type === "expression"
      ? "challengesOfExpressionIds"
      : "challengesOfUnderstandingTextIds";

    const response = await fetch(`${API_BASE_URL}/situations/${situationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: newIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to remove gloss: ${response.status}`);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
    toast.success("Gloss removed successfully");
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to remove gloss");
  },
});

function handleRemoveGloss(glossId: string, type: "expression" | "understanding") {
  if (confirm("Remove this gloss from the situation?")) {
    removeGlossMutation.mutate({ glossId, type });
  }
}

function handleEditSituation() {
  if (!situation.value) return;
  openEditModal(situation.value);
}

async function handleUpdateSituation(descriptions: LocalizedString[], imageLink?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/situations/${situationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        descriptions,
        imageLink,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update situation: ${response.status}`);
    }

    await queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
    toast.success("Situation updated successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Failed to update situation: ${message}`);
  }
}

function handleGlossChanged() {
  queryClient.invalidateQueries({ queryKey: ["situation", situationId] });
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
              <h2 class="card-title">{{ primaryDescription || 'Untitled situation' }}</h2>
              <p class="mt-1 text-xs font-mono text-base-content/60 break-all">ID: {{ situation.id }}</p>
              <div class="mt-2 space-y-1 text-sm text-base-content/70">
                <p class="flex items-center gap-2">
                  <span class="font-medium uppercase text-xs tracking-wide text-base-content/70">
                    Target language:
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span v-if="languageInfo?.emoji" aria-hidden="true">{{ languageInfo?.emoji }}</span>
                    {{ languageInfo?.name ?? situation.targetLanguage }}
                    <span class="text-xs uppercase text-base-content/60">({{ situation.targetLanguage }})</span>
                  </span>
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium uppercase text-xs tracking-wide text-base-content/70">
                    Native language:
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span v-if="nativeLanguageInfo?.emoji" aria-hidden="true">{{ nativeLanguageInfo?.emoji }}</span>
                    {{ nativeLanguageInfo?.name ?? situation.nativeLanguage }}
                    <span class="text-xs uppercase text-base-content/60">({{ situation.nativeLanguage }})</span>
                  </span>
                </p>
              </div>
              <div v-if="situation.descriptions.length" class="space-y-1 mt-4">
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
              <img :src="situation.imageLink" :alt="`Image for ${situation.id}`"
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
              <div class="text-sm text-base-content/70 mb-2">
                Glosses in native language ({{ situation.nativeLanguage }}) that prompt learners to express themselves in {{ situation.targetLanguage }}
              </div>

              <div v-if="situation.challengesOfExpression.length === 0" class="text-center py-4 text-base-content/70">
                No expression glosses yet
              </div>
              <div v-else class="space-y-3">
                <div v-for="gloss in situation.challengesOfExpression" :key="gloss.id"
                  class="card bg-base-100 border border-base-300">
                  <div class="card-body p-3">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1">
                        <GlossTreeNode
                          :gloss="gloss"
                          :enforce-language="situation.nativeLanguage"
                          :translation-language="situation.targetLanguage"
                          @changed="handleGlossChanged"
                        />
                      </div>
                      <button
                        @click="handleRemoveGloss(gloss.id, 'expression')"
                        class="btn btn-ghost btn-sm btn-square"
                        type="button"
                        title="Remove gloss"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button @click="openGlossModalExpression" class="btn btn-outline btn-sm gap-2" type="button">
                  <Plus :size="16" />
                  Add expression gloss
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
              <div class="text-sm text-base-content/70 mb-2">
                Glosses in target language ({{ situation.targetLanguage }}) that learners need to understand
              </div>

              <div v-if="situation.challengesOfUnderstandingText.length === 0"
                class="text-center py-4 text-base-content/70">
                No understanding glosses yet
              </div>
              <div v-else class="space-y-3">
                <div v-for="gloss in situation.challengesOfUnderstandingText" :key="gloss.id"
                  class="card bg-base-100 border border-base-300">
                  <div class="card-body p-3">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1">
                        <GlossTreeNode
                          :gloss="gloss"
                          :enforce-language="situation.targetLanguage"
                          :translation-language="selectedNativeLanguage"
                          @changed="handleGlossChanged"
                        />
                      </div>
                      <button
                        @click="handleRemoveGloss(gloss.id, 'understanding')"
                        class="btn btn-ghost btn-sm btn-square"
                        type="button"
                        title="Remove gloss"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <button @click="openGlossModalUnderstanding" class="btn btn-outline btn-sm gap-2" type="button">
                  <Plus :size="16" />
                  Add understanding gloss
                </button>
                <button @click="openAIGenerateModal" class="btn btn-primary btn-sm gap-2" type="button">
                  <Sparkles :size="16" />
                  Generate with AI
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

      <GlossModal
      v-if="situation"
      :show="showGlossModalExpression"
      mode="create"
      :locked-language="situation.nativeLanguage"
      @close="showGlossModalExpression = false"
      @saved="(gloss) => handleGlossAdded(gloss, 'expression')"
    />

    <GlossModal
      v-if="situation"
      :show="showGlossModalUnderstanding"
      mode="create"
      :locked-language="situation.targetLanguage"
      @close="showGlossModalUnderstanding = false"
      @saved="(gloss) => handleGlossAdded(gloss, 'understanding')"
    />

    <ModalGenerateUnderstandingChallenges
      v-if="situation"
      :show="showAIGenerateModal"
      :situation="situation"
      :native-language="situation.nativeLanguage"
      @close="showAIGenerateModal = false"
      @saved="handleAIGenerated"
    />

    <ModalEditSituation @update="handleUpdateSituation" />
  </section>
</template>
