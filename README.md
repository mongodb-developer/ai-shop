# AI-Shop Demo

This is a small web application to show case [Atlas Vector search](https://www.mongodb.com/products/platform/atlas-vector-search) with [Langchain JS](https://js.langchain.com/docs/get_started/introduction) and Open AI.

The Application has a product catalog and an AI assistant that uses LangChain and Open AI to provide the user products based on lists/reciepes or any unstructred requests.

The bottom section is showing the 3 fundemantal sections that the application is doing :
1. Create a prompt with all the necessary context to the LLM
1. Extract data into a predifined format and enrich with queryable embeddings
1. Generate X MongoDB vector search aggregations and reshapes to present the relevant results.


# Requirments 

1. Atlas Project
1. Atlas Cluster (free cluster is eligible)
1. App Services Application (eg. `AI-Shop`) to Host triggers and secrets. Make sure it is linked 
1. Open AI account with API Access
See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

### Step 1
In your App Services application, under "Values",  create the following Secret `openAIKey` with your OPEN AI API key:

Create a linked value called `OpenAIKey` and link to the secret

### Step 2 

Create a Database trigger  on `insert` to place Open AI embeddings on each product we will ingest.

- Database : `ai_shop`
- Collection : `products`

### function `calcEmbeedings`

```
exports = async function(changeEvent) {
    // Get the full document from the change event.
    const doc = changeEvent.fullDocument;

    // Define the OpenAI API url and key.
    const url = 'https://api.openai.com/v1/embeddings';
    // Use the name you gave the value of your API key in the “Values” utility inside of App Services
    const openai_key = context.values.get("openAIKey");

    try {
        console.log(`Processing document with id: ${JSON.stringify(doc)}`);
        

        // Call OpenAI API to get the embeddings.
        let response = await context.http.post({
            url: url,
             headers: {
                'Authorization': [`Bearer ${openai_key}`],
                'Content-Type': ['application/json']
            },
            body: JSON.stringify({
                input: `${doc.title} - #{doc.description}`,
                model: "text-embedding-ada-002"
            })
        });

        // Parse the JSON response
        let responseData = EJSON.parse(response.body.text());

        // Check the response status.
        if(response.statusCode === 200) {
            console.log("Successfully received embedding.");

            const embedding = responseData.data[0].embedding;

            // Get the cluster in MongoDB Atlas.
            const mongodb = context.services.get('mongodb-atlas');
            const db = mongodb.db('ai_shop'); // Replace with your database name.
            const collection = db.collection('products'); // Replace with your collection name.

            // Update the document in MongoDB.
            const result = await collection.updateOne(
                { _id: doc._id },
                // The name of the new field you’d like to contain your embeddings.
                { $set: { embeddings: embedding }}
            );

            if(result.modifiedCount === 1) {
                console.log("Successfully updated the document.");
                
                
            } else {
                console.log("Failed to update the document.");
            }
        } else {
            console.log(`Failed to receive embedding. Status code: ${response.body.text()}`);
        }

    } catch(err) {
        console.error(err);
    }
};
```
- Verify that the function runs under "SYSTEM" context after saving the trigger.

### Step 4 - Create Vector index

Create an Atlas Search index by going to the Cluster "Search" tab and specify a new index on:
- Database : `ai_shop`
- Collection : `products`

Use "JSON Editor" and specify a "defualt" index:
```
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embeddings": {
        "dimensions": 1536,
        "similarity": "cosine",
        "type": "knnVector"
      }
    }
  }
}
```

Create the index and make sure it is "Active".

### Ingest the data
 
We need to ingest the data under local directory `data`:
1. `data/ai_shop.categories.json` into collection named `categories` (hosting the possible categories in the shop).
1. `data/ai_shop.products.json` into collection named `categories` (hosting the possible categories in the shop).

We can use tools like `mongoimport` or compass to import those files. Or we can take the content and "copy" into "Data Explorer" > "INSERT DOCUMENT" tab:

Once data is ingested the trigger should set "embeddings" field under each product.

### Step 5 - Setup application

Create .env file in the main directory with the following content:
```
OPEN_AI_KEY='<OPEN_AI_KEY>'
DB_URL='<ATLAS_CONNECTION_URI>'
```
- The database user must have read/write permissions on `ai_shop` database.
### Install the application

```sh
npm install
```

### Step 6 - Run application

### Start the backend

```sh
npm run server
```

### Start fronend

```sh
npm run dev
```

Go to the suggested vite url to browse application:


## Desclaimer

Use at your own risk. Not an official MongoDB product.



