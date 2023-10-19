<template>
  <div class="container">
    <div class="product-area">
     
     <div class="header">
       <h1>Product catalog</h1>
       <button v-if="!isLogged" @click="showPopup = true">Login</button>
       <!-- <button v-if="!isLogged" @click="login">Login</button> -->
       <!-- <button @click="logout()" title="logout">👤</button> -->
       <div v-if="isLogged" class="user-icons">
         <button @click="logout()" title="logout">👤</button>
         <button>🛒</button>
         <div class="badge">{{ cart.length }}</div>
     </div>
     </div>
   <div class="search-bar">
     <input v-model="transcribedText" placeholder="Search..."/>
     <button @click="getSearch">Search</button>
     <div v-if="showPopup" class="popup">
     <div class="popup-content">
       <h2>Enter Details</h2>
       <input v-model="userPhone" placeholder="Enter phone number" />
       <button v-if="!smsSent" @click="startAuth">SMS</button>
       <input v-if="smsSent" v-model="authCode" placeholder="Enter auth code" />
       <button v-if="smsSent" @click="verifyAndProceed">Verify</button>
       <button @click="closePopup">Close</button>
     </div>
   </div>


   </div>
   <div v-if="this.products.length<1" ><img src="./loading.gif" /></div>
   <div class="product" v-for="product in this.products" :key="product.id" :class="{'grid-disabled' : thinking}">
     <div class="product-category">
       <h2>{{ product.category }}</h2>
       <div class="products" :class="{ added: catProduct.isAdded }" v-for="catProduct in product.products" :key="product.title">
         <div class="product-info" >
           <h3>{{ catProduct.title }}</h3>
           <!--  -->
           <div class="product-detail"><p>{{ catProduct.description }}</p>
           <!-- <img class="product-image" :src="catProduct.imageUrl" /> -->
           <div class="emoji">{{catProduct.emoji}}</div>
          </div>
           <p class="price"><b>price: </b>{{ catProduct.price }}</p>
           <button v-if="!catProduct.isAdded" @click="addToCart(catProduct)">Add to cart</button>
           <button v-else @click="removeFromCart(catProduct)">Remove</button>
         </div>
       </div>
     </div>
   </div>
   </div>
    <div class="ai-chat-assistent">
      <div class="header">
        <h1>AI Chat Assistent</h1>
      </div>
      <div class="content-area" ref="contentArea">
        <div class="message" v-for="message in messages" :class="{ 'from-user': message.fromUser }">
         <b>{{ message['from-user'] }}</b> : {{ message.text }}
        </div>
        <div class="spinner" v-if="this.thinking">
          <img src="./loading.gif" />
        </div>

      </div>
      <div class="input-area">
        <textarea v-model="messageText" @keyup.enter="sendMessage" placeholder="How can I assist you... type in requests,lists,reciepes" />
        <button @click="sendMessage">Send</button>
    </div> 
    </div>
    
    
  </div>
  <div class="codeSamples">
    <div v-if="aiPrompt" class="prompt">
      <h2>Prompt</h2>
      <json-viewer :value="aiPrompt" boxed/>
    </div>
    <div class="shoppingList">
      <h2>Extracted List</h2>
      <json-viewer :value="shopingList" boxed />

    </div>
    <div class="pipeline">
      <h2>Aggregation Pipeline</h2>
      <json-viewer :value="pipeline" boxed copyable> </json-viewer>

    </div>
  </div>
</template>

<script>
import axios from 'axios';
import * as Realm from 'realm-web';
// import { useAuth0 } from '@auth0/auth0-vue';


import JsonViewer from 'vue-json-viewer'


const app = new Realm.App({ id: "ai-shop-ottvo" });
 //import { useAuth0 } from "@auth0/auth0-vue";
//const { loginWithRedirect } = useAuth0();


