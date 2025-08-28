const db = require("../../config/DBConnection3");

// const subject_Charts_model = async (user_id) => {
//   console.log(user_id, "next time");
//   try {
//     // Get the organization details for the user
//     const [organizationDetails] = await db.execute(
//       `SELECT organization_detail_id, study_enrolled_id
//        FROM organization
//        WHERE user_id = ?`,
//       [user_id]
//     );

//     if (!organizationDetails.length) {
//       throw new Error("No organization details found");
//     }

//     const orgId = organizationDetails[0].organization_detail_id;
//     const studyIds = organizationDetails[0].study_enrolled_id
//       .split(",")
//       .map((i) => Number(i));

//     console.log(typeof orgId, "check org id");
//     console.log(studyIds, typeof studyIds, "check study ids");

//     const findInSetConditions = studyIds
//       .map((id) => `FIND_IN_SET(${id}, o.study_enrolled_id)`)
//       .join(" OR ");
//     const userQuery = `
//       SELECT u.user_id, ur.role_id, o.date_enrolled, o.organization_detail_id, o.study_enrolled_id
//       FROM user u
//       INNER JOIN organization o ON u.user_id = o.user_id
//       JOIN user_role ur ON u.user_id = ur.user_id
//       WHERE o.organization_detail_id = ?
//       AND (${findInSetConditions})
//       AND ur.role_id = 10
//     `;

//     const [users] = await db.execute(userQuery, [orgId]);
//     console.log(users, "check user");

//     const placeholders = studyIds.map(() => "?").join(",");
//     const scheduleQuery = `
//       SELECT s.schedule_id, s.study_enrolled_id, s.schedule_date, s.schedule_time,
//              s.status, s.note, s.disable_status, s.reason, s.user_id, s.day_id
//       FROM schedule s
//       JOIN organization o ON s.user_id = o.user_id
//       WHERE o.organization_detail_id = ?
//       AND s.study_enrolled_id IN (${placeholders})
//     `;

//     const [schedules] = await db.execute(scheduleQuery, [orgId, ...studyIds]);
//     console.log(schedules, "check schedules");

//     return { users, schedules };
//   } catch (error) {
//     throw error;
//   }
// };

const subject_Charts_model = async (user_id) => {
  console.log(user_id, "next time");
  try {
    const [organizationDetails] = await db.execute(
      `SELECT organization_detail_id, study_enrolled_id
       FROM organization
       WHERE user_id = ?`,
      [user_id]
    );

    if (!organizationDetails.length) {
      throw new Error("No organization details found");
    }

    // Get comma-separated IDs from first result
    const orgIds = organizationDetails[0].organization_detail_id;

    console.log(typeof orgIds, "check org ids ");
    const studyId = organizationDetails[0]?.study_enrolled_id
      .split(",")
      .map((i) => Number(i));

    console.log(studyId, typeof studyId, "check info");

    // Get all users in same organizations and study
    const findInSetConditions = studyId
      .map((id) => `FIND_IN_SET(${id}, o.study_enrolled_id)`)
      .join(" OR ");
    const query = `
  SELECT u.user_id, ur.role_id, o.date_enrolled, o.organization_detail_id, o.study_enrolled_id
  FROM user u
  INNER JOIN organization o ON u.user_id = o.user_id
  JOIN user_role ur ON u.user_id = ur.user_id
  WHERE o.organization_detail_id = ?
  AND (${findInSetConditions})
  AND ur.role_id = 10
`;

    const query2 = ``;

    const users = await db.execute(query, [orgIds]);
    console.log(users, "check user");

    return users[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  subject_Charts_model,
};
