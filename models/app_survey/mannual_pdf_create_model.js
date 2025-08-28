const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

const getResponses = async (user_id, scale_id, day_id, created_at) => {
  try {
    const sql = `
     SELECT
        r.app_survey_question_response_id,
        r.user_id,
        r.investigator_id,
        r.timer,
        r.app_survey_question_id,
        r.option_id,
        r.scale_id,
        r.day_id,
        r.description,
        r.scale_start_time,
        r.scale_end_time,

        r.created_at,
        qt.question_text,
        ot.option_text,
        s.filled_by,
        sc.scale_name,
        o.ecrf_id,
        sd.day_name,
        sn.schedule_name
      FROM app_survey_question_responses AS r
      JOIN scale AS s ON s.scale_id = r.scale_id
      JOIN scale_translations AS sc ON sc.scale_id = r.scale_id
      JOIN organization AS o ON r.user_id = o.user_id
      JOIN scale_question_translations AS qt ON qt.question_id = r.app_survey_question_id
      JOIN scale_question_option_translations AS ot ON ot.option_id = r.option_id
      JOIN schedule_days AS sd ON r.day_id = sd.day_id
      JOIN study_schedules AS sn ON sd.schedule_id = sn.schedule_id

      WHERE r.user_id     = ?
        AND r.scale_id    = ?
        AND r.day_id      = ?
        AND r.created_at  = ?;
    `;

    const [rows] = await db.execute(sql, [
      user_id,
      scale_id,
      day_id,
      created_at,
    ]);
    const investigator_id = rows[0].investigator_id;
    const query2 = `SELECT first_name, last_name FROM organization WHERE user_id = ?`;
    const [investigatorResult] = await db.execute(query2, [investigator_id]);

    // Get the first_name and last_name from the query result
    const first_name = investigatorResult[0].first_name;
    const last_name = investigatorResult[0].last_name;

    // Console log the values
    console.log("Investigator first_name:", first_name);
    console.log("Investigator last_name:", last_name);

    // Add the values to each row in the result
    rows.forEach((row) => {
      row.investigator_first_name = first_name;
      row.investigator_last_name = last_name;
    });

    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getResponses,
};
