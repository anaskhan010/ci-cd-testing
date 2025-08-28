// models/organization/organizationModel.js
const pool = require("../../config/DBConnection3.js");
const crypto = require("crypto");
const { notifyLockedUsers } = require('../../services/accountLock.service');

const {
  formatDate,
  insertPatientAccountStatus,
  blockUserAccount,
} = require("../../utils/utils.js");

// Encryption ConfigurationgetOrganizationAndRolebyUseridModel
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

const getOrganizationName = async (organization_detail_id) => {
  const query = `
    SELECT organization_name
    FROM organization_details
    WHERE organization_detail_id = ?
  `;
  try {
    const [rows] = await pool.query(query, [organization_detail_id]);
    return rows[0]?.organization_name || null;
  } catch (error) {
    console.error("Error fetching organization name:", error);
    throw error;
  }
};

const createOrganization = async (
  hashFirstName,
  hashMiddleName,
  hashLastName,
  status,
  hashGender,
  address,
  hashContactNumber,
  date_of_birth,
  stipend,
  study_enrolled_ids,
  notification,
  note,
  email,
  hashPassword,
  role_id,
  organization_detail_id,
  hashImage,
  ecrf_id,
  timezone
) => {
  const connection = await pool.getConnection();
  try {
    // Check if role_id is valid
    if (parseInt(role_id) !== 10) {
      throw new Error("Invalid role_id");
    }

    // Fetch study information
    const studyQuery = "SELECT * FROM study_enrolled WHERE enrolled_id IN (?)";
    const [studyResults] = await connection.query(studyQuery, [
      study_enrolled_ids.split(","),
    ]);

    // Calculate age based on date_of_birth
    const birthDate = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    // Decrypt gender for comparison
    const decryptedGender = decrypt(hashGender).toLowerCase();

    // Validate age and gender for each study
    for (let study of studyResults) {
      if (age < study.lower_age_limit || age > study.upper_age_limit) {
        throw new Error(
          `Age does not meet the criteria for study: ${study.study_name}`
        );
      }

      // Check if the study.end_date is before the current date
      if (new Date(study.end_date) < today) {
        throw new Error(`Study ${study.study_name} has ended.`);
      }

      const allowedGenders = JSON.parse(study.genders).map((g) =>
        g.toLowerCase()
      );
      if (!allowedGenders.includes(decryptedGender)) {
        throw new Error(
          `Gender does not meet the criteria for study: ${study.study_name}`
        );
      }
    }

    // Check if the email already exists
    const checkUserQuery = "SELECT * FROM user WHERE email = ?";
    const [checkUserResult] = await connection.query(checkUserQuery, [email]);
    if (checkUserResult.length > 0) {
      throw new Error("This email already exists");
    }

    // Check if ecrf_id already exists
    const checkEcrfIdQuery = "SELECT * FROM organization WHERE ecrf_id = ?";
    const [checkEcrfIdResult] = await connection.query(checkEcrfIdQuery, [
      ecrf_id,
    ]);
    if (checkEcrfIdResult.length > 0) {
      throw new Error("This ecrf_id already exists");
    }
    const passwordSetDate = new Date();
    // Insert into user table with reset_by_admin set to "true" for first-time login
    const userQuery =
      "INSERT INTO user (email, password, password_set_date, reset_by_admin) VALUES (?, ?, ?, ?)";
    const [userResult] = await connection.query(userQuery, [
      email,
      hashPassword,
      passwordSetDate,
      "true", // Set reset_by_admin to true for all new users except role_id 10
    ]);
    const userId = userResult.insertId;

    // Insert into organization table
    const organizationQuery = `
      INSERT INTO organization (
        user_id, first_name, middle_name, last_name, status, gender, address,
        contact_number, date_of_birth, stipend, image, study_enrolled_id,
        date_enrolled, notification, organization_detail_id, role_id, ecrf_id, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const formattedDate = formatDate(new Date(), "US");
    await connection.query(organizationQuery, [
      userId,
      hashFirstName,
      hashMiddleName || null,
      hashLastName,
      status,
      hashGender,
      address,
      hashContactNumber,
      formatDate(date_of_birth, "US"),
      stipend,
      hashImage,
      study_enrolled_ids,
      formattedDate,
      notification,
      organization_detail_id,
      role_id,
      ecrf_id,
      timezone,
    ]);

    // Insert into note table
    const noteQuery = "INSERT INTO note (user_id, note) VALUES (?, ?)";
    await connection.query(noteQuery, [userId, note]);

    // Insert into validate_organization table
    const validateOrgQuery = `
      INSERT INTO validate_organization (
        user_id, first_name, middle_name, last_name, status, gender, address,
        contact_number, date_of_birth, stipend, image, study_enrolled_id,
        date_enrolled, notification, organization_detail_id, role_id, ecrf_id, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.query(validateOrgQuery, [
      userId,
      hashFirstName,
      hashMiddleName || null,
      hashLastName,
      status,
      hashGender,
      address,
      hashContactNumber,
      formatDate(date_of_birth, "US"),
      stipend,
      hashImage,
      study_enrolled_ids,
      formattedDate,
      notification,
      organization_detail_id,
      role_id,
      ecrf_id,
      timezone,
    ]);

    // Insert into user_role table
    const userRoleQuery =
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)";
    await connection.query(userRoleQuery, [userId, role_id]);

    // Insert into patient_account_status table
    await insertPatientAccountStatus(userId, "Pending", "Initial registration");

    const studyEnrolledArray = study_enrolled_ids.split(",").filter(Boolean);

    // For each study, query the personnel_assigned_sites_studies table
    // for records with matching site (organization_detail_id) and study.
    const assignedQuery = `
      SELECT DISTINCT personnel_id FROM personnel_assigned_sites_studies
      WHERE site_id = ? AND study_id = ?
    `;
    for (const studyId of studyEnrolledArray) {
      const [assignedRows] = await connection.query(assignedQuery, [
        organization_detail_id,
        Number(studyId),
      ]);
      // For each matching personnel, insert into personel_subject
      for (const row of assignedRows) {
        await connection.query(
          "INSERT INTO personel_subject (site_id, study_id, personel_id, subject_id) VALUES (?, ?, ?, ?)",
          [organization_detail_id, Number(studyId), row.personnel_id, userId]
        );
      }
    }
    
    // Entry for sending email record
    try {
      const [emailTypes] = await connection.query(
        `SELECT email_type_id 
     FROM email_types
     WHERE email_type_id IN (17)`
      );

      for (const emailType of emailTypes) {
        await connection.query(
          `INSERT INTO email_sent_notification (email_type_id, personel_id, status) 
       VALUES (?, ?, ?)`,
          [emailType?.email_type_id, userId, "Enable"]
        );
      }
    } catch (err) {
      console.error(
        `Error inserting email_sent_notification records for userId=${userId}:`,
        err
      );
    }

    return { userId };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
};

const assignSitesStudiesAndSubjects = async (
  personnelId,
  organizationDetailIds, // array of site IDs
  studyEnrolledIds // array of study IDs
) => {
  console.log(
    "=======================Assigned studies and sites and subjects from heree=============================="
  );

  const connection = await pool.getConnection();
  try {
    // Iterate over every combination of site and study
    for (const siteId of organizationDetailIds) {
      for (const studyId of studyEnrolledIds) {
        // Insert into the new mapping table
        await connection.query(
          "INSERT INTO personnel_assigned_sites_studies (personnel_id, site_id, study_id) VALUES (?, ?, ?)",
          [personnelId, siteId, studyId]
        );

        // Fetch subjects from the organization table (joining with user_role) with role_id = 10
        const [subjects] = await connection.query(
          `SELECT o.user_id
           FROM organization o
           JOIN user_role ur ON o.user_id = ur.user_id
           WHERE o.organization_detail_id = ? AND o.study_enrolled_id = ? AND ur.role_id = 10`,
          [siteId, studyId]
        );

        console.log(
          "---------SUBJECTS TO BE ASSIGNED TO THIS ROLE HERE-----------"
        );
        console.log(subjects);

        // For each matching subject, insert an assignment in personel_subject table
        for (const subject of subjects) {
          await connection.query(
            "INSERT INTO personel_subject (site_id, study_id, personel_id, subject_id) VALUES (?, ?, ?, ?)",
            [siteId, studyId, personnelId, subject.user_id]
          );
        }
      }
    }
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
};
const createTLFBSubject = async ({ user_id, source_id }) => {
  const query = "INSERT INTO tlfb_subject (user_id, source_id) VALUES (?, ?)";
  const [result] = await pool.query(query, [user_id, source_id]);
  return result;
};
const getStudyName = async (study_enrolled_id) => {
  const query = `
    SELECT study_name
    FROM study_enrolled
    WHERE enrolled_id = ?
  `;
  try {
    const [rows] = await pool.query(query, [study_enrolled_id]);
    return rows[0]?.study_name || null;
  } catch (error) {
    console.error("Error fetching study name:", error);
    throw error;
  }
};

async function getNotificationRecipients(newOrgDetailId, studyEnrolledIds) {
  const connection = await pool.getConnection();
  try {
    // Get role 9 users
    const [role9Users] = await connection.query(
      `SELECT u.email, o.first_name, o.last_name
       FROM user_role ur
       JOIN user u ON ur.user_id = u.user_id
       JOIN organization o ON ur.user_id = o.user_id
       WHERE ur.role_id = 9`
    );

    // Get role 22 users with matching study and org
    let role22Users = [];
    if (studyEnrolledIds.length > 0) {
      const placeholders = studyEnrolledIds.map(() => "?").join(",");
      const [results] = await connection.query(
        `SELECT u.email, o.first_name, o.last_name
         FROM user_role ur
         JOIN organization o ON ur.user_id = o.user_id
         JOIN user u ON ur.user_id = u.user_id
         WHERE ur.role_id = 22
           AND o.organization_detail_id = ?
           AND o.study_enrolled_id IN (${placeholders})`,
        [newOrgDetailId, ...studyEnrolledIds]
      );
      role22Users = results;
    }

    // Decrypt PII fields and combine
    const recipients = [...role9Users, ...role22Users].map((user) => ({
      email: user.email,
      firstName: decrypt(user.first_name),
      lastName: decrypt(user.last_name),
    }));

    // Remove duplicates
    return recipients.filter(
      (v, i, a) => a.findIndex((t) => t.email === v.email) === i
    );
  } finally {
    connection.release();
  }
}

const ecrfIdExists = async (ecrf_id) => {
  try {
    const [result] = await pool.query(
      "SELECT COUNT(*) AS count FROM organization WHERE ecrf_id = ?",
      [ecrf_id]
    );
    return result[0].count > 0;
  } catch (error) {
    throw error;
  }
};

const createPersonnelModel = async (
  hashFirstName,
  hashMiddleName,
  hashLastName,
  status,
  hashGender,
  address,
  hashContactNumber,
  date_of_birth,
  study_enrolled_id, // primary study id
  notification,
  note,
  email,
  hashPassword,
  role_id,
  organization_detail_id, // primary site id
  hashImage,
  timezone
) => {
  const connection = await pool.getConnection();
  try {
    const passwordSetDate = new Date();
    // Insert into user table with reset_by_admin set to "true" for first-time login
    const [userResult] = await connection.query(
      "INSERT INTO user (email, password, password_set_date, reset_by_admin) VALUES (?, ?, ?, ?)",
      [email, hashPassword, passwordSetDate, "true"]
    );
    const userId = userResult.insertId;

    // Insert into organization table (using primary site and study)
    await connection.query(
      `INSERT INTO organization (user_id, first_name, middle_name, last_name, status, gender, address,timezone, contact_number, date_of_birth, image, study_enrolled_id, date_enrolled, notification, organization_detail_id, role_id) VALUES (?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        hashFirstName,
        hashMiddleName || null,
        hashLastName,
        status,
        hashGender,
        address,
        timezone,
        hashContactNumber,
        formatDate(date_of_birth, "US"),
        hashImage,
        study_enrolled_id,
        formatDate(new Date(), "US"),
        notification,
        organization_detail_id,
        role_id,
      ]
    );

    // Insert into note table
    await connection.query("INSERT INTO note (user_id, note) VALUES (?, ?)", [
      userId,
      note,
    ]);

    // Insert into validate_organization table
    await connection.query(
      `INSERT INTO validate_organization (user_id, first_name, middle_name, last_name, status, gender, address, contact_number, date_of_birth, image, study_enrolled_id, date_enrolled, notification, organization_detail_id, role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        hashFirstName,
        hashMiddleName || null,
        hashLastName,
        status,
        hashGender,
        address,
        hashContactNumber,
        formatDate(date_of_birth, "US"),
        hashImage,
        study_enrolled_id,
        formatDate(new Date(), "US"),
        notification,
        organization_detail_id,
        role_id,
      ]
    );

    // Insert into user_role table
    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, role_id]
    );

    // Insert into patient_account_status table
    await insertPatientAccountStatus(userId, "Pending", "Initial registration");

    const [emailTypes] = await connection.query(
      "SELECT email_type_id FROM email_types"
    );
    for (const emailType of emailTypes) {
      await connection.query(
        "INSERT INTO email_sent_notification (email_type_id, personel_id, status) VALUES (?, ?, ?)",
        [emailType.email_type_id, userId, "Enable"]
      );
    }

    return { userId };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
};

const signinOrganization = async (email, password) => {
  const connection = await pool.getConnection();
  try {
    // Start transaction after getting all required data
    const [userResult] = await connection.query(
      "SELECT * FROM user WHERE email = ? FOR UPDATE", // Added FOR UPDATE to prevent concurrent modifications
      [email]
    );

    if (userResult.length === 0) {
      return null;
    }

    const user = userResult[0];
    const userId = user.user_id;

    // Now start the transaction since we have the user data
    await connection.beginTransaction();

    // Hash the input password
    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const passwordAge = new Date() - new Date(user.password_set_date);
    //const oneDay = 10 * 60 * 1000;
    const oneDay = 6 * 30 * 24 * 60 * 60 * 1000;

    if (passwordAge > oneDay) {
      // Added retry logic for deadlock
      let retries = 3;
      while (retries > 0) {
        try {
          await connection.query(
            `UPDATE user SET is_password_expired = 0 WHERE user_id = ?`,
            [user.user_id]
          );
          await connection.commit();
          break;
        } catch (err) {
          if (err.code === "ER_LOCK_DEADLOCK" && retries > 1) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms before retry
            continue;
          }
          throw err;
        }
      }

      return {
        status: "PasswordExpired",
        message: "Password has expired. Please reset your password.",
        requiresPasswordReset: true,
      };
    }

    if (user.password !== hashedPassword) {
      // Password is incorrect, increment failed_attempts
      await connection.query(
        `UPDATE user SET failed_attempts = failed_attempts + 1, last_failed_attempt = NOW() WHERE user_id = ?`,
        [userId]
      );

      // Check if failed_attempts exceeds limit
      const failedAttemptsLimit = 3;
      const currentFailedAttempts = user.failed_attempts || 0;
      if (currentFailedAttempts + 1 >= failedAttemptsLimit) {
          console.log("user is being locked.")
        // Block user account
        await blockUserAccount(userId, "Exceeded maximum login attempts");
        
        // Sending Locked email 
        try {
          const [userResultForLockedAccount] = await connection.query(
            `SELECT u.*, o.*, od.*, r.role_id FROM user as u
            JOIN organization as o on o.user_id = u.user_id
            JOIN organization_details as od on od.organization_detail_id = o.organization_detail_id
            JOIN user_role as ur on ur.user_id = u.user_id
            JOIN role as r on r.role_id = ur.role_id
            WHERE u.email = ?`, 
            [email]
          );

          if (userResultForLockedAccount.length > 0) {
          const userLocked = userResultForLockedAccount[0];

          console.log("Sending emails to users")
          await notifyLockedUsers(userLocked.ecrf_id, userLocked);
          console.log("Lock notification emails sent.")
          }

        } catch (err) {
          console.error("Lock email handler failed:", err);
          return res.status(500).json({ message: "Internal Server Error" });
        }
        
        await connection.commit();
        return null;
      } else {
        // Commit transaction for failed attempt increment
        await connection.commit();
        return null;
      }
    } else {
      // Password is correct, reset failed_attempts and proceed
      await connection.query(
        `UPDATE user SET failed_attempts = 0, last_failed_attempt = NULL WHERE user_id = ?`,
        [userId]
      );

      // Check patient_account_status table for account status
      const [statusResult] = await connection.query(
        `
       SELECT
  pas.account_status,
  o.status
FROM patient_account_status AS pas
JOIN organization AS o
  ON pas.user_id = o.user_id
WHERE pas.user_id = ?
ORDER BY pas.updated_at DESC
LIMIT 1;

        `,
        [userId]
      );

      if (statusResult.length === 0) {
        await connection.rollback();
        return null;
      }

      const accountStatus = statusResult[0].account_status;
      const organizationStatus = statusResult[0].status;

      if (organizationStatus === "Withdrew Consent") {
        await connection.rollback();
        return {
          status: "Withdrew Consent",
          message:
            "Your account has been Withdrew Consent. Please contact administrator.",
        };
      } else if (organizationStatus === "Lost to Follow up") {
        await connection.rollback();
        return {
          status: "Lost to Follow up",
          message:
            "Your account has been Lost to Follow up. Please contact administrator.",
        };
      } else if (organizationStatus === "Dropped") {
        await connection.rollback();
        return {
          status: "Dropped",
          message:
            "Your account has been Dropped. Please contact administrator.",
        };
      }

      if (accountStatus === "Blocked") {
        await connection.rollback();
        return {
          status: "Blocked",
          message:
            "Your account has been locked due to three unsuccessful password attempts. Please contact your administrator for assistance.",
        };
      } else if (accountStatus === "Pending") {
        await connection.rollback();
        return {
          status: "Pending",
          message:
            "Your account is not approved by admin. Please contact the admin.",
        };
      } else if (accountStatus === "Disabled") {
        await connection.rollback();
        return {
          status: "Disabled",
          message:
            "Your account has been disabled. Please contact administrator.",
        };
      } else if (accountStatus === "Deleted") {
        await connection.rollback();
        return {
          status: "Deleted",
          message:
            "Your account has been deleted. Please contact administrator.",
        };
      } else if (accountStatus === "Accepted") {
        await connection.commit();
        return user;
      } else {
        await connection.rollback();
        return null;
      }
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error during signinOrganization:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

const isUserExist = async (email) => {
  try {
    const [result] = await pool.query("SELECT * FROM user WHERE email = ?", [
      email,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

// const getAllOrganizations = async (personelId) => {
//   try {
//     const [result] = await pool.query(`
//       SELECT
//         o.*,
//         u.email,
//         org.organization_name,
//         pas.account_status,
//         org.organization_address,
//         notes.note,
//         ps.study_id AS enrolled_ids,
//         se.study_name AS study_names
//       FROM personel_subject ps
//       JOIN organization o ON ps.subject_id = o.user_id
//       JOIN user u ON o.user_id = u.user_id
//       JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
//       JOIN study_enrolled se ON ps.study_id = se.enrolled_id
//       JOIN (
//           SELECT user_id, MAX(note) AS note
//           FROM note
//           GROUP BY user_id
//       ) AS notes ON u.user_id = notes.user_id
//       JOIN patient_account_status pas ON u.user_id = pas.user_id
//       JOIN user_role ur ON u.user_id = ur.user_id
//       WHERE pas.account_status = 'Accepted'
//         AND ps.personel_id = ?
//         AND ur.role_id = 10
//       ORDER BY ps.personel_subject_id DESC;
//     `);

//     // Decrypt the encrypted fields and process study data
//     const decryptedResult = result.map((org) => {
//       try {
//         // Convert the study ids and names into arrays (even if there's only one)
//         const enrolledIds = org.enrolled_ids
//           ? org.enrolled_ids.toString().split(",")
//           : [];
//         const studyNames = org.study_names
//           ? org.study_names.toString().split(",")
//           : [];

//         return {
//           ...org,
//           first_name: decrypt(org.first_name),
//           last_name: decrypt(org.last_name),
//           middle_name: decrypt(org.middle_name),
//           gender: decrypt(org.gender),
//           contact_number: decrypt(org.contact_number),
//           image: org.image ? decrypt(org.image) : null,
//           study_enrolled: enrolledIds.map((id, index) => ({
//             id: parseInt(id, 10),
//             name: studyNames[index] || "",
//           })),
//         };
//       } catch (decryptionError) {
//         console.error("Decryption error:", decryptionError);
//         return org;
//       }
//     });

//     return decryptedResult;
//   } catch (err) {
//     throw err;
//   }
// };

const getAllOrganizations = async (personelId) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT DISTINCT
        o.*,
        u.email,
        org.organization_name,
        pas.account_status,
        org.organization_address,
        notes.note,
        ps.study_id AS enrolled_ids,
        se.study_name AS study_names
      FROM organization AS o
      LEFT JOIN personel_subject ps ON ps.subject_id = o.user_id
      JOIN user u ON o.user_id = u.user_id
      JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
      JOIN study_enrolled se ON ps.study_id = se.enrolled_id
      JOIN (
          SELECT user_id, MAX(note) AS note
          FROM note
          GROUP BY user_id
      ) AS notes ON u.user_id = notes.user_id
      JOIN patient_account_status pas ON u.user_id = pas.user_id
      JOIN user_role ur ON u.user_id = ur.user_id
      WHERE pas.account_status in ('Accepted', 'Blocked')
        AND ps.personel_id = ?
        AND ur.role_id = 10
      ORDER BY o.organization_id  DESC;
    `,
      [personelId]
    );

    // Decrypt the encrypted fields and process study data
    const decryptedResult = rows.map((org) => {
      try {
        // Convert the study ids and names into arrays (even if there's only one)
        const enrolledIds = org.enrolled_ids
          ? org.enrolled_ids.toString().split(",")
          : [];
        const studyNames = org.study_names
          ? org.study_names.toString().split(",")
          : [];

        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          middle_name: decrypt(org.middle_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id, 10),
            name: studyNames[index] || "",
          })),
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

// get all organization roles users only without the role id 10
const getAllOrganizationsRolesUser = async () => {
  try {
    const [result] = await pool.query(`
      SELECT
    o.*,
    u.email,
    org.organization_name,
    pas.account_status,
    org.organization_address,
    notes.note,
    o.study_enrolled_id AS enrolled_ids,
    GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names
FROM
    organization AS o
JOIN
    user AS u ON o.user_id = u.user_id
JOIN
    organization_details AS org ON o.organization_detail_id = org.organization_detail_id
LEFT JOIN
    study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
JOIN
    ( SELECT user_id, MAX(note) AS note FROM note GROUP BY user_id ) AS notes ON u.user_id = notes.user_id
JOIN
    patient_account_status AS pas ON u.user_id = pas.user_id
JOIN
    user_role AS ur ON u.user_id = ur.user_id
WHERE
    pas.account_status = 'Accepted'
    AND ur.role_id != 10
GROUP BY
    o.organization_id, u.email, org.organization_name, org.organization_address, notes.note, o.study_enrolled_id
ORDER BY
    o.organization_id DESC;

    `);
    // Decrypt the encrypted fields and process study data
    const decryptedResult = result.map((org) => {
      try {
        const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];

        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          middle_name: decrypt(org.middle_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
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

const getAllOrganizationsForRole = async (userId, roleId) => {
  try {
    // Check if the user has the specified role
    const [roleResult] = await pool.query(
      `
      SELECT ur.user_id
      FROM user_role ur
      WHERE ur.user_id = ? AND ur.role_id = ?
      `,
      [userId, roleId]
    );

    if (roleResult.length === 0) {
      throw new Error("User does not have the specified role");
    }

    // Fetch the user's organization info (study_enrolled_id and organization_detail_id)
    const [orgInfo] = await pool.query(
      `
      SELECT study_enrolled_id, organization_detail_id
      FROM organization
      WHERE user_id = ?
      `,
      [userId]
    );

    if (orgInfo.length === 0) {
      throw new Error("No organization found for this user");
    }

    const studyEnrolledId = orgInfo[0].study_enrolled_id;
    const organizationDetailId = orgInfo[0].organization_detail_id;

    // Fetch organizations matching the user's study_enrolled_id and organization_detail_id
    const [result] = await pool.query(
      `
      SELECT
          o.*,
          u.email,
          org.organization_name,
          pas.account_status,
          org.organization_address,
          notes.note,
          o.study_enrolled_id AS enrolled_ids,
          GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names
      FROM
          organization AS o
      JOIN
          user AS u ON o.user_id = u.user_id
      JOIN
          organization_details AS org ON o.organization_detail_id = org.organization_detail_id
      LEFT JOIN
          study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
      JOIN
          (
              SELECT
                  user_id,
                  MAX(note) AS note
              FROM
                  note
              GROUP BY
                  user_id
          ) AS notes ON u.user_id = notes.user_id
      JOIN
          patient_account_status AS pas ON u.user_id = pas.user_id
      JOIN
          user_role AS ur ON u.user_id = ur.user_id AND ur.role_id = 10
      WHERE
          pas.account_status = 'Accepted'
          AND o.organization_detail_id = ?
          AND FIND_IN_SET(?, o.study_enrolled_id) > 0
      GROUP BY
          o.organization_id,
          u.email,
          org.organization_name,
          org.organization_address,
          notes.note,
          o.study_enrolled_id
      ORDER BY
          o.organization_id DESC;
      `,
      [parseInt(organizationDetailId), parseInt(studyEnrolledId)]
    );

    // Decrypt the encrypted fields and format study data
    const decryptedResult = result.map((org) => {
      try {
        const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];

        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          middle_name: decrypt(org.middle_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return org; // Return the original org record if decryption fails
      }
    });

    return decryptedResult;
  } catch (err) {
    throw err;
  }
};
const getAllOrganizationsForInvestigator = async (investigatorId) => {
  try {
    // Check if the investigator has the Principal Investigator role (role_id = 12 or 17)
    const [roleResult] = await pool.query(
      `
      SELECT ur.user_id
      FROM user_role ur
      JOIN role r ON ur.role_id = r.role_id
      WHERE ur.user_id = ? AND (r.role_id = 12 OR r.role_id = 17 OR r.role_id =19)
      `,
      [investigatorId]
    );

    if (roleResult.length === 0) {
      throw new Error("User is not a Principal Investigator");
    }

    // Fetch organization info
    const [orgInfo] = await pool.query(
      `
      SELECT study_enrolled_id, organization_detail_id
      FROM organization
      WHERE user_id = ?
      `,
      [investigatorId]
    );

    if (orgInfo.length === 0) {
      throw new Error("No organization found for this investigator");
    }

    const studyEnrolledId = orgInfo[0].study_enrolled_id;
    const organizationDetailId = orgInfo[0].organization_detail_id;

    // Fetch organizations matching the investigator's study_enrolled_id and organization_detail_id
    const [result] = await pool.query(
      `
      SELECT
    o.*,
    u.email,
    org.organization_name,
    pas.account_status,
    org.organization_address,
    notes.note,
    o.study_enrolled_id AS enrolled_ids,
    GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names
FROM
    organization AS o
JOIN
    user AS u ON o.user_id = u.user_id
JOIN
    organization_details AS org ON o.organization_detail_id = org.organization_detail_id
LEFT JOIN
    study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
JOIN
    (
        SELECT
            user_id,
            MAX(note) AS note
        FROM
            note
        GROUP BY
            user_id
    ) AS notes ON u.user_id = notes.user_id
JOIN
    patient_account_status AS pas ON u.user_id = pas.user_id
JOIN
    user_role AS ur ON u.user_id = ur.user_id AND ur.role_id = 10
WHERE
    pas.account_status = 'Accepted'
    AND o.organization_detail_id = ?
    AND FIND_IN_SET(?, o.study_enrolled_id) > 0
GROUP BY
    o.organization_id,
    u.email,
    org.organization_name,
    org.organization_address,
    notes.note,
    o.study_enrolled_id
ORDER BY
    o.organization_id DESC; -- Change the column for desired ordering

      `,
      [parseInt(organizationDetailId), parseInt(studyEnrolledId)]
    );
    // Decrypt the encrypted fields and process study data
    const decryptedResult = result.map((org) => {
      try {
        const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];

        return {
          ...org,
          first_name: decrypt(org.first_name),
          last_name: decrypt(org.last_name),
          middle_name: decrypt(org.middle_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
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

const getOrganizationById = async (paramUserId, tokenUserId) => {
  try {
    // First, check if the paramUserId exists in user_role table and get their role_id
    const [userRoleResult] = await pool.query(
      `SELECT role_id FROM user_role WHERE user_id = ?`,
      [paramUserId]
    );

    // Default to role_id 10 (subject) if no role is found
    let userRoleId = 10;
    if (userRoleResult && userRoleResult.length > 0) {
      userRoleId = userRoleResult[0].role_id;
    }

    // If tokenUserId is different from paramUserId, check authorization
    if (Number(tokenUserId) !== Number(paramUserId)) {
      const [personelRows] = await pool.query(
        `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
        [tokenUserId, paramUserId]
      );
      if (!personelRows || personelRows.length === 0) {
        const error = new Error(
          "Unauthorized: No matching record found in personel_subject"
        );
        error.statusCode = 401;
        throw error;
      }
    }

    let rows;

    // Different query based on role_id
    if (userRoleId != 10) {
      // For non-subject roles (roleId != 10), get study_id from personnel_assigned_sites_studies
      const [studyIds] = await pool.query(
        `SELECT study_id FROM personnel_assigned_sites_studies WHERE personnel_id = ?`,
        [paramUserId]
      );

      // Log warning if no studies assigned, but continue with the query
      if (!studyIds || studyIds.length === 0) {
        console.warn(
          `Warning: No studies assigned to personnel with ID ${paramUserId}`
        );
      }

      // For non-subject roles (roleId != 10), include additional data from personnel_assigned_sites_studies
      const [result] = await pool.query(
        `SELECT o.*, u.email,
          org.organization_name, org.organization_address, notes.note,
          GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
          GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
          GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
          GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
          GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
        FROM organization AS o
        JOIN user AS u ON o.user_id = u.user_id
        JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
        LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
        LEFT JOIN (
          SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id, inv_org.organization_detail_id
          FROM organization AS inv_org
          JOIN user_role AS r ON inv_org.user_id = r.user_id
          WHERE r.role_id = 12
        ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
          AND inv.organization_detail_id = o.organization_detail_id
        JOIN (
          SELECT user_id, MAX(note) AS note
          FROM note
          GROUP BY user_id
        ) AS notes ON u.user_id = notes.user_id
        WHERE o.user_id = ?
        GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
                org.organization_name, org.organization_address, notes.note`,
        [paramUserId]
      );

      rows = result;

      // Get additional data from personnel_assigned_sites_studies
      const [sitesStudies] = await pool.query(
        `SELECT
          pass.id, pass.personnel_id, pass.site_id, pass.study_id,
          od.organization_detail_id, od.organization_name, od.organization_address,
          se.enrolled_id, se.study_name
        FROM personnel_assigned_sites_studies pass
        LEFT JOIN organization_details od ON pass.site_id = od.organization_detail_id
        LEFT JOIN study_enrolled se ON pass.study_id = se.enrolled_id
        WHERE pass.personnel_id = ?`,
        [paramUserId]
      );

      // Process the additional data
      if (rows.length > 0 && sitesStudies.length > 0) {
        // Group sites
        const investigator_sites = [];
        const siteIds = new Set();

        sitesStudies.forEach((item) => {
          if (
            item.organization_detail_id &&
            !siteIds.has(item.organization_detail_id)
          ) {
            siteIds.add(item.organization_detail_id);
            investigator_sites.push({
              organization_detail_id: item.organization_detail_id,
              organization_name: item.organization_name,
              organization_address: item.organization_address,
            });
          }
        });

        // Group studies
        const investigator_studies = [];
        const studyIds = new Set();

        sitesStudies.forEach((item) => {
          if (item.enrolled_id && !studyIds.has(item.enrolled_id)) {
            studyIds.add(item.enrolled_id);
            investigator_studies.push({
              enrolled_id: item.enrolled_id,
              study_name: item.study_name,
            });
          }
        });

        // Add to the first row
        rows[0].investigator_sites = investigator_sites;
        rows[0].investigator_studies = investigator_studies;
      }
    } else {
      // For subjects (roleId = 10), check study_enrolled_id in organization table
      const [studyEnrolled] = await pool.query(
        `SELECT study_enrolled_id FROM organization WHERE user_id = ?`,
        [paramUserId]
      );

      if (
        !studyEnrolled ||
        studyEnrolled.length === 0 ||
        !studyEnrolled[0].study_enrolled_id
      ) {
        // Log warning if no studies enrolled, but continue with the query
        console.warn(
          `Warning: No studies enrolled for subject with ID ${paramUserId}`
        );
      }

      // For subjects (roleId = 10), use the original query
      const [result] = await pool.query(
        `SELECT o.*, u.email,
        pas.account_status,
          org.organization_name, org.organization_address, notes.note,
          GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
          GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
          GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
          GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
          GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
        FROM organization AS o
        JOIN user AS u ON o.user_id = u.user_id
        JOIN patient_account_status as pas ON pas.user_id = u.user_id
        JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
        LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
        LEFT JOIN (
          SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id, inv_org.organization_detail_id
          FROM organization AS inv_org
          JOIN user_role AS r ON inv_org.user_id = r.user_id
          WHERE r.role_id = 12
        ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
          AND inv.organization_detail_id = o.organization_detail_id
        JOIN (
          SELECT user_id, MAX(note) AS note
          FROM note
          GROUP BY user_id
        ) AS notes ON u.user_id = notes.user_id
        WHERE o.user_id = ?
        GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
                org.organization_name, org.organization_address, notes.note`,
        [paramUserId]
      );

      rows = result;
    }

    if (!rows || rows.length === 0) {
      return null;
    }

    let org = rows[0];

    try {
      const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
      const studyNames = org.study_names ? org.study_names.split(",") : [];
      const investigatorUserIds = org.investigator_user_ids
        ? org.investigator_user_ids.split(",")
        : [];
      const investigatorFirstNames = org.investigator_first_names
        ? org.investigator_first_names.split(",")
        : [];
      const investigatorLastNames = org.investigator_last_names
        ? org.investigator_last_names.split(",")
        : [];

      // Decrypt or handle fields
      const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
        user_id: parseInt(id, 10),
        first_name: decrypt(investigatorFirstNames[index] || ""),
        last_name: decrypt(investigatorLastNames[index] || ""),
      }));

      org = {
        ...org,
        first_name: decrypt(org.first_name || ""),
        middle_name: decrypt(org.middle_name || ""),
        last_name: decrypt(org.last_name || ""),
        gender: decrypt(org.gender || ""),
        contact_number: decrypt(org.contact_number || ""),
        image: org.image ? decrypt(org.image) : null,
        study_enrolled: enrolledIds.map((id, index) => ({
          id: parseInt(id, 10),
          name: studyNames[index] || "",
        })),
        investigators: decryptedInvestigators,
      };

      delete org.investigator_first_names;
      delete org.investigator_last_names;
    } catch (decryptionError) {
      console.error("Decryption error:", decryptionError);
    }

    return org;
  } catch (err) {
    throw err; // Let the controller handle the status code
  }
};

