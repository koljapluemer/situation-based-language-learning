import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './app/App.vue';
import router from './app/router';

const app = createApp(App);

app.use(router);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  },
});

app.mount('#app');
