require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();

// Cache the database connection
let cachedDb = null;

app.use(cors());
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const mongoUrl = process.env.MONGO_URL;
const mongo_database = 'Benefits';

// Add collection names mapping
const getCollectionName = (bank) => {
  const collections = {
    'BBVA': 'BBVA_GO_V3',
    'CIUDAD': 'CIUDAD',
    'ICBC': 'ICBC',
    'SANTANDER': 'SANTANDER',
    'SUPERVILLE': 'SUPERVILLE',
    'PERSONAL': 'PERSONAL'
  };
  return collections[bank.toUpperCase()];
};

// Function to connect to MongoDB
async function connectToMongoDB() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1
    });

    await client.connect();
    console.log('Connected to MongoDB');
    
    cachedDb = client.db(mongo_database);
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all benefits for a specific bank
app.get('/api/:bank', async (req, res) => {
  const { bank } = req.params;
  const collectionName = getCollectionName(bank);
  
  if (!collectionName) {
    return res.status(400).json({ error: 'Invalid bank name' });
  }

  try {
    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const benefits = await collection.find({}).toArray();
    res.json(benefits);
  } catch (error) {
    console.error(`Error fetching benefits for ${bank}:`, error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Export the app for serverless deployment
module.exports = app;