// const getOrganizationById = async (paramUserId, tokenUserId) => {
//   try {
//     if (Number(tokenUserId) !== Number(paramUserId)) {
//       const [personelRows] = await pool.query(
//         `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
//         [tokenUserId, paramUserId]
//       );
//       if (!personelRows || personelRows.length === 0) {
//         const error = new Error(
//           "Unauthorized: No matching record found in personel_subject"
//         );
//         error.statusCode = 401;
//         throw error;
//       }
//     }

//     let rows;

//     // Different query based on role_id
//     if (roleId != 10) {
//       // For non-subject roles (roleId != 10), include additional data from personnel_assigned_sites_studies
//       const [result] = await pool.query(
//         `SELECT o.*, u.email,
//           org.organization_name, org.organization_address, notes.note,
//           GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
//           GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
//           GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
//           GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
//           GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
//         FROM organization AS o
//         JOIN user AS u ON o.user_id = u.user_id
//         JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
//         LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
//         LEFT JOIN (
//           SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id, inv_org.organization_detail_id
//           FROM organization AS inv_org
//           JOIN user_role AS r ON inv_org.user_id = r.user_id
//           WHERE r.role_id = 12
//         ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
//           AND inv.organization_detail_id = o.organization_detail_id
//         JOIN (
//           SELECT user_id, MAX(note) AS note
//           FROM note
//           GROUP BY user_id
//         ) AS notes ON u.user_id = notes.user_id
//         WHERE o.user_id = ?
//         GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
//                 org.organization_name, org.organization_address, notes.note`,
//         [paramUserId]
//       );

