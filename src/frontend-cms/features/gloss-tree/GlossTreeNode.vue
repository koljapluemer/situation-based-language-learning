<script setup lang="ts">
defineOptions({ name: "GlossTreeNode" });

import { computed, reactive, ref, watch } from "vue";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-vue-next";
import { useToast } from "../../dumb/toasts";
import GlossModal from "../gloss-manage/GlossModal.vue";
import type { GlossDTO, GlossReference, LanguageCode } from "@sbl/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const props = defineProps<{
  gloss: GlossDTO;
  depth?: number;
  detachable?: boolean;
  translationLanguage?: LanguageCode;
  lockLanguage?: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  detach: [];
}>();

type RelationType = "contains" | "translations";
const relationFieldMap = {
  contains: "containsIds",
  translations: "translationIds",
} as const;

const toast = useToast();
const localGloss = ref<GlossDTO>(props.gloss);
const isNodeOpen = ref(false);
const containsOpen = ref(false);
const translationsOpen = ref(false);
const filteredTranslations = computed(() => {
  const list = localGloss.value?.translations ?? [];
  if (!props.translationLanguage) {
    return list;
  }
  return list.filter((ref) => ref.language === props.translationLanguage);
});

const childGlosses = reactive<Record<string, GlossDTO>>({});

const showModal = ref(false);
const modalMode = ref<"create" | "edit">("create");
const modalInitial = ref<GlossDTO | null>(null);
const relationContext = ref<RelationType | null>(null);
const modalDefaultLanguage = ref<LanguageCode | undefined>(undefined);
const modalLockedLanguage = ref<LanguageCode | undefined>(undefined);
const modalDefaults = computed(() =>
  modalDefaultLanguage.value ? { language: modalDefaultLanguage.value } : undefined
);

watch(
  () => props.gloss,
  (next) => {
    localGloss.value = next;
  }
);

watch(
  () => localGloss.value?.contains.map((item) => item.id) ?? [],
  (ids) => {
    const existing = new Set(ids);
    Object.keys(childGlosses).forEach((id) => {
      if (!existing.has(id)) {
        delete childGlosses[id];
      }
    });
  }
);

watch(containsOpen, (open) => {
  if (open) {
    ensureGlossLoaded();
    preloadChildGlosses();
  }
});

watch(translationsOpen, (open) => {
  if (open) {
    ensureGlossLoaded();
  }
});

function setModalLanguages(language?: LanguageCode | null, lock?: boolean) {
  modalDefaultLanguage.value = language ?? undefined;
  modalLockedLanguage.value = lock && language ? language : undefined;
}

function clearModalLanguages() {
  modalDefaultLanguage.value = undefined;
  modalLockedLanguage.value = undefined;
}

function formatContent(gloss: GlossDTO | null) {
  if (!gloss) return "—";
  return gloss.isParaphrased ? `[${gloss.content}]` : gloss.content;
}

function handleNodeToggle(event: Event) {
  const target = event.target as HTMLDetailsElement;
  isNodeOpen.value = target.open;
  if (target.open) {
    ensureGlossLoaded();
  }
}

function openEditSelf() {
  if (!localGloss.value) return;
  modalMode.value = "edit";
  relationContext.value = null;
  modalInitial.value = localGloss.value;
  setModalLanguages(localGloss.value.language, props.lockLanguage);
  showModal.value = true;
}

async function handleDeleteSelf() {
  if (!localGloss.value) return;
  try {
    const summary = await fetchReferenceSummary(localGloss.value.id);
    const message = summary.totalReferences
      ? `Delete this gloss? ${summary.totalReferences} other references rely on it.`
      : "Delete this gloss? This cannot be undone.";
    if (!confirm(message)) return;

    const response = await fetch(`${API_BASE_URL}/glosses/${localGloss.value.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete gloss: ${response.status}`);
    }
    toast.success("Gloss deleted");
    emit("changed");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to delete gloss");
  }
}

