<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { GlossDTO, LanguageCode, Note } from "@sbl/shared";
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
}>();

const emit = defineEmits<{
  close: [];
  saved: [GlossDTO];
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

const defaultLanguage: LanguageCode = props.defaults?.language ?? "eng";

const form = reactive<FormState>({
  language: props.initialGloss?.language ?? defaultLanguage,
  content: props.initialGloss?.content ?? props.defaults?.content ?? "",
  isParaphrased: props.initialGloss?.isParaphrased ?? false,
  transcriptions: props.initialGloss?.transcriptions ? [...props.initialGloss.transcriptions] : [],
  notes: props.initialGloss?.notes ? cloneNotes(props.initialGloss.notes) : [],
});

const isSubmitting = ref(false);

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetForm();
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

function resetForm() {
  form.language = props.initialGloss?.language ?? props.defaults?.language ?? "eng";
  form.content = props.initialGloss?.content ?? props.defaults?.content ?? "";
  form.isParaphrased = props.initialGloss?.isParaphrased ?? false;
  form.transcriptions = props.initialGloss?.transcriptions ? [...props.initialGloss.transcriptions] : [];
  form.notes = props.initialGloss?.notes ? cloneNotes(props.initialGloss.notes) : [];
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

async function handleSubmit() {
  if (!form.content.trim()) {
    toast.error("Content is required");
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      language: form.language,
      content: form.content.trim(),
      isParaphrased: form.isParaphrased,
      transcriptions: form.transcriptions.filter((entry) => entry.trim()).map((entry) => entry.trim()),
      notes: serializeNotes(form.notes),
      containsIds: [],
      nearSynonymIds: [],
      nearHomophoneIds: [],
      translationIds: [],
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
      throw new Error(`Failed to ${props.mode === "create" ? "create" : "update"} gloss: ${response.status}`);
    }

    const result = await response.json();
    emit("saved", result.data as GlossDTO);
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    toast.error(message);
  } finally {
    isSubmitting.value = false;
  }
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
            <LanguageSelect id="gloss-language" v-model="form.language" />
          </fieldset>

          <fieldset class="fieldset">
            <label for="gloss-content" class="label">Content</label>
            <input
              id="gloss-content"
              v-model="form.content"
              type="text"
              class="input"
              placeholder="Hola"
              required
            />
          </fieldset>

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
                <button type="button" class="btn btn-ghost btn-xs" @click="removeTranscription(index)">Remove</button>
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
              <div v-for="(note, index) in form.notes" :key="index" class="border border-base-300 rounded-lg p-3 space-y-2">
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
                <button type="button" class="btn btn-ghost btn-xs w-full" @click="removeNote(index)">Remove note</button>
              </div>
            </div>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-outline" @click="$emit('close')" :disabled="isSubmitting">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save" }}
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