//       rows = result;

//       // Get additional data from personnel_assigned_sites_studies
//       const [sitesStudies] = await pool.query(
//         `SELECT
//           pass.id, pass.personnel_id, pass.site_id, pass.study_id,
//           od.organization_detail_id, od.organization_name, od.organization_address,
//           se.enrolled_id, se.study_name
//         FROM personnel_assigned_sites_studies pass
//         LEFT JOIN organization_details od ON pass.site_id = od.organization_detail_id
//         LEFT JOIN study_enrolled se ON pass.study_id = se.enrolled_id
//         WHERE pass.personnel_id = ?`,
//         [paramUserId]
//       );

//       // Process the additional data
//       if (rows.length > 0 && sitesStudies.length > 0) {
//         // Group sites
//         const investigator_sites = [];
//         const siteIds = new Set();

//         sitesStudies.forEach((item) => {
//           if (
//             item.organization_detail_id &&
//             !siteIds.has(item.organization_detail_id)
//           ) {
//             siteIds.add(item.organization_detail_id);
//             investigator_sites.push({
//               organization_detail_id: item.organization_detail_id,
//               organization_name: item.organization_name,
//               organization_address: item.organization_address,
//             });
//           }
//         });

//         // Group studies
//         const investigator_studies = [];
//         const studyIds = new Set();

