import PageSituationsList from '../pages/situations-list/PageSituationsList.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'situations-list',
      component: PageSituationsList
    }
  ]
});

export default router;
