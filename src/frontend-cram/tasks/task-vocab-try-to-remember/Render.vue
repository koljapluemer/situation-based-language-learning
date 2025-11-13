<script setup lang="ts">
import { ref, onMounted, toRaw } from 'vue';
import { useRouter } from 'vue-router';
import { createEmptyCard } from 'ts-fsrs';
import type { Task } from '@frontend-shared/tasks/Task';
import type { TargetItem } from '@frontend-shared/entities/target-items/TargetItem';
import type { RepositoriesContextStrict } from '@frontend-shared/shared/types/RepositoriesContext';
import type { ActionControl } from '@frontend-shared/tasks/ui/ActionControl';
import { useToast } from '@frontend-shared/shared/toasts';
import { useI18n } from 'vue-i18n';
import VocabRenderer from '@frontend-shared/features/target-item-view/VocabRenderer.vue';
import ActionBar from '@frontend-shared/tasks/ui/ActionBar.vue';
import Instruction from '@frontend-shared/tasks/ui/Instruction.vue';

interface Props {
  task: Task;
  repositories: RepositoriesContextStrict;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  finished: [correctness?: 'correct' | 'incorrect' | 'neutral'];
}>();

const toast = useToast();
const { t } = useI18n();
const router = useRouter();
const vocabRepo = props.repositories.vocabRepo;
const vocab = ref<TargetItem | null>(null);
const actionControls = ref<ActionControl[]>([]);

const loadVocab = async () => {
  const vocabId = props.task.associatedVocab?.[0];
  if (!vocabId) return;
  const vocabData = await vocabRepo.getVocabByUID(vocabId);
  if (vocabData) {
    vocab.value = vocabData;
  }
};

const handleDone = async () => {
  if (!vocab.value) return;

  try {
    // Initialize learning card for unseen vocab
    const emptyCard = createEmptyCard();

    const updatedVocab = {
      ...toRaw(vocab.value),
      progress: {
        ...vocab.value.progress,
        level: 0,
        ...emptyCard
      }
    };

    await vocabRepo.updateVocab(updatedVocab);
    emit('finished', 'neutral');
  } catch {
    toast.error('Failed to initialize vocabulary');
    emit('finished', 'neutral');
  }
};

const handleSkip = async () => {
  emit('finished', 'neutral');
};

const handleDisable = async () => {
  if (!vocab.value) return;

  try {
    // Mark vocab as do not practice
    const updatedVocab = {
      ...toRaw(vocab.value),
      doNotPractice: true
    };
    await vocabRepo.updateVocab(updatedVocab);

    emit('finished', 'neutral');
  } catch {
    toast.error('Failed to update vocabulary');
    emit('finished', 'neutral');
  }
};

const handleJumpTo = () => {
  if (vocab.value) {
    router.push(`/vocab/${vocab.value.id}/edit`);
  }
};

function handleAction(controlId: string) {
  if (controlId === 'done') handleDone();
  else if (controlId === 'skip') handleSkip();
  else if (controlId === 'disable') handleDisable();
  else if (controlId === 'jump-to') handleJumpTo();
}

onMounted(() => {
  loadVocab();

  // Set up action controls
  actionControls.value = [
    {
      type: 'button',
      id: 'done',
      label: t('common.done'),
      position: 'central'
    }
  ];
});
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <Instruction :prompt="task.prompt" />

    <!-- Scrollable content area -->
    <div class="flex-1 overflow-auto min-h-0">
      <div class="container mx-auto p-4">
        <div v-if="vocab">
          <VocabRenderer :vocab="vocab" :repos="repositories" show-language />
        </div>

        <div v-else>
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- ActionBar always at bottom -->
    <ActionBar :controls="actionControls" @action="handleAction" />
  </div>
</template>