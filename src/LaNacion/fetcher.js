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
const mongo_collection = 'LaNacion'

const MAX_RETRIES = 50;
const RETRY_DELAY = 1000; // 1 second
async function makeRequestWithBackoff(url, body, retries = 0) {
  try {
    // const response = await axios.post(url, JSON.stringify(body));
    const response = await axios.post(url, body);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 403 && retries < MAX_RETRIES) {
      console.log(`Rate limited. Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return makeRequestWithBackoff(url, body, retries + 1);
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

    let okArray = []

    let continueFetching = true
    let pager = 1
    while (continueFetching) {
      let postBody = {
        "data": "",
        "filters": [
        ],
        "from": pager,
        "sort": "newest",
        "size":50
    }
      await makeRequestWithBackoff(`https://api-club.lanacion.com.ar/api/accounts/search`, postBody)
        .then((res) => {
          console.log(`pager ${pager}`)
          // let resData = res.data
          let resData = res
          if (!resData.data) {
            console.log("end of data", resData)
            continueFetching = false
            return
          }
          if (resData.data.length < 1) {
            console.log("end of data", resData)
            continueFetching = false
            return
          }
          for (let item of resData.data) {
            // console.log("item", item)
            okArray.push(item)
          }
          pager++;
        })
        .catch(error => {
          console.log(`Error fetching data for pager=${pager}: ${error.message}`);
        })
    }
    console.log("okArray length", okArray.length)

    // for (let id of benefitsIds) {
    //   await makeRequestWithBackoff(`https://www.bancociudad.com.ar/beneficios_rest/beneficios/${id}`, {"header":{},"data":{"latitud":null,"longitud":null}})
    //     .then((res) => {
    //       console.log(`Getting benefit ${id}`)
    //       let data = res;
    //       if (data.mensaje !== "OK") throw new Error('Ciudad: reponse not OK')
    //       okArray.push(data.retorno)
    //     })
    //     .catch(error => {
    //       console.log(`Error fetching data for ${id}: ${error.message}`);
    //     })
    // }

    // console.log("okArray", okArray)
    await client.db(mongo_database).collection(mongo_collection).insertMany(okArray)
    // const updateOps = okArray.map((item) => ({
    //   updateOne: {
    //     filter: {"beneficio.id": item.beneficio.id},
    //     update: { $set: item },
    //     upsert: true
    //   }
    // }));
    // const resp = await client.db(mongo_database).collection(mongo_collection).bulkWrite(updateOps)
    // console.log("Data upserted to MongoDB", resp)
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