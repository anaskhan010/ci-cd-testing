const express = require("express");
const registrationManagementController = require("../../controllers/userRegistrationManagement/registrationManagementController");
const auditLog = require("../../middleware/audit_logger");
const router = express.Router();

router.get("/accepted", registrationManagementController.getAllAcceptedStatus);
router.get("/pending", registrationManagementController.getAllPendingStatus); // for dashboard
router.get("/pendingusers", registrationManagementController.getPendingUsersController); // for user management 
router.get("/disabled", registrationManagementController.getAllDisableStatusController);
router.get("/blocked", registrationManagementController.getAllBlockedStatusController);
router.put(
  "/updateStatus/:id",
  auditLog("update", "update registration status "),
  registrationManagementController.updateRegistrationStatus
);
router.get(
  "/awaiting_disable",
  registrationManagementController.getAllAwaitingStatus
);
module.exports = router;
