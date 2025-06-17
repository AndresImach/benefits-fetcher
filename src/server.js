require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS with specific options
app.use(cors({
  origin: '*',
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
const BANKS = {
  'BBVA': 'BBVA_GO_V3',
  'CIUDAD': 'CIUDAD',
  'ICBC': 'ICBC',
  'SANTANDER': 'SANTANDER',
  'SUPERVILLE': 'SUPERVILLE',
  'PERSONAL': 'PERSONAL'
};

// Get collection name from bank name
const getCollectionName = (bank) => {
  return BANKS[bank.toUpperCase()];
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
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log('Connected to MongoDB');
    
    return client.db(mongo_database);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Direct access to collection to test MongoDB connection
app.get('/api/test/:bank', async (req, res) => {
  try {
    const { bank } = req.params;
    const db = await connectToMongoDB();
    const collection = db.collection(bank);
    const count = await collection.countDocuments();
    res.json({ 
      collection: bank,
      documentCount: count,
      database: mongo_database,
      connected: true
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all benefits from all banks
app.get('/api/benefits', async (req, res) => {
  try {
    // Use bank names (keys) instead of collection names
    const banks = Object.keys(BANKS);
    const allBenefits = {};
    const db = await connectToMongoDB();

    console.log('Connected to database:', mongo_database);
    
    for (const bank of banks) {
      const collectionName = getCollectionName(bank);
      console.log(`Trying to fetch from collection: ${collectionName} for bank: ${bank}`);
      
      try {
        const collection = db.collection(collectionName);
        const benefits = await collection.find({}).toArray();
        
        console.log(`${collectionName}: Found ${benefits?.length || 0} documents`);
        
        if (benefits && benefits.length > 0) {
          allBenefits[bank] = benefits;
          console.log(`Found ${benefits.length} benefits for ${bank}`);
        } else {
          console.log(`No benefits found for ${bank} in collection ${collectionName}`);
          allBenefits[bank] = [];
        }
      } catch (bankError) {
        console.error(`Error fetching benefits for ${bank}:`, bankError);
        allBenefits[bank] = { error: `Failed to fetch benefits for ${bank}` };
      }
    }

    // Log the response before sending
    console.log('Response summary:', Object.keys(allBenefits).map(bank => ({
      bank,
      count: Array.isArray(allBenefits[bank]) ? allBenefits[bank].length : 'error'
    })));

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
        availableBanks: Object.keys(BANKS)
      });
    }

    const db = await connectToMongoDB();
    console.log(`Using collection: ${collectionName}`);
    
    const collection = db.collection(collectionName);
    const benefits = await collection.find({}).toArray();

    console.log(`Query results for ${bank}:`, {
      collectionName,
      resultsFound: benefits?.length || 0
    });

    if (!benefits || benefits.length === 0) {
      console.log(`No benefits found for bank: ${bank}`);
      return res.json([]);
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
      testConnection: '/api/test/:collectionName',
      health: '/api/health'
    },
    availableBanks: Object.keys(BANKS),
    collections: BANKS
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    res.json({ 
      status: 'ok',
      database: {
        connected: true,
        name: mongo_database
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
