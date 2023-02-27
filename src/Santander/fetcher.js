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
var convert = require('xml-js');
const isLocal = false;
var mongoUrl = '';
if (isLocal) {
  mongoUrl = "mongodb://localhost:27017/?maxPoolSize=20&w=majority";
} else {
  mongoUrl = process.env.MONGO_URL;
}

const mongo_database = 'Benefits'
const mongo_collection = 'Santander'

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const MAX_RETRIES = 50;
const RETRY_DELAY = 1000; // 1 second
async function makeRequestWithBackoff(url, retries = 0) {
  try {
    const response = await axios.get(url, {
      httpsAgent
    });
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

// var parser = new xml2js.Parser();

async function run() {
  console.log("app start")
  try {
    const client = new MongoClient(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1
    });
    await client.connect();
    console.log("client connected")

    let benefitsIds = [];
    let okArray = []

    let continueFetching = true
    let pager = 0
    while (continueFetching) {
      await makeRequestWithBackoff(`https://www.santander.com.ar/banco/contenthandler/searchfeed/search?sortKey=sortdestdefault&sortOrder=asc&index=search_service_portal::/aplicaciones/tsr/collections/catalogo&query=*&start=${100*pager}&results=100`)
        .then((res) => {
          console.log(`pager ${pager}`)
          let resData = res
          var result1 = convert.xml2js(resData, {
            compact: true,
            spaces: 2,
            ignoreDeclaration: true
          });
          if (!result1["atom:feed"]["atom:entry"]) {
            console.log("end of data", result1)
            continueFetching = false
            return
          }
          let stringified = JSON.stringify(result1);
          stringified = stringified.replaceAll("atom:", "")
          stringified = stringified.replaceAll("xmlns:", "")
          stringified = stringified.replaceAll("wplc:", "")
          stringified = stringified.replaceAll("opensearch:", "")
          let jsonified = JSON.parse(stringified)
          for (let item of jsonified.feed.entry) {
            item.id = item.id._text
            item.title = item.title._text
            item.relevance = item.relevance._text
            item.updated = item.updated._text
            item.category = item.category._attributes
            item.summary = item.summary._cdata
            let tempField = {};
            for (let field of item.field) {
              if (!tempField[field._attributes.id]) tempField[field._attributes.id] = []
              tempField[field._attributes.id].push(field._text)
            }
            item.field = tempField
            okArray.push(item)
          }
          pager++;
        })
        .catch(error => {
          console.log(`Error fetching data for pager=${pager}: ${error.message}`);
        })
    }

    // console.log("okArray", okArray)
    await client.db(mongo_database).collection(mongo_collection).insertMany(okArray)
    fs.writeFile('temp/okFile.json', JSON.stringify(okArray), function (err) {
      if (err) throw err;
      console.log('Array saved to file!');
      process.exit();
    });
  } catch (error) {
    console.log("error Santander", error);
  }
}
run().catch(console.dir);