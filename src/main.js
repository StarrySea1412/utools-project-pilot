import { createApp } from 'vue';
import App from './App.vue';
import './assets/app.css';

window.addEventListener('error', (e) => { document.title = 'ERR: ' + e.message; });
window.addEventListener('unhandledrejection', (e) => { document.title = 'REJ: ' + (e.reason?.message || e.reason); });

createApp(App).mount('#app');
