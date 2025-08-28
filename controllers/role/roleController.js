const RoleModel = require("../../models/role/roleModel");
const { body, param, validationResult } = require("express-validator");

// get all roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await RoleModel.getAllRoles();
    res.status(200).json({ roles });
  } catch (err) {
    console.log("Error fetching roles:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get user role by user id
const getUserRole = async (userId) => {
  try {
    const role = await RoleModel.getUserRole(userId);
    return role;
  } catch (err) {
    throw err;
  }
};

// create role with permissions
const createRoleWithPermissions = async (req, res) => {
  try {
    const { roleName, permissions } = req.body;

    if (!roleName || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        message:
          "Invalid input. Please provide a role name and an array of permission IDs.",
      });
    }

    const result = await RoleModel.createRoleWithPermissions(
      roleName,
      permissions
    );

    return res.status(201).json({
      message: "Role created successfully with assigned permissions",
      role: result,
    });
  } catch (error) {
    console.error("Error creating role with permissions:", error);
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

// update role permissions
const updateRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!roleId || !Array.isArray(permissions)) {
      return res
        .status(400)
        .json({
          message:
            "Invalid input. Please provide a role ID and an array of permission IDs.",
        });
    }

    const result = await RoleModel.updateRolePermissions(roleId, permissions);

    return res.status(200).json({
      message: "Role permissions updated successfully",
      role: result,
    });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({ message: "Role ID is required" });
    }

    const result = await RoleModel.deleteRole(roleId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting role:", error);
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

module.exports = {
  getAllRoles,
  getUserRole,
  createRoleWithPermissions,
  updateRolePermissions,
  deleteRole,
};
