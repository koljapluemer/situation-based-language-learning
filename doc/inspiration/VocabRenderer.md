```vue
<template>
    <div class="flex flex-col gap-2 w-full">
        <!-- Global notes (full width, above everything) -->
        <div v-if="globalNotes.length > 0" class="flex flex-row gap-1 flex-wrap w-full">
            <NoteDisplayMini v-for="note in globalNotes" :key="note.id" :note="note" />
        </div>

        <div class="flex flex-row gap-1 w-full flex-wrap">
            <div class="card card-sm shadow-sm flex-1">
                <div class="card-body">
                    <div class="flex-1 flex flex-col gap-4">
                    <!-- Cloze rendering -->
                    <div v-if="clozeData" class="text-3xl text-center w-full" :dir="isRTL ? 'rtl' : 'ltr'">
                        <span v-if="clozeData.beforeWord">{{ clozeData.beforeWord }} </span>

                        <!-- Hidden word as blank or revealed -->
                        <span v-if="!showClozeAnswer"
                              class="inline-block bg-gray-300 dark:bg-gray-600 text-transparent rounded px-2 py-1 mx-1 select-none"
                              :style="{ width: Math.max(clozeData.hiddenWord.length * 0.6, 3) + 'em' }">
                            {{ clozeData.hiddenWord }}
                        </span>
                        <span v-else class="text-green-600 dark:text-green-400 font-bold mx-1">
                            {{ clozeData.hiddenWord }}
                        </span>

                        <span v-if="clozeData.afterWord"> {{ clozeData.afterWord }}</span>
                    </div>

                    <!-- Regular content rendering -->
                    <div v-else-if="vocab.content && !hideContent" class="font-bold text-center w-full" :class="{
                        'text-8xl': vocab.consideredCharacter,
                        'text-5xl': !vocab.consideredCharacter && !vocab.consideredSentence,
                        'text-3xl': vocab.consideredSentence
                    }">
                        {{ vocab.content }}
                    </div>

                    <!-- Question marks when content hidden -->
                    <div v-else-if="hideContent && showQuestionMarks" class="font-bold text-center w-full" :class="{
                        'text-8xl': vocab.consideredCharacter,
                        'text-5xl': !vocab.consideredCharacter && !vocab.consideredSentence,
                        'text-3xl': vocab.consideredSentence
                    }">
                        ???
                    </div>
                    <!-- Images -->
                    <div v-if="vocab.images && vocab.images.length > 0" class="">
                        <div class="grid gap-2"
                            :class="vocab.images.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : vocab.images.length === 2 ? 'grid-cols-2 max-w-md mx-auto' : 'grid-cols-2 md:grid-cols-3 max-w-lg mx-auto'">
                            <VocabImage v-for="image in vocab.images.slice(0, 6)" :key="image.id" :image="image"
                                class="rounded-lg" />
                        </div>
                        <div v-if="vocab.images.length > 6" class=" text-base-content/50 mt-2">
                            {{ $t('common.add') }}{{ vocab.images.length - 6 }} {{ $t('practice.tasks.moreImages') }}
                        </div>
                    </div>
                    <!-- Sound -->
                    <div v-if="vocab.sounds && vocab.sounds.length > 0" class="flex flex-wrap gap-2 justify-center">
                        <SoundPlayer
                            v-for="sound in vocab.sounds.filter(s => !s.disableForPractice)"
                            :key="sound.id"
                            :sound="sound"
                        />
                    </div>
                </div>
                <div class="flex flex-col gap-2 items-start">
                    <div v-if="languageData && showLanguage" class="border rounded-md border-base-200 p-1">{{
                        renderLanguage(languageData) }}
                    </div>
                    <!-- Vocab-only notes (not global) -->
                    <div v-if="vocabOnlyNotes.length > 0" class="flex flex-row gap-1 flex-wrap">
                        <NoteDisplayMini v-for="note in vocabOnlyNotes" :key="note.id" :note="note" />
                    </div>
                    <!-- Transcriptions (always shown) -->
                    <div v-if="transcriptionNotes.length > 0" class="flex flex-col gap-1">
                        <div class="text-sm font-medium text-base-content/70">Transcription:</div>
                        <div class="flex flex-row gap-1 flex-wrap">
                            <NoteDisplayMini v-for="note in transcriptionNotes" :key="note.id" :note="note" />
                        </div>
                    </div>
                    <!-- Deep data metadata badges -->
                    <div v-if="showDeepData" class="flex flex-row gap-1 flex-wrap">
                        <span v-if="vocab.priority" class="badge badge-sm" :class="{
                            'badge-error': vocab.priority >= 4,
                            'badge-warning': vocab.priority === 3,
                            'badge-info': vocab.priority <= 2
                        }">Priority {{ vocab.priority }}</span>
                        <span v-for="type in vocabTypeBadges" :key="type" class="badge badge-sm badge-outline">{{ type }}</span>
                        <span v-if="vocab.doNotPractice" class="badge badge-sm badge-warning">Do Not Practice</span>
                        <span v-if="vocab.isPicturable" class="badge badge-sm badge-ghost">Picturable</span>
                    </div>
                </div>
                <div v-if="vocab.links && vocab.links.length > 0" class="flex flex-wrap gap-2 w-full">
                    <LinkDisplayCompact v-for="(link, index) in vocab.links" :key="index" :link="link" class="w-full" />
                </div>
                <!-- Origins (showDeepData) -->
                <div v-if="showDeepData && vocab.origins && vocab.origins.length > 0" class="flex flex-col gap-1 w-full">
                    <div class="text-sm font-medium text-base-content/70">Origins:</div>
                    <div class="flex flex-row gap-1 flex-wrap">
                        <span v-for="origin in vocab.origins" :key="origin" class="badge badge-sm badge-ghost">{{ origin }}</span>
                    </div>
                </div>
                <!-- Similar Sounding (showDeepData) -->
                <div v-if="showDeepData && similarSoundingVocabItems.length > 0" class="flex flex-col gap-1 w-full">
                    <div class="text-sm font-medium text-base-content/70">Similar Sounding:</div>
                    <div class="flex flex-row gap-1 flex-wrap">
                        <span v-for="item in similarSoundingVocabItems" :key="item.id" class="badge badge-sm badge-outline">{{ item.content }}</span>
                    </div>
                </div>
            </div>

            </div>

            <!-- Relations sections (showRelations) -->
            <div v-if="showRelations" class="flex flex-col gap-2 w-full">
                <!-- Related Vocab -->
                <div v-if="relatedVocabItems.length > 0" class="flex flex-col gap-1">
                    <div class="text-sm font-medium text-base-content/70">Related:</div>
                    <div class="flex flex-row gap-1 flex-wrap">
                        <span v-for="item in relatedVocabItems" :key="item.id" class="badge badge-sm badge-outline">{{ item.content }}</span>
                    </div>
                </div>
                <!-- Contains -->
                <div v-if="containsVocabItems.length > 0" class="flex flex-col gap-1">
                    <div class="text-sm font-medium text-base-content/70">Contains:</div>
                    <div class="flex flex-row gap-1 flex-wrap">
                        <span v-for="item in containsVocabItems" :key="item.id" class="badge badge-sm badge-outline">{{ item.content }}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col gap-2 flex-1" v-if="!hideTranslations">
                <!-- Translation-shared notes (above all translation cards) -->
                <div v-if="translationSharedNotes.length > 0" class="flex flex-row gap-1 flex-wrap">
                    <NoteDisplayMini v-for="note in translationSharedNotes" :key="note.id" :note="note" />
                </div>

                <!-- Individual translation cards -->
                <div class="card card-sm shadow-sm" v-for="translation in displayedTranslations" :key="translation.id">
                    <div class="card-body">
                        <div class="flex flex-row gap-1">
                            <div class="card-title text-xl flex-1 ">{{ translation.content }}</div>
                            <!-- Translation-specific notes only -->
                            <div class="flex flex-col gap-1 flex-1 items-end" v-if="getTranslationSpecificNotes(translation).length > 0">
                                <NoteDisplayMini
                                    v-for="note in getTranslationSpecificNotes(translation)"
                                    :key="note.id" :note="note" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { TargetItem } from '../../entities/target-items/TargetItem';
import type { Language } from '@frontend-shared/entities/languages/Language';
import type { Gloss } from '@frontend-shared/entities/glosses/Gloss';
import { renderLanguage } from '@frontend-shared/entities/languages/renderLanguage';
import type { RepositoriesContext } from '@frontend-shared/shared/types/RepositoriesContext';
import LinkDisplayCompact from '@frontend-shared/entities/links/LinkDisplayCompact.vue';
import type { Note } from '@frontend-shared/entities/notes/Note';
import NoteDisplayMini from '@frontend-shared/entities/notes/NoteDisplayMini.vue';
import VocabImage from '@frontend-shared/shared/ui/VocabImage.vue';
import SoundPlayer from '@frontend-shared/shared/ui/SoundPlayer.vue';

export interface ClozeData {
  beforeWord: string;
  hiddenWord: string;
  afterWord: string;
  hiddenWordIndex: number;
  hiddenWords?: string[];
}

const props = defineProps<{
    vocab: TargetItem
    repos: RepositoriesContext
    showLanguage?: boolean
    showAllNotesImmediately?: boolean
    hideTranslations?: boolean
    onlyShowSingleRandomTranslation?: boolean
    hideContent?: boolean
    showQuestionMarks?: boolean
    clozeData?: ClozeData
    showClozeAnswer?: boolean
    isRTL?: boolean
    showDeepData?: boolean
    showRelations?: boolean
}>();

const languageRepo = props.repos.languageRepo || undefined
const translationRepo = props.repos.translationRepo || undefined
const noteRepo = props.repos.noteRepo || undefined
const vocabRepo = props.repos.vocabRepo || undefined

const languageData = ref<Language | null>(null);
const translations = ref<Gloss[]>([]);
const vocabNotes = ref<Note[]>([]);
const translationNotes = ref<Note[]>([]);
const transcriptionNotes = ref<Note[]>([]);
const relatedVocabItems = ref<TargetItem[]>([]);
const containsVocabItems = ref<TargetItem[]>([]);
const similarSoundingVocabItems = ref<TargetItem[]>([]);

// Compute displayed translations based on onlyShowSingleRandomTranslation prop
const displayedTranslations = computed(() => {
    if (props.onlyShowSingleRandomTranslation && translations.value.length > 0) {
        const randomIndex = Math.floor(Math.random() * translations.value.length);
        return [translations.value[randomIndex]];
    }
    return translations.value;
});

// Compute vocab type badges (can have multiple)
const vocabTypeBadges = computed(() => {
    const badges: string[] = [];
    if (props.vocab.consideredCharacter) badges.push('Character');
    if (props.vocab.consideredWord !== false) badges.push('Word'); // default to Word if undefined
    if (props.vocab.consideredSentence) badges.push('Sentence');
    return badges;
});

// Helper: Create unique key for note deduplication
const getNoteKey = (note: Note): string => {
    return `${note.content}|${note.noteType || ''}`;
};

// Helper: Filter notes by showBeforeExercise or showAllNotesImmediately
const shouldShowNote = (note: Note): boolean => {
    return props.showAllNotesImmediately || !!note.showBeforeExercise;
};

// Compute note categories for deduplication
const globalNotes = computed(() => {
    // Notes that appear on vocab AND all translations
    const visibleVocabNotes = vocabNotes.value.filter(shouldShowNote);
    if (visibleVocabNotes.length === 0 || displayedTranslations.value.length === 0) return [];

    return visibleVocabNotes.filter(note => {
        const key = getNoteKey(note);
        // Check if this note appears in ALL translations
        return displayedTranslations.value.every(translation => {
            const translationNoteIds = translation.notes || [];
            const translationNotesForThis = translationNotes.value.filter(n =>
                translationNoteIds.includes(n.id) && shouldShowNote(n)
            );
            return translationNotesForThis.some(tn => getNoteKey(tn) === key);
        });
    });
});

const translationSharedNotes = computed(() => {
    // Notes that appear in ALL translations but NOT in vocab
    if (displayedTranslations.value.length === 0) return [];

    const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));

    // Get notes from first translation
    const firstTranslation = displayedTranslations.value[0];
    const firstTranslationNoteIds = firstTranslation.notes || [];
    const firstTranslationNotes = translationNotes.value.filter(n =>
        firstTranslationNoteIds.includes(n.id) && shouldShowNote(n)
    );

    return firstTranslationNotes.filter(note => {
        const key = getNoteKey(note);
        // Skip if it's a global note
        if (globalNoteKeys.has(key)) return false;

        // Check if this note appears in ALL translations
        return displayedTranslations.value.every(translation => {
            const translationNoteIds = translation.notes || [];
            const translationNotesForThis = translationNotes.value.filter(n =>
                translationNoteIds.includes(n.id) && shouldShowNote(n)
            );
            return translationNotesForThis.some(tn => getNoteKey(tn) === key);
        });
    });
});

const vocabOnlyNotes = computed(() => {
    // Notes unique to vocab (excluding global notes)
    const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));
    return vocabNotes.value.filter(note => {
        if (!shouldShowNote(note)) return false;
        const key = getNoteKey(note);
        return !globalNoteKeys.has(key);
    });
});

const getTranslationSpecificNotes = (translation: Gloss): Note[] => {
    // Notes unique to this specific translation
    const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));
    const sharedNoteKeys = new Set(translationSharedNotes.value.map(getNoteKey));

    const translationNoteIds = translation.notes || [];
    const notesForThisTranslation = translationNotes.value.filter(n =>
        translationNoteIds.includes(n.id) && shouldShowNote(n)
    );

    return notesForThisTranslation.filter(note => {
        const key = getNoteKey(note);
        return !globalNoteKeys.has(key) && !sharedNoteKeys.has(key);
    });
};



onMounted(async () => {
    const lang = await languageRepo?.getByCode(props.vocab.language);
    languageData.value = lang ?? null;

    // Load translations
    if (props.vocab.translations && props.vocab.translations.length > 0) {
        translations.value = await translationRepo?.getTranslationsByIds(props.vocab.translations) || [];
    }

    // Load vocab notes
    if (props.vocab.notes && props.vocab.notes.length > 0) {
        vocabNotes.value = await noteRepo?.getNotesByUIDs(props.vocab.notes) || [];
    }

    // Load transcriptions (always load)
    if (props.vocab.transcriptions && props.vocab.transcriptions.length > 0) {
        transcriptionNotes.value = await noteRepo?.getNotesByUIDs(props.vocab.transcriptions) || [];
    }

    // Load translation notes
    const allTranslationNoteIds: string[] = [];
    translations.value.forEach(translation => {
        if (translation.notes && translation.notes.length > 0) {
            allTranslationNoteIds.push(...translation.notes);
        }
    });
    if (allTranslationNoteIds.length > 0) {
        translationNotes.value = await noteRepo?.getNotesByUIDs(allTranslationNoteIds) || [];
    }

    // Load related vocab data if showRelations is true
    if (props.showRelations && vocabRepo) {
        if (props.vocab.relatedVocab && props.vocab.relatedVocab.length > 0) {
            relatedVocabItems.value = await vocabRepo.getVocabByUIDs(props.vocab.relatedVocab) || [];
        }
        if (props.vocab.contains && props.vocab.contains.length > 0) {
            containsVocabItems.value = await vocabRepo.getVocabByUIDs(props.vocab.contains) || [];
        }
    }

    // Load similar sounding vocab if showDeepData is true
    if (props.showDeepData && vocabRepo && props.vocab.similarSoundingButNotTheSame && props.vocab.similarSoundingButNotTheSame.length > 0) {
        similarSoundingVocabItems.value = await vocabRepo.getVocabByUIDs(props.vocab.similarSoundingButNotTheSame) || [];
    }
});
</script>
```