const db = require("../../config/DBConnection3");

const make_compliant_model = async (user_id) => {
  const query = `UPDATE organization SET is_compliant=1 WHERE user_id =?`;
  try {
    const [result] = await db.query(query, [user_id]);
    return result;
  } catch (error) {
    throw error;
  }
};

const non_complaint_model = async (userId, roleId) => {
  console.log("===========================");
  console.log("User ID:", userId, "Role ID:", roleId);
  console.log("===========================");

  // Base query with common parts for selecting non-compliant subjects
  const baseQuery = `
    SELECT
      u.user_id,
      u.email,
      o.ecrf_id,
      o.study_enrolled_id,
      o.organization_detail_id,
      o.status,
      o.is_compliant,
      o.first_name,
      o.last_name,
      CONVERT_TZ(
        CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 08:00:00'),
        'America/Chicago','UTC'
      ) AS window_start_utc,
      CONVERT_TZ(
        CONCAT(DATE(NOW()), ' 08:00:00'),
        'America/Chicago','UTC'
      ) AS window_end_utc,
      (
        SELECT smr.created_at
        FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
        ORDER BY smr.created_at DESC
        LIMIT 1
      ) AS last_submission_time,
      TIMESTAMPDIFF(
        HOUR,
        (
          SELECT smr2.created_at
          FROM submit_medicine_records smr2
          WHERE smr2.user_id = u.user_id
          ORDER BY smr2.created_at DESC
          LIMIT 1
        ),
        NOW()
      ) AS hours_since_last_submission
  `;

  // Common WHERE conditions for non-compliant subjects
  const baseConditions = `
    WHERE
      r.role_name = 'Subject'
      AND o.status = 'Randomized'
      AND TIMESTAMPDIFF(DAY, pm.created_at, NOW()) >= 3
      AND NOT EXISTS (
        SELECT 1
        FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
          AND smr.created_at >= CONVERT_TZ(
            CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 08:00:00'),
            'America/Chicago','UTC'
          )
          AND smr.created_at < CONVERT_TZ(
            CONCAT(DATE(NOW()), ' 08:00:00'),
            'America/Chicago','UTC'
          )
      )
  `;

  try {
    let query;
    let queryParams = [];

    // For superadmin (role_id = 9), get all non-compliant subjects
    if (parseInt(roleId) === 9) {
      console.log(
        "Using superadmin query - returning all non-compliant subjects"
      );
      query = `
        ${baseQuery}
        FROM user u
        JOIN user_role ur ON u.user_id = ur.user_id
        JOIN role r ON ur.role_id = r.role_id
        JOIN organization o ON u.user_id = o.user_id
        JOIN patientmedications pm ON u.user_id = pm.user_id
        ${baseConditions}
      `;
    } else {
      // For other roles, get only subjects assigned to this personnel through personel_subject table
      console.log(
        "Using non-superadmin query - filtering by personel_subject assignments"
      );
      query = `
        ${baseQuery}
        FROM user u
        JOIN user_role ur ON u.user_id = ur.user_id
        JOIN role r ON ur.role_id = r.role_id
        JOIN organization o ON u.user_id = o.user_id
        JOIN patientmedications pm ON u.user_id = pm.user_id
        JOIN personel_subject ps ON u.user_id = ps.subject_id
        ${baseConditions}
        AND ps.personel_id = ?
      `;
      queryParams.push(userId);
    }

    // Execute the query
    console.log("Executing query with params:", queryParams);
    const [rows] = await db.query(query, queryParams);
    console.log(`Found ${rows.length} non-compliant subjects`);
    return rows;
  } catch (error) {
    console.error("Error in non_complaint_model:", error);
    throw error;
  }
};

module.exports = {
  non_complaint_model,
  make_compliant_model,
};
