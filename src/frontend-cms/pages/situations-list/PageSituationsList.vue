<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { SituationDTO } from "@sbl/shared";
import { Eye } from "lucide-vue-next";
import ModalCreateSituation from "../../features/situation-create/ModalCreateSituation.vue";
import { useModalCreateSituation } from "../../features/situation-create/index";
import { useToast } from "../../dumb/toasts/index";
import { slugify } from "../../dumb/slug";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const situations = ref<SituationDTO[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

const { open, close } = useModalCreateSituation();
const toast = useToast();

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

async function handleCreateSituation(description: string, imageLink?: string) {
  const identifier = slugify(description);

  try {
    const response = await fetch(`${API_BASE_URL}/situations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier,
        descriptions: [
          {
            language: "eng",
            content: description,
          },
        ],
        imageLink,
        challengesOfExpression: [],
        challengesOfUnderstandingText: [],
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("A situation with this identifier already exists");
      }
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
            <th>#</th>
            <th>Identifier</th>
            <th>Descriptions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!situations.length">
            <td colspan="4" class="py-8 text-center text-base-content/70">
              No situations found.
            </td>
          </tr>
          <tr v-for="(situation, index) in situations" :key="situation.identifier">
            <td>{{ index + 1 }}</td>
            <td class="font-semibold">{{ situation.identifier }}</td>
            <td class="max-w-xl whitespace-pre-line text-sm">
              <ul class="list-disc list-inside space-y-1">
                <li v-for="desc in situation.descriptions" :key="desc.language + desc.content">
                  <span class="font-medium uppercase text-xs tracking-wide text-base-content/70">
                    {{ desc.language }}:
                  </span>
                  {{ desc.content }}
                </li>
              </ul>
            </td>
            <td>
              <router-link
                :to="{ name: 'situation-view', params: { id: situation.identifier } }"
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
