// models/sign_well_model/signWellModel.js

const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Function to save document for signing
// const saveDocumentForSigning = async (
//   userId,
//   scale_id,
//   day_id,
//   investigatorId,
//   filePath,
//   documentId,
//   embeddedSigningUrl1,
//   embeddedSigningUrl2,
//   recipient1_email,
//   recipient2_email,
//   recipient1_status,
//   recipient2_status,
//   recipient1_bounced,
//   recipient2_bounced,
//   filledBy,
//   status = "Enable"
// ) => {
//   const query = `
//     INSERT INTO signature (
//       user_id,
//       scale_id,
//       day_id,
//       investigatorId,
//       file_path,
//       document_id,
//       embedded_signing_url_recipient1,
//       embedded_signing_url_recipient2,
//       recipient1_email,
//       recipient2_email,
//       recipient1_status,
//       recipient2_status,
//       recipient1_bounced,
//       recipient2_bounced,
//       filled_by,
//       status
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
//   `;

//   const params = [
//     userId,
//     scale_id,
//     day_id,
//     investigatorId,
//     filePath,
//     documentId,
//     embeddedSigningUrl1,
//     embeddedSigningUrl2,
//     recipient1_email,
//     recipient2_email,
//     recipient1_status,
//     recipient2_status,
//     recipient1_bounced,
//     recipient2_bounced,
//     filledBy,
//     status,
//   ];

//   try {
//     const [result] = await db.query(query, params);
//     return result;
//   } catch (error) {
//     throw error;
//   }
// };


const saveDocumentForSigning = async (
  userId,
  scale_id,
  day_id,
  investigatorId,
  filePath,
  documentId,
  embeddedSigningUrl1,
  embeddedSigningUrl2,
  recipient1_email,
  recipient2_email,
  recipient1_status,
  recipient2_status,
  recipient1_bounced,
  recipient2_bounced,
  filledBy,
  signee1_passcode,
  signee2_passcode,
  status = "Enable"
) => {
  const query = `
    INSERT INTO signature (
      user_id,
      scale_id,
      day_id,
      investigatorId,
      file_path,
      document_id,
      embedded_signing_url_recipient1,
      embedded_signing_url_recipient2,
      recipient1_email,
      recipient2_email,
      recipient1_status,
      recipient2_status,
      recipient1_bounced,
      recipient2_bounced,
      filled_by,
      recipient1_pass_code,
      recipient2_pass_code,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?)
  `;

  const params = [
    userId,
    scale_id,
    day_id,
    investigatorId,
    filePath,
    documentId,
    embeddedSigningUrl1,
    embeddedSigningUrl2,
    recipient1_email,
    recipient2_email,
    recipient1_status,
    recipient2_status,
    recipient1_bounced,
    recipient2_bounced,
    filledBy,
    signee1_passcode,
    signee2_passcode,
    status,
  ];

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (error) {
    throw error;
  }
};

const getIncompleteDocuments = async () => {
  const query = `
 SELECT s.document_id
      FROM signature  as s
      JOIN user as u on u.user_id = s.user_id
      JOIN organization as o on o.user_id = u.user_id
      WHERE (s.recipient1_status IS NULL OR s.recipient1_status != 'completed')
         AND (s.recipient2_status IS NULL OR s.recipient2_status != 'completed');  
  
  `;

  try {
    const [rows] = await db.query(query);
    return rows;
  } catch (error) {
    console.error("[DB] Error fetching incomplete documents:", error.message);
    // Optionally rethrow so the cron job can catch it and handle/log properly
    throw new Error("Failed to fetch incomplete documents from DB");
  }
};

// Function to update document status
const updateDocumentStatus = async (documentId, updateData) => {
  const query = `
    UPDATE signature 
    SET recipient1_status = ?, 
        recipient2_status = ?, 
        recipient1_bounced = ?, 
        recipient2_bounced = ?
    WHERE document_id = ?
  `;

  const params = [
    updateData.recipient1_status,
    updateData.recipient2_status,
    updateData.recipient1_bounced,
    updateData.recipient2_bounced,
    documentId,
  ];

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (error) {
    throw error;
  }
};

// Function to get document by user ID
const getDBDocumentByUserId = async (userId) => {
    const query = `SELECT sig.s_id,sig.user_id,sig.scale_id,sig.day_id,sig.investigatorId,sig.embedded_signing_url_recipient1,sig.embedded_signing_url_recipient2,sig.document_id,sig.file_path,sig.recipient1_email,sig.recipient2_email,sig.recipient1_status,sig.recipient2_status,sig.recipient1_bounced,sig.recipient2_bounced,sig.filled_by,sig.status,sig.recipient1_pass_code,sig.recipient2_pass_code,DATE_FORMAT(sig.created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS created_at, sc.scale_name, d.day_name, sts.schedule_name,s.filled_by, o.ecrf_id
    FROM signature AS sig
    JOIN scale_translations AS sc ON sig.scale_id = sc.scale_id 
    JOIN schedule_days AS d ON sig.day_id = d.day_id
    JOIN study_schedules AS sts ON d.schedule_id = sts.schedule_id
    JOIN scale AS s ON sig.scale_id = s.scale_id
    JOIN organization AS o ON sig.user_id = o.user_id
    WHERE sig.user_id = ? AND sig.status = "Enable"`


//   const query = `
//   SELECT sig.*, sc.scale_name, d.day_name, sts.schedule_name,s.filled_by, o.ecrf_id
//     FROM signature AS sig
//     JOIN scale_translations AS sc ON sig.scale_id = sc.scale_id 
//     JOIN schedule_days AS d ON sig.day_id = d.day_id
//     JOIN study_schedules AS sts ON d.schedule_id = sts.schedule_id
//     JOIN scale AS s ON sig.scale_id = s.scale_id
//     JOIN organization AS o ON sig.user_id = o.user_id
//     WHERE sig.user_id = ? AND sig.status = "Enable"
//   `;

  try {
    const [result] = await db.query(query, [userId]);
    return result;
  } catch (error) {
    throw error;
  }
};

