<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { LANGUAGES, type LanguageCode } from '@sbl/shared';
import { getKnownLanguages, setKnownLanguages } from '../../dumb/known-languages-storage';
import { useToast } from '../../dumb/toasts';
import { ChevronUp, ChevronDown, X } from 'lucide-vue-next';

const router = useRouter();
const toast = useToast();

const orderedLanguages = ref<LanguageCode[]>([]);
const isSubmitting = ref(false);

// Load existing selection on mount
onMounted(() => {
  orderedLanguages.value = getKnownLanguages();
});

// Available languages that haven't been selected yet
const availableLanguages = computed(() => {
  const selected = new Set(orderedLanguages.value);
  return Object.entries(LANGUAGES)
    .filter(([code]) => !selected.has(code as LanguageCode))
    .map(([code, lang]) => ({ code: code as LanguageCode, ...lang }));
});

function addLanguage(code: LanguageCode) {
  orderedLanguages.value.push(code);
}

function removeLanguage(index: number) {
  orderedLanguages.value.splice(index, 1);
}

function moveUp(index: number) {
  if (index === 0) return;
  const temp = orderedLanguages.value[index];
  orderedLanguages.value[index] = orderedLanguages.value[index - 1];
  orderedLanguages.value[index - 1] = temp;
}

function moveDown(index: number) {
  if (index === orderedLanguages.value.length - 1) return;
  const temp = orderedLanguages.value[index];
  orderedLanguages.value[index] = orderedLanguages.value[index + 1];
  orderedLanguages.value[index + 1] = temp;
}

function handleSubmit() {
  if (orderedLanguages.value.length === 0) return;

  isSubmitting.value = true;

  try {
    setKnownLanguages(orderedLanguages.value);
    toast.success('Languages saved successfully');
    router.push({ name: 'landing' });
  } catch (error) {
    toast.error('Failed to save languages');
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <h1>What languages do you already speak?</h1>
    <p class="text-sm text-base-content/70">
      Order matters! Your first language will be preferred for situation descriptions.
    </p>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Selected Languages (Ordered) -->
      <div v-if="orderedLanguages.length > 0" class="space-y-2">
        <h2 class="text-lg font-bold">Your Languages</h2>
        <div class="space-y-2">
          <div
            v-for="(code, index) in orderedLanguages"
            :key="code"
            class="flex items-center gap-2 p-3 bg-base-200 rounded-lg"
          >
            <span class="badge badge-sm">{{ index + 1 }}</span>
            <span class="flex-1">
              <template v-if="LANGUAGES[code]?.emoji">{{ LANGUAGES[code].emoji }} </template>{{ LANGUAGES[code]?.name }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="index === 0 || isSubmitting"
                @click="moveUp(index)"
                title="Move up"
              >
                <ChevronUp :size="16" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                :disabled="index === orderedLanguages.length - 1 || isSubmitting"
                @click="moveDown(index)"
                title="Move down"
              >
                <ChevronDown :size="16" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-error"
                :disabled="isSubmitting"
                @click="removeLanguage(index)"
                title="Remove"
              >
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Available Languages -->
      <div v-if="availableLanguages.length > 0" class="space-y-2">
        <h2 class="text-lg font-bold">Add Languages</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="lang in availableLanguages"
            :key="lang.code"
            type="button"
            class="btn btn-outline btn-sm justify-start"
            :disabled="isSubmitting"
            @click="addLanguage(lang.code)"
          >
            <template v-if="lang.emoji">{{ lang.emoji }} </template>{{ lang.name }}
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="orderedLanguages.length === 0 || isSubmitting"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
          {{ isSubmitting ? 'Saving...' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn btn-outline"
          @click="router.push({ name: 'landing' })"
          :disabled="isSubmitting"
        >
          Cancel
        </button>
      </div>
    </form>
  </section>
</template>
