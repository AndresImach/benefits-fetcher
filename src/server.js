require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

const client = new MongoClient(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1
});

// Connect to MongoDB
client.connect()
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Get all benefits from a specific bank
// app.get('/api/benefits/BBVA_GO_V3', async (req, res) => {
//   try {
//     const { bank } = req.params;
//     const collectionName = getCollectionName(bank);
    
//     console.log('Fetching from database:', mongo_database);
//     console.log('Collection:', collectionName);
    
//     if (!collectionName) {
//       throw new Error(`Invalid bank: ${bank}`);
//     }
    
//     const db = client.db(mongo_database);
//     const collections = await db.listCollections().toArray();
//     console.log('Available collections:', collections.map(c => c.name));
    
//     const benefits = await db
//       .collection(collectionName)
//       .find({})
//       .toArray();
    
//     console.log(`Found ${benefits.length} benefits for ${bank}`);
    
//     res.json(benefits);
//   } catch (error) {
//     console.error('Error fetching benefits:', error);
//     res.status(500).json({ error: 'Internal server error', details: error.message });
//   }
// });

// Get all benefits from all banks
app.get('/api/benefits', async (req, res) => {
  try {
    const banks = ['BBVA', 'CIUDAD', 'ICBC', 'SANTANDER', 'SUPERVILLE', 'PERSONAL'];
    const allBenefits = {};

    for (const bank of banks) {
      const collectionName = getCollectionName(bank);
      if (collectionName) {
        const benefits = await client
          .db(mongo_database)
          .collection(collectionName)
          .find({})
          .toArray();
      
        allBenefits[collectionName] = benefits;
      }
    }

    res.json(allBenefits);
  } catch (error) {
    console.error('Error fetching all benefits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
