import { createRouter, createWebHistory } from 'vue-router';
import PageLanding from 'pages/landing/PageLanding.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: PageLanding
    },
  ]
});

export default router;
