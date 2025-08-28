const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise
const CryptoJS = require("crypto-js");
const crypto = require("crypto");
const SECRET_KEY = "asdsajdaoeiqwedkasdaskdjaskdklas";
const cron = require("node-cron");

const encryptPath = function (path) {
  return CryptoJS.AES.encrypt(path, SECRET_KEY).toString();
};

const decryptPath = async function (encryptedPath) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPath, SECRET_KEY);
    const decryptedPath = bytes.toString(CryptoJS.enc.Utf8);
    return decryptedPath;
  } catch (error) {
    throw error;
  }
};

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
); // Decoding Base64 key to Buffer
const IV_LENGTH = 16; // For AES, this is always 16

function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Create a new patient video
const createPatientVideo = async function (user_id, video_url, medication_id) {
  const encryptedPath = encryptPath(video_url);
  const query =
    "INSERT INTO patient_videos (user_id, video_url, medication_id) VALUES (?, ?, ?)";
  try {
    const [result] = await db.query(query, [
      user_id,
      encryptedPath,
      medication_id,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

// Get all patient videos
const getAllPatientVideos = async function () {
  const query = `WITH RankedVideos AS (
    SELECT 
        v.video_url,
        v.user_id,
        o.first_name,
        o.last_name,
        u.email,
        m.medication_name,
        m.dosage,
        m.frequency_type,
        m.frequency_time,
        m.frequency_condition,
        m.note AS medication_note,
        ROW_NUMBER() OVER (PARTITION BY v.user_id ORDER BY v.video_url) AS rn
    FROM 
        patient_videos AS v
    JOIN 
        user AS u ON v.user_id = u.user_id
    JOIN 
        organization AS o ON u.user_id = o.user_id
    JOIN 
        note AS n ON u.user_id = n.user_id
    JOIN 
        patientmedications AS m ON v.medication_id = m.medication_id
  )
  SELECT
      video_url,
      user_id,
      first_name,
      last_name,
      email,
      medication_name,
      dosage,
      frequency_type,
      frequency_time,
      frequency_condition,
      medication_note
  FROM
      RankedVideos
  WHERE
      rn = 1;
  `;
  try {
    const [result] = await db.query(query);
    // Decrypt the encrypted fields
    const decryptedResult = result.map((org) => {
      try {
        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org;
      }
    });
    return decryptedResult;
  } catch (err) {
    throw err;
  }
};

// Get all patient videos for investigator
const getAllPatientVideosForInvestigator = async function (investigatorId) {
  try {
    // First, fetch the investigator's details from the organization table
    const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;
    const [investigatorResult] = await db.query(investigatorQuery, [
      investigatorId,
    ]);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    const investigator = investigatorResult[0];

    const query = `
      WITH RankedVideos AS (
        SELECT 
          v.video_url,
          v.user_id,
          o.first_name,
          o.last_name,
          u.email,
          m.medication_name,
          m.dosage,
          m.frequency_type,
          m.frequency_time,
          m.frequency_condition,
          m.note AS medication_note,
          ROW_NUMBER() OVER (PARTITION BY v.user_id ORDER BY v.video_url) AS rn
        FROM 
          patient_videos AS v
        JOIN 
          user AS u ON v.user_id = u.user_id
        JOIN 
          organization AS o ON u.user_id = o.user_id
        JOIN 
          note AS n ON u.user_id = n.user_id
        JOIN 
          patientmedications AS m ON v.medication_id = m.medication_id
        JOIN
          user_role AS ur ON u.user_id = ur.user_id
        WHERE
          ur.role_id = 10
          AND FIND_IN_SET(?, o.study_enrolled_id) > 0
          AND o.organization_detail_id = ?
      )
      SELECT
        video_url,
        user_id,
        first_name,
        last_name,
        email,
        medication_name,
        dosage,
        frequency_type,
        frequency_time,
        frequency_condition,
        medication_note
      FROM
        RankedVideos
      WHERE
        rn = 1;
    `;

    const [result] = await db.query(query, [
      investigator.study_enrolled_id,
      investigator.organization_detail_id,
    ]);

    // Decrypt the encrypted fields
    const decryptedResult = result.map((org) => {
      try {
        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org;
      }
    });
    return decryptedResult;
  } catch (err) {
    throw err;
  }
};

// Get all patient videos by user ID
const getAllPatientVideosByid = async function (id) {
  const query = `SELECT v.*, o.first_name, o.last_name, u.email, m.medication_name,
    m.dosage, m.frequency_type, m.frequency_time, m.frequency_condition, m.note AS medication_note 
  FROM patient_videos AS v
  JOIN user AS u ON v.user_id = u.user_id
  JOIN organization AS o ON u.user_id = o.user_id
  JOIN patientmedications AS m ON v.medication_id = m.medication_id
  JOIN note AS n ON u.user_id = n.user_id 
  WHERE v.user_id = ?
  ORDER BY v.created_at DESC;
  `;
  try {
    const [result] = await db.query(query, [id]);
    if (result.length > 0) {
      const decryptedResults = result.map((row) => {
        try {
          return {
            ...row,
            first_name: decrypt(row.first_name),
            last_name: decrypt(row.last_name),
          };
        } catch (decryptionError) {
          console.error("Decryption error:", decryptionError);
          return row; // Return original row if decryption fails
        }
      });
      return decryptedResults;
    } else {
      return []; // Return an empty array if no results found
    }
  } catch (err) {
    throw err;
  }
};

// Check and update patient compliance status
const checkComplianceStatus = async (user_id) => {
  console.log("Compliance status check running...");
  console.log(`Checking compliance status for user ${user_id}`);

  const query = `
    SELECT DATE(created_at) AS upload_date
    FROM patient_videos
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  try {
    const [results] = await db.query(query, [user_id]);

    // Check if the user has any video uploads
    if (results.length === 0) {
      console.log(
        `User ${user_id} is a new patient with no video uploads. Considered compliant.`
      );
      return true;
    }

    const today = new Date();
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(today.getDate() - 1);

    // Create a set of all unique dates for which videos have been uploaded
    const uploadDates = new Set(
      results.map((row) => new Date(row.upload_date).toISOString().slice(0, 10))
    );

    // Check each day from the user's first upload day to yesterday
    const firstUploadDate = new Date(results[results.length - 1].upload_date);
    const complianceCheckDate = new Date(firstUploadDate);

    // Loop through each day from the first upload to yesterday
    while (complianceCheckDate < oneDayAgo) {
      const checkDate = complianceCheckDate.toISOString().slice(0, 10);
      if (!uploadDates.has(checkDate)) {
        console.log(
          `User ${user_id} is missing a video for ${checkDate}. Marking as Non-Compliant.`
        );
        await updateOrganizationStatus(user_id, "Non-Compliant");
        console.log(`User ${user_id} marked as Non-Compliant.`);
        return false;
      }
      complianceCheckDate.setDate(complianceCheckDate.getDate() + 1);
    }

    console.log(
      `User ${user_id} has videos for each day up to yesterday. User is compliant.`
    );
    return true;
  } catch (err) {
    console.error(`Error querying database for user ${user_id}:`, err);
    throw err;
  }
};

// Function to update organization status
const updateOrganizationStatus = async (user_id, status) => {
  console.log(`Updating organization status for user ${user_id} to ${status}`);
  const query = "UPDATE organization SET status = ? WHERE user_id = ?";
  try {
    const [result] = await db.query(query, [status, user_id]);
    console.log(`Successfully updated organization status for user ${user_id}`);
    return result;
  } catch (err) {
    console.error(
      `Error updating organization status for user ${user_id}:`,
      err
    );
    throw err;
  }
};

module.exports = {
  createPatientVideo,
  decryptPath,
  getAllPatientVideos,
  getAllPatientVideosForInvestigator,
  getAllPatientVideosByid,
  checkComplianceStatus,
  updateOrganizationStatus,
};
