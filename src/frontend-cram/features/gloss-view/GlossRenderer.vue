<template>
  <div class="flex flex-col gap-2 w-full">
    <!-- Global notes (full width, above everything) -->
    <div v-if="globalNotes.length > 0" class="flex flex-row gap-1 flex-wrap w-full">
      <span v-for="note in globalNotes" :key="getNoteKey(note)" class="badge badge-sm">{{ note.content }}</span>
    </div>

    <div class="flex flex-row gap-1 w-full flex-wrap">
      <div class="card shadow flex-1">
        <div class="card-body">
          <div class="flex-1 flex flex-col gap-4">
            <!-- Main content (target language) -->
            <div v-if="gloss.content && !hideContent" class="font-bold text-center w-full text-3xl">
              <span v-if="gloss.isParaphrased">[</span>{{ gloss.content }}<span v-if="gloss.isParaphrased">]</span>
            </div>

            <!-- Question marks when content hidden -->
            <div v-else-if="hideContent && showQuestionMarks" class="font-bold text-center w-full text-3xl">
              ???
            </div>
          </div>

          <div class="flex flex-col gap-2 items-start">
            <div v-if="showLanguage" class="border rounded-md border-base-200 p-1">
              {{ gloss.language }}
            </div>

            <!-- Gloss-only notes (not global) -->
            <div v-if="glossOnlyNotes.length > 0" class="flex flex-row gap-1 flex-wrap">
              <span v-for="note in glossOnlyNotes" :key="getNoteKey(note)" class="badge badge-sm">{{ note.content }}</span>
            </div>

            <!-- Transcriptions (always shown) -->
            <div v-if="gloss.transcriptions.length > 0" class="flex flex-col gap-1">
              <div class="text-sm font-medium text-base-content/70">Transcription:</div>
              <div class="flex flex-row gap-1 flex-wrap">
                <span v-for="transcription in gloss.transcriptions" :key="transcription" class="badge badge-sm">{{ transcription }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Translations section (native language) -->
      <div class="flex flex-col gap-2 flex-1" v-if="!hideTranslations && resolvedTranslations.length > 0">
        <!-- Translation-shared notes (above all translation cards) -->
        <div v-if="translationSharedNotes.length > 0" class="flex flex-row gap-1 flex-wrap">
          <span v-for="note in translationSharedNotes" :key="getNoteKey(note)" class="badge badge-sm">{{ note.content }}</span>
        </div>

        <!-- Individual translation cards -->
        <div class="card shadow" v-for="translation in resolvedTranslations" :key="translation.id">
          <div class="card-body">
            <div class="flex flex-row gap-1">
              <div class="card-title text-xl flex-1">
                <span v-if="translation.isParaphrased">[</span>{{ translation.content }}<span v-if="translation.isParaphrased">]</span>
              </div>
              <!-- Translation-specific notes only -->
              <div class="flex flex-col gap-1 flex-1 items-end" v-if="getTranslationSpecificNotes(translation).length > 0">
                <span
                  v-for="note in getTranslationSpecificNotes(translation)"
                  :key="getNoteKey(note)"
                  class="badge badge-sm"
                >{{ note.content }}</span>
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
import type { GlossEntity } from '../../entities/gloss/types';
import { getGlossesByIds } from '../../entities/gloss';
import type { Note } from '@sbl/shared';

const props = defineProps<{
  gloss: GlossEntity;
  showLanguage?: boolean;
  showAllNotesImmediately?: boolean;
  hideTranslations?: boolean;
  hideContent?: boolean;
  showQuestionMarks?: boolean;
}>();

const resolvedTranslations = ref<GlossEntity[]>([]);

// Helper: Create unique key for note deduplication
const getNoteKey = (note: Note): string => {
  return `${note.content}|${note.noteType || ''}`;
};

// Helper: Filter notes by showBeforeSolution or showAllNotesImmediately
const shouldShowNote = (note: Note): boolean => {
  return props.showAllNotesImmediately || !!note.showBeforeSolution;
};

// Visible notes from the gloss
const visibleGlossNotes = computed(() => props.gloss.notes.filter(shouldShowNote));

// Compute note categories for deduplication
const globalNotes = computed(() => {
  // Notes that appear on gloss AND all translations
  if (visibleGlossNotes.value.length === 0 || resolvedTranslations.value.length === 0) return [];

  return visibleGlossNotes.value.filter(note => {
    const key = getNoteKey(note);
    // Check if this note appears in ALL translations
    return resolvedTranslations.value.every(translation => {
      const translationNotes = translation.notes.filter(shouldShowNote);
      return translationNotes.some(tn => getNoteKey(tn) === key);
    });
  });
});

const translationSharedNotes = computed(() => {
  // Notes that appear in ALL translations but NOT in gloss
  if (resolvedTranslations.value.length === 0) return [];

  const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));

  // Get notes from first translation
  const firstTranslationNotes = resolvedTranslations.value[0].notes.filter(shouldShowNote);

  return firstTranslationNotes.filter(note => {
    const key = getNoteKey(note);
    // Skip if it's a global note
    if (globalNoteKeys.has(key)) return false;

    // Check if this note appears in ALL translations
    return resolvedTranslations.value.every(translation => {
      const translationNotes = translation.notes.filter(shouldShowNote);
      return translationNotes.some(tn => getNoteKey(tn) === key);
    });
  });
});

const glossOnlyNotes = computed(() => {
  // Notes unique to gloss (excluding global notes)
  const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));
  return visibleGlossNotes.value.filter(note => {
    const key = getNoteKey(note);
    return !globalNoteKeys.has(key);
  });
});

const getTranslationSpecificNotes = (translation: GlossEntity): Note[] => {
  // Notes unique to this specific translation
  const globalNoteKeys = new Set(globalNotes.value.map(getNoteKey));
  const sharedNoteKeys = new Set(translationSharedNotes.value.map(getNoteKey));

  const notesForThisTranslation = translation.notes.filter(shouldShowNote);

  return notesForThisTranslation.filter(note => {
    const key = getNoteKey(note);
    return !globalNoteKeys.has(key) && !sharedNoteKeys.has(key);
  });
};

onMounted(async () => {
  console.log('[GlossRenderer] Mounting for gloss:', props.gloss.id, props.gloss.content);
  console.log('[GlossRenderer] translationIds:', props.gloss.translationIds);
  console.log('[GlossRenderer] hideTranslations:', props.hideTranslations);

  // Load translations
  if (props.gloss.translationIds && props.gloss.translationIds.length > 0) {
    resolvedTranslations.value = await getGlossesByIds(props.gloss.translationIds);
    console.log('[GlossRenderer] Resolved translations:', resolvedTranslations.value.length);
    resolvedTranslations.value.forEach(t => {
      console.log('[GlossRenderer]   Translation:', t.id, t.language, t.content);
    });
  } else {
    console.log('[GlossRenderer] No translation IDs to load');
  }
});
</script>