//         sitesStudies.forEach((item) => {
//           if (item.enrolled_id && !studyIds.has(item.enrolled_id)) {
//             studyIds.add(item.enrolled_id);
//             investigator_studies.push({
//               enrolled_id: item.enrolled_id,
//               study_name: item.study_name,
//             });
//           }
//         });

//         // Add to the first row
//         rows[0].investigator_sites = investigator_sites;
//         rows[0].investigator_studies = investigator_studies;
//       }
//     } else {
//       // For subjects (roleId = 10), use the original query
//       const [result] = await pool.query(
//         `SELECT o.*, u.email,
//           org.organization_name, org.organization_address, notes.note,
//           GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
//           GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
//           GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
//           GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
//           GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
//         FROM organization AS o
//         JOIN user AS u ON o.user_id = u.user_id
//         JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
//         LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
//         LEFT JOIN (
//           SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id, inv_org.organization_detail_id
//           FROM organization AS inv_org
//           JOIN user_role AS r ON inv_org.user_id = r.user_id
//           WHERE r.role_id = 12
//         ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
//           AND inv.organization_detail_id = o.organization_detail_id
//         JOIN (
//           SELECT user_id, MAX(note) AS note
//           FROM note
//           GROUP BY user_id
//         ) AS notes ON u.user_id = notes.user_id
//         WHERE o.user_id = ?
//         GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
//                 org.organization_name, org.organization_address, notes.note`,
//         [paramUserId]
//       );

