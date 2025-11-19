<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { LogOut } from 'lucide-vue-next';
import ToastContainer from '../dumb/toasts/ToastContainer.vue';
import { useAuth } from './composables/useAuth';

const router = useRouter();
const route = useRoute();
const { signOut, user } = useAuth();

const handleLogout = async () => {
  await signOut();
  router.push('/login');
};

const isLoginPage = () => route.name === 'login';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header with logout button -->
    <header v-if="!isLoginPage() && user" class="navbar bg-base-300 px-4">
      <div class="flex-1">
        <span class="text-xl font-bold">CMS</span>
      </div>
      <div class="flex-none gap-2">
        <span class="text-sm">{{ user.email }}</span>
        <button class="btn btn-sm btn-ghost" @click="handleLogout">
          <LogOut :size="16" />
          Logout
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="prose mx-auto flex-1 container flex flex-col gap-4 my-2">
      <router-view />
    </main>

    <ToastContainer />
  </div>
</template>

<style>
@import "tailwindcss";

@plugin "daisyui" {
  themes: fantasy --default, /* you may list other themes */
  other-theme-name;
}

@plugin "daisyui/theme" {
  name: fantasy;
  default: true;
  /* override colors */
  --color-primary: #7A29E9;
  --color-secondary: #210B3F;
  /* you can override more variables if needed */
}


@layer base {
  h1 {
    @apply text-4xl font-bold leading-tight my-6 text-center;
  }

  h2 {
    @apply text-3xl font-semibold leading-snug;
  }

  h3 {
    @apply text-2xl font-semibold leading-snug;
  }

  h4 {
    @apply text-xl font-medium leading-snug;
  }

  h5 {
    @apply text-lg font-medium leading-snug;
  }

  h6 {
    @apply text-base font-medium leading-snug uppercase tracking-wide;
  }
}

</style>
