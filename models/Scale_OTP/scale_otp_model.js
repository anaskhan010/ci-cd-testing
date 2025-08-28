const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise
const crypto = require("crypto");

// Encryption constants
const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16; // For AES, this is always 16

// Decrypt function
function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Function to send OTP to user
const sendOtpToUser = async (userId, otp, expireAt) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if the user has the required role (role_id = 12)
    const roleQuery = "SELECT role_id FROM user_role WHERE user_id = ?";
    const [roleResult] = await connection.query(roleQuery, [userId]);

    if (!roleResult.length || roleResult[0].role_id !== 12) {
      throw new Error("User does not have the required role.");
    }

    // Fetch the user's email
    const emailQuery = "SELECT email FROM user WHERE user_id = ?";
    const [userResult] = await connection.query(emailQuery, [userId]);

    if (!userResult.length) {
      throw new Error("User not found.");
    }

    const email = userResult[0].email;

    // Insert OTP into the database
    const insertQuery =
      "INSERT INTO scale_otp (email, otp, expiry_at) VALUES (?, ?, ?)";
    await connection.query(insertQuery, [email, otp, expireAt]);

    await connection.commit();
    console.log(`OTP sent to ${email}: ${otp}`);
    return { message: "OTP sent successfully", otp };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Function to verify OTP
const verifyOtp = async (userId, otp) => {
  try {
    // Check if user_id has the required role (role_id = 12)
    const roleQuery = "SELECT role_id FROM user_role WHERE user_id = ?";
    const [roleResults] = await db.query(roleQuery, [userId]);

    if (!roleResults.length || roleResults[0].role_id !== 12) {
      throw new Error("User does not have the required role.");
    }

    // Fetch the email associated with the user_id
    const emailQuery = "SELECT email FROM user WHERE user_id = ?";
    const [userResults] = await db.query(emailQuery, [userId]);

    if (!userResults.length) {
      throw new Error("User not found.");
    }

    const email = userResults[0].email;

    // Verify the OTP
    const otpQuery =
      "SELECT otp, expiry_at FROM scale_otp WHERE email = ? AND otp = ?";
    const [otpResults] = await db.query(otpQuery, [email, otp]);

    if (!otpResults.length) {
      throw new Error("Invalid OTP or email.");
    }

    const { expiry_at } = otpResults[0];
    const currentTime = new Date();

    // Check if the OTP is expired
    if (currentTime > expiry_at) {
      throw new Error("OTP has expired.");
    }

    // OTP is valid
    return "OTP verified successfully.";
  } catch (error) {
    throw error;
  }
};

// Function to get all investigators by study IDs
const getAllInvestigatorsByStudyIds = async (studyIds) => {
  try {
    // Create placeholders for the number of study_ids
    const placeholders = studyIds.map(() => "?").join(",");

    // SQL query to fetch investigators based on study_ids and role_id
    const query = `
      SELECT o.first_name, o.last_name, o.user_id, se.study_name
      FROM organization o
      JOIN study_enrolled se ON o.study_enrolled_id = se.enrolled_id
      JOIN user_role ur ON o.user_id = ur.user_id
      WHERE se.enrolled_id IN (${placeholders}) AND ur.role_id = 12
    `;

    // Execute the query with the study_ids as parameters
    const [results] = await db.query(query, studyIds);

    if (results.length > 0) {
      // Structure the results by study_name
      const structuredResults = {};

      results.forEach((result) => {
        const studyName = result.study_name;

        // Decrypt first_name and last_name
        try {
          result.first_name = decrypt(result.first_name);
          result.last_name = decrypt(result.last_name);
        } catch (decryptionError) {
          console.error("Decryption error:", decryptionError);
        }

        // Initialize array if it doesn't exist
        if (!structuredResults[studyName]) {
          structuredResults[studyName] = [];
        }

        // Add investigator details
        structuredResults[studyName].push({
          first_name: result.first_name,
          last_name: result.last_name,
          user_id: result.user_id,
        });
      });

      return structuredResults;
    } else {
      return null;
    }
  } catch (err) {
    throw new Error(
      "Error fetching investigator data based on study IDs and role ID."
    );
  }
};

module.exports = { sendOtpToUser, verifyOtp, getAllInvestigatorsByStudyIds };
