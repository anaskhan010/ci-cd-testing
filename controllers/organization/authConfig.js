// authConfig.js
const msal = require("@azure/msal-node");
require("../../config/Config.env").dotenv();

const config = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID, // Application (client) ID
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`, // Tenant ID
    clientSecret: process.env.AZURE_CLIENT_SECRET, // Client Secret
  },
};

const cca = new msal.ConfidentialClientApplication(config);

module.exports = cca;
