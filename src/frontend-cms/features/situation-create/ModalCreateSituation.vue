<script setup lang="ts">
import { ref } from "vue";
import { type LanguageCode } from "@sbl/shared";
import { useModalCreateSituation } from "./index";
import LanguageSelect from "../../dumb/LanguageSelect.vue";

const { isOpen, close } = useModalCreateSituation();

const emit = defineEmits<{
  create: [description: string, targetLanguage: LanguageCode, imageLink?: string];
}>();

const description = ref("");
const targetLanguage = ref<LanguageCode>("" as LanguageCode);
const imageLink = ref("");
const isSubmitting = ref(false);

function handleSubmit() {
  const trimmed = description.value.trim();
  if (!trimmed || !targetLanguage.value) return;

  isSubmitting.value = true;
  const imageLinkValue = imageLink.value.trim() || undefined;
  emit("create", trimmed, targetLanguage.value, imageLinkValue);
}

function handleClose() {
  if (isSubmitting.value) return;
  description.value = "";
  targetLanguage.value = "" as LanguageCode;
  imageLink.value = "";
  close();
}

// Reset form when modal closes
function handleModalClose() {
  if (!isOpen.value) {
    description.value = "";
    targetLanguage.value = "" as LanguageCode;
    imageLink.value = "";
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

          <fieldset class="fieldset">
            <label for="target-language" class="label">Target Language (language being learned)</label>
            <LanguageSelect
              id="target-language"
              v-model="targetLanguage"
              :disabled="isSubmitting"
              required
            />
          </fieldset>

          <fieldset class="fieldset">
            <label for="image-link" class="label">Image URL (optional)</label>
            <input
              id="image-link"
              v-model="imageLink"
              type="url"
              class="input"
              placeholder="https://example.com/images/greeting.jpg"
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
              :disabled="!description.trim() || !targetLanguage || isSubmitting"
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
