const db = require("../../config/DBConnection3.js");
const {detectLanguage} = require("../../services/translation.service.js")

// Create ECRF question
const createEcrfQuestion = async (question, isYesNo, allowsDetails) => {
  try {
    const query = `INSERT INTO ecrf_questions (question, is_yes_no, allows_details) VALUES (?, ?, ?)`;
    const [result] = await db.query(query, [question, isYesNo, allowsDetails]);
    return result;
  } catch (err) {
    throw err;
  }
};

// Get all ECRF questions
const getAllEcrfQuestions = async () => {
  try {
    const query = `SELECT * FROM ecrf_questions`;
    const [results] = await db.query(query);
    return results;
  } catch (err) {
    throw err;
  }
};

const submitEcrfAnswers = async (userId, ticketId, answers) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // ✅ Prevent duplicate submissions for the same ticket on the same day
    const checkQuery = `
      SELECT id 
      FROM ecrf_submissions 
      WHERE ticket_id = ? 
        AND DATE(created_at) = CURDATE()
    `;
    const [checkResults] = await connection.query(checkQuery, [ticketId]);

    if (checkResults.length > 0) {
      await connection.rollback();
      throw new Error("A submission for this ticket already exists today");
    }

    // ✅ Insert into ecrf_submissions
    const insertSubmissionQuery = `
      INSERT INTO ecrf_submissions (user_id, ticket_id) 
      VALUES (?, ?)
    `;
    const [submissionResult] = await connection.query(insertSubmissionQuery, [
      userId,
      ticketId,
    ]);
    const submissionId = submissionResult.insertId;

    // ✅ Prepare answers with language detection
    const answerValues = [];
    for (const a of answers) {
      let detectedLang = "en";
      let confidence = 100.0;

      if (a.answer && a.answer.trim() !== "") {
        try {
          const detection = await detectLanguage(a.answer);
          detectedLang = detection.language || "en";
          confidence = detection.confidence || 100.0;
        } catch (err) {
          console.error("Language detection failed:", err.message);
        }
      }

      answerValues.push([
        submissionId,
        a.questionId,
        a.answer,
        detectedLang,
        confidence,
      ]);
    }

    // ✅ Insert into ecrf_answers
    const insertAnswerQuery = `
      INSERT INTO ecrf_answers (submission_id, question_id, answer, detected_language, detection_confidence) 
      VALUES ?
    `;
    await connection.query(insertAnswerQuery, [answerValues]);

    await connection.commit();
    return submissionId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const getOrganizationByTicket = async (ticketId) => {
  try {
    const query = `
      SELECT o.user_id, o.organization_detail_id, o.study_enrolled_id, ats.ticket_id 
      FROM organization AS o 
      JOIN incident_reports AS ir ON o.user_id = ir.user_id 
      JOIN adverse_ticketing_system AS ats ON ats.incident_report_id = ir.id 
      WHERE ats.ticket_id = ?
    `;
    const [results] = await db.query(query, [ticketId]);
    return results;
  } catch (error) {
    throw error;
  }
};

// Get ECRF submissions by ticket ID
const getEcrfSubmissionsByTicket = async (ticketId) => {
  try {
    const query = `
      SELECT s.id as submission_id, s.user_id, s.ticket_id, s.created_at, 
             q.id as question_id, q.question, q.is_yes_no, q.allows_details, 
             a.answer, a.detected_language, a.detection_confidence 
      FROM ecrf_submissions s
      JOIN ecrf_answers a ON s.id = a.submission_id
      JOIN ecrf_questions q ON a.question_id = q.id
      WHERE s.ticket_id = ?
      ORDER BY s.created_at DESC, q.id ASC
    `;
    const [results] = await db.query(query, [ticketId]);
    return results;
  } catch (err) {
    throw err;
  }
};

// Get Study Enrolled ID
const getStudyEnrolledId = async (userId) => {
  try {
    const query =
      "SELECT study_enrolled_id FROM organization WHERE user_id = ?";
    const [results] = await db.query(query, [userId]);
    if (results.length === 0) throw new Error("User not found in organization");
    return results[0].study_enrolled_id;
  } catch (err) {
    throw err;
  }
};

// Get Roles Excluding
const getRolesExcluding = async (
  excludeRoleId,
  studyEnrolledId,
  organization_detail_id
) => {
  try {
    const query = `
      SELECT ur.user_id, r.role_id, r.role_name 
      FROM user_role ur
      JOIN role r ON r.role_id = ur.role_id
      JOIN organization o ON ur.user_id = o.user_id
      WHERE r.role_id != ? 
        AND o.study_enrolled_id = ? 
        AND o.organization_detail_id = ?
    `;
    const [results] = await db.query(query, [
      excludeRoleId,
      studyEnrolledId,
      organization_detail_id,
    ]);
    return results;
  } catch (err) {
    throw err;
  }
};