//       rows = result;
//     }

//     if (!rows || rows.length === 0) {
//       return null;
//     }

//     let org = rows[0];

//     try {
//       const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
//       const studyNames = org.study_names ? org.study_names.split(",") : [];
//       const investigatorUserIds = org.investigator_user_ids
//         ? org.investigator_user_ids.split(",")
//         : [];
//       const investigatorFirstNames = org.investigator_first_names
//         ? org.investigator_first_names.split(",")
//         : [];
//       const investigatorLastNames = org.investigator_last_names
//         ? org.investigator_last_names.split(",")
//         : [];

//       // Decrypt or handle fields
//       const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
//         user_id: parseInt(id, 10),
//         first_name: decrypt(investigatorFirstNames[index] || ""),
//         last_name: decrypt(investigatorLastNames[index] || ""),
//       }));

//       org = {
//         ...org,
//         first_name: decrypt(org.first_name || ""),
//         middle_name: decrypt(org.middle_name || ""),
//         last_name: decrypt(org.last_name || ""),
//         gender: decrypt(org.gender || ""),
//         contact_number: decrypt(org.contact_number || ""),
//         image: org.image ? decrypt(org.image) : null,
//         study_enrolled: enrolledIds.map((id, index) => ({
//           id: parseInt(id, 10),
//           name: studyNames[index] || "",
//         })),
//         investigators: decryptedInvestigators,
//       };

//       delete org.investigator_first_names;
//       delete org.investigator_last_names;
//     } catch (decryptionError) {
//       console.error("Decryption error:", decryptionError);
//     }

//     return org;
//   } catch (err) {
//     throw err; // Let the controller handle the status code
//   }
// };

