const express = require("express");
const auditLog = require("../../middleware/audit_logger");
const {
  rolePagePermission,
  getPagePermissionByRole,
  updateRolePermissions,
} = require("../../controllers/user_role_page_permission/userRolePagePermssionController");

const router = express.Router();

router.post(
  "/createUserRolePagePermission",

  rolePagePermission
);
router.post("/getpageswithrole", getPagePermissionByRole);
router.put(
  "/updaterolepermissions",

  updateRolePermissions
);
module.exports = router;
