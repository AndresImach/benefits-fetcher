require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS with specific options
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  // Normalize bank name to uppercase for comparison
  const normalizedBank = bank.toUpperCase();
  return collections[normalizedBank];
};

// Function to connect to MongoDB with better error handling
async function connectToMongoDB() {
  if (!mongoUrl) {
    throw new Error('MONGO_URL environment variable is not set');
  }

  try {
    const client = new MongoClient(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
      connectTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
    });

    await client.connect();
    console.log('Connected to MongoDB');
    
    return client.db(mongo_database);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Get all benefits from all banks
app.get('/api/benefits', async (req, res) => {
  try {
    const banks = ['BBVA', 'CIUDAD', 'ICBC', 'SANTANDER', 'SUPERVILLE', 'PERSONAL'];
    const allBenefits = {};
    const db = await connectToMongoDB();

    for (const bank of banks) {
      const collectionName = getCollectionName(bank);
      if (collectionName) {
        try {
          const collection = db.collection(collectionName);
          const benefits = await collection.find({}).toArray();
          
          if (benefits && benefits.length > 0) {
            allBenefits[bank] = benefits;
            console.log(`Found ${benefits.length} benefits for ${bank}`);
          } else {
            console.log(`No benefits found for ${bank}`);
            allBenefits[bank] = [];
          }
        } catch (bankError) {
          console.error(`Error fetching benefits for ${bank}:`, bankError);
          allBenefits[bank] = { error: `Failed to fetch benefits for ${bank}` };
        }
      }
    }

    res.json(allBenefits);
  } catch (error) {
    console.error('Error fetching all benefits:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get benefits for a specific bank
app.get('/api/benefits/:bank', async (req, res) => {
  const { bank } = req.params;
  console.log(`Fetching benefits for bank: ${bank}`);
  
  try {
    const collectionName = getCollectionName(bank);
    if (!collectionName) {
      console.log(`Invalid bank name: ${bank}`);
      return res.status(404).json({ 
        error: 'Bank not found',
        message: `No configuration found for bank: ${bank}`,
        availableBanks: ['BBVA', 'CIUDAD', 'ICBC', 'SANTANDER', 'SUPERVILLE', 'PERSONAL']
      });
    }

    const db = await connectToMongoDB();
    const collection = db.collection(collectionName);
    const benefits = await collection.find({}).toArray();

    if (!benefits || benefits.length === 0) {
      console.log(`No benefits found for bank: ${bank}`);
      return res.json([]); // Return empty array instead of 404
    }

    console.log(`Found ${benefits.length} benefits for ${bank}`);
    res.json(benefits);
  } catch (error) {
    console.error(`Error fetching benefits for ${bank}:`, error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Root route handler
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Benefits Fetcher API is running',
    endpoints: {
      getAllBenefits: '/api/benefits',
      getBankBenefits: '/api/benefits/:bank',
      health: '/api/health'
    },
    availableBanks: ['BBVA', 'CIUDAD', 'ICBC', 'SANTANDER', 'SUPERVILLE', 'PERSONAL']
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Export the app for serverless deployment
module.exports = app;
