import './assets/main.css'
// import { createAuth0 } from '@auth0/auth0-vue';
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App);

/*
app.use(
    createAuth0({
      domain: "<AUTH0-DOMAIN>",
      clientId: "<AUTHO-CLIENT-ID>",
      connection: "sms"
    })
  );
  */


  

app.mount('#app')
