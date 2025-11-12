<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Pencil, Trash2, X, Check, ChevronRight, ChevronDown } from "lucide-vue-next";
import type {
  ChallengeOfExpression,
  ChallengeOfExpressionWriteInput,
  GlossDTO,
  LocalizedString,
  SituationDTO,
} from "@sbl/shared";
import GlossModal from "../../features/gloss-manage/GlossModal.vue";
import GlossTreeNode from "../../features/gloss-tree/GlossTreeNode.vue";
import { useToast } from "../../dumb/toasts/index";

const props = defineProps<{
  challenge: ChallengeOfExpression;
  situationId: string;
  index: number;
}>();

const emit = defineEmits<{
  deleted: [];
  updated: [];
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const toast = useToast();
const queryClient = useQueryClient();

const ENGLISH_LANGUAGE = "eng";
const isSectionOpen = ref(false);
const isEditing = ref(false);
const englishPrompt = computed(() => getEnglishPrompt(props.challenge));
const editedPrompt = ref(englishPrompt.value);
const showGlossModal = ref(false);
const isGlossPending = ref(false);

watch(
  () => props.challenge.prompts,
  () => {
    if (!isEditing.value) {
      editedPrompt.value = englishPrompt.value;
    }
  },
  { deep: true }
);

const deleteMutation = useMutation({
  mutationFn: async () => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfExpression
      .filter((_, i) => i !== props.index)
      .map(toChallengeWritePayload);

    await persistExpressionChallenges(updatedChallenges);
  },
  onSuccess: () => {
    emit("deleted");
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to delete challenge");
    if (error instanceof Error && error.message.includes("Conflict")) {
      queryClient.invalidateQueries({ queryKey: ["situation", props.situationId] });
    }
  },
});

const updateMutation = useMutation({
  mutationFn: async (newPrompt: string) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfExpression.map((challenge, i) => {
      if (i === props.index) {
        return {
          identifier: challenge.identifier,
          prompts: updateEnglishPrompt(clonePrompts(challenge.prompts), newPrompt),
          glossIds: challenge.glosses.map((gloss) => gloss.id),
        };
      }
      return toChallengeWritePayload(challenge);
    });

    await persistExpressionChallenges(updatedChallenges);
  },
  onSuccess: () => {
    isEditing.value = false;
    emit("updated");
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to update challenge");
    if (error instanceof Error && error.message.includes("Conflict")) {
      queryClient.invalidateQueries({ queryKey: ["situation", props.situationId] });
    }
  },
});

function handleToggle(event: Event) {
  const target = event.target as HTMLDetailsElement;
  isSectionOpen.value = target.open;
}

function handleDelete() {
  if (confirm("Delete this challenge?")) {
    deleteMutation.mutate();
  }
}

function startEdit() {
  editedPrompt.value = englishPrompt.value;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editedPrompt.value = englishPrompt.value;
}

function saveEdit() {
  if (editedPrompt.value.trim()) {
    updateMutation.mutate(editedPrompt.value.trim());
  }
}

function openCreateGlossModal() {
  showGlossModal.value = true;
}

function closeGlossModal() {
  showGlossModal.value = false;
}

async function handleGlossSaved(gloss: GlossDTO, meta?: { existed: boolean }) {
  showGlossModal.value = false;
  try {
    isGlossPending.value = true;
    await attachGloss(gloss.id);
    toast.success(meta?.existed ? "Attached existing gloss" : "Gloss added to challenge");
    emit("updated");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to save gloss");
  } finally {
    isGlossPending.value = false;
  }
}

async function detachGloss(glossId: string) {
  const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
  if (!situation) throw new Error("Situation not found in cache");

  isGlossPending.value = true;
  try {
    const updatedChallenges = situation.challengesOfExpression.map((challenge, i) => {
      if (i === props.index) {
        const remainingIds = challenge.glosses
          .filter((gloss) => gloss.id !== glossId)
          .map((gloss) => gloss.id);
        return {
          identifier: challenge.identifier,
          prompts: clonePrompts(challenge.prompts),
          glossIds: remainingIds,
        } satisfies ChallengeOfExpressionWriteInput;
      }
      return toChallengeWritePayload(challenge);
    });

    await persistExpressionChallenges(updatedChallenges);
    toast.success("Gloss detached");
    emit("updated");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to detach gloss");
  } finally {
    isGlossPending.value = false;
  }
}

