<script setup lang="ts">
import { LANGUAGES, type LanguageCode } from "@sbl/shared";

const model = defineModel<LanguageCode>({ required: true });

const languageOptions = Object.entries(LANGUAGES).map(([code, lang]) => ({
  code: code as LanguageCode,
  label: 'emoji' in lang ? `${lang.emoji} ${lang.name}` : lang.name,
}));
</script>

<template>
  <select v-model="model" class="select">
    <option value="" disabled>Select a language</option>
    <option v-for="lang in languageOptions" :key="lang.code" :value="lang.code">
      {{ lang.label }}
    </option>
  </select>
</template>
