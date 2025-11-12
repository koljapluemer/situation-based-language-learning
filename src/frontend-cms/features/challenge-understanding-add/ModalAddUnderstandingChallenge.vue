<script setup lang="ts">
import { ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { SituationDTO, LanguageCode } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import LanguageSelect from "../../dumb/LanguageSelect.vue";

const props = defineProps<{
  show: boolean;
  situationId: string;
}>();

const emit = defineEmits<{
  close: [];
  added: [];
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const toast = useToast();
const queryClient = useQueryClient();

const text = ref("");
const language = ref<LanguageCode>("" as LanguageCode);

// Add challenge mutation
const addMutation = useMutation({
  mutationFn: async ({ newText, newLanguage }: { newText: string; newLanguage: LanguageCode }) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = [
      ...situation.challengesOfUnderstandingText.map(c => ({
        text: c.text,
        language: c.language,
        glossIds: [],
      })),
      { text: newText, language: newLanguage, glossIds: [] },
    ];

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
      throw new Error(`Failed to add challenge: ${response.status}`);
    }

    // Consume response body to complete the request
    await response.json();
  },
  onSuccess: () => {
    emit("added");
    emit("close");
    text.value = "";
    language.value = "" as LanguageCode;
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to add challenge");
    if (error instanceof Error && error.message.includes("Conflict")) {
      queryClient.invalidateQueries({ queryKey: ["situation", props.situationId] });
    }
  },
});

function handleSubmit() {
  const trimmedText = text.value.trim();
  if (!trimmedText || !language.value) return;
  addMutation.mutate({ newText: trimmedText, newLanguage: language.value });
}

function handleClose() {
  if (addMutation.isPending.value) return;
  text.value = "";
  language.value = "" as LanguageCode;
  emit("close");
}

// Reset form when modal closes
watch(() => props.show, (newShow) => {
  if (!newShow) {
    text.value = "";
    language.value = "" as LanguageCode;
  }
});
</script>

<template>
  <teleport to="body">
    <dialog :open="show" class="modal">
      <div class="modal-box">
        <h2>Add Understanding Challenge</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="challenge-language" class="label">Language</label>
            <LanguageSelect
              id="challenge-language"
              v-model="language"
              :disabled="addMutation.isPending.value"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label for="challenge-text" class="label">Text</label>
            <input
              id="challenge-text"
              v-model="text"
              type="text"
              class="input"
              placeholder="Hola, ¿cómo estás?"
              required
              :disabled="addMutation.isPending.value"
            />
          </fieldset>

          <div class="modal-action">
            <button
              type="button"
              class="btn btn-outline"
              @click="handleClose"
              :disabled="addMutation.isPending.value"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!text.trim() || !language || addMutation.isPending.value"
            >
              <span v-if="addMutation.isPending.value" class="loading loading-spinner loading-sm"></span>
              {{ addMutation.isPending.value ? "Adding..." : "Add" }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="handleClose" :disabled="addMutation.isPending.value">close</button>
      </form>
    </dialog>
  </teleport>
</template>
