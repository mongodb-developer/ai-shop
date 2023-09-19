require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { OpenAI } = require('langchain/llms/openai');
const { PromptTemplate } = require('langchain/prompts');
const { StructuredOutputParser } = require('langchain/output_parsers');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { z } = require('zod');

// Constants
const PORT = 3000;
const DB_URL = process.env.DB_URL;
const DB_NAME = 'ai_shop';

// Variables
let db = null;

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection function
const connectToDb = async () => {
    if (db) return db;   
    const client = new MongoClient(DB_URL);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(DB_NAME);
    return db;
};

// Sample schema for AI parsing
const schema = z.object({
    "shopping_list": z.array(z.object({
        "product": z.string().describe("The name of the product"),
        "quantity": z.number().describe("The quantity of the product"),
        "unit": z.string().optional(),
        "category": z.string().optional(),
    })),
}).deepPartial();

const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPEN_AI_KEY}) 

// Embeddings function
const placeEmbeddings = async (documents) => {
    const embeddedDocuments = documents.map(async (document) => {
        const embeddedDocument = await embeddings.embedQuery(document.product);
        document.embeddings = embeddedDocument;   
        return document;
    });
    return Promise.all(embeddedDocuments);
};

// Routes
app.get('/products', async (req, res) => {
    db = await connectToDb();
    let pipeline = [
        {
            $group: {
                _id: '$category',
                products: {
                    $push: {
                        title: '$title',
                        description: '$description',
                        emoji: '$emoji',
                        price: '$price'
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                category: '$_id',
                products: 1
            }
        }
    ]
    if (req.query.phone){
        const user = await db.collection('users').findOne({ phone: req.query.phone });
        if (user){
            pipeline.unshift({
                "$search": {
                    "index": "default",
                    "knnBeta": {
                        "vector": user.user_avgEmbedding,
                        "path": "embeddings",
                        "k": 100
                    }
                }
            })
    }
  
}
    const products = await db.collection('products').aggregate(pipeline).toArray();
    res.json(products);
});

app.get('/products/search', async (req, res) => {
    db = await connectToDb();
    const { query } = req.query;
    const messages = await db.collection('products').aggregate([
                {
                    $search: {
                        index: 'default',
                        text: {
                            query,
                            path: ['title', 'description'],
                            fuzzy: {
                                maxEdits: 1
                            }
                        }
                        
                    },
                },
                {
                    $group: {
                        _id: '$category',
                        products: {
                            $push: {
                                title: '$title',
                                description: '$description',
                                emoji: '$emoji',
                                price: '$price'
                            },
                        }
                    }
                },
                {   
                    $project: {
                        _id: 0,
                        category: '$_id',
                        products: 1
                }}
            ]).toArray();
            res.json(messages);
        });

app.post('/products/addToCart', async (req, res) => {
    db = await connectToDb();
    const { products, phone, orderId } = req.body;

    await db.collection('orders').updateOne({phone : phone, orderId: orderId}, {$set: {products : products}}, {upsert : true});
    res.json({ message: 'Product added to cart' });
  
});
app.post('/aiSearch', async (req, res) => {
    // Connect to MongoDB
    db = await connectToDb();
    
    // Extract search query from the request
    const { query } = req.body;
    
    // Initialize OpenAI instance
    const llm = new OpenAI({ 
       
        openAIApiKey: process.env.OPEN_AI_KEY,
        modelName: "gpt-3.5-turbo-0613",
        temperature: 0 
    });

    // Create a structured output parser using the Zod schema
    const outputParser = StructuredOutputParser.fromZodSchema(schema);
    const formatInstructions = outputParser.getFormatInstructions();
    
    // Create a prompt template
    const prompt = new PromptTemplate({
        template: "Build a user grocery list in English as best as possible.\n{format_instructions}\n possible category {categories}\n{query}",
        inputVariables: ["query", "categories"],
        partialVariables: { format_instructions: formatInstructions },
    });
    
    // Fetch all categories from the database
    const categories = await db.collection('categories').find({}, { "_id": 0 }).toArray();
    const docs = categories.map((category) => category.categoryName);
    
    // Format the input prompt
    const input = await prompt.format({
        query: query,
        categories: docs
    });

    // Call the OpenAI model
    const response = await llm.call(input);
    const responseDoc = await outputParser.parse(response);
    let shoppingList = responseDoc.shopping_list;

    // Embed the shopping list
    shoppingList = await placeEmbeddings(shoppingList);
    
    // Construct aggregation query for searching products based on shopping list
    const aggregationQuery = [
        {
            "$search": {
                "index": "default",
                "knnBeta": {
                    "vector": shoppingList[0].embeddings,
                    "path": "embeddings",
                    // "filter": {
                    //     "text": {
                    //         "path": "category",
                    //         "query": shoppingList[0].category
                    //     }
                    // },
                    "k": 20
                }
            }
        },
        {$limit: 3},
        { $addFields: { "searchTerm": shoppingList[0].product } },
        ...shoppingList.slice(1).map((item) => ({
            $unionWith: {
                coll: "products",
                pipeline: [
                    {
                        "$search": {
                            "index": "default",
                            "knnBeta": {
                                "vector": item.embeddings,
                                // "filter": {
                                //     "text": {
                                //         "path": "category",
                                //         "query": item.category
                                //     }
                                // },
                                "path": "embeddings",
                                "k": 20
                            }
                        }
                    },
                    {$limit: 3},
                    { $addFields: { "searchTerm": item.product } }
                ]
            }
        })),
        { $group: { _id: "$searchTerm", products: { $push: "$$ROOT" } } },
        { $project: { "_id": 0, "category": "$_id", "products.title": 1, "products.description": 1,"products.emoji" : 1, "products.price": 1 } }
    ];

    // Execute aggregation query
    const collection = db.collection('products');
    const result = await collection.aggregate(aggregationQuery).toArray();
    
    // Respond with results
    res.json({ "result": result, "searchList": shoppingList, prompt: input, pipeline: aggregationQuery });
});

app.listen(PORT);







