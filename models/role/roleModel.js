const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Get All Roles
const getAllRoles = async () => {
  try {
    const query = "SELECT * FROM role";
    const [result] = await db.query(query);
    return result;
  } catch (err) {
    throw { status: 500, message: "Error fetching roles" };
  }
};

// Get User Role
const getUserRole = async (userId) => {
  try {
    const query =
      "SELECT ur.role_id, r.role_name FROM user_role AS ur JOIN role AS r ON ur.role_id = r.role_id WHERE user_id = ?";
    const [result] = await db.query(query, [userId]);
    if (result.length === 0) {
      throw { status: 404, message: "User has no role" };
    }
    return result[0];
  } catch (err) {
    if (err.status && err.message) {
      throw err; // Re-throw custom errors
    } else {
      throw { status: 500, message: "Error fetching role" };
    }
  }
};

// Create a new role with permissions
const createRoleWithPermissions = async (roleName, permissionIds) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Insert new role
    const insertRoleQuery = "INSERT INTO role (role_name) VALUES (?)";
    const [result] = await connection.query(insertRoleQuery, [roleName]);
    const roleId = result.insertId;

    // Insert role permissions
    const insertPermissionsQuery =
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ?";
    const values = permissionIds.map((permissionId) => [roleId, permissionId]);

    await connection.query(insertPermissionsQuery, [values]);

    await connection.commit();

    return { roleId, roleName, permissionIds };
  } catch (err) {
    await connection.rollback();
    if (err.status && err.message) {
      throw err;
    } else {
      throw {
        status: 500,
        message: "Error creating new role or assigning permissions",
      };
    }
  } finally {
    connection.release();
  }
};

// Update Role Permissions based on Selection of Permission
const updateRolePermissions = async (roleId, permissionIds) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Delete existing permissions for the role
    const deleteQuery = "DELETE FROM role_permissions WHERE role_id = ?";
    await connection.query(deleteQuery, [roleId]);

    // Insert new permissions
    const insertQuery =
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ?";
    const values = permissionIds.map((permissionId) => [roleId, permissionId]);

    await connection.query(insertQuery, [values]);

    await connection.commit();

    return { roleId, updatedPermissions: permissionIds };
  } catch (err) {
    await connection.rollback();
    if (err.status && err.message) {
      throw err;
    } else {
      throw {
        status: 500,
        message: "Error updating role permissions",
      };
    }
  } finally {
    connection.release();
  }
};

// Delete Role
const deleteRole = async (roleId) => {
  try {
    const query = "DELETE FROM role WHERE role_id = ?";
    const [result] = await db.query(query, [roleId]);
    if (result.affectedRows === 0) {
      throw { status: 404, message: "Role not found" };
    }
    return { message: "Role deleted successfully" };
  } catch (err) {
    if (err.status && err.message) {
      throw err;
    } else {
      throw { status: 500, message: "Error deleting role" };
    }
  }
};

module.exports = {
  getAllRoles,
  getUserRole,
  createRoleWithPermissions,
  updateRolePermissions,
  deleteRole,
};
