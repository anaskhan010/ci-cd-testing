var express = require("express");
var organizationController = require("../../controllers/organization/organizationController");
const router = express.Router();
const auditLog = require("../../middleware/audit_logger");
var multer = require("multer");
var path = require("path");

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

// Create a new Research Hero Personnel
router.post(
  "/createPersonnel",
  upload.single("image"),
  auditLog("create", "organization"),
  organizationController.createPersonnel
);

router.get("/getAllOrganizations", organizationController.getAllOrganizations);

router.get(
  "/getAllOrganizationsRolesUser",
  organizationController.getAllOrganizationsRolesUser
);

router.get(
  "/getAllOrganizationsForInvestigator/:id",
  organizationController.getAllOrganizationsForInvestigator
);

router.get(
  "/getOrganizationById/:id",
  organizationController.getOrganizationById
);

router.get("/getUserDetails/:id", organizationController.getUserDetails);

router.get(
  "/getnoncompliantpatient",
  organizationController.getPatientNonCompliant
);

// get all non-compliant patients for investigator
router.get(
  "/getPatientNonCompliantForInvestigator/:id",
  organizationController.getPatientNonCompliantForInvestigator
);
router.put(
  "/updateOrganization/:id",
  upload.single("image"),
  auditLog("update", "organization"),
  organizationController.updateOrganization
);
router.delete(
  "/deleteOrganization/:id",
  auditLog("delete", "organization"),
  organizationController.deleteOrganization
);

router.put("/update-password", organizationController.updatePassword);

// =============================organization details  Routes============================

router.post(
  "/createOrganizationDetails",
  auditLog("create ", "organization details"),
  organizationController.createOrganizationDetails
);
router.get(
  "/getAllOrganizationsDetails",

  organizationController.getAllOrganizationsDetails
);

router.put(
  "/updateOrganizationDetails",
  auditLog("update", "organization details"),
  organizationController.updateOrganizationDetails
);
router.get("/getFile/:user_id", organizationController.getTLFBMasterViewLink);

router.get(
  "/get_site/:user_id",
  organizationController.getOrganizationByUserIdController
);

module.exports = router;
