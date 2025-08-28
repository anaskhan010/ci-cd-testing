const db = require("../../config/DBConnection3.js");

const getAccessibleUsers = async (subjectUserId) => {
  const emailEnabledSubquery = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = 15
    GROUP BY personel_id
    HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;

  const query = `
    SELECT DISTINCT u.user_id, u.email, o.first_name, o.last_name, od.organization_name, r.role_name 
    FROM user as u
    JOIN personnel_assigned_sites_studies as pass on pass.personnel_id = u.user_id
    JOIN patient_account_status as pas on pas.user_id = u.user_id
    JOIN organization as o on o.user_id = u.user_id
    JOIN organization_details as od on od.organization_detail_id = pass.site_id
    JOIN user_role as ur on ur.user_id = u.user_id
    JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
    JOIN role as r on r.role_id = ur.role_id
    WHERE r.role_id NOT IN (9, 10, 18, 22) 
      AND pas.account_status = 'Accepted' 
      AND pass.site_id = (
          SELECT o2.organization_detail_id
          FROM user AS u2
          JOIN organization AS o2 ON u2.user_id = o2.user_id 
          JOIN organization_details AS od ON od.organization_detail_id = o2.organization_detail_id
          WHERE u2.user_id = ?
          LIMIT 1
      )
    ORDER BY r.role_name, u.email
    ;
  `;

  const [rows] = await db.query(query, [subjectUserId]);
  return rows;
};

const isUnlockEmailEnabledByUserId  = async (userId, emailTypeId ) => {
  // Basic input guard (counts as error handling)
  if (userId == null) throw new TypeError("isEmailEnabledForUser: userId is required");

  const sql = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = ?
      AND personel_id = ?
    GROUP BY personel_id
    HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;

  try {
    const [rows] = await db.query(sql, [emailTypeId, userId]);
    return Array.isArray(rows) && rows.length > 0; // true if fully enabled
  } catch (err) {
    // Log and rethrow so the caller can decide to skip sending
    console.error(`isEmailEnabledForUser: DB error for userId=${userId}, type=${emailTypeId}`, err);
    throw new Error("Email preference lookup failed.");
  }

};


const getUsersByRoleSiteAndEmailType = async (roleId, siteId, emailTypeId ) => {
  const emailEnabledSubquery = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = ?
    GROUP BY personel_id
    HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;
  const [rows] = await db.query(
    `SELECT DISTINCT u.user_id, u.email, o.first_name, o.last_name
     FROM user u
     JOIN user_role ur ON u.user_id = ur.user_id
     JOIN patient_account_status as pas on pas.user_id = u.user_id
     JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
     JOIN organization o ON o.user_id = u.user_id
     JOIN personnel_assigned_sites_studies as pass on pass.personnel_id = u.user_id
     WHERE pas.account_status = 'Accepted' AND ur.role_id = ? AND pass.site_id = ?`,
    [emailTypeId, roleId, siteId]
  );
  return rows;
};

const getUsersByRole = async (roleId) => {
  const emailEnabledSubquery = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = 15
    GROUP BY personel_id
    HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;

  const [rows] = await db.query(
    `SELECT u.user_id, u.email, o.first_name, o.last_name
     FROM user u
     JOIN user_role ur ON u.user_id = ur.user_id
     JOIN patient_account_status as pas on pas.user_id = u.user_id
     JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
     JOIN organization o ON o.user_id = u.user_id
     WHERE  pas.account_status = 'Accepted' AND ur.role_id = ?`,
    [roleId]
  );
  return rows;
};



module.exports = {
  getAccessibleUsers,
  getUsersByRoleSiteAndEmailType,
  getUsersByRole,
  isUnlockEmailEnabledByUserId
};
