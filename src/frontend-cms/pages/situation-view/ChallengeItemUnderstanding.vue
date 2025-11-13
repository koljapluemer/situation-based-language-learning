<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Pencil, Trash2, X, Check, ChevronRight, ChevronDown } from "lucide-vue-next";
import type {
  ChallengeOfUnderstandingText,
  ChallengeOfUnderstandingTextWriteInput,
  GlossDTO,
  LanguageCode,
  SituationDTO,
} from "@sbl/shared";
import { LANGUAGES } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import LanguageSelect from "../../dumb/LanguageSelect.vue";
import GlossModal from "../../features/gloss-manage/GlossModal.vue";
import GlossTreeNode from "../../features/gloss-tree/GlossTreeNode.vue";

const props = defineProps<{
  challenge: ChallengeOfUnderstandingText;
  situationId: string;
  index: number;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
}>();

const emit = defineEmits<{
  deleted: [];
  updated: [];
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const toast = useToast();
const queryClient = useQueryClient();

const isSectionOpen = ref(false);
const isEditing = ref(false);
const editedText = ref(props.challenge.text);
const editedLanguage = ref<LanguageCode>(props.challenge.language);
const showGlossModal = ref(false);
const isGlossPending = ref(false);
const targetLanguage = computed(() => props.targetLanguage);
const nativeLanguage = computed(() => props.nativeLanguage);
const situationQueryKey = computed(() => ["situation", props.situationId, nativeLanguage.value]);
const filteredGlosses = computed(() =>
  props.challenge.glosses.filter((gloss) => gloss.language === targetLanguage.value)
);

watch(
  () => props.challenge,
  () => {
    if (!isEditing.value) {
      editedText.value = props.challenge.text;
      editedLanguage.value = props.challenge.language;
    }
  },
  { deep: true }
);

const deleteMutation = useMutation({
  mutationFn: async () => {
    const situation = queryClient.getQueryData<SituationDTO>(situationQueryKey.value);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfUnderstandingText
      .filter((_, i) => i !== props.index)
      .map(toUnderstandingWritePayload);

    await persistUnderstandingChallenges(updatedChallenges);
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
  mutationFn: async ({ text, language }: { text: string; language: LanguageCode }) => {
    const situation = queryClient.getQueryData<SituationDTO>(situationQueryKey.value);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfUnderstandingText.map((challenge, i) =>
      i === props.index
        ? {
            text,
            language,
            glossIds: challenge.glosses.map((gloss) => gloss.id),
          }
        : toUnderstandingWritePayload(challenge)
    );

    await persistUnderstandingChallenges(updatedChallenges);
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

function getLanguageDisplay(code: LanguageCode): string {
  const lang = LANGUAGES[code];
  return "emoji" in lang ? `${lang.emoji} ${lang.name}` : lang.name;
}

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
  editedText.value = props.challenge.text;
  editedLanguage.value = props.challenge.language;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editedText.value = props.challenge.text;
  editedLanguage.value = props.challenge.language;
}

function saveEdit() {
  if (editedText.value.trim()) {
    updateMutation.mutate({
      text: editedText.value.trim(),
      language: editedLanguage.value,
    });
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

async function attachGloss(glossId: string) {
  const situation = queryClient.getQueryData<SituationDTO>(situationQueryKey.value);
  if (!situation) throw new Error("Situation not found in cache");

  const updatedChallenges = situation.challengesOfUnderstandingText.map((challenge, i) => {
    if (i === props.index) {
      const ids = new Set(challenge.glosses.map((gloss) => gloss.id));
      ids.add(glossId);
      return {
        text: challenge.text,
        language: challenge.language,
        glossIds: Array.from(ids),
      };
    }
    return toUnderstandingWritePayload(challenge);
  });

  await persistUnderstandingChallenges(updatedChallenges);
}

async function detachGloss(glossId: string) {
  const situation = queryClient.getQueryData<SituationDTO>(situationQueryKey.value);
  if (!situation) throw new Error("Situation not found in cache");

  isGlossPending.value = true;
  try {
    const updatedChallenges = situation.challengesOfUnderstandingText.map((challenge, i) => {
      if (i === props.index) {
        const remainingIds = challenge.glosses
          .filter((gloss) => gloss.id !== glossId)
          .map((gloss) => gloss.id);
        return {
          text: challenge.text,
          language: challenge.language,
          glossIds: remainingIds,
        } satisfies ChallengeOfUnderstandingTextWriteInput;
      }
      return toUnderstandingWritePayload(challenge);
    });

    await persistUnderstandingChallenges(updatedChallenges);
    toast.success("Gloss detached");
    emit("updated");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to detach gloss");
  } finally {
    isGlossPending.value = false;
  }
}

async function persistUnderstandingChallenges(challenges: ChallengeOfUnderstandingTextWriteInput[]) {
  const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengesOfUnderstandingText: challenges,
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

function toUnderstandingWritePayload(
  challenge: ChallengeOfUnderstandingText
): ChallengeOfUnderstandingTextWriteInput {
  return {
    text: challenge.text,
    language: challenge.language,
    glossIds: challenge.glosses.map((gloss) => gloss.id),
  };
}

</script>

<template>
  <div class="border-l border-base-300">
    <details class="group" :open="isSectionOpen" @toggle="handleToggle">
      <summary class="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-base-200 list-none">
        <ChevronRight :size="16" class="group-open:hidden" />
        <ChevronDown :size="16" class="hidden group-open:block" />
        <div class="flex flex-col flex-1">
          <span class="font-medium">{{ challenge.text }}</span>
          <span class="text-xs text-light">{{ getLanguageDisplay(challenge.language) }}</span>
        </div>
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
        <div v-if="isEditing" class="space-y-3">
          <input
            v-model="editedText"
            type="text"
            class="input input-sm"
            @keyup.enter="saveEdit"
            @keyup.escape="cancelEdit"
          />
          <LanguageSelect v-model="editedLanguage" />
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
          <div v-if="!filteredGlosses.length" class="text-sm text-light italic">
            No glosses in the target language.
          </div>
          <div v-else class="space-y-2">
            <GlossTreeNode
              v-for="gloss in filteredGlosses"
              :key="gloss.id"
              :gloss="gloss"
              :lock-language="true"
              :enforce-language="targetLanguage"
              :translation-language="nativeLanguage"
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
    :defaults="{ language: targetLanguage }"
    :locked-language="targetLanguage"
    @close="closeGlossModal"
    @saved="handleGlossSaved"
  />
</template>
