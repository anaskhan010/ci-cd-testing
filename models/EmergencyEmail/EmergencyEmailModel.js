const db = require("../../config/DBConnection3.js");

const emergencyEmailModel = async (
  subject,
  date_time,
  description,
  user_id
) => {
  try {
    const query = `INSERT INTO emergency_report (subject, date_time, description, user_id) VALUES (?, ?, ?, ?)`;
    const [result] = await db.query(query, [
      subject,
      date_time,
      description,
      user_id,
    ]);
    return result;
  } catch (err) {
    throw err;
  }
};

const getUsersByStudyId = async (
  study_enrolled_id,
  organization_detail_id,
  exclude_user_id
) => {
  console.log(
    organization_detail_id,
    "organization",
    study_enrolled_id,
    "study",
    exclude_user_id
  );
  try {
    const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
       WHERE email_type_id = 10
      GROUP BY personel_id
      HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;

    const query = `
      SELECT u.user_id, u.email, o.first_name, o.last_name, o.role_id, r.role_name
      FROM organization o
      JOIN user u ON o.user_id = u.user_id
      JOIN role r ON o.role_id = r.role_id
      JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
      WHERE o.study_enrolled_id = ? AND o.organization_detail_id=? AND o.user_id != ? AND r.role_id != 10
    `;
    const [results] = await db.query(query, [
      study_enrolled_id,
      organization_detail_id,
      exclude_user_id,
    ]);
    return results;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  emergencyEmailModel,
  getUsersByStudyId,
};
