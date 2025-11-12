<script setup lang="ts">
import { ref, watch } from "vue";
import type { LocalizedString } from "@sbl/shared";
import { useModalEditSituation } from "./index";

const { isOpen, currentSituation, close } = useModalEditSituation();

const emit = defineEmits<{
  update: [identifier: string, descriptions: LocalizedString[], imageLink?: string];
}>();

const identifier = ref("");
const descriptions = ref<LocalizedString[]>([]);
const imageLink = ref("");
const isSubmitting = ref(false);

// Watch for situation changes and populate form
watch(currentSituation, (situation) => {
  if (situation) {
    identifier.value = situation.identifier;
    descriptions.value = [...situation.descriptions];
    imageLink.value = situation.imageLink ?? "";
  }
});

function handleSubmit() {
  if (!identifier.value.trim() || descriptions.value.length === 0) return;

  isSubmitting.value = true;
  const imageLinkValue = imageLink.value.trim() || undefined;
  emit("update", identifier.value, descriptions.value, imageLinkValue);
}

function handleClose() {
  if (isSubmitting.value) return;
  resetForm();
  close();
}

function resetForm() {
  identifier.value = "";
  descriptions.value = [];
  imageLink.value = "";
  isSubmitting.value = false;
}

function updateDescription(index: number, content: string) {
  descriptions.value[index].content = content;
}

function addDescription() {
  descriptions.value.push({ language: "eng", content: "" });
}

function removeDescription(index: number) {
  descriptions.value.splice(index, 1);
}

// Reset form when modal closes
function handleModalClose() {
  if (!isOpen.value) {
    resetForm();
  }
}
</script>

<template>
  <teleport to="body">
    <dialog :open="isOpen" class="modal" @close="handleModalClose">
      <div class="modal-box max-w-2xl">
        <h2>Edit Situation</h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="identifier" class="label">Identifier</label>
            <input
              id="identifier"
              v-model="identifier"
              type="text"
              class="input"
              placeholder="greeting-basic"
              required
              :disabled="isSubmitting"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label class="label">Descriptions</label>
            <div class="space-y-2">
              <div
                v-for="(desc, index) in descriptions"
                :key="index"
                class="flex gap-2 items-start"
              >
                <select
                  v-model="desc.language"
                  class="select select-bordered w-24"
                  :disabled="isSubmitting"
                >
                  <option value="eng">eng</option>
                  <option value="spa">spa</option>
                  <option value="deu">deu</option>
                  <option value="fra">fra</option>
                </select>
                <input
                  :value="desc.content"
                  @input="updateDescription(index, ($event.target as HTMLInputElement).value)"
                  type="text"
                  class="input flex-1"
                  placeholder="Description"
                  required
                  :disabled="isSubmitting"
                />
                <button
                  v-if="descriptions.length > 1"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="removeDescription(index)"
                  :disabled="isSubmitting"
                >
                  Remove
                </button>
              </div>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                @click="addDescription"
                :disabled="isSubmitting"
              >
                Add Description
              </button>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <label for="image-link-edit" class="label">Image URL (optional)</label>
            <input
              id="image-link-edit"
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
              :disabled="!identifier.trim() || descriptions.length === 0 || isSubmitting"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              {{ isSubmitting ? "Saving..." : "Save Changes" }}
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
