const express = require("express");
const router = express.Router();
const azureAuthController = require("../../controllers/azure_auth_controller/azureAuthController");

router.get("/token", azureAuthController.getGraphAccessToken);

module.exports = router;
