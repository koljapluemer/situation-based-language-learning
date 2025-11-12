<script setup lang="ts">
import { ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Pencil, Trash2, X, Check } from "lucide-vue-next";
import type { ChallengeOfExpression, SituationDTO } from "@sbl/shared";
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

const isEditing = ref(false);
const editedPrompt = ref(props.challenge.prompt);

// Delete mutation
const deleteMutation = useMutation({
  mutationFn: async () => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfExpression
      .filter((_, i) => i !== props.index)
      .map(c => ({ prompt: c.prompt, glossIds: [] }));

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
  },
});

// Update mutation
const updateMutation = useMutation({
  mutationFn: async (newPrompt: string) => {
    const situation = queryClient.getQueryData<SituationDTO>(["situation", props.situationId]);
    if (!situation) throw new Error("Situation not found in cache");

    const updatedChallenges = situation.challengesOfExpression.map((c, i) =>
      i === props.index ? { prompt: newPrompt, glossIds: [] } : { prompt: c.prompt, glossIds: [] }
    );

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
    // Refresh data on conflict
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
  editedPrompt.value = props.challenge.prompt;
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editedPrompt.value = props.challenge.prompt;
}

function saveEdit() {
  if (editedPrompt.value.trim()) {
    updateMutation.mutate(editedPrompt.value.trim());
  }
}
</script>

<template>
  <div class="flex items-center gap-2 py-2 px-3 hover:bg-base-200 border-l border-base-300">
    <div v-if="!isEditing" class="flex-1">
      <span class="text-sm">{{ challenge.prompt }}</span>
    </div>
    <div v-else class="flex-1 flex items-center gap-2">
      <input
        v-model="editedPrompt"
        type="text"
        class="input input-sm flex-1"
        @keyup.enter="saveEdit"
        @keyup.escape="cancelEdit"
      />
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