// const getUsersByRoles = async (roles, studyEnrolledId) => {
//   try {
//     if (roles.length === 0) return [];
//     const roleIds = roles.map((r) => r.role_id);

//     (roleIds, "*****", studyEnrolledId);

//     const query = `
//       SELECT DISTINCT u.user_id, u.email, o.first_name, o.last_name, org.organization_name, org.organization_detail_id, o.study_enrolled_id
//       FROM user u
//       JOIN user_role ur ON u.user_id = ur.user_id
//       JOIN organization o ON u.user_id = o.user_id
//       JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
//       WHERE ur.role_id IN (?)
//       AND FIND_IN_SET(?, o.study_enrolled_id) > 0
//     `;

//     const [results] = await db.query(query, [roleIds, studyEnrolledId]);
//     return results;
//   } catch (err) {
//     throw err;
//   }
// };

const getUsersByRolesForAEForm = async (
  roles,
  studyEnrolledId,
  organization_detail_id
) => {
  ("Checking AE FORM");
  try {
    if (roles.length === 0) return [];

    const roleIds = roles.map((r) => r.role_id);
    (
      "Role IDs:",
      roleIds,
      "Study Enrolled ID:",
      studyEnrolledId,
      "Org Detail ID:",
      organization_detail_id
    );

    // Create a comma-separated list of placeholders for role IDs
    const rolePlaceholders = roleIds.map(() => "?").join(",");

    const query = `
      SELECT DISTINCT 
        u.user_id, 
        u.email, 
        o.first_name, 
        o.last_name, 
        org.organization_name, 
        org.organization_detail_id, 
        o.study_enrolled_id
      FROM user u
      JOIN user_role ur ON u.user_id = ur.user_id
      JOIN organization o ON u.user_id = o.user_id
      JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
      WHERE ur.role_id IN (${rolePlaceholders})
        AND o.study_enrolled_id = ?
        AND o.organization_detail_id = ?
        AND EXISTS (
          SELECT 1 
          FROM email_sent_notification esn
          WHERE esn.personel_id = u.user_id
            AND esn.email_type_id = 4
            AND esn.status = 'Enable'
        )
    `;
    const params = [...roleIds, studyEnrolledId, organization_detail_id];
    const [results] = await db.query(query, params);
    (
      "Users that will receive emails (filtered by email_sent_notification):",
      results
    );
    (`Total users to get emails: ${results.length}`);
    return results;
  } catch (err) {
    throw err;
  }
};

// const getUsersByRolesForAEForm = async (roles, studyEnrolledId) => {
//   ("Checking AE FORM");
//   try {
//     if (roles.length === 0) return [];
//     const roleIds = roles.map((r) => r.role_id);

//     ("Role IDs:", roleIds, "Study Enrolled ID:", studyEnrolledId);

//     // Create a comma-separated list of placeholders for role IDs
//     const rolePlaceholders = roleIds.map(() => "?").join(",");

//     // Main query using an EXISTS clause instead of a join with a subquery
//     const query = `
//       SELECT DISTINCT
//         u.user_id,
//         u.email,
//         o.first_name,
//         o.last_name,
//         org.organization_name,
//         org.organization_detail_id,
//         o.study_enrolled_id
//       FROM user u
//       JOIN user_role ur ON u.user_id = ur.user_id
//       JOIN organization o ON u.user_id = o.user_id
//       JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
//       WHERE ur.role_id IN (${rolePlaceholders})
//         AND FIND_IN_SET(?, o.study_enrolled_id) > 0
//         AND EXISTS (
//           SELECT 1
//           FROM email_sent_notification esn
//           WHERE esn.personel_id = u.user_id
//             AND esn.email_type_id = 4
//             AND esn.status = 'Enable'
//         )
//     `;

//     // Build parameters: first all role IDs, then the studyEnrolledId for the FIND_IN_SET clause
//     const params = [...roleIds, studyEnrolledId];

//     const [results] = await db.query(query, params);
//     (
//       "Users that will receive emails (filtered by email_sent_notification):",
//       results
//     );
//     (`Total users to get emails: ${results.length}`);
//     return results;
//   } catch (err) {
//     throw err;
//   }
// };

module.exports = {
  createEcrfQuestion,
  submitEcrfAnswers,
  getOrganizationByTicket,
  getEcrfSubmissionsByTicket,
  getAllEcrfQuestions,
  getStudyEnrolledId,
  getRolesExcluding,
  getUsersByRolesForAEForm,
};