async function attachGloss(glossId: string) {
  const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
  if (!situation) throw new Error("Situation not found in cache");

  const updatedChallenges = situation.challengesOfExpression.map((challenge, i) => {
    if (i === props.index) {
      const ids = new Set(challenge.glosses.map((gloss) => gloss.id));
      ids.add(glossId);
      return {
        identifier: challenge.identifier,
        prompts: clonePrompts(challenge.prompts),
        glossIds: Array.from(ids),
      };
    }
    return toChallengeWritePayload(challenge);
  });

  await persistExpressionChallenges(updatedChallenges);
}

async function persistExpressionChallenges(challenges: ChallengeOfExpressionWriteInput[]) {
  const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengesOfExpression: challenges,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Conflict: This situation was modified by another user. Refresh and try again.");
    }
    throw new Error(`Failed to save challenge: ${response.status}`);
  }

  await response.json();
}

function getEnglishPrompt(challenge: ChallengeOfExpression): string {
  return challenge.prompts.find((prompt) => prompt.language === ENGLISH_LANGUAGE)?.content ?? "";
}

function toChallengeWritePayload(challenge: ChallengeOfExpression): ChallengeOfExpressionWriteInput {
  return {
    identifier: challenge.identifier,
    prompts: clonePrompts(challenge.prompts),
    glossIds: challenge.glosses.map((gloss) => gloss.id),
  };
}

function clonePrompts(prompts: LocalizedString[]): LocalizedString[] {
  return prompts.map((prompt) => ({ ...prompt }));
}

function updateEnglishPrompt(prompts: LocalizedString[], content: string): LocalizedString[] {
  const existingIndex = prompts.findIndex((prompt) => prompt.language === ENGLISH_LANGUAGE);
  if (existingIndex === -1) {
    return [...prompts, { language: ENGLISH_LANGUAGE, content }];
  }

  return prompts.map((prompt, index) => (index === existingIndex ? { ...prompt, content } : prompt));
}

</script>

<template>
  <div class="border-l border-base-300">
    <details class="group" :open="isSectionOpen" @toggle="handleToggle">
      <summary class="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-base-200 list-none">
        <ChevronRight :size="16" class="group-open:hidden" />
        <ChevronDown :size="16" class="hidden group-open:block" />
        <span class="flex-1 text-sm">
          {{ englishPrompt || "Untitled expression challenge" }}
        </span>
        <div class="flex items-center gap-1 ml-auto">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            aria-label="Edit challenge"
            @click.stop.prevent="startEdit"
          >
            <Pencil :size="14" />
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs text-error"
            :disabled="deleteMutation.isPending.value"
            aria-label="Delete challenge"
            @click.stop.prevent="handleDelete"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </summary>

      <div class="ml-4 border-l border-base-200 pl-4 py-4 space-y-4">
        <div v-if="isEditing" class="space-y-2">
          <input
            v-model="editedPrompt"
            type="text"
            class="input input-sm"
            @keyup.enter="saveEdit"
            @keyup.escape="cancelEdit"
          />
          <div class="flex items-center gap-2">
            <button
              @click="saveEdit"
              class="btn btn-primary btn-xs"
              :disabled="updateMutation.isPending.value"
              aria-label="Save"
            >
              <Check :size="14" />
              Save
            </button>
            <button
              @click="cancelEdit"
              class="btn btn-outline btn-xs"
              :disabled="updateMutation.isPending.value"
              aria-label="Cancel"
            >
              <X :size="14" />
              Cancel
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div v-if="!challenge.glosses.length" class="text-sm text-light italic">
            No glosses attached yet.
          </div>
          <div v-else class="space-y-2">
            <GlossTreeNode
              v-for="gloss in challenge.glosses"
              :key="gloss.id"
              :gloss="gloss"
              detachable
              @detach="detachGloss(gloss.id)"
              @changed="emit('updated')"
            />
          </div>
          <button
            type="button"
            class="btn btn-outline btn-xs justify-start"
            @click.stop="openCreateGlossModal"
            :disabled="isGlossPending"
          >
            Add gloss
          </button>
        </div>
      </div>
    </details>
  </div>

  <GlossModal
    :show="showGlossModal"
    mode="create"
    :defaults="{ language: ENGLISH_LANGUAGE }"
    @close="closeGlossModal"
    @saved="handleGlossSaved"
  />
</template>
