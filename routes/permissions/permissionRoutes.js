const express = require("express");

const permissionController = require("../../controllers/permissions/permissionController");
const auditLog = require("../../middleware/audit_logger");
const router = express.Router();

router.get("/getAllPermissions", permissionController.getAllPermissions);
router.get(
  "/getPermission/:roleId",
  permissionController.getPermissionsByRoleId
);

module.exports = router;

// router.post(
//   "/createPermission",
//   auditLog("create", "permission"),
//   permissionController.createPermission
// );

// router.post("/createRoute", permissionController.createRoute);
// router.get("/getAllPermission", permissionController.getPermissions);
// router.get("/getAllRoutes", permissionController.getAllRoutes);
