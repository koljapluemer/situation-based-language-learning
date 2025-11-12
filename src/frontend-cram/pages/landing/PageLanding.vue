<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { LANGUAGES } from '@sbl/shared';
import { getKnownLanguages, hasKnownLanguages } from '../../dumb/known-languages-storage';

const knownLanguages = ref(getKnownLanguages());
const hasLanguages = ref(hasKnownLanguages());

onMounted(() => {
  knownLanguages.value = getKnownLanguages();
  hasLanguages.value = hasKnownLanguages();
});
</script>

<template>
  <section class="space-y-6">
    <h1>Welcome!</h1>

    <div class="card shadow">
      <div class="card-body">
        <h2 class="card-title">Your Languages</h2>

        <div v-if="hasLanguages" class="space-y-2">
          <p>You speak:</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="code in knownLanguages"
              :key="code"
              class="badge badge-lg"
            >
              <template v-if="LANGUAGES[code]?.emoji">{{ LANGUAGES[code].emoji }} </template>{{ LANGUAGES[code]?.name }}
            </span>
          </div>
        </div>

        <div v-else>
          <p class="text-base-content/70">You haven't set up your languages yet.</p>
        </div>

        <div class="card-actions">
          <router-link
            :to="{ name: 'known-languages-setup' }"
            class="btn btn-primary btn-sm"
          >
            {{ hasLanguages ? 'Edit Languages' : 'Set Up Languages' }}
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
