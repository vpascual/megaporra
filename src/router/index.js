import { createRouter, createWebHashHistory } from 'vue-router'

// App.vue renders everything itself — these components are never mounted via
// <router-view>. They exist only so Vue Router accepts the route definitions
// and provides useRoute()/useRouter() throughout the app.
const Empty = { render: () => null }

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',                 component: Empty },
    { path: '/participant/:id',  component: Empty },
    { path: '/:pathMatch(.*)*',  redirect: '/' },
  ],
})
