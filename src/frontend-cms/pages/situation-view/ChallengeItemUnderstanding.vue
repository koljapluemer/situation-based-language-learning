<script setup lang="ts">
import { ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Pencil, Trash2, X, Check } from "lucide-vue-next";
import type { ChallengeOfUnderstandingText, SituationDTO, LanguageCode } from "@sbl/shared";
import { LANGUAGES } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import LanguageSelect from "../../dumb/LanguageSelect.vue";

const props = defineProps<{
  challenge: ChallengeOfUnderstandingText;
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

const isEditing = ref(false);
const editedText = ref(props.challenge.text);
const editedLanguage = ref<LanguageCode>(props.challenge.language);

function getLanguageDisplay(code: LanguageCode): string {
  const lang = LANGUAGES[code];
  return 'emoji' in lang ? `${lang.emoji} ${lang.name}` : lang.name;
}

// Delete mutation
const deleteMutation = useMutation({
  mutationFn: async () => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfUnderstandingText
      .filter((_, i) => i !== props.index)
      .map(c => ({ text: c.text, language: c.language, glossIds: [] }));

    const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengesOfUnderstandingText: updatedChallenges,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: This situation was modified by another user. Refreshing...");
      }
      throw new Error(`Failed to delete challenge: ${response.status}`);
    }

    // Consume response body to complete the request
    await response.json();
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

// Update mutation
const updateMutation = useMutation({
  mutationFn: async ({ text, language }: { text: string; language: LanguageCode }) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfUnderstandingText.map((c, i) =>
      i === props.index
        ? { text, language, glossIds: [] }
        : { text: c.text, language: c.language, glossIds: [] }
    );

    const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengesOfUnderstandingText: updatedChallenges,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: This situation was modified by another user. Refreshing...");
      }
      throw new Error(`Failed to update challenge: ${response.status}`);
    }

    // Consume response body to complete the request
    await response.json();
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
</script>

<template>
  <div class="flex items-start gap-2 py-2 px-3 hover:bg-base-200 border-l border-base-300">
    <div v-if="!isEditing" class="flex-1">
      <div class="text-sm">{{ challenge.text }}</div>
      <div class="text-xs text-base-content/70 mt-1">
        {{ getLanguageDisplay(challenge.language) }}
      </div>
    </div>
    <div v-else class="flex-1 flex flex-col gap-2">
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
          class="btn btn-ghost btn-xs"
          :disabled="updateMutation.isPending.value"
          aria-label="Save"
        >
          <Check :size="14" />
        </button>
        <button
          @click="cancelEdit"
          class="btn btn-ghost btn-xs"
          :disabled="updateMutation.isPending.value"
          aria-label="Cancel"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
    <div v-if="!isEditing" class="flex items-center gap-1">
      <button
        @click="startEdit"
        class="btn btn-ghost btn-xs"
        :disabled="deleteMutation.isPending.value"
        aria-label="Edit"
      >
        <Pencil :size="14" />
      </button>
      <button
        @click="handleDelete"
        class="btn btn-ghost btn-xs"
        :disabled="deleteMutation.isPending.value"
        aria-label="Delete"
      >
        <Trash2 :size="14" />
      </button>
    </div>
  </div>
</template>
