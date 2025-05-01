import { createMemoryHistory, createRouter } from 'vue-router';

import Index from '@/pages/index.vue';

const routes = [
  { path: '/', redirect: { name: 'index' } },
  { path: '/home', name: 'index', component: Index },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
