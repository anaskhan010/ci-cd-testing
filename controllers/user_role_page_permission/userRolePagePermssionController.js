const userRolePagePermissionModel = require("../../models/user_role_page_permission/userRolePagePermissionModel.js");
const auditLog = require("../../middleware/audit_logger.js");
exports.rolePagePermission = async function (req, res) {
  const { user_id, role_name, userrolepagepermission } = req.body;
  console.log("Request Body:", req.body); // Add this line for logging

  try {
    var result = await userRolePagePermissionModel.createRolewithPagePermission(
      user_id,
      role_name,
      userrolepagepermission
    );
    console.log("Result:", result); // Add this line for logging
    res.status(201).json(result);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getPagePermissionByRole = async function (req, res) {
  try {
    var roleid = req.body.roleid;
    console.log(roleid);

    var result = await userRolePagePermissionModel.getPageandPermissionbyRoleid(
      roleid
    );

    res.status(200).json({ success: true, message: " successfully", result });
  } catch (error) {
    console.error("Error deleting user by ID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// =================================================

// update user_role_page_permission
exports.updateRolePermissions = async function (req, res) {
  var { roleid, selectedPermissions } = req.body;
  console.log(selectedPermissions, "selectedPermissions");

  if (!roleid || !Array.isArray(selectedPermissions)) {
    return res.status(400).json({
      message:
        "Invalid input. Ensure roleid and selectedPermissions are provided.",
      missingFields: {
        roleid: !!roleid,
        selectedPermissions: Array.isArray(selectedPermissions),
      },
    });
  }

  try {
    // Fetch existing permissions for audit logging
    const oldPermissions = await userRolePagePermissionModel.getRolePermissions(
      roleid
    );

    if (!oldPermissions) {
      return res.status(404).json({ message: "Role permissions not found." });
    }

    // Update role permissions in the database
    var result = await userRolePagePermissionModel.updateRolePermissions(
      roleid,
      selectedPermissions
    );

    console.log(result, "result");

    // Prepare data for audit log
    const newPermissions = {
      roleid,
      selectedPermissions,
    };

    // Log the update operation
    auditLog(
      "UPDATE",
      "RolePermissions",
      oldPermissions, // Old permissions before the update
      newPermissions, // Updated permissions
      "Role permissions updated successfully"
    )(req, res, () => {});

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating role permissions:", error.message);

    // Log the error in audit log
    auditLog(
      "UPDATE_ERROR",
      "RolePermissions",
      { roleid, selectedPermissions }, // Data attempted to update
      null, // No new value due to error
      `Error updating role permissions: ${error.message}`
    )(req, res, () => {});

    res.status(500).json({ error: error.message });
  }
};
