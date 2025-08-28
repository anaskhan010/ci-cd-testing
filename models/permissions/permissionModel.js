const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Get all permissions
const getAllPermissions = async () => {
  try {
    const query = "SELECT * FROM permissions";
    const [result] = await db.query(query);
    return result;
  } catch (err) {
    throw { status: 500, message: "Error fetching permissions" };
  }
};

// Get permissions by role ID
const getPermissionsByRoleId = async (roleId) => {
  try {
    const query = `
      SELECT p.permission_id, p.permission_name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.permission_id
      WHERE rp.role_id = ?
    `;
    const [result] = await db.query(query, [roleId]);
    return result;
  } catch (err) {
    throw {
      status: 500,
      message: "Error fetching permissions for role",
    };
  }
};

module.exports = {
  getAllPermissions,
  getPermissionsByRoleId,
};
