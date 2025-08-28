const axios = require("axios");
require("dotenv").config();

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

async function getAccessTokenForGraph() {
  try {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const response = await axios.post(url, data.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error("Failed to fetch access token:", error.message);
    // Return a default value or null to avoid crashing the application
    return null;
  }
}

module.exports = {
  getAccessTokenForGraph,
};
