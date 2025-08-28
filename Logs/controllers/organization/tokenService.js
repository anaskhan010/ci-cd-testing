// tokenService.js
const msal = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
require("dotenv").config();

const config = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

const cca = new msal.ConfidentialClientApplication(config);
const SCOPES = ["https://graph.microsoft.com/.default"];

let accessTokenCache = null;
let tokenExpiry = null;

async function acquireToken() {
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes: SCOPES,
    });
    accessTokenCache = result.accessToken;
    tokenExpiry = Date.now() + (result.expiresIn - 300) * 1000; // 5 minutes buffer
    return accessTokenCache;
  } catch (error) {
    console.error("Error acquiring token:", error);
    throw error;
  }
}

async function getAccessToken() {
  if (!accessTokenCache || Date.now() > tokenExpiry) {
    console.log("Access token expired or not found. Acquiring new token.");
    return await acquireToken();
  }
  return accessTokenCache;
}

async function getAuthenticatedClient() {
  const token = await getAccessToken();
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

module.exports = {
  getAuthenticatedClient,
};
