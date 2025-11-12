import { ref } from 'vue';
import type { SituationDTO } from '@sbl/shared';

const isOpen = ref(false);
const currentSituation = ref<SituationDTO | null>(null);

export const useModalEditSituation = () => {
  const open = (situation: SituationDTO) => {
    currentSituation.value = situation;
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
    currentSituation.value = null;
  };

  return {
    isOpen,
    currentSituation,
    open,
    close
  };
};
