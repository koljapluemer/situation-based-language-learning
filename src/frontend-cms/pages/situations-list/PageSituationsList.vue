<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LANGUAGES, type LanguageCode, type SituationDTO } from "@sbl/shared";
import { Eye } from "lucide-vue-next";
import ModalCreateSituation from "../../features/situation-create/ModalCreateSituation.vue";
import { useModalCreateSituation } from "../../features/situation-create/index";
import { useToast } from "../../dumb/toasts/index";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const situations = ref<SituationDTO[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

const { open, close } = useModalCreateSituation();
const toast = useToast();

function getEnglishDescription(situation: SituationDTO) {
  return situation.descriptions.find((desc) => desc.language === "eng")?.content ?? "No English description";
}

function getLanguageInfo(code: string) {
  return LANGUAGES[code] ?? null;
}

async function loadSituations() {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/situations`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload: { data: SituationDTO[] } = await response.json();
    situations.value = payload.data ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errorMessage.value = `Unable to load situations: ${message}`;
  } finally {
    isLoading.value = false;
  }
}

async function handleCreateSituation(description: string, targetLanguage: LanguageCode, nativeLanguage: LanguageCode, imageLink?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/situations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        descriptions: [
          {
            language: "eng",
            content: description,
          },
        ],
        targetLanguage,
        nativeLanguage,
        imageLink,
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    toast.success("Situation created successfully");
    close();
    await loadSituations();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast.error(`Failed to create situation: ${message}`);
  } finally {
    close();
  }
}

onMounted(loadSituations);
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between gap-4">
      <h1>Situations</h1>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" type="button" @click="open">
          Create Situation
        </button>
        <button class="btn btn-outline btn-sm" type="button" @click="loadSituations" :disabled="isLoading">
          Refresh
        </button>
      </div>
    </header>

    <div v-if="errorMessage" role="alert" class="alert alert-error">
      <span>{{ errorMessage }}</span>
    </div>

    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-base-content/70">
      <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
      Loading situations…
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th>English Description</th>
            <th>Target Language</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!situations.length">
            <td colspan="3" class="py-8 text-center text-base-content/70">
              No situations found.
            </td>
          </tr>
          <tr v-for="situation in situations" :key="situation.id">
            <td class="max-w-2xl whitespace-pre-line text-sm">
              {{ getEnglishDescription(situation) }}
            </td>
            <td class="font-semibold">
              <span class="inline-flex items-center gap-2">
                <span v-if="getLanguageInfo(situation.targetLanguage)?.emoji" aria-hidden="true">
                  {{ getLanguageInfo(situation.targetLanguage)?.emoji }}
                </span>
                {{ getLanguageInfo(situation.targetLanguage)?.name ?? situation.targetLanguage }}
                <span class="text-xs uppercase text-base-content/60">({{ situation.targetLanguage }})</span>
              </span>
            </td>
            <td>
              <router-link
                :to="{ name: 'situation-view', params: { id: situation.id } }"
                class="btn btn-ghost btn-sm"
                aria-label="View situation"
              >
                <Eye :size="16" />
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModalCreateSituation @create="handleCreateSituation" />
  </section>
</template>
