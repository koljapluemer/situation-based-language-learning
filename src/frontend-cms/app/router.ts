import PageSituationsList from '../pages/situations-list/PageSituationsList.vue';
import PageSituationView from '../pages/situation-view/PageSituationView.vue';
import PageLogin from '../pages/login/PageLogin.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from './lib/supabase';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: PageLogin,
      meta: { public: true }
    },
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

// Auth guard
router.beforeEach(async (to, from, next) => {
  // Public routes don't need auth
  if (to.meta.public) {
    next();
    return;
  }

  // Check if user is authenticated
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    // Not authenticated, redirect to login
    next({ name: 'login' });
  } else {
    // Authenticated, proceed
    next();
  }
});

export default router;
