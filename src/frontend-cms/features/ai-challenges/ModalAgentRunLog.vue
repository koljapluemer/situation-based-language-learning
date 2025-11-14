<script setup lang="ts">
import { computed } from "vue";
import { Activity } from "lucide-vue-next";

interface AgentRunLogEntry {
  timestamp: string;
  type: "info" | "tool" | "error" | "result";
  message: string;
  details?: unknown;
}

interface Props {
  show: boolean;
  logs: AgentRunLogEntry[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const typeStyles: Record<AgentRunLogEntry["type"], string> = {
  info: "badge-info",
  tool: "badge-secondary",
  error: "badge-error",
  result: "badge-success",
};

const orderedLogs = computed(() => {
  return [...props.logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
});

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

function formatDetails(details: unknown): string | null {
  if (details === undefined || details === null) {
    return null;
  }
  if (typeof details === "string") {
    return details;
  }
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
</script>

<template>
  <dialog :open="show" class="modal modal-bottom sm:modal-middle" @close="emit('close')">
    <div class="modal-box max-w-3xl">
      <div class="flex items-center gap-3 mb-4">
        <Activity :size="18" class="text-primary" />
        <h3 class="text-lg font-semibold">
          Agent run log
          <span class="text-sm font-normal text-base-content/60">
            ({{ logs.length }} entr{{ logs.length === 1 ? "y" : "ies" }})
          </span>
        </h3>
      </div>

      <div v-if="orderedLogs.length === 0" class="text-sm text-base-content/70">
        No log entries captured for this run.
      </div>

      <div v-else class="max-h-[26rem] overflow-y-auto divide-y divide-base-200">
        <article
          v-for="(entry, index) in orderedLogs"
          :key="entry.timestamp + index"
          class="py-3 space-y-2"
        >
          <div class="flex items-center justify-between gap-4 text-xs text-base-content/70">
            <span class="font-mono">{{ formatTimestamp(entry.timestamp) }}</span>
            <span class="badge badge-sm uppercase" :class="typeStyles[entry.type]">
              {{ entry.type }}
            </span>
          </div>
          <p class="text-sm font-medium text-base-content">
            {{ entry.message }}
          </p>
          <pre
            v-if="formatDetails(entry.details)"
            class="bg-base-200 rounded-lg text-xs p-3 text-base-content/90 overflow-x-auto"
          >{{ formatDetails(entry.details) }}</pre>
        </article>
      </div>

      <div class="modal-action">
        <form method="dialog">
          <button class="btn" type="button" @click="emit('close')">Close</button>
        </form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">close</button>
    </form>
  </dialog>
</template>
