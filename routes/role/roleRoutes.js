const roleController = require("../../controllers/role/roleController");
const express = require("express");
const auditLog = require("../../middleware/audit_logger");
const router = express.Router();

// router.post(
//   "/createRole",
//   auditLog("create", "role"),
//   roleController.createRole
// );
// router.delete(
//   "/deleteRole/:id",
//   auditLog("delete", "role"),
//   roleController.deleteRole
// );

router.get("/getRole/:id", roleController.getUserRole);
router.get("/getAllRoles", roleController.getAllRoles);
router.post(
  "/createRoleWithPermissions",
  auditLog("create", "role"),
  roleController.createRoleWithPermissions
);

router.put(
  "/updateRolePermissions/:roleId",
  roleController.updateRolePermissions
);
router.delete(
  "/deleteRole/:roleId",
  auditLog("delete", "role"),
  roleController.deleteRole
);

module.exports = router;
