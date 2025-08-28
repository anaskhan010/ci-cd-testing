const express = require("express");
const auditLog = require("../../middleware/audit_logger");
const {
  createPage,
  getPages,
} = require("../../controllers/pages/pageController");

const router = express.Router();

router.post("/createpage", auditLog("create", "page"), createPage);
router.get("/getallpages", getPages);

module.exports = router;