export default {
  // setup() {
  //   const auth0 = useAuth0();
    
  //   return {
  //     isAuthenticated: auth0.isAuthenticated,
  //     isLoading: auth0.isLoading,
  //     user: auth0.user,
  //     login() {
  //       auth0.loginWithRedirect({connection: 'sms'})
  //     },
  //     logout() {
  //       auth0.logout({
  //         logoutParams: {
  //           returnTo: window.location.origin
  //         }
  //       });
  //     }
  //   }
  // },
  components: {
    JsonViewer
  },
  data() {
    return {
      products : [],
      messageText: '',
      messages: [],
      transcribedText: '',
      thinking: false,
      showPopup: false,
      currentMessage: '',
      // userPhone: '',
      // authCode: '',
      //  isLogged: false,
      userPhone: '+972544444444',

      isLogged: true,
      orderId : '',
      smsSent: false,
      cart: [],
      pipeline: null,
      shopingList: null,
      aiPrompt: null,


    };
  },
  mounted() {
    this.getProducts();
  },
  watch: {
    messages() {
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    }
  },
  methods: {
  

    async getProducts() {
    
      //const response = await axios.get('http://localhost:3000/products');
      const axiosConfig = {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        url: `http://localhost:3000/products?phone=${this.userPhone}`,
        method: 'get',
      };
      const response = await axios(axiosConfig);
      this.products = response.data;
    },
    scrollToBottom() {
      const contentArea = this.$refs.contentArea;
      contentArea.scrollTop = contentArea.scrollHeight;
    },

    addToCart(product) {
      this.cart = [...this.cart, product];
      this.products.forEach((cat) => {
        cat.products.forEach((prod) => {
          if (prod.title === product.title) {
            prod.isAdded = true;
          }
        });
      });
      const axiosConfig = {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        url: 'http://localhost:3000/products/addToCart',
        method: 'post',
        data: {
          phone: this.userPhone,
          orderId : this.orderId,
          products: this.cart
        }
      };

      const response = axios(axiosConfig);
      if (response.status === 200) {
        console.log('added to cart');
      }
    },
    removeFromCart(product) {
      this.cart = this.cart.filter((prod) => prod.title !== product.title);

      this.products.forEach((cat) => {
        cat.products.forEach((prod) => {
          if (prod.title === product.title) {
            prod.isAdded = false;
          }
        });
      });

      const axiosConfig={
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        url: 'http://localhost:3000/products/addToCart',
        method: 'post',
        data: {
          phone: this.userPhone,
          products: this.cart
        }
      };

      const response = axios(axiosConfig);
      if (response.status === 200) {
        console.log('removed from cart');
      }
      
    },
    async getSearch(){
      const axiosConfig = {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        url: 'http://localhost:3000/products/search?query='+this.transcribedText,
        method: 'get',
      };
      const response = await axios(axiosConfig);
      this.products = response.data;
    },
  openPopup() {
    this.showPopup = true;
  },
  closePopup() {
    this.showPopup = false;
  },
  logout() {
    if (this.isLogged){
    app.currentUser.logOut();
    this.cart = [];
    this.isLogged = false;
    }
  },
  async  loginCustomFunction(payload) {
  // Create a Custom Function credential
  const credentials = Realm.Credentials.function(payload);
  // Authenticate the user
  const user = await app.logIn(credentials);
  // `App.currentUser` updates to match the logged in user
  console.assert(user.id === app.currentUser.id);
  return user;
  // console.log('login')
  // loginWithRedirect();
},
  async verifyAndProceed() {
    // Here, you can add logic to verify the user's phone and auth code

    const user = await this.loginCustomFunction({
      phone: this.userPhone,
      authCode: this.authCode
    });

    // await this.loginCustomFunction({
    // });

    // After verification, close the popup
    this.showPopup = false;

    // Continue with the order or other operations...
    this.isLogged = true;

    this.orderId = Math.floor(Math.random() * 1000000000);

    await this.getProducts();
  },
  async startAuth() {
    // Here, you can add logic to send an SMS to the user's phone
    const axiosConfig={
      headers: {
          'Content-Type': 'application/json;charset=UTF-8'
      },
     // url: '<APP-SERVICES-URL>/endpoint/smsAuth',
      method: 'post',
      data: {
        phone: this.userPhone
      }
    };
    const response = await axios(axiosConfig);
    this.smsSent = true;
    // await this.loginCustomFunction({
    // });

    },
    async typeBotAnimation(message) {
      const delay = (ms) => new Promise((res) => setTimeout(res, ms));
      let partialMessage = '';
      this.messages.push({ "from-user": "Bot", text: '' });
      for (let i = 0; i < message.length; i++) {
        partialMessage += message[i];
        await delay(50);  // Wait 100ms between each character
        this.messages[this.messages.length - 1].text = partialMessage;
      }
     
      this.currentMessage = '';
    },
    async formattedList(list) {
     let retList = ''
    list.forEach( (item) => {

      retList += `\n ${item.product} - ${item.quantity} / ${item.unit} `
    });

    await this.typeBotAnimation(retList);
    await this.typeBotAnimation("I hope you like them!");
  },
  async handleResponse(response) {
      this.thinking = false;
      this.aiPrompt = response.data.prompt;
      this.pipeline = response.data.pipeline;
      this.shopingList = response.data.searchList;
      const foundProducts = response.data.result;
      
      if (foundProducts.length === 0) {
        await this.typeBotAnimation("Sorry, I couldn't find anything.");
      } else {
        this.products = foundProducts;
        await  this.typeBotAnimation(`Here are some products I was looking for:`);
        await this.formattedList(response.data.searchList)//.map(item => item.product + " - " + item.quantity + " / " + item.unit))}`);
        
      }
    },
    async sendMessage() {
      if (this.messageText === ''){
        this.messages.push({ "from-user": "Bot", text: "Please no empty messages" });
        return;
      }

      if (!this.isLogged ) {
        this.messages.push({ "from-user": "Bot", text: "Please login first" });
        return;
      }

      const axiosConfig = {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        },
        url: 'http://localhost:3000/aiSearch',
        method: 'post',
        data: {
          query: this.messageText
        }
      };
      this.messages.push({ "from-user": "User", text: this.messageText });
      //this.messages.push({ "from-user": "Bot", text: "Let me work on it..." });
      this.typeBotAnimation("Let me work on it... Transforming query... Contacting LLM ... Parsing results...");
      this.thinking = true;
      this.messageText = '';
      axios(axiosConfig).then((response) => this.handleResponse(response));
      
    }

  }
};
</script>

