require("dotenv").config();
const axios = require('axios');
const {
  MongoClient,
  ServerApiVersion
} = require("mongodb");
const fs = require("fs");
let https;
try {
  https = require('node:https');
} catch (err) {
  console.error('https support is disabled!');
}
const isLocal = false;
var mongoUrl = '';
if (isLocal) {
  mongoUrl = "mongodb://localhost:27017/?maxPoolSize=20&w=majority";
} else {
  mongoUrl = process.env.MONGO_URL;
}

const mongo_database = 'Benefits'
const mongo_collection = 'ICBC'

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const MAX_RETRIES = 50;
const RETRY_DELAY = 1000; // 1 second
async function makeRequestWithBackoff(url, retries = 0) {
  try {
    const response = await axios.get(url, { httpsAgent });
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
    await client.connect();
    console.log("client connected")

    let benefitsIds = [];
    let okArray = []

    let continueFetching = true
    let pager = 1
    while (continueFetching) {
      await makeRequestWithBackoff(`https://api-prod-icbc.pisol.net/beneficios/list?filter={}&num_page=${pager}&row_by_page=100`)
        .then((res) => {
          console.log(`pager ${pager}`)
          // let resData = res.data
          let resData = res
          if (resData.status.code !== 200) {
            console.log("end of data", resData)
            continueFetching = false
            return
          }
          for (let item of resData.response?.beneficio_data) {
            console.log("item", item)
            for (let beneficio of item) {
              okArray.push(beneficio)
            }
          }
          pager++;
        })
        .catch(error => {
          console.log(`Error fetching data for pager=${pager}: ${error.message}`);
        })
    }

    console.log("okArray", okArray)
    await client.db(mongo_database).collection(mongo_collection).insertMany(okArray)
    fs.writeFile('temp/okFile.json', JSON.stringify(okArray), function (err) {
      if (err) throw err;
      console.log('Array saved to file!');
      process.exit();
    });
  } catch (error) {
    console.log("error ICBC", error);
  }
}
run().catch(console.dir);