const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise
const crypto = require("crypto");
const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function getOrganizationInfoForUser(userId, roleId) {
  // Check if the user has the specified role
  const [roleResult] = await db.query(
    `SELECT ur.user_id FROM user_role ur WHERE ur.user_id = ? AND ur.role_id = ?`,
    [userId, roleId]
  );

  if (roleResult.length === 0) {
    throw new Error("User does not have the specified role");
  }

  // Fetch the user's organization info (study_enrolled_id and organization_detail_id)
  const [orgInfo] = await db.query(
    `SELECT GROUP_CONCAT(DISTINCT study_id) AS study_enrolled_id, GROUP_CONCAT(DISTINCT site_id) AS organization_detail_id
    FROM personnel_assigned_sites_studies
    WHERE personnel_id = ?
    `,
    [userId]
  );

  if (orgInfo.length === 0) {
    throw new Error("No organization found for this user");
  }

  return {
    studyEnrolledId: orgInfo[0].study_enrolled_id,
    organizationDetailId: orgInfo[0].organization_detail_id,
  };
}

const insertPatientAccountStatus = async function (
  userId,
  accountStatus,
  reason
) {
  console.log("------------------------");
  console.log(userId, accountStatus, reason);
  console.log("------------------------");
  const query = `INSERT INTO patient_account_status (user_id, account_status, reason, updated_at) VALUES (?, ?, ?, ?)`;
  const currentDate = new Date();
  try {
    const [result] = await db.query(query, [
      userId,
      accountStatus,
      reason,
      currentDate,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getAllAcceptedStatus = async (userId, roleId) => {
  let studyEnrolledId, organizationDetailId;

  const superAdminRole = [9];
  if (!superAdminRole.includes(roleId)) {
    const orgInfo = await getOrganizationInfoForUser(userId, roleId);
    studyEnrolledId = orgInfo.studyEnrolledId;
    organizationDetailId = orgInfo.organizationDetailId;
  }

  console.log(
    studyEnrolledId,
    "============",
    organizationDetailId,
    "-=-=-==--==-"
  );

  let query = `
    SELECT
      r.account_status_id,
      r.account_status,
      r.user_id,
      r.reason,
      r.user_id,
      st.study_name,
      o.date_enrolled,
      o.ecrf_id,
      u.email
    FROM
      patient_account_status AS r
    JOIN
      user AS u ON r.user_id = u.user_id
    LEFT JOIN
      organization AS o ON r.user_id = o.user_id
    JOIN
      study_enrolled AS st ON o.study_enrolled_id = st.enrolled_id
    WHERE
      r.account_status = 'Accepted'
  `;

  const params = [];
  if (!superAdminRole.includes(roleId)) {
    // Apply filtering conditions
    query += `
      AND o.study_enrolled_id = ?
      AND o.organization_detail_id = ?
    `;
    params.push(studyEnrolledId, organizationDetailId);
  }

  query += ` ORDER BY r.account_status_id DESC;`;

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

// const getAllPendingStatus = async (userId, roleId) => {
//   let studyEnrolledId, organizationDetailId;
//   const superAdminRole = [9];

//   // If role_id is not 9, we apply the filtering conditions
//   if (!superAdminRole.includes(roleId)) {
//     const orgInfo = await getOrganizationInfoForUser(userId, roleId);
//     studyEnrolledId = orgInfo.studyEnrolledId;
//     organizationDetailId = orgInfo.organizationDetailId;
//   }

//   let query = `
//     SELECT 
//       r.*,
//       u.email,
//       o.ecrf_id 
//     FROM 
//       patient_account_status AS r 
//     JOIN 
//       user AS u ON r.user_id = u.user_id 
//     LEFT JOIN
//       organization AS o ON r.user_id = o.user_id
//     WHERE 
//       r.account_status = "Pending"
//   `;

//   const params = [];
//   if (!superAdminRole.includes(roleId)) {
//     query += `
//       AND o.study_enrolled_id = ?
//       AND o.organization_detail_id = ?
//     `;
//     params.push(studyEnrolledId, organizationDetailId);
//   }

//   query += ` ORDER BY r.account_status_id DESC;`;

//   try {
//     const [result] = await db.query(query, params);
//     return result;
//   } catch (err) {
//     throw err;
//   }
// };

const getAllPendingStatus = async (userId, roleId) => {
  const superAdminRole = [9];

  let query, params = [];

  if (superAdminRole.includes(roleId)) {
    // Super admin sees all pending statuses
    query = `
      SELECT
        r.*,
        u.email,
        o.ecrf_id
      FROM
        patient_account_status AS r
      JOIN
        user AS u ON r.user_id = u.user_id
      LEFT JOIN
        organization AS o ON r.user_id = o.user_id
      WHERE
        r.account_status = "Pending"
      ORDER BY r.account_status_id DESC
    `;
  } else {
    // Non-super admin sees only subjects assigned to them through personel_subject table
    query = `
      SELECT
        r.*,
        u.email,
        o.ecrf_id
      FROM
        patient_account_status AS r
      JOIN
        user AS u ON r.user_id = u.user_id
      LEFT JOIN
        organization AS o ON r.user_id = o.user_id
      LEFT JOIN
        personel_subject AS p ON p.subject_id = r.user_id
      WHERE
        r.account_status = "Pending" AND p.personel_id = ?
      ORDER BY r.account_status_id DESC
    `;
    params.push(userId);
  }

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

const getAllDisableStatus = async (userId, roleId) => {
  let studyEnrolledId, organizationDetailId;

  const superAdminRole = [9];
  if (!superAdminRole.includes(roleId)) {
    const orgInfo = await getOrganizationInfoForUser(userId, roleId);
    studyEnrolledId = orgInfo.studyEnrolledId;
    organizationDetailId = orgInfo.organizationDetailId;
  }

  let query = `
    SELECT 
       r.account_status_id,
  r.user_id,
  r.account_status,
  r.reason,
  r.first_time,
  CONVERT_TZ(r.updated_at, '+00:00', '+00:00') AS updated_at,
      u.email,
      o.ecrf_id
    FROM 
      patient_account_status AS r 
    JOIN 
      user AS u ON r.user_id = u.user_id 
    LEFT JOIN  -- Changed to LEFT JOIN
      organization AS o ON r.user_id = o.user_id
    WHERE 
      r.account_status = "Disabled"
  `;

  const params = [];

  if (!superAdminRole.includes(roleId)) {
    query += `
      AND o.study_enrolled_id = ?
      AND o.organization_detail_id = ?
    `;
    params.push(studyEnrolledId, organizationDetailId);
  }

  query += ` ORDER BY r.account_status_id DESC;`;

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

const updateRegistrationStatus = async (
  status,
  id,
  investigator_id,
  reason,
  updateEntity = "USER_MANAGEMENT",
  actionEntity = "UPDATE"
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Step 1: Find the user_id associated with the given account_status_id
    const findUserIdQuery = `SELECT user_id FROM patient_account_status WHERE account_status_id = ?`;
    const [userResult] = await connection.query(findUserIdQuery, [id]);

    if (userResult.length === 0) {
      throw new Error("User not found");
    }
    const userId = userResult[0].user_id;

    // Step 1.5: Fetch current first_time
    const fetchFirstTimeQuery = `SELECT first_time FROM patient_account_status WHERE user_id = ?`;
    const [firstTimeResult] = await connection.query(fetchFirstTimeQuery, [
      userId,
    ]);
    const original_first_time = firstTimeResult[0].first_time;

    // Step 2: Update the status and reason for the given user_id
    let updateStatusQuery = `UPDATE patient_account_status SET account_status = ?, reason = ?,  updated_at = NOW()`;
    let queryParams = [status, reason];

    if (status === "Accepted") {
      updateStatusQuery += `, first_time = 0`;
    }

    updateStatusQuery += ` WHERE user_id = ?`;
    queryParams.push(userId);

    const [updateResult] = await connection.query(
      updateStatusQuery,
      queryParams
    );

    if (status === "Disabled") {
      // Step 3: Cancel all associated schedules
      const cancelSchedulesQuery = `UPDATE schedule SET status = 'Cancelled' WHERE user_id = ?`;
      await connection.query(cancelSchedulesQuery, [userId]);

      // Step 4: Cancel all associated medications
      const cancelMedicationsQuery = `UPDATE patientmedications SET disable_status = 'Cancelled' WHERE user_id = ?`;
      await connection.query(cancelMedicationsQuery, [userId]);
    }

    const reason_table = `INSERT INTO reason_description (user_id,investigator_id,track_id,update_entity,action_entity,reason) VALUES (?,?,?,?,?,?)`;
    let values2 = [
      userId,
      investigator_id,
      id,
      updateEntity,
      actionEntity,
      reason,
    ];
    await connection.query(reason_table, values2);

    // Commit the transaction
    await connection.commit();

    return { updateResult, first_time: original_first_time };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const getRegistrationStatusById = async (id) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM patient_account_status WHERE account_status_id = ?",
      [id]
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

const getAllBlockedStatus = async (userId, roleId) => {
  let studyEnrolledId, organizationDetailId;
  const superAdminRole = [9];

  if (!superAdminRole.includes(roleId)) {
    const orgInfo = await getOrganizationInfoForUser(userId, roleId);
    studyEnrolledId = orgInfo.studyEnrolledId;
    organizationDetailId = orgInfo.organizationDetailId;
  }

  let query = `
    SELECT 
      r.*, 
      u.email ,
      o.ecrf_id,
      rol.role_name
    FROM 
      patient_account_status AS r 
    JOIN 
      user AS u ON r.user_id = u.user_id 
    JOIN user_role as ur on ur.user_id = u.user_id
    JOIN role as rol on rol.role_id = ur.role_id
    LEFT JOIN
      organization AS o ON r.user_id = o.user_id
    WHERE 
      r.account_status = "Blocked"
      AND rol.role_id != 9
  `;

  const params = [];

  if (!superAdminRole.includes(roleId)) {
    query += `
      AND o.study_enrolled_id in (?)
      AND o.organization_detail_id in (?)
    `;
    params.push(studyEnrolledId.split(','), organizationDetailId.split(','));
  }

  query += ` ORDER BY r.account_status_id DESC;`;

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};


const fetchPendingUsersByAccess = async (userId, roleId) => {
  let studyEnrolledId, organizationDetailId;
  const superAdminRole = [9];

  if (!superAdminRole.includes(roleId)) {
    const orgInfo = await getOrganizationInfoForUser(userId, roleId);
    studyEnrolledId = orgInfo.studyEnrolledId;
    organizationDetailId = orgInfo.organizationDetailId;
  }

  let query = `
    SELECT 
      r.*, 
      u.email ,
      o.ecrf_id,
      rol.role_name
    FROM 
      patient_account_status AS r 
    JOIN 
      user AS u ON r.user_id = u.user_id 
    JOIN user_role as ur on ur.user_id = u.user_id
    JOIN role as rol on rol.role_id = ur.role_id
    LEFT JOIN
      organization AS o ON r.user_id = o.user_id
    WHERE 
      r.account_status = "Pending"
      AND rol.role_id != 9
  `;

  const params = [];

  if (!superAdminRole.includes(roleId)) {
    query += `
      AND o.study_enrolled_id in (?)
      AND o.organization_detail_id in (?)
    `;
    params.push(studyEnrolledId.split(','), organizationDetailId.split(','));
  }

  query += ` ORDER BY r.account_status_id DESC;`;

  try {
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

const getAllAwaitingDisableStatus = async (userId, roleId) => {
  let studyEnrolledId, organizationDetailId;
  const superAdminRole = [9];

  // If role_id is not 9, we apply the filtering conditions
  if (!superAdminRole.includes(roleId)) {
    const orgInfo = await getOrganizationInfoForUser(userId, roleId);
    studyEnrolledId = orgInfo.studyEnrolledId;
    organizationDetailId = orgInfo.organizationDetailId;
  }

  let query = `
    SELECT 
      r.account_status_id,
      r.user_id,
      r.account_status,
      r.reason,
      r.first_time,
      r.updated_at, 
      u.email 
    FROM 
      patient_account_status AS r 
    JOIN 
      user AS u ON r.user_id = u.user_id 
    LEFT JOIN
      organization AS o ON r.user_id = o.user_id
    WHERE 
      r.account_status = "awaiting_disable"
  `;

  const params = [];

  // Append filtering conditions for non-super admin users
  if (!superAdminRole.includes(roleId)) {
    query += `
      AND o.study_enrolled_id = ?
      AND o.organization_detail_id = ?
    `;
    params.push(studyEnrolledId, organizationDetailId);
  }

  // Append the final ordering clause
  query += ` ORDER BY r.account_status_id DESC;`;

  try {
    // IMPORTANT: Pass the params array to replace the placeholders in the query
    const [result] = await db.query(query, params);
    return result;
  } catch (err) {
    throw err;
  }
};

const getAllCountStuatus = async () => {
  // get All Pending Status Count
  const query = ` 
  SELECT count(account_status) as count FROM
  patient_account_status
WHERE
  account_status = 'Pending';
  `;
  const [pendingCount] = await db.query(query);

  // get All Accepted Status Count
  const query1 = `
  
  SELECT count(account_status) as count FROM
  patient_account_status
WHERE
  account_status = 'Accepted';
  `;
  const [acceptedCount] = await db.query(query1);

  // get All Disabled Status Count
  const query2 = `
  
  SELECT count(account_status) as count FROM
  patient_account_status
WHERE
  account_status = 'Disabled';
  `;
  const [disabledCount] = await db.query(query2);

  // get All Blocked Status Count
  const query3 = `
  
  SELECT count(account_status) as count FROM
  patient_account_status
WHERE
  account_status = 'Blocked';
  `;
  const [blockedCount] = await db.query(query3);

  // get All Awaiting Disable Status Count
  const query4 = `
  
  SELECT count(account_status) as count FROM
  patient_account_status
WHERE
  account_status = 'awaiting_disable';
  `;
  const [awaitingDisableCount] = await db.query(query4);

  return {
    pendingCount: pendingCount[0].count,
    acceptedCount: acceptedCount[0].count,
    disabledCount: disabledCount[0].count,
    blockedCount: blockedCount[0].count,
    awaitingDisableCount: awaitingDisableCount[0].count,
  };
};

const getOrganizationById = async (user_id) => {
  console.log("=========================");
  console.log(user_id, "user_id");
  console.log("=========================");
  try {
    const [result] = await db.query(
      `
      SELECT o.*, u.email,
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
        SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id
        FROM organization AS inv_org
        JOIN user_role AS r ON inv_org.user_id = r.user_id
        WHERE r.role_id = 12
      ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
      JOIN (
        SELECT user_id, MAX(note) AS note
        FROM note
        GROUP BY user_id
      ) AS notes ON u.user_id = notes.user_id
      WHERE o.user_id = ?
      GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
               org.organization_name, org.organization_address, notes.note
      `,
      [user_id]
    );

    if (result.length > 0) {
      let org = result[0];
      console.log(
        "+++++++++++++++++++++++++++++++++++Organization Details here++++++++++++++++++++++++++++++++++++++++++"
      );
      console.log(org);

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

        // Decrypt investigator first and last names individually
        const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
          user_id: parseInt(id),
          first_name: decrypt(investigatorFirstNames[index] || ""),
          last_name: decrypt(investigatorLastNames[index] || ""),
        }));

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
          investigators: decryptedInvestigators,
        };

        // Remove raw investigator_first_names and investigator_last_names from the result
        delete org.investigator_first_names;
        delete org.investigator_last_names;
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
      }

      console.log(
        "decrypted organition details here +++++++++++++++++++++++++++++++++++++++"
      );
      console.log(org);

      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

module.exports = {
  insertPatientAccountStatus,
  getAllAcceptedStatus,
  getAllPendingStatus,
  updateRegistrationStatus,
  getAllDisableStatus,
  getAllBlockedStatus,
  getAllAwaitingDisableStatus,
  getRegistrationStatusById,
  getAllCountStuatus,
  getOrganizationById,
  fetchPendingUsersByAccess
};