const archivalScaleModel = async (user_id, scale_id, day_id) => {
  // Get a dedicated connection from the pool
  const connection = await db.getConnection();
  try {
    console.log(user_id, scale_id, day_id, "============model -------------");

    // Begin transaction on the acquired connection
    await connection.beginTransaction();

    const appSurveyQuery = `
      UPDATE app_survey_question_responses
      SET status = ?
      WHERE user_id = ? AND scale_id = ? AND day_id = ?`;
    const [appResult] = await connection.query(appSurveyQuery, [
      "Disable",
      user_id,
      scale_id,
      day_id,
    ]);
    console.log("appResult", appResult);

    const signatureQuery = `
      UPDATE signature
      SET status = ?
      WHERE user_id = ? AND scale_id = ? AND day_id = ?`;
    const [sigResult] = await connection.query(signatureQuery, [
      "Disable",
      user_id,
      scale_id,
      day_id,
    ]);
    console.log("sigResult", sigResult);

    const signQuery = `
      UPDATE excel_signature
      SET status = ?
      WHERE user_id = ? AND scale_id = ? AND day_id = ?`;
    const [signResult] = await connection.query(signQuery, [
      "Disable",
      user_id,
      scale_id,
      day_id,
    ]);
    console.log("signResult", signResult);

    const submitScaleQuery = `
      UPDATE submit_scale_status
      SET disable_status = ?
      WHERE user_id = ? AND scale_id = ? AND day_id = ?`;
    const [submitScaleResult] = await connection.query(submitScaleQuery, [
      "Disable",
      user_id,
      scale_id,
      day_id,
    ]);
    console.log("submitScaleResult", submitScaleResult);

    // Commit the transaction
    await connection.commit();

    // Release the connection back to the pool
    connection.release();

    return {
      appResult: appResult.affectedRows,
      sigResult: sigResult.affectedRows,
      signResult: signResult.affectedRows,
      submitScaleResult: submitScaleResult.affectedRows,
    };
  } catch (error) {
    // Rollback the transaction if any error occurs
    await connection.rollback();
    connection.release();
    console.error("Transaction error:", error);
    throw error;
  }
};



const getScaleNameById = async (scale_id) => {
  const query = `
    SELECT scale_name
    FROM scale_translations
    WHERE scale_id = ?
    LIMIT 1
  `;

  try {
    const [result] = await db.query(query, [scale_id]);
    return result.length > 0 ? result[0].scale_name : null;
  } catch (error) {
    console.error("Error getting scale name:", error);
    throw error;
  }
};


const updateDocumentForSigning = async (
  userId,
  scale_id,
  day_id,
  investigatorId,
  documentId,
  embeddedSigningUrl1,
  embeddedSigningUrl2,
  recipient1_email,
  recipient2_email,
  recipient1_status,
  recipient2_status,
  recipient1_bounced,
  recipient2_bounced,
  filledBy,
  signee1_passcode,
  signee2_passcode,
  status = "Enable",
  s_id
) => {
  const query = `
    UPDATE signature SET
  user_id = ?,
  scale_id = ?,
  day_id = ?,
  investigatorId = ?,
  document_id = ?,
  embedded_signing_url_recipient1 = ?,
  embedded_signing_url_recipient2 = ?,
  recipient1_email = ?,
  recipient2_email = ?,
  recipient1_status = ?,
  recipient2_status = ?,
  recipient1_bounced = ?,
  recipient2_bounced = ?,
  filled_by = ?,
  recipient1_pass_code = ?,
  recipient2_pass_code = ?,
  status = ?
WHERE s_id = ?

  `;

  const params = [
    userId,
    scale_id,
    day_id,
    investigatorId,
    documentId,
    embeddedSigningUrl1,
    embeddedSigningUrl2,
    recipient1_email,
    recipient2_email,
    recipient1_status,
    recipient2_status,
    recipient1_bounced,
    recipient2_bounced,
    filledBy,
    signee1_passcode,
    signee2_passcode,
    status,
    s_id
  ];

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (error) {
    console.error('Error updating signature:', error);
    throw error;
  }
};







const getScaleDetails = async (signature_id) => {
  const query = `
      SELECT user_id, scale_id, day_id, investigatorId, filled_by, file_path
    FROM signature
    WHERE s_id = ?;
  `;

  try {
    const [result] = await db.query(query, [signature_id]);
    
    return result?.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error getting file Path:", error);
    throw error;
  }
};

module.exports = {
  saveDocumentForSigning,
  getDBDocumentByUserId,
  updateDocumentStatus,
  archivalScaleModel,
  getScaleNameById,
  updateDocumentForSigning,
  getScaleDetails,
  getIncompleteDocuments
};
