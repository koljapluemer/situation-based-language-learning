<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { Sparkles, Trash2, AlertCircle } from "lucide-vue-next";
import type { SituationDTO, LanguageCode } from "@sbl/shared";
import { useToast } from "../../dumb/toasts/index";
import ModalAgentRunLog from "./ModalAgentRunLog.vue";
import { apiFetch } from "../../app/lib/api-client";

interface GlossPayload {
  id?: string;
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

interface AgentRunLogEntry {
  timestamp: string;
  type: "info" | "tool" | "error" | "result";
  message: string;
  details?: unknown;
}

interface AgenticMetadata {
  mode: "agentic";
  provider?: "openai" | "gemini";
  iterations: number;
  toolCalls: number;
  count: number;
  errors: string[];
  logs?: AgentRunLogEntry[];
  runId?: string;
}

interface Props {
  show: boolean;
  situation: SituationDTO;
  nativeLanguage: LanguageCode;
  challengeType: "expression" | "understanding";
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const toast = useToast();

// Computed labels based on challenge type
const modalTitle = computed(() =>
  props.challengeType === "expression"
    ? "Generate Expression Challenges"
    : "Generate Understanding Text Challenges"
);

const infoDescription = computed(() =>
  props.challengeType === "expression"
    ? "The agent will generate high-level communicative functions in your native language (e.g., \"ask how much X costs\") with target language translations and nested parts for learning."
    : "The agent will analyze the situation, explore related glosses, call validation tools, and then suggest challenges. Runs can take a few extra seconds but create richer results and detailed logs."
);

const apiEndpoint = computed(() =>
  props.challengeType === "expression"
    ? "/ai/generate-expression-challenges/agentic"
    : "/ai/generate-understanding-challenges/agentic"
);

// State
const userHints = ref("");
const suggestions = ref<GlossPayload[]>([]);
const selectedIndices = ref<Set<number>>(new Set());
const isGenerating = ref(false);
const isSaving = ref(false);
const metadata = ref<AgenticMetadata | null>(null);
const errorMessage = ref<string | null>(null);
const runLogs = ref<AgentRunLogEntry[]>([]);
const showLogsModal = ref(false);
const currentRunId = ref<string | null>(null);
const logStreamActive = ref(false);
const hasRunLogs = computed(() => runLogs.value.length > 0);
const canViewLogs = computed(() =>
  logStreamActive.value || hasRunLogs.value || Boolean(currentRunId.value)
);
let logEventSource: EventSource | null = null;
const provider = ref<"openai" | "gemini">("openai");

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

function startLogStream(runId: string) {
  stopLogStream();
  try {
    const source = new EventSource(`${API_BASE_URL}/ai/run-logs/${runId}`);
    logEventSource = source;
    logStreamActive.value = true;
    source.onopen = () => {
      logStreamActive.value = true;
    };
    source.onmessage = (event) => {
      if (!event.data) return;
      try {
        const entry: AgentRunLogEntry = JSON.parse(event.data);
        runLogs.value = [...runLogs.value, entry];
      } catch {
        // ignore malformed messages
      }
    };
    source.addEventListener("end", () => {
      stopLogStream();
    });
    source.onerror = () => {
      stopLogStream();
    };
  } catch (error) {
    console.error("Failed to start log stream", error);
    stopLogStream();
  }
}

function stopLogStream() {
  if (logEventSource) {
    logEventSource.close();
    logEventSource = null;
  }
  logStreamActive.value = false;
}

onBeforeUnmount(() => {
  stopLogStream();
});

async function handleGenerate() {
  isGenerating.value = true;
  metadata.value = null;
  errorMessage.value = null;
  runLogs.value = [];
  showLogsModal.value = false;

  try {
    const runId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    currentRunId.value = runId;
    startLogStream(runId);
    showLogsModal.value = true;

    const body = {
      situationId: props.situation.id,
      targetLanguage: props.situation.targetLanguage,
      nativeLanguage: props.nativeLanguage,
      runId,
      userHints: userHints.value || undefined,
      provider: provider.value,
    };

    const response = await apiFetch(apiEndpoint.value, {
      method: "POST",
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
    runLogs.value = Array.isArray(result.metadata?.logs) ? result.metadata.logs : [];

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
    stopLogStream();
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
      `${API_BASE_URL}/situations/${props.situation.id}/save-generated-challenges`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedGlosses: selected,
          nativeLanguage: props.nativeLanguage,
          challengeType: props.challengeType
        }),
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
  errorMessage.value = null;
  stopLogStream();
  runLogs.value = [];
  showLogsModal.value = false;
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
        <h3 class="mb-6">{{ modalTitle }}</h3>

        <div class="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-base-content/80 mb-4">
          <p class="font-medium text-base-content">
            Agentic generation is enabled for this situation.
          </p>
          <p class="mt-1 text-base-content/70">
            {{ infoDescription }}
          </p>
        </div>

        <fieldset class="fieldset">
          <label class="label">AI Provider</label>
          <div class="join">
            <button
              type="button"
              class="btn btn-sm join-item"
              :class="provider === 'openai' ? 'btn-primary' : 'btn-outline'"
              @click="provider = 'openai'"
            >
              OpenAI
            </button>
            <button
              type="button"
              class="btn btn-sm join-item"
              :class="provider === 'gemini' ? 'btn-primary' : 'btn-outline'"
              @click="provider = 'gemini'"
            >
              Gemini
            </button>
          </div>
        </fieldset>

        <div class="flex items-center justify-between mb-4 text-sm text-base-content/70">
          <span v-if="logStreamActive" class="inline-flex items-center gap-2 text-success">
            <span class="loading loading-spinner loading-xs"></span>
            Streaming logs…
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            :disabled="!canViewLogs"
            @click="showLogsModal = true"
          >
            View run log
          </button>
        </div>

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

      <div v-if="errorMessage" class="alert alert-error mt-4 text-sm">
        <AlertCircle :size="16" />
        <div>{{ errorMessage }}</div>
      </div>

      <!-- Metadata Display -->
      <div v-if="metadata" class="alert mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <AlertCircle :size="16" />
        <div class="flex-1">
          <div>
            <span class="font-semibold text-xs uppercase tracking-wide text-base-content/60">
              Provider:
            </span>
            <span class="mr-2">{{ metadata.provider ?? 'openai' }}</span>
            Generated {{ metadata.count }} gloss{{ metadata.count !== 1 ? "es" : "" }}
            <template v-if="metadata.iterations">
              in {{ metadata.iterations }} iteration{{ metadata.iterations !== 1 ? "s" : "" }}
              ({{ metadata.toolCalls }} tool calls)
            </template>
          </div>
          <div v-if="metadata.runId" class="text-xs text-base-content/60 mt-1">
            Run ID: {{ metadata.runId }}
          </div>
          <div v-if="metadata.errors?.length" class="text-xs text-base-content/70 mt-1">
            {{ metadata.errors.length }} error{{ metadata.errors.length === 1 ? "" : "s" }} recorded during the run
          </div>
        </div>
        <button
          v-if="canViewLogs"
          class="btn btn-ghost btn-xs"
          type="button"
          @click="showLogsModal = true"
        >
          View run log
        </button>
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
  <ModalAgentRunLog
    :show="showLogsModal"
    :logs="runLogs"
    @close="showLogsModal = false"
  />
  </teleport>
</template>
