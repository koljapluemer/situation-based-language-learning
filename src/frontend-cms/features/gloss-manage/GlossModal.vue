<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { GlossDTO, LanguageCode, Note } from "@sbl/shared";
import { LANGUAGES } from "@sbl/shared";
import LanguageSelect from "../../dumb/LanguageSelect.vue";
import { useToast } from "../../dumb/toasts";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const props = defineProps<{
  show: boolean;
  mode: "create" | "edit";
  initialGloss?: GlossDTO | null;
  defaults?: {
    language?: LanguageCode;
    content?: string;
  };
  lockedLanguage?: LanguageCode;
}>();

const emit = defineEmits<{
  close: [];
  saved: [GlossDTO, { existed: boolean }?];
}>();

const toast = useToast();

type NoteForm = Note;

interface FormState {
  language: LanguageCode;
  content: string;
  isParaphrased: boolean;
  transcriptions: string[];
  notes: NoteForm[];
}

const form = reactive<FormState>({
  language: resolveLanguage(),
  content: props.initialGloss?.content ?? props.defaults?.content ?? "",
  isParaphrased: props.initialGloss?.isParaphrased ?? false,
  transcriptions: props.initialGloss?.transcriptions ? [...props.initialGloss.transcriptions] : [],
  notes: props.initialGloss?.notes ? cloneNotes(props.initialGloss.notes) : [],
});

const isSubmitting = ref(false);
const existingGloss = ref<GlossDTO | null>(null);
const suggestions = ref<GlossDTO[]>([]);
const isCheckingMatches = ref(false);
let matchTimer: ReturnType<typeof setTimeout> | undefined;
let matchToken = 0;

const attachingExisting = computed(
  () => props.mode === "create" && Boolean(existingGloss.value)
);

const primaryLabel = computed(() => {
  if (attachingExisting.value) return "Attach existing gloss";
  return props.mode === "create" ? "Create" : "Save";
});

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetForm();
    } else {
      clearMatches();
    }
  }
);

watch(
  () => props.initialGloss,
  () => {
    if (props.show) {
      resetForm();
    }
  },
  { deep: true }
);

watch(
  () => [form.language, form.content],
  () => {
    if (!props.show || props.mode !== "create") return;
    clearMatches();
    if (matchTimer) clearTimeout(matchTimer);
    const trimmed = form.content.trim();
    if (!trimmed) return;
    matchTimer = setTimeout(() => fetchMatches(trimmed), 300);
  },
  { deep: true }
);

watch(
  () => props.lockedLanguage,
  (next) => {
    if (next) {
      form.language = next;
    }
  }
);

function resetForm() {
  form.language = resolveLanguage();
  form.content = props.initialGloss?.content ?? props.defaults?.content ?? "";
  form.isParaphrased = props.initialGloss?.isParaphrased ?? false;
  form.transcriptions = props.initialGloss?.transcriptions ? [...props.initialGloss.transcriptions] : [];
  form.notes = props.initialGloss?.notes ? cloneNotes(props.initialGloss.notes) : [];
  clearMatches();
}

function resolveLanguage(): LanguageCode {
  return (props.lockedLanguage ?? props.initialGloss?.language ?? props.defaults?.language ?? "eng") as LanguageCode;
}

function clearMatches() {
  existingGloss.value = null;
  suggestions.value = [];
  isCheckingMatches.value = false;
  if (matchTimer) {
    clearTimeout(matchTimer);
    matchTimer = undefined;
  }
}

function addTranscription() {
  form.transcriptions.push("");
}

function removeTranscription(index: number) {
  form.transcriptions.splice(index, 1);
}

function addNote() {
  form.notes.push({
    noteType: "",
    content: "",
    showBeforeSolution: false,
  });
}

function removeNote(index: number) {
  form.notes.splice(index, 1);
}

function serializeNotes(notes: FormState["notes"]): Note[] {
  return notes
    .filter((note) => note.noteType.trim() && note.content.trim())
    .map((note) => ({
      noteType: note.noteType.trim(),
      content: note.content.trim(),
      showBeforeSolution: Boolean(note.showBeforeSolution),
    }));
}

function cloneNotes(notes: Note[]): NoteForm[] {
  return notes.map((note) => ({
    noteType: note.noteType,
    content: note.content,
    showBeforeSolution: note.showBeforeSolution,
  }));
}

async function fetchMatches(query: string) {
  matchToken += 1;
  const token = matchToken;
  isCheckingMatches.value = true;
  try {
    const exactRes = await fetch(
      `${API_BASE_URL}/glosses?language=${encodeURIComponent(form.language)}&content=${encodeURIComponent(query)}`
    );
    if (!exactRes.ok) throw new Error("Exact lookup failed");
    const exactPayload = await exactRes.json();
    if (token !== matchToken) return;
    existingGloss.value = (exactPayload.data as GlossDTO[])[0] ?? null;

    if (query.length < 2) {
      suggestions.value = [];
      return;
    }

    const suggestRes = await fetch(
      `${API_BASE_URL}/glosses/search?language=${encodeURIComponent(form.language)}&query=${encodeURIComponent(query)}&limit=5`
    );
    if (!suggestRes.ok) throw new Error("Suggestion lookup failed");
    const suggestPayload = await suggestRes.json();
    if (token !== matchToken) return;
    const results = (suggestPayload.data as GlossDTO[]).filter(
      (gloss) => gloss.id !== existingGloss.value?.id
    );
    suggestions.value = results;
  } catch (error) {
    console.error(error);
  } finally {
    if (token === matchToken) {
      isCheckingMatches.value = false;
    }
  }
}

