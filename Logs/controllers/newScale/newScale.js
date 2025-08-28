const scaleModel = require("../../models/newScales/newScalesModel");
const pool = require("../../config/DBConnection3");
const db = require("../../config/DBConnection3");
const util = require("util");
const auditLog = require("../../middleware/audit_logger");

const createScale = async (req, res) => {
  try {
    // Get data from the request body
    const scaleData = req.body;

    const checkScaleName = await scaleModel.checkScale();
    const scaleNames = checkScaleName[0].map((row) => row.scale_name);
    if (scaleNames.includes(scaleData.scale_name)) {
      return res.status(400).json({ message: "Scale name already exists" });
    }

    // If these top-level fields are missing, make them null or arrays so they're not "undefined"
    scaleData.role_id = scaleData.role_id ?? null;
    scaleData.study_id = scaleData.study_id ?? null;
    scaleData.translations = Array.isArray(scaleData.translations)
      ? scaleData.translations
      : [];
    scaleData.sections = Array.isArray(scaleData.sections)
      ? scaleData.sections
      : [];

    // Insert the scale and related data
    const scaleId = await scaleModel.createScale(scaleData);

    // Log the scale creation
    auditLog(
      "CREATE",
      "Scale",
      null, // No old value since it's a new scale
      {
        scale_id: scaleId,
        role_id: scaleData.role_id,
        study_id: scaleData.study_id,
        translations: scaleData.translations,
        sections: scaleData.sections,
      },
      "New scale created successfully"
    )(req, res, () => {});

    // Send a successful response
    res.status(201).json({ message: "Scale created successfully", scaleId });
  } catch (error) {
    console.error("Error creating scale:", error);

    // Check if this is a duplicate scale name error
    if (error.statusCode === 400) {
      // Log the duplicate name error
      auditLog(
        "CREATE_ERROR",
        "Scale",
        null,
        { error: error.message, scaleData },
        `Scale creation failed: ${error.message}`
      )(req, res, () => {});

      return res.status(400).json({ message: error.message });
    }

    // Log the error
    auditLog(
      "CREATE_ERROR",
      "Scale",
      null,
      { error: error.message },
      `Scale creation failed: ${error.message}`
    )(req, res, () => {});

    // Send a generic error response for other errors
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getScaleById = async (req, res) => {
  let connection;
  try {
    // Extract scale ID and language code from the request
    const scaleId = req.params.id;
    const languageCode = req.query.language_code;

    // Input validation
    if (!scaleId || !languageCode) {
      return res
        .status(400)
        .json({ message: "Scale ID and language code are required" });
    }

    // Fetch the scale data
    const scaleData = await scaleModel.getScaleById(scaleId, languageCode);

    if (!scaleData) {
      return res.status(404).json({ message: "Scale not found" });
    }

    res.status(200).json(scaleData);
  } catch (error) {
    console.error("Error fetching scale:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Add this new function after getScaleById

const updateScale = async (req, res) => {
  try {
    // Get scale ID from URL parameters
    const scaleId = req.params.id;

    // Get updated data from request body
    const scaleData = req.body;

    // Validate scale ID
    if (!scaleId) {
      return res.status(400).json({ message: "Scale ID is required" });
    }

    // Check if scale exists
    const [scaleExists] = await db.query(
      "SELECT scale_id FROM scale WHERE scale_id = ?",
      [scaleId]
    );

    if (scaleExists.length === 0) {
      return res.status(404).json({ message: "Scale not found" });
    }

    // Fetch the old scale data for audit logging
    // We'll use the first language code from the new data, or default to 'en'
    const languageCode =
      scaleData.translations && scaleData.translations.length > 0
        ? scaleData.translations[0].language_code
        : "en";

    const oldScaleData = await scaleModel.getScaleById(scaleId, languageCode);

    // Update the scale
    await scaleModel.updateScale(scaleId, scaleData);

    // Prepare data for audit logging
    // We'll compare the old and new values to track what changed
    const oldValue = {
      scale_id: oldScaleData.scale_id,
      role_id: oldScaleData.role_id,
      study_id: oldScaleData.study_id,
      scale_name: oldScaleData.scale_name,
      translations: oldScaleData.translations || [],
      sections: oldScaleData.sections || [],
    };

    const newValue = {
      scale_id: scaleId,
      role_id: scaleData.role_id,
      study_id: scaleData.study_id,
      scale_name: scaleData.scale_name,

      translations: scaleData.translations || [],
      sections: scaleData.sections || [],
    };

    // Log the scale update
    auditLog(
      "UPDATE",
      "Scale",
      oldValue,
      newValue,
      "Scale updated successfully"
    )(req, res, () => {});

    // Send success response
    res.status(200).json({
      message: "Scale updated successfully",
      scaleId,
    });
  } catch (error) {
    console.error("Error updating scale:", error);

    // Check if this is a duplicate scale name error
    if (error.statusCode === 400) {
      // Log the duplicate name error
      auditLog(
        "UPDATE_ERROR",
        "Scale",
        null,
        {
          error: error.message,
          scale_id: scaleId,
          scaleData,
        },
        `Scale update failed: ${error.message}`
      )(req, res, () => {});

      return res.status(400).json({ message: error.message });
    }

    // Log the error
    auditLog(
      "UPDATE_ERROR",
      "Scale",
      null,
      {
        error: error.message,
        scale_id: scaleId,
      },
      `Scale update failed: ${error.message}`
    )(req, res, () => {});

    // Send a generic error response for other errors
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update the module.exports to include the new function
module.exports = {
  createScale,
  getScaleById,
  updateScale,
};
