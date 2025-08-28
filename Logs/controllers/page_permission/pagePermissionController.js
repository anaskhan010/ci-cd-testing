const pagePermissionModel = require("../../models/pages_permission/pagePermissionModel");
const auditLog = require("../../middleware/audit_logger.js");
// Create a new page
// Create a new page (now accepts page_order)
const createPageController = async (req, res) => {
  const {
    page_name,
    temp_page_name,
    route,
    icon,
    label,
    data_tour,
    page_order,
  } = req.body;

  // Validate required fields (page_order is optional)
  if (
    !page_name ||
    !temp_page_name ||
    !route ||
    !icon ||
    !label ||
    !data_tour
  ) {
    return res.status(400).json({
      message:
        "Missing required fields. Please ensure all fields are provided.",
      missingFields: {
        page_name: !!page_name,
        temp_page_name: !!temp_page_name,
        route: !!route,
        icon: !!icon,
        label: !!label,
        data_tour: !!data_tour,
      },
    });
  }

  try {
    const result = await pagePermissionModel.createPage(
      page_name,
      temp_page_name,
      route,
      icon,
      label,
      data_tour,
      page_order // will default to 0 in model if undefined
    );

    const newPageData = {
      page_name,
      temp_page_name,
      route,
      icon,
      label,
      data_tour,
      page_order,
    };

    auditLog(
      "CREATE",
      "Page",
      null,
      newPageData,
      "New page created successfully"
    )(req, res, () => {});
    res.status(200).json({ message: "Page created successfully", result });
  } catch (error) {
    console.error("Error creating page:", error);
    auditLog(
      "CREATE_ERROR",
      "Page",
      null,
      { page_name, temp_page_name, route, icon, label, data_tour, page_order },
      `Error creating page: ${error.message}`
    )(req, res, () => {});
    res.status(400).json({ message: "Error creating page", error });
  }
};

// New: Update page order controller
const updatePageOrderController = async (req, res) => {
  const { pages } = req.body; // expects an array of objects: [{ page_id, page_order }, ...]
  if (!Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({
      message: "Invalid input. 'pages' should be a non-empty array.",
    });
  }
  try {
    const result = await pagePermissionModel.updatePageOrder(pages);
    res
      .status(200)
      .json({ message: "Page order updated successfully", result });
  } catch (error) {
    console.error("Error updating page order:", error);
    res
      .status(400)
      .json({ message: "Error updating page order", error: error.message });
  }
};

// Assign pages to a role based on study_id
const submitPagePermissionController = async (req, res) => {
  const { study_id, role_id, page_ids } = req.body; // Expects page_ids as an array

  if (
    !study_id ||
    !role_id ||
    !Array.isArray(page_ids) ||
    page_ids.length === 0
  ) {
    return res.status(400).json({
      message:
        "Invalid input. Ensure study_id, role_id, and page_ids are provided.",
      missingFields: {
        study_id: !!study_id,
        role_id: !!role_id,
        page_ids: Array.isArray(page_ids) && page_ids.length > 0,
      },
    });
  }

  try {
    // Call the model function to create page permissions
    const result = await pagePermissionModel.createPagePermissionModel(
      study_id,
      role_id,
      page_ids
    );

    // Prepare data for the audit log
    const newPermissionData = {
      study_id,
      role_id,
      page_ids,
    };

    // Log the creation of page permissions
    auditLog(
      "CREATE",
      "PagePermission",
      null, // No old value as this is a new creation
      newPermissionData, // New data
      "Page permissions created successfully"
    )(req, res, () => {});

    res.status(200).json({
      message: "Pages with permissions created successfully",
      result,
    });
  } catch (error) {
    console.error("Error creating page permissions:", error);

    // Log the error in audit log
    auditLog(
      "CREATE_ERROR",
      "PagePermission",
      { study_id, role_id, page_ids }, // Data that failed to create
      null, // No new value as this is a failed attempt
      `Error creating page permissions: ${error.message}`
    )(req, res, () => {});

    res.status(400).json({
      message: "Error creating page permissions",
      error: error.message,
    });
  }
};

