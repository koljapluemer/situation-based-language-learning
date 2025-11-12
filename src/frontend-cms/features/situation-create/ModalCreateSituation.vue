<script setup lang="ts">
import { ref } from "vue";
import { useModalCreateSituation } from "./index";

const { isOpen, close } = useModalCreateSituation();

const emit = defineEmits<{
  create: [description: string];
}>();

const description = ref("");
const isSubmitting = ref(false);

function handleSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed) return;

  isSubmitting.value = true;
  emit("create", trimmed);
}

function handleClose() {
  if (isSubmitting.value) return;
  description.value = "";
  close();
}

// Reset form when modal closes
function handleModalClose() {
  if (!isOpen.value) {
    description.value = "";
    isSubmitting.value = false;
  }
}
</script>

<template>
  <teleport to="body">
    <dialog :open="isOpen" class="modal" @close="handleModalClose">
      <div class="modal-box">
        <h2>Create Situation</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="description-eng" class="label">English description</label>
            <input
              id="description-eng"
              v-model="description"
              type="text"
              class="input"
              placeholder="Greeting someone at a café"
              required
              :disabled="isSubmitting"
            />
          </fieldset>

          <div class="modal-action">
            <button
              type="button"
              class="btn btn-outline"
              @click="handleClose"
              :disabled="isSubmitting"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!description.trim() || isSubmitting"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              {{ isSubmitting ? "Creating..." : "Create" }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="handleClose" :disabled="isSubmitting">close</button>
      </form>
    </dialog>
  </teleport>
</template>