const getOrganizationByIdForLog = async (organization_id) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM organization WHERE organization_id = ?",
      [organization_id]
    );
    if (result.length > 0) {
      let org = result[0];
      try {
        const enrolledIds = org.study_enrolled_id
          ? org.study_enrolled_id.split(",")
          : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];

        org = {
          ...org,
          first_name: decrypt(org.first_name),
          middle_name: decrypt(org.middle_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
        };
        console.log(org, "--------------------");
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
      }
      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

const updateOrganization = async (
  organization_id,
  email,
  hashFirstName,
  hashMiddleName,
  hashLastName,
  status,
  hashGender,
  address,
  hashContactNumber,
  date_of_birth,
  stipend,
  study_enrolled_ids,
  notification,
  note,
  ecrf_id,
  hashimage,
  reason = "Hi!!!",
  user_id,
  investigator_id,
  updateEntity = "ORGANIZATION",
  actionEntity = "UPDATE"
) => {
  try {
    // Base query without image
    let query =
      "UPDATE organization AS o JOIN user AS u ON o.user_id = u.user_id JOIN note AS n ON u.user_id = n.user_id SET  o.first_name = ?, o.middle_name = ?, o.last_name = ?, o.status = ?, o.gender = ?, o.address = ?, o.contact_number = ?,date_of_birth=?, o.stipend = ?, o.study_enrolled_id = ?, o.notification = ?, n.note = ?, ecrf_id = ?";
    let values = [
      hashFirstName,
      hashMiddleName || null,
      hashLastName,
      status,
      hashGender,
      address,
      hashContactNumber,
      date_of_birth,
      stipend,
      study_enrolled_ids,
      notification,
      note,
      ecrf_id,
    ];

    // If an image is provided, add it to the query and values
    if (hashimage) {
      query += ", o.image = ?";
      values.push(hashimage);
    }
    if (email) {
      query += ", u.email =?";
      values.push(email);
    }
    // Add WHERE clause
    query += " WHERE o.organization_id = ?";
    values.push(organization_id);
    console.log("Updating organization with values:", values);

    // Execute the update query
    const [result] = await pool.query(query, values);

    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,update_entity,	action_entity,	reason ) VALUES (?,?,?,?,?)`;
    let values2 = [
      user_id,
      investigator_id,
      updateEntity,
      actionEntity,
      reason,
    ];
    const res = await pool.query(reason_table, values2);

    return (data = {
      result,
      res,
    });
  } catch (err) {
    console.error("Error in updateOrganization:", err);
    throw err;
  }
};

const getisRandomized = async (organization_id) => {
  try {
    const query = `
      SELECT *
      FROM organization
      WHERE organization_id = ?
    `;
    const [result] = await pool.execute(query, [organization_id]);
    return result[0];
  } catch (err) {
    console.error("Get isRandomized Error:", err);
    throw err;
  }
};

const updateIsRandomized = async (organization_id, newIsRandomized) => {
  try {
    const query =
      "UPDATE organization SET is_randomized = ? WHERE organization_id = ?";
    const values = [newIsRandomized, organization_id];
    const [result] = await pool.execute(query, values);
    return result;
  } catch (err) {
    console.log(err, "error updating is_randomized");
    throw err;
  }
};

const checkEcrfIdExists = async (ecrf_id, organization_id) => {
  try {
    const [results] = await pool.query(
      "SELECT COUNT(*) AS count FROM organization WHERE ecrf_id = ? AND organization_id != ?",
      [ecrf_id, organization_id]
    );
    return results[0].count > 0;
  } catch (err) {
    throw err;
  }
};

const deleteOrganization = async (
  user_id,
  investigator_id,
  reason,
  updateEntity = "ORGANIZATION",
  actionEntity = "DELETE"
) => {
  try {
    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?)`;
    let values2 = [
      user_id,
      investigator_id,
      updateEntity,
      actionEntity,
      reason,
    ];
    const recordReason = await pool.query(reason_table, values2);

    const [patientAccountStatusResult] = await pool.query(
      `UPDATE patient_account_status
       SET account_status = 'Disabled', reason = ? ,updated_at= NOW()
       WHERE user_id = ?`,
      [reason, user_id]
    );

    const [userSchedules] = await pool.query(
      `SELECT *
       FROM schedule
       WHERE user_id = ?`,
      [user_id]
    );

    if (userSchedules.length > 0) {
      await pool.query(
        `UPDATE schedule
         SET disable_status = 'Disable'
         WHERE user_id = ?`,
        [user_id]
      );
    }

    const [userMedications] = await pool.query(
      `SELECT *
       FROM patientmedications
       WHERE user_id = ?`,
      [user_id]
    );

    if (userMedications.length > 0) {
      await pool.query(
        `UPDATE patientmedications
         SET disable_status = 'Disable'
         WHERE user_id = ?`,
        [user_id]
      );
    }

    const [incidentReports] = await pool.query(
      `SELECT id
       FROM incident_reports
       WHERE user_id = ?`,
      [user_id]
    );

    for (const report of incidentReports) {
      const incidentReportId = report.id;

      await pool.query(
        `UPDATE adverse_ticketing_system
         SET status = 'Archived'
         WHERE incident_report_id = ?`,
        [incidentReportId]
      );
    }

    return {
      message:
        "Organization deleted/disabled and related records updated successfully.",
      patientAccountStatusResult,
      updatedSchedules: userSchedules.length,
      updatedMedications: userMedications.length,
      updatedIncidentReports: incidentReports.length,
      recordReason,
    };
  } catch (err) {
    console.error("Error deleting organization:", err);
    throw err;
  }
};

