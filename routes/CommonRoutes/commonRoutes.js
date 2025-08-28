const organizationController = require("../../controllers/organization/organizationController");
const registrationmanagementController = require("../../controllers/userRegistrationManagement/registrationManagementController");
var express = require("express");

const auditLog = require("../../middleware/audit_logger");
var multer = require("multer");
var path = require("path");
var router = express.Router();

// Configure multer storage
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/patients"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

var upload = multer({ storage: storage });

router.post(
  "/createOrganization",
  upload.single("image"),
  auditLog("create", "organization"),
  organizationController.createOrganization
);
router.post("/forgotPassword", organizationController.forgotPassword);
router.post("/verifyOtp", organizationController.verifyOtp);
router.post("/resetPassword", organizationController.resetPassword);
router.post("/logout", organizationController.logoutController);

router.get(
  "/get-all-count-status",
  registrationmanagementController.getAllCountStatusController
);

router.get("/reasons", organizationController.getReasonDescriptionController);

module.exports = router;
