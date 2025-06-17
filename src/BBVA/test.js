const axios = require("axios");

async function testBackend() {
  try {
    // Replace with your backend URL
    const response = await axios.get("http://localhost:3000/temp/okFile.json");
    console.log("File fetched successfully:");
    console.log(response.data);
  } catch (error) {
    console.error("Error fetching file:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

testBackend();