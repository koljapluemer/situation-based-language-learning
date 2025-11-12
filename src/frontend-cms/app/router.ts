import PageSituationsList from '../pages/situations-list/PageSituationsList.vue';
import PageSituationView from '../pages/situation-view/PageSituationView.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'situations-list',
      component: PageSituationsList
    },
    {
      path: '/situations/:id',
      name: 'situation-view',
      component: PageSituationView
    }
  ]
});

export default router;
