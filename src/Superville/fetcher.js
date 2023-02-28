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
const mongo_collection = 'Superville'

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br',
  'Content-Type': 'application/json'
};

const MAX_RETRIES = 50;
const RETRY_DELAY = 1000; // 1 second
async function makeRequestWithBackoff(url, retries = 0) {
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.log(error)
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

    for (let identite of ["false", "true"]) {
      console.log(`Fetching Identité ${identite}`)
      let rubros = [];
      await makeRequestWithBackoff(`https://www.supervielle.com.ar/api/rubros/?esIdentite=${identite}`)
        .then((res) => {
          rubros = res.rubros
        })
        .catch(error => {
          console.log(`Error fetching rubros for identite=${identite}: ${error.message}`);
        })

      for (let rubroObject of rubros) {
        let rubro = rubroObject.nombre
        await makeRequestWithBackoff(`https://www.supervielle.com.ar/api/beneficios?rubro=${rubro}&esIdentite=${identite}`)
          .then((res) => {
            console.log(`rubro ${rubro}`)
            let resData = res
            if (resData.codigo !== "OK" || resData.beneficios.length < 1) {
              console.log("end of data", resData)
              continueFetching = false
              return
            }
            for (let item of resData.beneficios) {
              // console.log("item", item)
              okArray.push(item)
            }
          })
          .catch(error => {
            console.log(`Error fetching data for rubro=${rubro}: ${error.message}`);
          })
      }
    }


    // console.log("okArray", okArray)
    // await client.db(mongo_database).collection(mongo_collection).insertMany(okArray)
    const updateOps = okArray.map((item) => ({
      updateOne: {
        filter: {"beneficio_data.beneficio_id": item.id},
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
    console.log("error ICBC", error);
  }
}
run().catch(console.dir);