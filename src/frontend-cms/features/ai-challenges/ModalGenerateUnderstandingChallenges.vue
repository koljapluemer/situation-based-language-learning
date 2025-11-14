<script setup lang="ts">
import { ref, computed } from "vue";
import { Sparkles, Trash2, AlertCircle } from "lucide-vue-next";
import type { SituationDTO, LanguageCode } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";

interface GlossPayload {
  content: string;
  isParaphrased: boolean;
  transcriptions?: string[];
  notes?: Array<{
    noteType: string;
    content: string;
    showBeforeSolution: boolean;
  }>;
  contains?: GlossPayload[];
}

interface Props {
  show: boolean;
  situation: SituationDTO;
  nativeLanguage: LanguageCode;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const toast = useToast();
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

// State
const mode = ref<"classic" | "agentic">("classic");
const count = ref(5);
const userHints = ref("");
const suggestions = ref<GlossPayload[]>([]);
const selectedIndices = ref<Set<number>>(new Set());
const isGenerating = ref(false);
const isSaving = ref(false);
const metadata = ref<any>(null);
const errorMessage = ref<string | null>(null);

const selectedCount = computed(() => selectedIndices.value.size);

function toggleSelection(index: number) {
  if (selectedIndices.value.has(index)) {
    selectedIndices.value.delete(index);
  } else {
    selectedIndices.value.add(index);
  }
  // Force reactivity
  selectedIndices.value = new Set(selectedIndices.value);
}

function selectAll() {
  selectedIndices.value = new Set(suggestions.value.map((_, i) => i));
}

function deselectAll() {
  selectedIndices.value = new Set();
}

async function handleGenerate() {
  isGenerating.value = true;
  metadata.value = null;
  errorMessage.value = null;

  try {
    const endpoint =
      mode.value === "classic"
        ? "/ai/generate-understanding-challenges/classic"
        : "/ai/generate-understanding-challenges/agentic";

    const body = {
      situationId: props.situation.identifier,
      targetLanguage: props.situation.targetLanguage,
      nativeLanguage: props.nativeLanguage,
      ...(mode.value === "classic" && { count: count.value }),
      userHints: userHints.value || undefined,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      const details = errorData.details ? `\n\n${errorData.details}` : "";
      throw new Error(`${errorMsg}${details}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Generation failed");
    }

    suggestions.value = result.glosses || [];
    metadata.value = result.metadata;

    // Auto-select all
    selectAll();

    toast.success(
      `Generated ${suggestions.value.length} challenge${
        suggestions.value.length !== 1 ? "s" : ""
      }`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errorMessage.value = message;
    toast.error(`Failed to generate`);
  } finally {
    isGenerating.value = false;
  }
}

async function handleSave() {
  const selected = suggestions.value.filter((_, i) => selectedIndices.value.has(i));

  if (selected.length === 0) {
    toast.info("Please select at least one challenge to save");
    return;
  }

  isSaving.value = true;

  try {
    const response = await fetch(
      `${API_BASE_URL}/situations/${props.situation.identifier}/save-generated-challenges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedGlosses: selected }),
      }
    );

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Save failed");
    }

    toast.success(`Saved ${selected.length} challenge${selected.length !== 1 ? "s" : ""}`);
    emit("saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Failed to save: ${message}`);
  } finally {
    isSaving.value = false;
  }
}

function handleClose() {
  // Reset state
  suggestions.value = [];
  selectedIndices.value = new Set();
  metadata.value = null;
  userHints.value = "";
  emit("close");
}

function removeSuggestion(index: number) {
  suggestions.value.splice(index, 1);
  selectedIndices.value.delete(index);
  // Adjust indices after removal
  const newSelected = new Set<number>();
  selectedIndices.value.forEach((i) => {
    if (i > index) {
      newSelected.add(i - 1);
    } else if (i < index) {
      newSelected.add(i);
    }
  });
  selectedIndices.value = newSelected;
}

function formatGlossContent(gloss: GlossPayload): string {
  return gloss.isParaphrased ? `[${gloss.content}]` : gloss.content;
}

function renderContainsTree(contains: GlossPayload[], depth = 0): string {
  if (!contains || contains.length === 0) return "";

  return contains
    .map((child) => {
      const indent = "  ".repeat(depth + 1);
      const prefix = depth === 0 ? "├─ " : "└─ ";
      const content = formatGlossContent(child);
      const nested = child.contains ? renderContainsTree(child.contains, depth + 1) : "";
      return `${indent}${prefix}${content}${nested ? "\n" + nested : ""}`;
    })
    .join("\n");
}
</script>