function startAddRelation(type: RelationType) {
  relationContext.value = type;
  modalMode.value = "create";
  modalInitial.value = null;
  if (type === "contains") {
    setModalLanguages(localGloss.value?.language, props.lockLanguage);
  } else {
    setModalLanguages(props.translationLanguage, true);
  }
  showModal.value = true;
}

async function openEditRelation(reference: GlossReference) {
  try {
    const gloss = await fetchGloss(reference.id);
    modalMode.value = "edit";
    relationContext.value = null;
    modalInitial.value = gloss;
    setModalLanguages(gloss.language, props.lockLanguage);
    showModal.value = true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to load gloss");
  }
}

async function detachRelation(type: RelationType, reference: GlossReference) {
  if (!localGloss.value) return;
  const confirmText =
    type === "contains"
      ? "Remove this gloss from the contains list?"
      : "Remove this translation?";
  if (!confirm(confirmText)) return;
  try {
    const ids = getRelationIds(type).filter((id) => id !== reference.id);
    await updateRelations(type, ids);
    toast.success(type === "contains" ? "Contains list updated" : "Translation removed");
    await refreshSelf();
    emit("changed");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to update relation");
  }
}

async function handleModalSaved(gloss: GlossDTO) {
  showModal.value = false;
  if (relationContext.value) {
    try {
      const ids = new Set(getRelationIds(relationContext.value));
      ids.add(gloss.id);
      await updateRelations(relationContext.value, Array.from(ids));
      toast.success("Relation updated");
      await refreshSelf();
      emit("changed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update relation");
    } finally {
      relationContext.value = null;
      modalInitial.value = null;
      clearModalLanguages();
    }
    return;
  }

  // Editing an existing gloss
  if (gloss.id === localGloss.value?.id) {
    localGloss.value = gloss;
  }
  await refreshSelf();
  emit("changed");
  relationContext.value = null;
  modalInitial.value = null;
  clearModalLanguages();
}

async function refreshSelf() {
  if (!localGloss.value) return;
  localGloss.value = await fetchGloss(localGloss.value.id);
}

async function ensureGlossLoaded() {
  if (!localGloss.value) return;
  if (!localGloss.value.contains || !localGloss.value.translations) {
    await refreshSelf();
  }
}

async function preloadChildGlosses() {
  if (!localGloss.value?.contains?.length) return;
  const pending = localGloss.value.contains
    .map((reference) => reference.id)
    .filter((id) => id && !childGlosses[id]);

  await Promise.all(
    pending.map(async (id) => {
      try {
        childGlosses[id] = await fetchGloss(id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load gloss");
      }
    })
  );
}

async function fetchGloss(id: string): Promise<GlossDTO> {
  const response = await fetch(`${API_BASE_URL}/glosses/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load gloss: ${response.status}`);
  }
  const data = await response.json();
  return data.data as GlossDTO;
}

function getRelationIds(type: RelationType): string[] {
  if (!localGloss.value) return [];
  const refs = type === "contains" ? localGloss.value.contains : localGloss.value.translations;
  return refs.map((ref) => ref.id).filter(Boolean);
}

async function updateRelations(type: RelationType, ids: string[]) {
  if (!localGloss.value) return;
  const payload: Record<string, string[]> = {
    [relationFieldMap[type]]: ids,
  };
  const response = await fetch(`${API_BASE_URL}/glosses/${localGloss.value.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to update gloss relations: ${response.status}`);
  }
}

function relationEmpty(type: RelationType) {
  if (type === "contains") {
    return (localGloss.value?.contains?.length ?? 0) === 0;
  }
  return filteredTranslations.value.length === 0;
}

const hasContains = computed(() => (localGloss.value?.contains?.length ?? 0) > 0);

async function handleChildChanged() {
  await refreshSelf();
  emit("changed");
}

function handleModalClose() {
  showModal.value = false;
  relationContext.value = null;
  modalInitial.value = null;
  clearModalLanguages();
}

async function fetchReferenceSummary(glossId: string) {
  const response = await fetch(`${API_BASE_URL}/glosses/${glossId}/references`);
  if (!response.ok) {
    throw new Error(`Failed to load references: ${response.status}`);
  }
  const data = await response.json();
  return data.data as { totalReferences: number };
}
</script>

