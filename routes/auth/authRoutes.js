var express = require("express");
const organizationController = require("../../controllers/organization/organizationController.js");

var router = express.Router();

router.post(
  "/signin",
  organizationController.signinOrganization
);

module.exports = router;
