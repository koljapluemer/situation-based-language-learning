<script setup lang="ts">
import type { SituationDTO, LanguageCode } from "@sbl/shared";
import ModalGenerateChallenges from "./ModalGenerateChallenges.vue";

interface Props {
  show: boolean;
  situation: SituationDTO;
  nativeLanguage: LanguageCode;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();
</script>

<template>
  <ModalGenerateChallenges
    :show="show"
    :situation="situation"
    :native-language="nativeLanguage"
    challenge-type="expression"
    @close="emit('close')"
    @saved="emit('saved')"
  />
</template>
