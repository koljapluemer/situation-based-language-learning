import { createRouter, createWebHistory } from 'vue-router';
import PageLanding from 'pages/landing/PageLanding.vue';
import PageKnownLanguagesSetup from 'pages/known-languages-setup/PageKnownLanguagesSetup.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: PageLanding
    },
    {
      path: '/known-languages-setup',
      name: 'known-languages-setup',
      component: PageKnownLanguagesSetup
    },
  ]
});

export default router;
