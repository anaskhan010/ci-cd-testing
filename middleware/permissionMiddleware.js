const jwt = require("jsonwebtoken");
const db = require("../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Check if the path contains a static asset
function isStaticAsset(path) {
  return (
    path.startsWith("/public/") ||
    path.endsWith(".ico") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".svg")
  );
}

// Check Permission Middleware
const checkPermission = async (req, res, next) => {
  console.log("Path here:", req.path);

  // Skip permission check for static assets
  if (isStaticAsset(req.path)) {
    return next();
  }

  // Skip check if there's no authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Exclude routes starting with /patients/
  if (req.path.startsWith("/patients/")) {
    return next();
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;
    const path = req.path;
    const basePath = path.split("/").slice(0, -1).join("/") + "/:id";

    // Query to check for both exact path and base path
    const routeQuery = `
      SELECT r.permission_id, p.permission_name
      FROM routes r
      JOIN permissions p ON r.permission_id = p.permission_id
      WHERE r.path = ? OR r.path = ?`;

    // Execute the first query
    const [routeRows] = await db.query(routeQuery, [path, basePath]);

    if (routeRows.length === 0) {
      return res.status(403).json({
        message: "No permission configured for this route",
      });
    }

    const permissionId = routeRows[0].permission_id;

    // Get user's roles
    const [userRoleRows] = await db.query(
      `SELECT ur.role_id FROM user_role ur WHERE ur.user_id = ?`,
      [userId]
    );

    const roleIds = userRoleRows.map((row) => row.role_id);

    if (roleIds.length === 0) {
      return res.status(403).json({ message: "User has no roles assigned" });
    }

    // Check if any of the user's roles have the required permission
    const [permissionRows] = await db.query(
      `
      SELECT rp.permission_id
      FROM role_permissions rp
      WHERE rp.role_id IN (?) AND rp.permission_id = ?`,
      [roleIds, permissionId]
    );

    if (permissionRows.length > 0) {
      // User has permission
      return next();
    } else {
      // User does not have permission
      return res.status(403).json({
        message: {
          code: "Forbidden",
          error: "You do not have permission to access this page",
          info: "Please contact your admin to get access",
        },
      });
    }
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      // JWT verification error
      return res
        .status(401)
        .json({ message: "Unauthorized", error: error.message });
    } else {
      // Database or other error
      console.error("Error in checkPermission middleware:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
};

module.exports = { checkPermission };