const createOrganizationDetail = async (
  organization_name,
  organization_address,
  timezone
) => {
  try {
    const [result] = await pool.query(
      `INSERT INTO organization_details (organization_name, organization_address,timezone) VALUES (?,?, ?)`,
      [organization_name, organization_address, timezone]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const updateOrganizationDetail = async (
  organization_address,
  organization_detail_id,
  timezone
) => {
  try {
    const [result] = await pool.query(
      "UPDATE organization_details SET organization_address = ?, timezone=? WHERE organization_detail_id = ?",
      [organization_address, timezone, organization_detail_id]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getOrganizationByNameOrAddress = async (
  organization_name,
  organization_address
) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM organization_details WHERE organization_name = ? OR organization_address = ?",
      [organization_name, organization_address]
    );
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

const getOrganizationByAddressForDifferentId = async (
  organization_address,
  organization_detail_id
) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM organization_details WHERE organization_address = ? AND organization_detail_id != ?",
      [organization_address, organization_detail_id]
    );
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

const getOrganizationDetailById = async (organization_detail_id) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM organization_details WHERE organization_detail_id = ?",
      [organization_detail_id]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getAllOrganizationDetails = async () => {
  try {
    const [result] = await pool.query(`SELECT * FROM organization_details`);
    return result;
  } catch (err) {
    throw err;
  }
};

const updateOrganizationStatus = async (organization_id, status) => {
  try {
    const [result] = await pool.query(
      "UPDATE organization SET status = ? WHERE organization_id = ?",
      [status, organization_id]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getNonComplaint = async () => {
  try {
    const [result] = await pool.query(`
      SELECT o.first_name, o.last_name, o.status, u.user_id, u.email
      FROM organization AS o
      JOIN user AS u ON o.user_id = u.user_id
      WHERE o.status = "Non-Compliant"
    `);

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

const getNonCompliantForInvestigator = async (investigatorId) => {
  try {
    // Fetch the investigator's study_enrolled_id
    const [investigatorResult] = await pool.query(
      `SELECT study_enrolled_id FROM organization WHERE user_id = ?`,
      [investigatorId]
    );

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    const studyEnrolledId = investigatorResult[0].study_enrolled_id;

    // Fetch non-compliant patients matching the study_enrolled_id
    const [result] = await pool.query(
      `
      SELECT
        o.first_name,
        o.last_name,
        o.status,
        u.user_id,
        u.email
      FROM
        organization AS o
      JOIN
        user AS u ON o.user_id = u.user_id
      JOIN
        user_role AS ur ON u.user_id = ur.user_id
      WHERE
        o.status = "Non-Compliant"
        AND ur.role_id = 10
        AND FIND_IN_SET(?, o.study_enrolled_id) > 0
      `,
      [studyEnrolledId]
    );

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

const getUserById = async (userId) => {
  try {
    const [result] = await pool.query("SELECT * FROM user WHERE user_id = ?", [
      userId,
    ]);
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

// const updateUserPassword = async (userId, newPasswordHash) => {
//   try {
//     // Check if the user is assigned the role with role_id = 10 or 12
//     const [roleResult] = await pool.query(
//       "SELECT COUNT(*) AS count FROM user_role WHERE user_id = ? AND (role_id = 10 OR role_id = 12)",
//       [userId]
//     );

//     const resetByAdmin = roleResult[0].count > 0 ? "false" : "true";

//     // Update the user's password and reset_by_admin status
//     const [updateResult] = await pool.query(
//       "UPDATE user SET password = ?, reset_by_admin = ? WHERE user_id = ?",
//       [newPasswordHash, resetByAdmin, userId]
//     );

//     return updateResult;
//   } catch (err) {
//     throw err;
//   }
// };

const updateUserPassword = async (userId, newPasswordHash) => {
  try {
    // When a user changes their password, always set reset_by_admin to "false"
    // This indicates they have changed their password and don't need to be prompted again
    const resetByAdmin = "false";

    // Update password_set_date to current time and set reset_by_admin to false
    const passwordSetDate = new Date();
    const [updateResult] = await pool.query(
      "UPDATE user SET password = ?, reset_by_admin = ?, password_set_date = ? WHERE user_id = ?",
      [newPasswordHash, resetByAdmin, passwordSetDate, userId]
    );

    return updateResult;
  } catch (err) {
    throw err;
  }
};

const getPasswordHistory = async (userId) => {
  try {
    const [results] = await pool.query(
      "SELECT password FROM password_history WHERE user_id = ? ORDER BY changed_at DESC LIMIT 2",
      [userId]
    );
    return results.map((row) => row.password);
  } catch (err) {
    throw err;
  }
};

// Insert the current password into the password_history table and ensure only the last two entries are kept
const addPasswordHistory = async (userId, passwordHash) => {
  try {
    // Insert a new history record
    await pool.query(
      "INSERT INTO password_history (user_id, password) VALUES (?, ?)",
      [userId, passwordHash]
    );

    // Check the total number of history entries for the user
    const [countResult] = await pool.query(
      "SELECT COUNT(*) AS count FROM password_history WHERE user_id = ?",
      [userId]
    );
    // If there are more than 2 entries, delete the oldest one(s)
    if (countResult[0].count > 5) {
      await pool.query(
        "DELETE FROM password_history WHERE user_id = ? ORDER BY changed_at ASC LIMIT 1",
        [userId]
      );
    }
  } catch (err) {
    throw err;
  }
};

// const getUserDetails = async (userId,roleId) => {
//   try {
//     const [result] = await pool.query(
//       `
//       SELECT u.user_id, u.email, u.failed_attempts, u.last_failed_attempt,
//              o.first_name, o.middle_name, o.last_name, o.gender, o.address, o.status,
//              o.contact_number, o.date_of_birth, o.stipend, o.image, o.ecrf_id,o.organization_id,
//              o.study_enrolled_id AS enrolled_ids,
//              GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names,
//              n.note,
//              pas.account_status, pas.reason, pas.account_status_id,
//              r.role_id, r.role_name
//       FROM user AS u
//       JOIN organization AS o ON u.user_id = o.user_id
//       LEFT JOIN study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
//       LEFT JOIN note AS n ON u.user_id = n.user_id
//       LEFT JOIN patient_account_status AS pas ON u.user_id = pas.user_id
//       LEFT JOIN user_role AS ur ON u.user_id = ur.user_id
//       LEFT JOIN role AS r ON ur.role_id = r.role_id
//       WHERE u.user_id = ?
//       GROUP BY u.user_id, o.first_name, o.middle_name, o.last_name,
//                o.gender, o.address, o.contact_number, o.date_of_birth,
//                o.stipend, o.image, o.study_enrolled_id, n.note,
//                pas.account_status, pas.reason, pas.account_status_id,
//                r.role_id, r.role_name
//       `,
//       [userId]
//     );

//     if (result.length === 0) {
//       return null; // No user found with the given user_id
//     }

//     const user = result[0];
//     try {
//       const enrolledIds = user.enrolled_ids ? user.enrolled_ids.split(",") : [];
//       const studyNames = user.study_names ? user.study_names.split(",") : [];

//       const decryptedUser = {
//         ...user,
//         first_name: decrypt(user.first_name),
//         middle_name: user.middle_name ? decrypt(user.middle_name) : null,
//         last_name: decrypt(user.last_name),
//         gender: decrypt(user.gender),
//         contact_number: decrypt(user.contact_number),
//         address: user.address,
//         image: user.image ? decrypt(user.image) : null,
//         study_enrolled: enrolledIds.map((id, index) => ({
//           id: parseInt(id),
//           name: studyNames[index] || "",
//         })),
//         account_status: user.account_status,
//         status: user.status,
//         reason: user.reason,
//         role: {
//           id: user.role_id,
//           name: user.role_name,
//         },
//       };

//       return decryptedUser;
//     } catch (decryptionError) {
//       console.error("Decryption error:", decryptionError);
//       return user;
//     }
//   } catch (err) {
//     throw err;
//   }
// };

const getUserDetails = async (userId, roleId) => {
  try {
    let rows;

    // Different query based on role_id
    if (roleId != 10) {
      // For non-subject roles (roleId != 10), include additional data from personnel_assigned_sites_studies
      const [result] = await pool.query(
        `
        SELECT u.user_id, u.email, u.failed_attempts, u.last_failed_attempt,
               o.first_name, o.middle_name, o.last_name, o.gender, o.address, o.status,
               o.contact_number, o.date_of_birth, o.stipend, o.image, o.ecrf_id, o.organization_id,
               o.study_enrolled_id AS enrolled_ids,
               GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names,
               n.note,
               pas.account_status, pas.reason, pas.account_status_id,
               r.role_id, r.role_name
        FROM user AS u
        JOIN organization AS o ON u.user_id = o.user_id
        LEFT JOIN study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
        LEFT JOIN note AS n ON u.user_id = n.user_id
        LEFT JOIN patient_account_status AS pas ON u.user_id = pas.user_id
        LEFT JOIN user_role AS ur ON u.user_id = ur.user_id
        LEFT JOIN role AS r ON ur.role_id = r.role_id
        WHERE u.user_id = ?
        GROUP BY u.user_id, o.first_name, o.middle_name, o.last_name,
                 o.gender, o.address, o.contact_number, o.date_of_birth,
                 o.stipend, o.image, o.study_enrolled_id, n.note,
                 pas.account_status, pas.reason, pas.account_status_id,
                 r.role_id, r.role_name
        `,
        [userId]
      );

      rows = result;

      // Get additional data from personnel_assigned_sites_studies
      const [sitesStudies] = await pool.query(
        `SELECT
          pass.id, pass.personnel_id, pass.site_id, pass.study_id,
          od.organization_detail_id, od.organization_name, od.organization_address,
          se.enrolled_id, se.study_name
        FROM personnel_assigned_sites_studies pass
        LEFT JOIN organization_details od ON pass.site_id = od.organization_detail_id
        LEFT JOIN study_enrolled se ON pass.study_id = se.enrolled_id
        WHERE pass.personnel_id = ?`,
        [userId]
      );

      // Process the additional data
      if (rows.length > 0 && sitesStudies.length > 0) {
        // Group sites
        const investigator_sites = [];
        const siteIds = new Set();

        sitesStudies.forEach((item) => {
          if (
            item.organization_detail_id &&
            !siteIds.has(item.organization_detail_id)
          ) {
            siteIds.add(item.organization_detail_id);
            investigator_sites.push({
              organization_detail_id: item.organization_detail_id,
              organization_name: item.organization_name,
              organization_address: item.organization_address,
            });
          }
        });

        // Group studies
        const investigator_studies = [];
        const studyIds = new Set();

        sitesStudies.forEach((item) => {
          if (item.enrolled_id && !studyIds.has(item.enrolled_id)) {
            studyIds.add(item.enrolled_id);
            investigator_studies.push({
              enrolled_id: item.enrolled_id,
              study_name: item.study_name,
            });
          }
        });

        // Add to the first row
        rows[0].investigator_sites = investigator_sites;
        rows[0].investigator_studies = investigator_studies;
      }
    } else {
      // For subjects (roleId = 10), use the original query
      const [result] = await pool.query(
        `
        SELECT u.user_id, u.email, u.failed_attempts, u.last_failed_attempt,
               o.first_name, o.middle_name, o.last_name, o.gender, o.address, o.status,
               o.contact_number, o.date_of_birth, o.stipend, o.image, o.ecrf_id, o.organization_id,
               o.study_enrolled_id AS enrolled_ids,
               GROUP_CONCAT(DISTINCT st.study_name ORDER BY st.enrolled_id) AS study_names,
               n.note,
               pas.account_status, pas.reason, pas.account_status_id,
               r.role_id, r.role_name
        FROM user AS u
        JOIN organization AS o ON u.user_id = o.user_id
        LEFT JOIN study_enrolled AS st ON FIND_IN_SET(st.enrolled_id, o.study_enrolled_id) > 0
        LEFT JOIN note AS n ON u.user_id = n.user_id
        LEFT JOIN patient_account_status AS pas ON u.user_id = pas.user_id
        LEFT JOIN user_role AS ur ON u.user_id = ur.user_id
        LEFT JOIN role AS r ON ur.role_id = r.role_id
        WHERE u.user_id = ?
        GROUP BY u.user_id, o.first_name, o.middle_name, o.last_name,
                 o.gender, o.address, o.contact_number, o.date_of_birth,
                 o.stipend, o.image, o.study_enrolled_id, n.note,
                 pas.account_status, pas.reason, pas.account_status_id,
                 r.role_id, r.role_name
        `,
        [userId]
      );

      rows = result;
    }

    if (rows.length === 0) {
      return null; // No user found with the given user_id
    }

    const user = rows[0];
    try {
      const enrolledIds = user.enrolled_ids ? user.enrolled_ids.split(",") : [];
      const studyNames = user.study_names ? user.study_names.split(",") : [];

      const decryptedUser = {
        ...user,
        first_name: decrypt(user.first_name),
        middle_name: user.middle_name ? decrypt(user.middle_name) : null,
        last_name: decrypt(user.last_name),
        gender: decrypt(user.gender),
        contact_number: decrypt(user.contact_number),
        address: user.address,
        image: user.image ? decrypt(user.image) : null,
        study_enrolled: enrolledIds.map((id, index) => ({
          id: parseInt(id),
          name: studyNames[index] || "",
        })),
        account_status: user.account_status,
        status: user.status,
        reason: user.reason,
        role: {
          id: user.role_id,
          name: user.role_name,
        },
      };

      return decryptedUser;
    } catch (decryptionError) {
      console.error("Decryption error:", decryptionError);
      return user;
    }
  } catch (err) {
    throw err;
  }
};

const getUserByEmail = async (email) => {
  try {
    const [result] = await pool.query("SELECT * FROM user WHERE email = ?", [
      email,
    ]);
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

const storeOtp = async (email, otp, expireAt) => {
  try {
    const [result] = await pool.query(
      "INSERT INTO otp_generator (email, otp, expire_at) VALUES (?, ?, ?)",
      [email, otp, expireAt]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getOtpRecord = async (email, otp) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM otp_generator WHERE email = ? AND otp = ?",
      [email, otp]
    );
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

const updateOtpWithToken = async (otp_id, token) => {
  try {
    const [result] = await pool.query(
      "UPDATE otp_generator SET token = ? WHERE otp_id = ?",
      [token, otp_id]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getOtpRecordByToken = async (email, token) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM otp_generator WHERE email = ? AND token = ?",
      [email, token]
    );
    return result[0] || null;
  } catch (err) {
    throw err;
  }
};

const updateUserPasswordModel = async (email, newPasswordHash) => {
  try {
    const newPasswordDate = new Date();
    // Also set reset_by_admin to "false" when a user resets their password
    const [result] = await pool.query(
      "UPDATE user SET password = ?, password_set_date = ?, reset_by_admin = ? WHERE email = ?",
      [newPasswordHash, newPasswordDate, "false", email]
    );
    return result;
  } catch (err) {
    throw err;
  }
};

const getInvestigatorByStudyId = async (study_id) => {
  try {
    const [results] = await pool.query(
      `
      SELECT u.user_id, u.email AS investigator_email,
             o.first_name AS investigator_first_name,
             o.last_name AS investigator_last_name
      FROM study_enrolled AS se
      JOIN organization AS o ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
      JOIN user_role AS ur ON o.user_id = ur.user_id
      JOIN user AS u ON o.user_id = u.user_id
      WHERE se.enrolled_id = ? AND ur.role_id = 12;
      `,
      [study_id]
    );

    if (results.length === 0) {
      throw new Error("No investigators found for the specified study_id");
    }

    const investigators = results.map((investigator) => ({
      user_id: investigator.user_id,
      investigator_email: investigator.investigator_email,
      investigator_first_name: decrypt(investigator.investigator_first_name),
      investigator_last_name: decrypt(investigator.investigator_last_name),
    }));

    return investigators;
  } catch (err) {
    throw err;
  }
};

const getOrganizationAndRolebyUseridModel = async (user_id) => {
  try {
    // First, retrieve the user's roles
    const [roleResult] = await pool.query(
      `
      SELECT ur.role_id
      FROM user_role ur
      WHERE ur.user_id = ?
      `,
      [user_id]
    );

    if (roleResult.length === 0) {
      throw new Error("Role not found for the user.");
    }

    const role_id = roleResult[0].role_id;

    let query;
    let params;

    if (role_id === 9) {
      // role_id is 9, show all organization details
      query = `
        SELECT organization_detail_id, organization_name, organization_address
        FROM organization_details
      `;
      params = [];
    } else {
      // role_id is not 9, show only the assigned organization details
      query = `
         SELECT od.organization_detail_id, od.organization_name, od.organization_address
        FROM personnel_assigned_sites_studies o
        JOIN organization_details od ON o.site_id = od.organization_detail_id
        WHERE o.personnel_id = ?
      `;
      params = [user_id];
    }

    const [result] = await pool.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

const getReasonDescriptionModel = async ({
  user_id,
  track_id,
  investigator_id,
}) => {
  try {
    let query = `
      SELECT
        rd.reason_id,
        rd.user_id,
        rd.investigator_id,
        rd.track_id,
        rd.update_entity,
        rd.action_entity,
        rd.reason,
        DATE_FORMAT(rd.record_time,'%Y-%m-%d %H:%i:%s') AS record_time,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        i.first_name AS investigator_first_name,
        i.last_name AS investigator_last_name
      FROM reason_description AS rd
      LEFT JOIN organization AS u ON rd.user_id = u.user_id
      LEFT JOIN organization AS i ON rd.investigator_id = i.user_id
    `;
    const values = [];
    const conditions = [];

    // Add condition for filtering by user_id (if provided)
    if (user_id) {
      conditions.push("rd.user_id = ?");
      values.push(user_id);
    }

    // Add condition for filtering by track_id (if provided)
    if (track_id) {
      conditions.push("rd.track_id = ?");
      values.push(track_id);
    }

    // Add condition for filtering by investigator_id (if provided)
    if (investigator_id) {
      conditions.push("rd.investigator_id = ?");
      values.push(investigator_id);
    }

    // Append the WHERE clause if any conditions exist.
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const [result] = await pool.query(query, values);

    // Decrypt the encrypted first_name and last_name fields for both user and investigator.
    result.forEach((row) => {
      if (row.user_first_name) {
        row.user_first_name = decrypt(row.user_first_name);
      }
      if (row.user_last_name) {
        row.user_last_name = decrypt(row.user_last_name);
      }
      if (row.investigator_first_name) {
        row.investigator_first_name = decrypt(row.investigator_first_name);
      }
      if (row.investigator_last_name) {
        row.investigator_last_name = decrypt(row.investigator_last_name);
      }
    });

    return result;
  } catch (error) {
    throw error;
  }
};

// Export all functions
module.exports = {
  createOrganization,
  assignSitesStudiesAndSubjects,
  getOrganizationName,
  getStudyName,
  createTLFBSubject,
  getNotificationRecipients,
  ecrfIdExists,
  createPersonnelModel,
  signinOrganization,
  getAllOrganizations,
  getAllOrganizationsRolesUser,
  getAllOrganizationsForRole,
  getAllOrganizationsForInvestigator,
  getOrganizationById,
  updateOrganization,
  getisRandomized,
  updateIsRandomized,
  deleteOrganization,
  isUserExist,
  getUserById,
  updateUserPassword,
  getPasswordHistory,
  addPasswordHistory,
  checkEcrfIdExists,
  // Organization Detail Model
  createOrganizationDetail,
  getAllOrganizationDetails,
  getOrganizationDetailById,
  updateOrganizationDetail,
  getOrganizationByAddressForDifferentId,
  getOrganizationByNameOrAddress,
  // Update organization status based on video uploaded in video table
  updateOrganizationStatus,
  getNonComplaint,
  getNonCompliantForInvestigator,
  getOrganizationByIdForLog,
  getUserDetails,
  storeOtp,
  getUserByEmail,
  getOtpRecord,
  updateOtpWithToken,
  getOtpRecordByToken,
  updateUserPasswordModel,
  getInvestigatorByStudyId,
  getOrganizationAndRolebyUseridModel,
  getReasonDescriptionModel
};