<template>
  <div class="border-l border-base-300">
    <details class="group" @toggle="handleNodeToggle">
      <summary class="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-base-200 list-none">
        <ChevronRight :size="16" class="group-open:hidden" />
        <ChevronDown :size="16" class="hidden group-open:block" />
        <span class="flex-1 text-sm">
          {{ formatContent(localGloss) }}
        </span>
        <span class="text-xs uppercase text-light tracking-wide">{{ localGloss?.language }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          aria-label="Edit gloss"
          @click.stop.prevent="openEditSelf"
        >
          <Pencil :size="14" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-error"
          aria-label="Delete gloss"
          @click.stop.prevent="handleDeleteSelf"
        >
          <Trash2 :size="14" />
        </button>
        <button
          v-if="props.detachable"
          type="button"
          class="btn btn-ghost btn-xs"
          aria-label="Detach gloss"
          @click.stop.prevent="emit('detach')"
        >
          <X :size="14" />
        </button>
      </summary>

      <div class="ml-4 border-l border-base-200 pl-4 py-4 space-y-4">
        <details class="group" @toggle="containsOpen = ($event.target as HTMLDetailsElement).open">
          <summary class="flex items-center gap-2 cursor-pointer list-none py-1">
            <ChevronRight :size="14" class="group-open:hidden" />
            <ChevronDown :size="14" class="hidden group-open:block" />
            <span class="font-medium text-sm flex-1">Contains</span>
          </summary>

          <div class="mt-2 space-y-2">
            <div v-if="relationEmpty('contains')" class="text-sm text-light italic">
              No child glosses yet.
            </div>
            <div v-else class="space-y-3">
              <div v-for="reference in localGloss?.contains ?? []" :key="reference.id">
                <GlossTreeNode
                  v-if="childGlosses[reference.id]"
                  :gloss="childGlosses[reference.id]"
                  :depth="(props.depth ?? 0) + 1"
                  detachable
                  @detach="detachRelation('contains', reference)"
                  @changed="handleChildChanged"
                />
                <div
                  v-else-if="containsOpen"
                  class="flex items-center gap-2 text-sm text-light py-1"
                >
                  <span>{{ reference.content }}</span>
                  <span class="text-xs uppercase text-light">{{ reference.language }}</span>
                  <span class="loading loading-spinner loading-xs"></span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-outline btn-xs justify-start"
              @click="startAddRelation('contains')"
            >
              <Plus :size="12" />
              Add contained gloss
            </button>
          </div>
        </details>

        <details
          class="group"
          @toggle="translationsOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="flex items-center gap-2 cursor-pointer list-none py-1">
            <ChevronRight :size="14" class="group-open:hidden" />
            <ChevronDown :size="14" class="hidden group-open:block" />
            <span class="font-medium text-sm flex-1">Translations</span>
          </summary>

          <div class="mt-2 space-y-2">
            <div v-if="relationEmpty('translations')" class="text-sm text-light italic">
              No translations yet.
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="translation in filteredTranslations"
                :key="translation.id"
                class="flex items-center gap-2 py-1 px-2 rounded hover:bg-base-200"
              >
                <span class="flex-1 text-sm">{{ translation.content }}</span>
                <span class="text-xs uppercase text-light">{{ translation.language }}</span>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  @click="openEditRelation(translation)"
                >
                  <Pencil :size="12" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs text-error"
                  @click="detachRelation('translations', translation)"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-outline btn-xs justify-start"
              @click="startAddRelation('translations')"
            >
              <Plus :size="12" />
              Add translation
            </button>
          </div>
        </details>
      </div>
    </details>
  </div>

  <GlossModal
    :show="showModal"
    :mode="modalMode"
    :initial-gloss="modalInitial ?? undefined"
    :defaults="modalDefaults"
    :locked-language="modalLockedLanguage"
    @close="handleModalClose"
    @saved="handleModalSaved"
  />
</template>