<style>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  gap: 20px;
}
.badge{

  background-color: red;
  color: white;
  border-radius: 40%;
  width: 20px;
  height: 20px;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.user-icons{
  display: flex;
  flex-direction: row;
  gap: 10px;
}
.header{
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 5px;
  padding-bottom: 10px;
 border-bottom: 1px solid #ccc;
  border-radius: 24px;
}

.search-bar {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 24px;
  padding: 10px;
  align-items: center;

  
  
}
.search-bar input {
  width: 100%;
  height: 30px;
  border-radius: 24px;
  border: 1px solid #ccc;
  padding: 10px;
}

.product-area {
  width: 500px;
  margin-left: 20px;
  border: 1px solid #ccc;
  border-radius: 24px;
}
.added{
  background-color: #ccc;
  color: #000000;
}

.mic-icon {
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  margin-left: 10px;
}
.product-info {
  padding: 10px;
 display: flex;
  flex-direction: column;
}
/* .product-info {
  padding: 10px;
  card: 1px solid #ccc;
  border-radius: 24px;
  border: 1px solid #ccc;
} */
.product {
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap : 10px;
  border-bottom: 1px solid #ccc;
}
.products {
  justify-content: space-around;
}
.product-area {
  width: 1200px;
  height: 90vh;
  margin-left: 20px;
  border: 1px solid #ccc;
  border-radius: 24px;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  padding: 10px;
}

.emoji {
  font-size: 50px;
  margin-bottom: 10px;
}

.product-category {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
}
.products {
  flex-direction: row;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 24px;
}
.ai-chat-assistent{
  width: 50vw;
  height: 90vh;
  border: 1px solid #ccc;
  border-radius: 24px;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;

}
.product-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 24px;
  align-self: flex-end;
}
.product-detail{
  display: flex;
  justify-content: space-between;
}
.content-area{
  flex-grow: 1;
  overflow-y: scroll;
  overflow-x: none;
  background-color: black;
  white-space: pre-wrap;
}

.input-area{
  display: flex;
  flex-direction: row;
  /* position: fixed; */
  position: relative;

  width: 100%;
  padding: 10px;
}
textarea { 
  width: 100%;
  height: 10vh;
  background-color: #222222;
  color: #ffffff;
}

.grid-disabled {
  animation: opacityLoop 4s infinite;
  /* Adjust the blur radius as needed */
}

@keyframes opacityLoop {
  0%, 100% {
    opacity: 0.2;
    backdrop-filter: blur(50px); 
  }
  50% {
    opacity: 0.5;
    backdrop-filter: blur(50px); 
  }
}

.popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.popup-content {
  background-color: white;
  color: #222222;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  width: 300px;
}


</style>
