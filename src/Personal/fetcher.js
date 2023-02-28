require("dotenv").config();
const axios = require('axios');
const {
  MongoClient,
  ServerApiVersion
} = require("mongodb");
const fs = require("fs");
const isLocal = false;
var mongoUrl = '';
if (isLocal) {
  mongoUrl = "mongodb://localhost:27017/?maxPoolSize=20&w=majority";
} else {
  mongoUrl = process.env.MONGO_URL;
}

const mongo_database = 'Benefits'
const mongo_collection = 'Personal'

const MAX_RETRIES = 50;
const RETRY_DELAY = 1000; // 1 second
async function makeRequestWithBackoff(url, retries = 0) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 403 && retries < MAX_RETRIES) {
      console.log(`Rate limited. Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return makeRequestWithBackoff(url, retries + 1);
    }
    throw error;
  }
}

async function run() {
  console.log("app start")
  try {
    const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    // await client.connect();
    // console.log("client connected")

    let benefitsIds = [];

    let continueFetching = true
    let pager = 0
    while (continueFetching) {
      await makeRequestWithBackoff(`https://www.personalpay.com.ar/api/benefits?limit=20&source=club&offset=${20*pager}`)
        .then((res) => {
          console.log(`pager ${pager}`)
          // let resData = res.data
          let resData = res
          if (resData.data.length < 1) {
            continueFetching = false
            return
          }
          for (let item of resData.data) {
            // console.log("item", item)
            benefitsIds.push(item.id)
          }
          pager++;
        })
        .catch(error => {
          console.log(`Error fetching data for pager=${pager}: ${error.message}`);
        })
    }
    console.log("benefitsIds", benefitsIds)

    let okArray = []
    for (let id of benefitsIds) {
      await makeRequestWithBackoff(`https://www.personalpay.com.ar/api/benefits/${id}`)
        .then((res) => {
          console.log(`Getting benefit ${id}`)
          let data = res;
          okArray.push(data)
        })
        .catch(error => {
          console.log(`Error fetching data for ${id}: ${error.message}`);
        })
    }

    // console.log("okArray", okArray)
    // await client.db(mongo_database).collection(mongo_collection).insertMany(okArray)
    const updateOps = okArray.map((item) => ({
      updateOne: {
        filter: {"beneficio.id": item.id},
        update: { $set: item },
        upsert: true
      }
    }));
    const resp = await client.db(mongo_database).collection(mongo_collection).bulkWrite(updateOps)
    console.log("Data upserted to MongoDB", resp)
    fs.writeFile('temp/okFile.json', JSON.stringify(okArray), function (err) {
      if (err) throw err;
      console.log('Array saved to file!');
      process.exit();
    });
  } catch (error) {
    console.log("error BBVA", error);
  }
}
run().catch(console.dir);