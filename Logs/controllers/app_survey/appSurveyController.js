const {
  createSurveyQuestions,
  getSurveyQuestions,
  submitSurveyResponse,
  getSurveyDetails,
  getAllSurveys,
  getAllSurveysForInvestigator,
  getSurveysByUserId,
  deleteSurveyById,
  createScale,
  getScale,
  scaleCount,
  getAllScales,
  getAllScaleName,
  getScaleByScaleid,
  submitSurveyResponseForPortal,
  getScalesforUser,
  updateScale,
  getScaleById,
  getQuestionResponsesByUserIdforportal,
  submitMobileAppModelRessponse,
  createSpanishScale,
  getSpanishScale,
  createRomanionScale,
  getRomanionScale,
  getAllSpanishScaleName,
  getSpanishScalebyScaleid,
  getExcelFileThroughId,
  getAllPatientsResponses,
  ArchivalScaleChangeStatus,
  deleteScaleById,
} = require("../../models/app_survey/appSurveyModel");
const jwt = require("jsonwebtoken");
const auditLog = require("../../middleware/audit_logger.js");
const auditLogs = require("../../middleware/auditLog_without_token.js");
const crypto = require("crypto");

// Get all surveys with details
const getAllSurveysController = async (req, res) => {
  try {
    const surveys = await getAllSurveys();
    res.status(200).json(surveys);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// get all surveys for the investigator
const getAllSurveysForInvestigatorController = async (req, res) => {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  try {
    const surveys = await getAllSurveysForInvestigator(investigatorId);
    res.status(200).json(surveys);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Get all surveys by user_id with details
const getSurveysByUserIdController = async (req, res) => {
  const { user_id } = req.params;

  try {
    const surveys = await getSurveysByUserId(user_id);
    res.status(200).json(surveys);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Get survey details for a user
const getSurveyDetailsController = async (req, res) => {
  const { user_id } = req.params;

  try {
    const surveyDetails = await getSurveyDetails(user_id);
    res.status(200).json(surveyDetails);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Create survey questions with options
const createSurveyQuestionsController = async (req, res) => {
  const { questions } = req.body;

  try {
    const result = await createSurveyQuestions(questions);
    res.status(201).json({
      message: "Survey questions created successfully",
      result,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Get all questions with options
const getSurveyQuestionsController = async (req, res) => {
  try {
    const questions = await getSurveyQuestions();
    res.status(200).json(questions);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// Submit survey response
const submitSurveyResponseController = async (req, res) => {
  const {
    user_id: userId,
    investigator_id,
    timer,
    survey_responses: surveyResponses,
    survey_details: surveyDetails,
    scale_id,
  } = req.body;

  try {
    const result = await submitSurveyResponse(
      userId,
      investigator_id,
      timer,
      surveyResponses,
      surveyDetails,
      scale_id
    );
    res.status(201).json({
      message: "Survey responses submitted successfully",
      dataToGet: {
        user_id,
        investigator_id,
        timer,
      },
      result,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const submitSurveyResponseControllerforportal = async (req, res) => {
  const {
    user_id: userId,
    survey_responses: surveyResponses,
    investigator_id,
    timer,
    schedule_id: scheduleId,
    day_id: dayId,
    scale_id: scaleId,
    scale_start_time,
    scale_end_time,
    filled_by,
    language_code,
  } = req.body;

  const token = req.headers.authorization.split(" ")[1];

  console.log(token, "******************");

  try {
    const result = await submitSurveyResponseForPortal(
      userId,
      surveyResponses,
      investigator_id,
      timer,
      scheduleId,
      dayId,
      scaleId,
      scale_start_time,
      scale_end_time,
      filled_by,
      language_code,
      token
    );
    auditLogs(
      "SUBMIT",
      "Scale",
      null,
      {
        userId,
        scheduleId,
        dayId,
        scaleId,
        surveyResponses,
        scale_start_time,
        scale_end_time,
      },
      "Scale responses submitted successfully"
    )(req, res, () => {});
    res.status(201).json({
      message: "Survey responses submitted successfully",
      result,
    });
  } catch (err) {
    if (err.message === "This scale has already been submitted.") {
      // Audit log for already submitted scale
      auditLog(
        "SURVEY_ALREADY_SUBMITTED",
        "Survey",
        { userId, scheduleId, dayId, scaleId },
        null,
        "Survey submission failed: This scale has already been submitted",
        token
      )(req, res, () => {});

      return res.status(400).json({ message: err.message });
    } else {
      // Audit log for any other survey submission error
      auditLog(
        "SURVEY_SUBMIT_ERROR",
        "Survey",
        { userId, scheduleId, dayId, scaleId },
        null,
        `Survey submission failed: ${err.message}`,
        token
      )(req, res, () => {});

      return res
        .status(500)
        .json({ message: "Internal server error", error: err.message });
    }
  }
};
// Delete survey by id
const deleteSurveyByIdController = async (req, res) => {
  const { survey_id } = req.params;

  try {
    const result = await deleteSurveyById(survey_id);
    res.status(200).json({ message: "Survey deleted successfully", result });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// ================================Scale==========================
const getScaleuser = async (req, res) => {
  const user_id = req.params.id;
  try {
    const result = await getScalesforUser(user_id);
    res.status(200).json(result);
  } catch (error) {
    console.log("check erorro", error);
    res.status(404).json(error);
  }
};

const createScaleController = async (req, res) => {
  try {
    const { scaleName, questions, study_id, symptoms, role_id } = req.body;
    console.log("Creating scale with data:", scaleName, questions);

    // Validate the input data
    if (!scaleName || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    console.log("Creating scale with data:", { scaleName, questions });

    // Call the model function to create the scale
    const scaleId = await createScale(
      scaleName,
      questions,
      study_id,
      symptoms,
      role_id
    );

    console.log("Scale created successfully with ID:", scaleId);

    res.status(201).json({ message: "Scale created successfully", scaleId });
  } catch (error) {
    console.error("Error creating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getScaleController = async (req, res) => {
  const { scale_id } = req.params;
  try {
    const result = await getScale(scale_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getSpanishScaleByIdController = async (req, res) => {
  const { scale_id } = req.params;
  try {
    const result = await getSpanishScalebyScaleid(scale_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Count Scale
const getScaleCount = async (req, res) => {
  try {
    const count = await scaleCount();
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all scales
const getAllScalesController = async (req, res) => {
  const token = req.headers["authorization"].split(" ")[1];
  console.log("Checking token==========================");
  console.log(token);
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Decode the token to get the role_id
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("Checking token role===========");
    console.log("Decoded token:", decoded);
    const role_id = decoded.role;
    console.log("Role ID:", role_id);

    // Pass role_id to the getAllScales model
    const result = await getAllScales(role_id);

    res.status(200).json({ message: "Get All Scales", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getScaleName = async (req, res) => {
  try {
    const result = await getAllScaleName();
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};
const getScalebyScaleID = async (req, res) => {
  const scale_id = req.params.id;
  try {
    const result = await getScaleByScaleid(scale_id);
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};

const getquestionresponseforportal = async (req, res) => {
  const user_id = req.params.id;
  try {
    const result = await getQuestionResponsesByUserIdforportal(user_id);
    res.status(200).json(result);
  } catch (error) {
    console.log("check erorro", error);
    res.status(404).json(error);
  }
};

const updateScaleController = async (req, res) => {
  try {
    const { scaleId, scaleName, questions, symptoms } = req.body;
    console.log("Updating scale with data:", {
      scaleId,
      scaleName,
      questions,
      symptoms,
    });

    // Validate the input data
    if (!scaleId || !scaleName || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Call the model function to update the scale
    const result = await updateScale(scaleId, scaleName, questions, symptoms);

    console.log("Scale updated successfully:", result);

    res.status(200).json({ message: "Scale updated successfully", result });
  } catch (error) {
    console.error("Error updating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get scale by id controller function

const getScaleByIdController = async (req, res) => {
  try {
    const scaleId = req.params.id; // Assuming the scale ID is passed as a route parameter
    const result = await getScaleById(scaleId);

    if (!result) {
      return res.status(404).json({ message: "Scale not found" });
    }

    res.status(200).json({ message: "Get Scale by ID", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitMobileModelResposneController = async (req, res) => {
  const { user_id: userId, survey_details: surveyDetails } = req.body;

  try {
    // Log the submission attempt
    auditLog(
      "SUBMIT",
      "Drink",
      null,
      { userId, surveyDetails },
      `User ${userId} is attempting to submit survey responses`
    )(req, res, () => {});

    // Submit the survey responses
    const result = await submitMobileAppModelRessponse(userId, surveyDetails);

    // Log the successful submission
    auditLog(
      "SUBMIT",
      "Drink",
      null,
      { userId, surveyDetails, result },
      `Survey responses submitted successfully by user ${userId}`
    )(req, res, () => {});

    res.status(201).json({
      message: "Survey responses submitted successfully",
      result,
    });
  } catch (err) {
    console.error("Error submitting survey responses:", err.message);

    // Log the error in audit log
    auditLog(
      "SUBMISSION_ERROR",
      "Drink",
      { userId, surveyDetails },
      null,
      `Error submitting survey responses for user ${userId}: ${err.message}`
    )(req, res, () => {});

    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

const createSpanishScaleController = async (req, res) => {
  try {
    const { scaleName, questions, study_id, symptoms, role_id } = req.body;
    console.log("Creating scale with data:", scaleName, questions);

    // Validate the input data
    if (!scaleName || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    console.log("Creating scale with data:", { scaleName, questions });

    // Call the model function to create the scale
    const scaleId = await createSpanishScale(
      scaleName,
      questions,
      study_id,
      symptoms,
      role_id
    );

    console.log("Scale created successfully with ID:", scaleId);

    const result = {
      scaleId,
      scaleName,
      questions,
      study_id,
      role_id,
    };

    res
      .status(201)
      .json({ message: "Scale created successfully", scaleId: result });
  } catch (error) {
    console.error("Error creating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllSpanishScalesController = async (req, res) => {
  const { scale_id } = req.params;
  console.log(scale_id, "&&&&&&(**");
  try {
    const result = await getSpanishScale(scale_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getSpanishScaleName = async (req, res) => {
  try {
    const result = await getAllSpanishScaleName();
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};

const createRomanionScaleController = async (req, res) => {
  try {
    const { scaleName, questions, study_id, symptoms, role_id } = req.body;
    console.log("Creating scale with data:", scaleName, questions);

    // Validate the input data
    if (!scaleName || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    console.log("Creating scale with data:", { scaleName, questions });

    // Call the model function to create the scale
    const scaleId = await createRomanionScale(
      scaleName,
      questions,
      study_id,
      symptoms,
      role_id
    );

    console.log("Scale created successfully with ID:", scaleId);

    const result = {
      scaleId,
      scaleName,
      questions,
      study_id,
      role_id,
    };

    res
      .status(201)
      .json({ message: "Scale created successfully", scaleId: result });
  } catch (error) {
    console.error("Error creating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllRomanionScalesController = async (req, res) => {
  const { scale_id } = req.params;

  try {
    const result = await getRomanionScale(scale_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getExcelFileController = async (req, res) => {
  const { doc_id } = req.params;
  try {
    const result = await getExcelFileThroughId(doc_id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);

function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined

  let textParts = text.split(":");
  if (textParts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }

  let iv = Buffer.from(textParts[0], "hex");
  let encryptedText = Buffer.from(textParts[1], "hex");

  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "binary", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

const getAllPatientsResponsess = async (req, res) => {
  try {
    // Retrieve scale_id from route parameters
    const { scale_id } = req.params;
    const { language_code } = req.query;
    console.log(language_code, "check language code");

    // Validate scale_id
    if (!scale_id) {
      return res.status(400).json({ message: "scale_id is required" });
    }

    const results = await getAllPatientsResponses(language_code, scale_id);

    // Process the results to group responses by user_id
    const data = {};

    results.forEach((row) => {
      if (!data[row.user_id]) {
        data[row.user_id] = {
          user_id: row.user_id,
          user_first_name: decrypt(row.user_first_name),
          user_last_name: decrypt(row.user_last_name),
          gender: decrypt(row.gender),
          contact_number: decrypt(row.contact_number),
          status: row.status,
          gender: decrypt(row.gender),
          address: row.address,
          date_of_birth: row.date_of_birth,
          stipend: row.stipend,
          study_name: row.study_name,
          study_start_date: row.study_start_date,
          study_end_date: row.study_end_date,
          scale_start_time: row.scale_start_time,
          scale_end_time: row.scale_end_time,

          organization_name: row.organization_name,
          organization_address: row.organization_address,

          investigator_id: row.investigator_id,
          investigator_first_name: row.investigator_first_name
            ? decrypt(row.investigator_first_name)
            : null,
          investigator_last_name: row.investigator_last_name
            ? decrypt(row.investigator_last_name)
            : null,
          // Removed 'score' from here
          ecrf_id: row.ecrf_id,
          filled_by: row.filled_by,
          responses: [],
        };
      }

      // Determine the final_option_text based on option_id and description
      let final_option_text = "";
      if (row.option_id) {
        final_option_text = row.option_text ? row.option_text.trim() : "";
        if (row.description) {
          final_option_text += ` ${row.description.trim()}`;
        }
      } else {
        final_option_text = row.description ? row.description.trim() : "";
      }

      // Add the response
      data[row.user_id].responses.push({
        app_survey_question_response_id: row.app_survey_question_response_id,
        question_id: row.question_id,
        question_text: row.question_text,
        option_id: row.option_id,
        option_text:
          final_option_text && final_option_text.includes("Description:")
            ? final_option_text.split("Description:")[1]
            : final_option_text,
        response_text:
          final_option_text && final_option_text.includes("Description:")
            ? final_option_text.split("Description:")[1]
            : final_option_text,
        score: row.score || 0, // Include score in each response
        day_id: row.day_id,
        day_name: row.day_name,
        schedule_name: row.schedule_name,
        day_order: row.day_order,
        scale_id: row.scale_id,
        scale_name: row.scale_name,
        filled_by: row.filled_by,
        created_at: row.created_at,
      });
    });

    // Convert the data object to an array
    const patients = Object.values(data);

    res.status(200).json({
      message: "Responses retrieved successfully",
      patients,
    });
  } catch (error) {
    console.error("Error fetching responses:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const archivalScaleChangeStatus = async (req, res) => {
  try {
    const { user_id, scale_id, day_id } = req.body;

    const result = await ArchivalScaleChangeStatus(user_id, scale_id, day_id);

    console.log("Delete Scale successfully:", result);

    res.status(200).json({ message: "Delete Scale successfully:", result });
  } catch (error) {
    console.error("Error updating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteScale = async (req, res) => {
  try {
    const { scale_id } = req.params;

    const result = await deleteScaleById(scale_id);

    console.log("Delete Scale successfully:", result);
    auditLogs(
      "DELETE",
      "Scale",
      { scale_id },
      null,
      "Scale responses submitted successfully"
    )(req, res, () => {});

    res.status(200).json({ message: "Delete Scale successfully:", result });
  } catch (error) {
    console.error("Error updating scale:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createSurveyQuestionsController,
  getSurveyQuestionsController,
  submitSurveyResponseController,
  getSurveyDetailsController,
  getAllSurveysController,
  getAllSurveysForInvestigatorController,
  getSurveysByUserIdController,
  deleteSurveyByIdController,
  createScaleController,
  getScaleController,
  getScaleCount,
  getAllScalesController,
  getScaleName,
  getScalebyScaleID,
  submitSurveyResponseControllerforportal,
  getScaleuser,
  updateScaleController,
  getScaleByIdController,
  getquestionresponseforportal,
  submitMobileModelResposneController,
  createSpanishScaleController,
  getAllSpanishScalesController,
  getSpanishScaleName,
  createRomanionScaleController,
  getAllRomanionScalesController,
  getSpanishScaleByIdController,
  getExcelFileController,
  getAllPatientsResponsess,
  archivalScaleChangeStatus,
  deleteScale,
};
