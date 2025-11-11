```vue
<template>
  <div class="border-l border-base-300">
    <!-- Goal Level -->
    <details class="group" :open="openStates.goal" @toggle="handleToggle('goal', $event)">
      <summary class="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-base-200 list-none">
        <ChevronRight :size="16" class="group-open:hidden" />
        <ChevronDown :size="16" class="hidden group-open:block" />
        <span class="font-medium">{{ goal.title }}</span>
        <span class="text-sm text-light">{{ getLanguageName(goal.language) }}</span>
        <button
          @click.stop="$emit('remove')"
          class="btn btn-sm btn-ghost ml-auto"
          aria-label="Remove goal"
        >
          <Trash2 :size="16" />
        </button>
      </summary>

      <div class="ml-4">
        <!-- Translations (no category wrapper) -->
        <div v-if="translationItems.length === 0" class="py-1 px-3 text-sm text-light italic flex items-center gap-2">
          <span>(empty)</span>
          <button @click.stop="showTranslationModalDialog = true" class="btn btn-xs btn-ghost ml-auto" aria-label="Add translation">
            <Plus :size="14" />
          </button>
        </div>
        <div v-else class="space-y-1">
          <div class="flex items-center gap-2 py-1 px-3">
            <button @click.stop="showTranslationModalDialog = true" class="btn btn-xs btn-ghost ml-auto" aria-label="Add translation">
              <Plus :size="14" />
            </button>
          </div>
          <div
            v-for="translation in translationItems"
            :key="translation.id"
            class="flex items-center gap-2 py-1 px-3 text-sm hover:bg-base-200"
          >
            <span class="flex-1">{{ translation.content }}</span>
            <button @click="openTranslationModal(translation)" class="btn btn-xs btn-ghost" aria-label="View translation">
              <Eye :size="12" />
            </button>
            <button @click="disconnectTranslation(translation.id)" class="btn btn-xs btn-ghost" aria-label="Remove translation">
              <X :size="12" />
            </button>
          </div>
        </div>
      </div>
    </details>
  </div>

  <TranslationModal
    :show="showTranslationModalDialog"
    :exclude-translation-ids="goal.translations"
    @close="showTranslationModalDialog = false"
    @translation-added="handleTranslationAdded"
  />

  <!-- Translation Viewer Modal -->
  <dialog :class="['modal', { 'modal-open': showTranslationModal }]">
    <div class="modal-box">
      <form method="dialog">
        <button @click="closeTranslationModal" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <TranslationRenderer
        v-if="selectedTranslation"
        :translation="selectedTranslation"
        :repos="{ languageRepo, translationRepo, noteRepo, vocabRepo }"
        showDeepData
      />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="closeTranslationModal">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, watch } from 'vue';
import type { GoalData } from '@frontend-shared/entities/goals/Goal';
import type { TranslationRepoContract } from '@frontend-shared/entities/glosses/TranslationRepoContract';
import type { LanguageRepoContract } from '@frontend-shared/entities/languages/LanguageRepoContract';
import type { VocabRepoContract } from '@frontend-shared/entities/target-items/VocabRepoContract';
import type { Gloss } from '@frontend-shared/entities/glosses/Gloss';
import type { Language } from '@frontend-shared/entities/languages/Language';
import { ChevronRight, ChevronDown, Trash2, X, Plus, Eye } from 'lucide-vue-next';
import TranslationModal from '@frontend-shared/features/gloss-modal/TranslationModal.vue';
import TranslationRenderer from '@frontend-shared/features/gloss-view/TranslationRenderer.vue';
import { setTreeState, getDefaultTreeState } from './treeState';
import type { NoteRepoContract } from '@frontend-shared/entities/notes/NoteRepoContract';

const props = defineProps<{
  goal: GoalData;
  situationId: string;
  initialOpenStates?: {
    goal: boolean;
  };
}>();

const emit = defineEmits<{
  remove: [];
  'translation-selected': [string, string];
  'translation-added': [string, string];
  'translation-disconnected': [string, string];
}>();

const translationRepo = inject<TranslationRepoContract>('translationRepo')!;
const languageRepo = inject<LanguageRepoContract>('languageRepo')!;
const vocabRepo = inject<VocabRepoContract>('vocabRepo')!;
const noteRepo = inject<NoteRepoContract>('noteRepo')!;

const translationItems = ref<Gloss[]>([]);
const allLanguages = ref<Language[]>([]);

const showTranslationModalDialog = ref(false);

// Translation viewer modal state
const showTranslationModal = ref(false);
const selectedTranslation = ref<Gloss | null>(null);

// Open/closed states with initial values from props or defaults
const openStates = ref(props.initialOpenStates || getDefaultTreeState());

async function loadData() {
  allLanguages.value = await languageRepo.getAll();

  // Load translations
  if (props.goal.translations.length > 0) {
    translationItems.value = await translationRepo.getTranslationsByIds(props.goal.translations);
  }
}

function getLanguageName(code: string): string {
  const lang = allLanguages.value.find(l => l.code === code);
  return lang ? `${lang.emoji} ${lang.name}` : code;
}

// Event handlers
function handleTranslationAdded(translationId: string) {
  emit('translation-added', props.goal.id, translationId);
}

function disconnectTranslation(translationId: string) {
  emit('translation-disconnected', props.goal.id, translationId);
}

// Handle toggle events to persist state
function handleToggle(path: 'goal', event: Event) {
  const target = event.target as HTMLDetailsElement;
  openStates.value[path] = target.open;
  setTreeState(props.situationId, props.goal.id, path, target.open);
}

// Translation viewer modal functions
function openTranslationModal(translation: Gloss) {
  selectedTranslation.value = translation;
  showTranslationModal.value = true;
}

function closeTranslationModal() {
  showTranslationModal.value = false;
  selectedTranslation.value = null;
}

onMounted(async () => {
  await loadData();
});

// Watch for goal changes and reload data
watch(() => props.goal, async () => {
  await loadData();
}, { deep: true });
</script>

```