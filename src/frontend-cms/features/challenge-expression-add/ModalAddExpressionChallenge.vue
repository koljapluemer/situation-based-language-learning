<script setup lang="ts">
import { ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { SituationDTO } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";

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

const prompt = ref("");

// Add challenge mutation
const addMutation = useMutation({
  mutationFn: async (newPrompt: string) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = [
      ...situation.challengesOfExpression.map(c => ({ prompt: c.prompt, glossIds: [] })),
      { prompt: newPrompt, glossIds: [] },
    ];

    const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengesOfExpression: updatedChallenges,
      }),
    });

    console.log('[DEBUG] PATCH response status:', response.status, 'ok:', response.ok);
    console.log('[DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: This situation was modified by another user. Refreshing...");
      }
      throw new Error(`Failed to add challenge: ${response.status}`);
    }

    // Parse and log the response
    try {
      const result = await response.json();
      console.log('[DEBUG] Parsed response:', result);
      return result;
    } catch (err) {
      console.error('[DEBUG] Failed to parse response:', err);
      console.error('[DEBUG] Response details:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      throw err;
    }
  },
  onSuccess: () => {
    emit("added");
    emit("close");
    prompt.value = "";
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to add challenge");
    if (error instanceof Error && error.message.includes("Conflict")) {
      queryClient.invalidateQueries({ queryKey: ["situation", props.situationId] });
    }
  },
});

function handleSubmit() {
  const trimmed = prompt.value.trim();
  if (!trimmed) return;
  addMutation.mutate(trimmed);
}

function handleClose() {
  if (addMutation.isPending.value) return;
  prompt.value = "";
  emit("close");
}

// Reset form when modal closes
watch(() => props.show, (newShow) => {
  if (!newShow) {
    prompt.value = "";
  }
});
</script>

<template>
  <teleport to="body">
    <dialog :open="show" class="modal">
      <div class="modal-box">
        <h2>Add Expression Challenge</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="challenge-prompt" class="label">Prompt</label>
            <input
              id="challenge-prompt"
              v-model="prompt"
              type="text"
              class="input"
              placeholder="Say hello to a friend"
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
              :disabled="!prompt.trim() || addMutation.isPending.value"
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