async function handleSubmit() {
  const trimmed = form.content.trim();
  if (!trimmed) {
    toast.error("Content is required");
    return;
  }

  if (attachingExisting.value && existingGloss.value) {
    emit("saved", existingGloss.value, { existed: true });
    toast.success("Attached existing gloss");
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      language: form.language,
      content: trimmed,
      isParaphrased: form.isParaphrased,
      transcriptions: form.transcriptions
        .filter((entry) => entry.trim())
        .map((entry) => entry.trim()),
      notes: serializeNotes(form.notes),
      containsIds: [],
      nearSynonymIds: [],
      nearHomophoneIds: [],
      translationIds: [],
      clarifiesUsageIds: [],
      toBeDifferentiatedFromIds: [],
    };

    const response = await fetch(
      props.mode === "create"
        ? `${API_BASE_URL}/glosses`
        : `${API_BASE_URL}/glosses/${props.initialGloss?.id}`,
      {
        method: props.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to ${props.mode === "create" ? "create" : "update"} gloss: ${response.status}`
      );
    }

    const result = await response.json();
    emit("saved", result.data as GlossDTO, { existed: false });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
  } finally {
    isSubmitting.value = false;
  }
}

function selectSuggestion(gloss: GlossDTO) {
  emit("saved", gloss, { existed: true });
  toast.success("Attached existing gloss");
}
</script>

<template>
  <teleport to="body">
    <dialog :open="show" class="modal" @close="$emit('close')">
      <div class="modal-box">
        <h2 class="card-title mb-4">{{ mode === "create" ? "Add Gloss" : "Edit Gloss" }}</h2>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <fieldset class="fieldset">
            <label for="gloss-language" class="label">Language</label>
            <LanguageSelect
              id="gloss-language"
              v-model="form.language"
              :disabled="Boolean(props.lockedLanguage)"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label for="gloss-content" class="label">Content</label>
            <div class="flex items-center gap-2">
              <span v-if="form.isParaphrased && !attachingExisting" aria-hidden="true" class="text-lg text-light">[</span>
              <input
                id="gloss-content"
                v-model="form.content"
                type="text"
                class="input flex-1"
                placeholder="Hola"
                required
              />
              <span v-if="form.isParaphrased && !attachingExisting" aria-hidden="true" class="text-lg text-light">]</span>
            </div>
            <div class="text-xs mt-2 space-y-1">
              <div
                class="flex gap-2 overflow-x-auto py-2 min-h-[2.5rem]"
                :class="{ 'opacity-0 pointer-events-none': !suggestions.length }"
              >
                <button
                  v-for="suggestion in suggestions"
                  :key="suggestion.id"
                  type="button"
                  class="btn btn-xs whitespace-nowrap"
                  @click="selectSuggestion(suggestion)"
                >
                  {{ suggestion.content }}
                </button>
              </div>
            </div>
          </fieldset>

          <template v-if="!attachingExisting">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" class="checkbox" v-model="form.isParaphrased" />
              Mark as paraphrased
            </label>

            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">Transcriptions</span>
                <button type="button" class="btn btn-xs btn-ghost" @click="addTranscription">Add</button>
              </div>
              <div v-if="form.transcriptions.length === 0" class="text-sm text-light italic">
                No transcriptions yet
              </div>
              <div v-else class="space-y-2">
                <div v-for="(entry, index) in form.transcriptions" :key="index" class="flex items-center gap-2">
                  <input
                    v-model="form.transcriptions[index]"
                    type="text"
                    class="input input-sm flex-1"
                    placeholder="ˈola"
                  />
                  <button type="button" class="btn btn-ghost btn-xs" @click="removeTranscription(index)">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">Notes</span>
                <button type="button" class="btn btn-xs btn-ghost" @click="addNote">Add</button>
              </div>
              <div v-if="form.notes.length === 0" class="text-sm text-light italic">
                No notes yet
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(note, index) in form.notes"
                  :key="index"
                  class="border border-base-300 rounded-lg p-3 space-y-2"
                >
                  <fieldset class="fieldset">
                    <label :for="`note-type-${index}`" class="label">Type</label>
                    <input
                      :id="`note-type-${index}`"
                      v-model="form.notes[index].noteType"
                      type="text"
                      class="input input-sm"
                      placeholder="Usage"
                    />
                  </fieldset>
                  <fieldset class="fieldset">
                    <label :for="`note-content-${index}`" class="label">Content</label>
                    <textarea
                      :id="`note-content-${index}`"
                      v-model="form.notes[index].content"
                      class="textarea textarea-sm"
                      placeholder="Explain the context..."
                    ></textarea>
                  </fieldset>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      v-model="form.notes[index].showBeforeSolution"
                    />
                    Show before solution
                  </label>
                  <button type="button" class="btn btn-ghost btn-xs w-full" @click="removeNote(index)">
                    Remove note
                  </button>
                </div>
              </div>
            </div>
          </template>

          <div class="modal-action">
            <button type="button" class="btn btn-outline" @click="$emit('close')" :disabled="isSubmitting">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? "Saving..." : primaryLabel }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="$emit('close')" :disabled="isSubmitting">close</button>
      </form>
    </dialog>
  </teleport>
</template>
