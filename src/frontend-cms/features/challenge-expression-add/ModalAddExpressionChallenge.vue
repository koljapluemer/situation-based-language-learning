<script setup lang="ts">
import { ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type {
  ChallengeOfExpression,
  ChallengeOfExpressionWriteInput,
  LocalizedString,
  SituationDTO,
} from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import { slugify } from "../../dumb/slug";

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
const ENGLISH_LANGUAGE = "eng";

const addMutation = useMutation({
  mutationFn: async (newPrompt: string) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const baseChallenges = situation.challengesOfExpression.map(toChallengeWritePayload);
    const identifier = generateUniqueIdentifier(newPrompt, situation.challengesOfExpression);

    const updatedChallenges: ChallengeOfExpressionWriteInput[] = [
      ...baseChallenges,
      {
        identifier,
        prompts: buildEnglishPrompt(newPrompt),
        glossIds: [],
      },
    ];

    const response = await fetch(`${API_BASE_URL}/situations/${props.situationId}?language=eng`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengesOfExpression: updatedChallenges,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Conflict: This situation was modified by another user. Refreshing...");
      }
      throw new Error(`Failed to add challenge: ${response.status}`);
    }

    return response.json();
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

watch(() => props.show, (newShow) => {
  if (!newShow) {
    prompt.value = "";
  }
});

function buildEnglishPrompt(content: string): LocalizedString[] {
  return [{ language: ENGLISH_LANGUAGE, content }];
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

function generateUniqueIdentifier(content: string, existing: ChallengeOfExpression[]): string {
  const base = slugify(content);
  const taken = new Set(existing.map((challenge) => challenge.identifier));
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}
</script>

<template>
  <teleport to="body">
    <dialog :open="show" class="modal">
      <div class="modal-box">
        <h2>Add Expression Challenge</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="challenge-prompt" class="label">English prompt</label>
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
