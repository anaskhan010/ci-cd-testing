const express = require("express");
const emailManagementController = require("../../controllers/emailManagementController/emailManagementController");

const router = express.Router();
router.post("/email_type", emailManagementController.createEmailTypeController);
router.get("/email_type", emailManagementController.getAllEmailTypesController);

router.get("/personels", emailManagementController.getAllPersonelController);
router.get(
  "/email-notification",
  emailManagementController.getAllNotificationByPersonelIdController
);

router.put(
  "/update-email-notification",
  emailManagementController.updateNotificationEnableDisableController
);

module.exports = router;
