const PermissionModel = require("../../models/permissions/permissionModel");

// get all permissions
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await PermissionModel.getAllPermissions();
    return res.status(200).json({ permissions });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// get permissions by role id
const getPermissionsByRoleId = async (req, res) => {
  try {
    const { roleId } = req.params;
    console.log("Here's our role Id: ", roleId);
    const permissions = await PermissionModel.getPermissionsByRoleId(roleId);
    return res.status(200).json({ permissions });
  } catch (error) {
    console.error("Error fetching permissions for role:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getAllPermissions,
  getPermissionsByRoleId,
};

// const { body, validationResult } = require("express-validator");
// const permissionModel = require("../../models/permissions/permissionModel");

// // Validation rules
// const validateCreatePermission = [
//   body("permission_name").notEmpty().withMessage("Permission name is required"),
// ];

// // Middleware to handle validation errors
// const handleValidationErrors = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }
//   next();
// };

// // Create a new permission
// const createPermission = async (req, res) => {
//   try {
//     const permission_name = req.body.permission_name;
//     const result = await permissionModel.createPermission(permission_name);
//     res
//       .status(201)
//       .json({ message: "Permission created successfully", result });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// // Create Route
// const createRoute = async (req, res) => {
//   try {
//     const path = req.body.path;
//     const permission_name = req.body.permission_name;
//     const result = await permissionModel.createRoute(path, permission_name);
//     res.status(201).json({
//       message: "Route created and permission assigned successfully",
//       result,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// // Get all permissions
// const getPermissions = async (req, res) => {
//   try {
//     const result = await permissionModel.getPermissions();
//     res.status(200).json(result); // Changed to 200 for successful GET request
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// const getAllRoutes = async (req, res) => {
//   try {
//     const result = await permissionModel.getAllRoutes();
//     res.status(200).json(result); // Changed to 200 for successful GET request
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// module.exports = {
//   createPermission: [
//     validateCreatePermission,
//     handleValidationErrors,
//     createPermission,
//   ],
//   createRoute,
//   getPermissions,
//   getAllRoutes,
// };