<template>
  <teleport to="body">
    <dialog :open="show" class="modal" @close="emit('close')">
      <div class="modal-box max-w-4xl">
        <h3 class="mb-6">Generate Understanding Text Challenges</h3>

      <!-- Mode Toggle -->
      <fieldset class="fieldset">
        <label class="label">Mode</label>
        <label class="cursor-pointer flex items-center gap-4">
          <span>Classic</span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            :checked="mode === 'agentic'"
            @change="mode = mode === 'classic' ? 'agentic' : 'classic'"
          />
          <span>Agentic</span>
        </label>
      </fieldset>

      <!-- Count (Classic only) -->
      <fieldset v-if="mode === 'classic'" class="fieldset">
        <label class="label">How many: {{ count }}</label>
        <input
          v-model.number="count"
          type="range"
          min="1"
          max="10"
          class="range range-primary"
        />
      </fieldset>

      <!-- User Hints -->
      <fieldset class="fieldset">
        <label for="hints" class="label">Additional hints (optional)</label>
        <textarea
          id="hints"
          v-model="userHints"
          class="textarea textarea-bordered"
          placeholder='e.g., "focus on polite forms", "include numbers 1-10"'
          rows="2"
        ></textarea>
      </fieldset>

      <!-- Generate Button -->
      <button
        @click="handleGenerate"
        :disabled="isGenerating"
        class="btn btn-primary w-full gap-2"
      >
        <Sparkles :size="16" />
        {{ isGenerating ? "Generating..." : "Generate with AI" }}
        <span v-if="isGenerating" class="loading loading-spinner loading-sm"></span>
      </button>

      <!-- Metadata Display -->
      <div v-if="metadata" class="alert mt-6">
        <AlertCircle :size="16" />
        <div>
          Generated {{ metadata.count }} gloss{{ metadata.count !== 1 ? "es" : "" }}
          <template v-if="metadata.iterations">
            in {{ metadata.iterations }} iteration{{ metadata.iterations !== 1 ? "s" : "" }}
            ({{ metadata.toolCalls }} tool calls)
          </template>
        </div>
      </div>

      <!-- Suggestions Display -->
      <div v-if="suggestions.length > 0" class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h4>Generated Suggestions ({{ suggestions.length }})</h4>
          <div class="flex gap-2">
            <button @click="selectAll" class="btn btn-ghost btn-xs">Select All</button>
            <button @click="deselectAll" class="btn btn-ghost btn-xs">Deselect All</button>
          </div>
        </div>

        <div class="grid gap-4 max-h-96 overflow-y-auto">
          <div
            v-for="(gloss, index) in suggestions"
            :key="index"
            class="card shadow"
            :class="selectedIndices.has(index) ? 'border border-primary' : ''"
          >
            <div class="card-body">
              <div class="flex items-start gap-4">
                <input
                  type="checkbox"
                  class="checkbox checkbox-primary"
                  :checked="selectedIndices.has(index)"
                  @change="toggleSelection(index)"
                />

                <div class="flex-1">
                  <div class="card-title">{{ formatGlossContent(gloss) }}</div>

                  <div v-if="gloss.transcriptions && gloss.transcriptions.length > 0" class="text-light mt-1">
                    {{ gloss.transcriptions.join(", ") }}
                  </div>

                  <div v-if="gloss.notes && gloss.notes.length > 0" class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-for="(note, ni) in gloss.notes"
                      :key="ni"
                      class="badge"
                      :class="note.showBeforeSolution ? 'badge-primary' : ''"
                      :title="note.content"
                    >
                      {{ note.noteType }}
                    </span>
                  </div>

                  <div v-if="gloss.contains && gloss.contains.length > 0" class="mt-4">
                    <div class="text-light">Contains:</div>
                    <pre class="text-light font-mono mt-1">{{ renderContainsTree(gloss.contains) }}</pre>
                  </div>
                </div>

                <button
                  @click="removeSuggestion(index)"
                  class="btn btn-ghost btn-sm btn-square"
                  title="Remove"
                  type="button"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <form method="dialog">
          <button class="btn">Close</button>
        </form>
        <button
          v-if="suggestions.length > 0"
          @click="handleSave"
          :disabled="isSaving || selectedCount === 0"
          class="btn btn-primary"
          type="button"
        >
          <span v-if="isSaving" class="loading loading-spinner loading-sm"></span>
          {{ isSaving ? "Saving..." : `Add Selected (${selectedCount})` }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
  </teleport>
</template>