// Get pages assigned to a role for a specific study
const getSubmitPagewithPermissionController = async (req, res) => {
  try {
    const { study_id, role_id } = req.params;
    if (!study_id || !role_id) {
      return res
        .status(400)
        .json({ message: "Study ID and Role ID are required" });
    }

    console.log("studyid", study_id);
    console.log("roleid", role_id);
    const results = await pagePermissionModel.getSubmitPageswithPermission(
      study_id,
      role_id
    );
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No pages found for this role and study" });
    }
    res.status(200).json({
      message: "Assigned pages retrieved successfully",
      pages: results,
    });
  } catch (error) {
    console.error("Error in getSubmitPagewithPermissionController:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update page permissions for a role and study
// const updatePagePermissionController = async (req, res) => {
//   const { study_id, role_id } = req.params;
//   const { page_ids } = req.body; // Expects page_ids as an array

//   if (!Array.isArray(page_ids) || page_ids.length === 0) {
//     return res.status(400).json({
//       message:
//         "Invalid input. Ensure page_ids is provided as a non-empty array.",
//       missingFields: {
//         page_ids: Array.isArray(page_ids) && page_ids.length > 0,
//       },
//     });
//   }

//   try {
//     // Fetch existing permissions for audit logging
//     const oldPermissions =
//       await pagePermissionModel.getSubmitPageswithPermission(study_id, role_id);

//     console.log(oldPermissions, "==========old permission===========");

//     if (!oldPermissions) {
//       return res.status(404).json({ message: "Page permissions not found." });
//     }

//     const oldPageIds = oldPermissions.map((permission) => permission.page_id);

//     // Update page permissions in the database
//     const result = await pagePermissionModel.updatePagePermission(
//       study_id,
//       role_id,
//       page_ids
//     );

//     // Prepare data for the audit log
//     // const newPermissions = {
//     //   study_id,
//     //   role_id,
//     //   page_ids,
//     // };

//     const removedPageIds = oldPageIds.filter(
//       (pageId) => !page_ids.includes(pageId)
//     );
//     // IDs added in the new permissions
//     const addedPageIds = page_ids.filter(
//       (pageId) => !oldPageIds.includes(pageId)
//     );

//     const changedFieldsOld = {};
//     const changedFieldsNew = {};

//     if (removedPageIds.length > 0 || addedPageIds.length > 0) {
//       changedFieldsOld.page_ids = removedPageIds;
//       changedFieldsNew.page_ids = addedPageIds;
//     }

//     // Log the update operation if there's any change
//     if (Object.keys(changedFieldsNew).length > 0) {
//       auditLog(
//         "UPDATE",
//         "PagePermission",
//         changedFieldsOld, // Old values for changed fields
//         changedFieldsNew, // New values for changed fields
//         "Page permissions updated successfully"
//       )(req, res, () => {});
//     }

//     // Log the update operation
//     auditLog(
//       "UPDATE",
//       "PagePermission",
//       changedFieldsOld, // Old permissions before the update
//       changedFieldsNew, // Updated permissions
//       "Page permissions updated successfully"
//     )(req, res, () => {});

//     res.status(200).json({
//       message: "Page permissions updated successfully",
//       result,
//     });
//   } catch (error) {
//     console.error("Error updating page permissions:", error);

//     // Log the error in audit log
//     auditLog(
//       "UPDATE_ERROR",
//       "PagePermission",
//       { study_id, role_id, page_ids }, // Data attempted to update
//       null, // No new value due to error
//       `Error updating page permissions: ${error.message}`
//     )(req, res, () => {});

//     res.status(400).json({
//       message: "Error updating page permissions",
//       error: error.message,
//     });
//   }
// };

const updatePagePermissionController = async (req, res) => {
  const { study_id, role_id } = req.params;
  const { page_ids } = req.body; // Expects page_ids as an array

  if (!Array.isArray(page_ids) || page_ids.length === 0) {
    return res.status(400).json({
      message:
        "Invalid input. Ensure page_ids is provided as a non-empty array.",
      missingFields: {
        page_ids: Array.isArray(page_ids) && page_ids.length > 0,
      },
    });
  }

  try {
    // Fetch the current (old) permissions with full details
    const oldPermissions =
      await pagePermissionModel.getSubmitPageswithPermission(study_id, role_id);
    if (!oldPermissions || oldPermissions.length === 0) {
      return res.status(404).json({ message: "Page permissions not found." });
    }

    // Compute differences based on IDs (optional)
    const oldPageIds = oldPermissions.map((permission) => permission.page_id);
    const removedPageIds = oldPageIds.filter((id) => !page_ids.includes(id));
    const addedPageIds = page_ids.filter((id) => !oldPageIds.includes(id));

    // Update page permissions in the database
    const result = await pagePermissionModel.updatePagePermission(
      study_id,
      role_id,
      page_ids
    );

    // Fetch full details for the new page_ids
    const newPermissions = await pagePermissionModel.getPagesByIds(page_ids);

    // Prepare audit log data with complete details for both old and new permissions
    const auditOldValue = {
      permissions: oldPermissions,
      differences: { removedPageIds },
    };
    const auditNewValue = {
      permissions: newPermissions,
      differences: { addedPageIds },
    };

    // Log a single audit entry for the update operation
    auditLog(
      "UPDATE",
      "PagePermission",
      auditOldValue, // Old data snapshot with details
      auditNewValue, // New data snapshot with details
      "Page permissions updated successfully"
    )(req, res, () => {});

    res.status(200).json({
      message: "Page permissions updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error updating page permissions:", error);
    auditLog(
      "UPDATE_ERROR",
      "PagePermission",
      { study_id, role_id, page_ids },
      null,
      `Error updating page permissions: ${error.message}`
    )(req, res, () => {});
    res.status(400).json({
      message: "Error updating page permissions",
      error: error.message,
    });
  }
};

// get All Pages
const getAllPages = async (req, res) => {
  try {
    const result = await pagePermissionModel.getAllPages();
    res.status(200).json({ result });
  } catch (error) {
    res.status(400).json(error);
  }
};

module.exports = {
  getAllPages,
  createPageController,
  submitPagePermissionController,
  getSubmitPagewithPermissionController,
  updatePagePermissionController,
  updatePageOrderController,
};
