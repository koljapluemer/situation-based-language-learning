<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { LANGUAGES, type LanguageCode } from '@sbl/shared';
import { getKnownLanguages, setKnownLanguages } from '../../dumb/known-languages-storage';
import { useToast } from '../../dumb/toasts';

const router = useRouter();
const toast = useToast();

const selectedLanguages = ref<Set<LanguageCode>>(new Set());
const isSubmitting = ref(false);

// Load existing selection on mount
onMounted(() => {
  const existing = getKnownLanguages();
  selectedLanguages.value = new Set(existing);
});

function toggleLanguage(code: LanguageCode) {
  if (selectedLanguages.value.has(code)) {
    selectedLanguages.value.delete(code);
  } else {
    selectedLanguages.value.add(code);
  }
}

function handleSubmit() {
  if (selectedLanguages.value.size === 0) return;

  isSubmitting.value = true;

  try {
    const languagesArray = Array.from(selectedLanguages.value);
    setKnownLanguages(languagesArray);
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

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <fieldset class="fieldset">
        <div class="grid grid-cols-2 gap-4">
          <label
            v-for="[code, lang] in Object.entries(LANGUAGES)"
            :key="code"
            class="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              class="checkbox"
              :checked="selectedLanguages.has(code as LanguageCode)"
              @change="toggleLanguage(code as LanguageCode)"
              :disabled="isSubmitting"
            />
            <span><template v-if="lang.emoji">{{ lang.emoji }} </template>{{ lang.name }}</span>
          </label>
        </div>
      </fieldset>

      <div class="flex gap-2">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="selectedLanguages.size === 0 || isSubmitting"
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
