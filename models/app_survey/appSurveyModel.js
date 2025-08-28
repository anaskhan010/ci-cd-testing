const db = require("../../config/DBConnection3.js");
const crypto = require("crypto");

const {
  calculateWHOQOLScore,
  generateSurveyPDF,
  sendPDFToAPI,
  generateSurveyExcel,
} = require("./util");

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(":");
  if (textParts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  let iv = Buffer.from(textParts[0], "hex");
  let encryptedText = Buffer.from(textParts[1], "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "binary", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const getAllSurveys = async () => {
  try {
    const query = `
      SELECT
          s.app_survey_id, s.drug_name, s.date, s.drug_size, s.drug_percentage, s.drug_quantity, s.user_id,
          q.app_survey_question,
          u.email, o.first_name, o.last_name, o.status, o.gender, o.address, o.contact_number, o.date_of_birth, o.stipend, o.study_enrolled_id,
          o.organization_detail_id, o.organization_id, o.notification, stu.study_name
      FROM
          app_survey s
      LEFT JOIN
          user u ON s.user_id = u.user_id
      LEFT JOIN
          organization o ON u.user_id = o.user_id
      LEFT JOIN study_enrolled stu ON o.study_enrolled_id = stu.enrolled_id
      LEFT JOIN
          app_survey_question_responses r ON s.user_id = r.user_id
      LEFT JOIN
          app_survey_questions q ON r.app_survey_question_id = q.app_survey_question_id
      WHERE
          s.app_survey_id IN (
              SELECT sub.latest_survey_id
              FROM (
                  SELECT MAX(s2.app_survey_id) AS latest_survey_id
                  FROM app_survey s2
                  LEFT JOIN user u2 ON s2.user_id = u2.user_id
                  GROUP BY u2.email
              ) sub
          )
    `;

    const [results] = await db.query(query);

    const surveys = {};

    results.forEach((row) => {
      const surveyId = row.app_survey_id;
      if (!surveys[surveyId]) {
        surveys[surveyId] = {
          survey_id: surveyId,
          drug_name: row.drug_name,
          date: row.date,
          drug_size: row.drug_size,
          drug_percentage: row.drug_percentage,
          drug_quantity: row.drug_quantity,
          user: {
            user_id: row.user_id,
            email: row.email,
            first_name: decrypt(row.first_name),
            last_name: decrypt(row.last_name),
            status: row.status,
            gender: decrypt(row.gender),
            address: row.address,
            contact_number: decrypt(row.contact_number),
            date_of_birth: row.date_of_birth,
            stipend: row.stipend,
            study_enrolled: row.study_enrolled_id,
          },
          organization: {
            organization_id: row.organization_id,
            organization_detail_id: row.organization_detail_id,
            notification: row.notification,
            study_enrolled_id: row.study_enrolled_id,
            study_name: row.study_name,
          },
          questions: [],
        };
      }
      if (row.app_survey_question && row.app_survey_response) {
        surveys[surveyId].questions.push({
          question: row.app_survey_question,
          response: row.app_survey_response,
        });
      }
    });

    return Object.values(surveys);
  } catch (error) {
    console.error("Error in getAllSurveys:", error);
    throw error;
  }
};

const getAllSurveysForInvestigator = async (investigatorId) => {
  try {
    const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;
    const [investigatorResult] = await db.query(investigatorQuery, [
      investigatorId,
    ]);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    const investigator = investigatorResult[0];

    const query = `
      SELECT
          s.app_survey_id, s.drug_name, s.date, s.drug_size, s.drug_percentage, s.drug_quantity, s.user_id,
          q.app_survey_question,
          u.email, o.first_name, o.last_name, o.status, o.gender, o.address, o.contact_number, o.date_of_birth, o.stipend, o.study_enrolled_id,
          o.organization_detail_id, o.organization_id, o.notification, stu.study_name
      FROM
          app_survey s
      LEFT JOIN
          user u ON s.user_id = u.user_id
      LEFT JOIN
          organization o ON u.user_id = o.user_id
      LEFT JOIN study_enrolled stu ON FIND_IN_SET(stu.enrolled_id, o.study_enrolled_id) > 0
      LEFT JOIN
          app_survey_question_responses r ON s.user_id = r.user_id
      LEFT JOIN
          app_survey_questions q ON r.app_survey_question_id = q.app_survey_question_id
      LEFT JOIN
          user_role ur ON u.user_id = ur.user_id
      WHERE
          s.app_survey_id IN (
              SELECT sub.latest_survey_id
              FROM (
                  SELECT MAX(s2.app_survey_id) AS latest_survey_id
                  FROM app_survey s2
                  LEFT JOIN user u2 ON s2.user_id = u2.user_id
                  GROUP BY u2.email
              ) sub
          )
          AND ur.role_id = 10
          AND FIND_IN_SET(?, o.study_enrolled_id) > 0
          AND o.organization_detail_id = ?
    `;

    const [results] = await db.query(query, [
      investigator.study_enrolled_id,
      investigator.organization_detail_id,
    ]);

    const surveys = {};

    results.forEach((row) => {
      const surveyId = row.app_survey_id;
      if (!surveys[surveyId]) {
        surveys[surveyId] = {
          survey_id: surveyId,
          drug_name: row.drug_name,
          date: row.date,
          drug_size: row.drug_size,
          drug_percentage: row.drug_percentage,
          drug_quantity: row.drug_quantity,
          user: {
            user_id: row.user_id,
            email: row.email,
            first_name: decrypt(row.first_name),
            last_name: decrypt(row.last_name),
            status: row.status,
            gender: decrypt(row.gender),
            address: row.address,
            contact_number: decrypt(row.contact_number),
            date_of_birth: row.date_of_birth,
            stipend: row.stipend,
            study_enrolled: row.study_enrolled_id,
          },
          organization: {
            organization_id: row.organization_id,
            organization_detail_id: row.organization_detail_id,
            notification: row.notification,
            study_enrolled_id: row.study_enrolled_id,
            study_name: row.study_name,
          },
          questions: [],
        };
      }
      if (row.app_survey_question && row.app_survey_response) {
        surveys[surveyId].questions.push({
          question: row.app_survey_question,
          response: row.app_survey_response,
        });
      }
    });

    return Object.values(surveys);
  } catch (error) {
    console.error("Error in getAllSurveysForInvestigator:", error);
    throw error;
  }
};

const getSurveyDetails = async (userId) => {
  try {
    const query = `
      SELECT q.app_survey_question, r.app_survey_response, s.drug_name, s.date, s.drug_size, s.drug_dosage, s.drug_percentage, s.drug_quantity
      FROM app_survey_questions q
      LEFT JOIN app_survey_question_responses r ON q.app_survey_question_id = r.app_survey_question_id
      LEFT JOIN app_survey s ON r.user_id = s.user_id
      WHERE r.user_id = ?
    `;
    const [results] = await db.query(query, [userId]);

    const surveyDetails = {};
    results.forEach((row) => {
      const drugName = row.drug_name;
      if (!surveyDetails[drugName]) {
        surveyDetails[drugName] = {
          drug_name: drugName,
          date: row.date,
          drug_size: row.drug_size,
          drug_dosage: row.drug_dosage,
          drug_percentage: row.drug_percentage,
          drug_quantity: row.drug_quantity,
          questions: [],
        };
      }
      surveyDetails[drugName].questions.push({
        question: row.app_survey_question,
        response: row.app_survey_response,
      });
    });

    return Object.values(surveyDetails);
  } catch (error) {
    console.error("Error in getSurveyDetails:", error);
    throw error;
  }
};

const getSurveyDataByUserId = async (user_id) => {
  try {
    const query = `
      SELECT
        s.app_survey_id,
        s.drug_name,
        s.date,
        s.drug_size,
        s.drug_percentage,
        s.drug_quantity,
        s.user_id,
        u.email,
        org.first_name,
        org.last_name,
        org.date_of_birth,
        e.study_name,
        org.organization_detail_id,
        org.organization_id,
        sc.scale_name
      FROM
        app_survey s
        LEFT JOIN user u ON s.user_id = u.user_id
        LEFT JOIN study_enrolled e ON s.user_id = u.user_id
        LEFT JOIN study_enrolled_assigned_scale eas ON e.enrolled_id = eas.enrolled_id
        LEFT JOIN scale_translations sc ON eas.scale_id = sc.scale_id
        LEFT JOIN organization org ON u.user_id = org.user_id
      WHERE
        s.user_id = ?
    `;
    const [results] = await db.query(query, [user_id]);
    console.log("Survey data:", results);
    return results;
  } catch (error) {
    console.error("Error in getSurveyDataByUserId:", error);
    throw error;
  }
};

const getQuestionResponsesByUserId = async (user_id) => {
  try {
    const query = `
      SELECT
        r.app_survey_question_id,
        q.app_survey_question,
        o.option_text
      FROM
        app_survey_question_responses r
        JOIN app_survey_questions q ON r.app_survey_question_id = q.app_survey_question_id
        JOIN app_survey_question_options o ON r.option_id = o.app_survey_question_option_id
      WHERE
        r.user_id = ?
    `;
    const [results] = await db.query(query, [user_id]);
    console.log("Question responses:", results);
    return results;
  } catch (error) {
    console.error("Error in getQuestionResponsesByUserId:", error);
    throw error;
  }
};

const getSurveysByUserId = async (user_id) => {
  try {
    console.log("Fetching data for user_id:", user_id);
    const [surveyData, questionResponses] = await Promise.all([
      getSurveyDataByUserId(user_id),
      getQuestionResponsesByUserId(user_id),
    ]);

    console.log("Survey data:", surveyData);
    console.log("Question responses:", questionResponses);

    if (surveyData.length === 0 && questionResponses.length === 0) {
      console.warn("No data found for user_id:", user_id);
      return [];
    }

    const surveysById = {};

    surveyData.forEach((row) => {
      if (!surveysById[row.app_survey_id]) {
        surveysById[row.app_survey_id] = {
          survey_id: row.app_survey_id,
          date: row.date,
          drug_data: [],
          user: {
            user_id: row.user_id,
            email: row.email,
            first_name: decrypt(row.first_name),
            last_name: decrypt(row.last_name),
            date_of_birth: row.date_of_birth,
          },
          organization: {
            organization_id: row.organization_id,
            organization_detail_id: row.organization_detail_id,
          },
          questions: [],
        };
      }

      const drugExists = surveysById[row.app_survey_id].drug_data.some(
        (drug) =>
          drug.drug_name === row.drug_name &&
          drug.drug_size === row.drug_size &&
          drug.drug_percentage === row.drug_percentage &&
          drug.drug_quantity === row.drug_quantity
      );

      if (!drugExists) {
        surveysById[row.app_survey_id].drug_data.push({
          drug_name: row.drug_name,
          drug_size: row.drug_size,
          drug_percentage: row.drug_percentage,
          drug_quantity: row.drug_quantity,
        });
      }
    });

    const questionsMap = {};
    questionResponses.forEach((row) => {
      if (!questionsMap[row.app_survey_question_id]) {
        questionsMap[row.app_survey_question_id] = {
          question: row.app_survey_question,
          options: [],
        };
      }
      if (
        !questionsMap[row.app_survey_question_id].options.includes(
          row.option_text
        )
      ) {
        questionsMap[row.app_survey_question_id].options.push(row.option_text);
      }
    });

    Object.values(surveysById).forEach((survey) => {
      survey.questions = Object.values(questionsMap);
    });

    console.log("Processed survey data:", Object.values(surveysById));
    return Object.values(surveysById);
  } catch (error) {
    console.error("Error processing surveys:", error);
    throw error;
  }
};

const createSurveyQuestions = async (questions) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const insertQuestionQuery = `
      INSERT INTO app_survey_questions (app_survey_question)
      VALUES ?
    `;
    const questionValues = questions.map((question) => [question.text]);
    const [questionResult] = await connection.query(insertQuestionQuery, [
      questionValues,
    ]);

    const questionIds = [];
    for (let i = 0; i < questions.length; i++) {
      questionIds.push(questionResult.insertId + i);
    }

    const insertOptionsQuery = `
      INSERT INTO app_survey_question_options (app_survey_question_id, option_text, score)
      VALUES ?
    `;
    const optionValues = questions.reduce((values, question, index) => {
      const questionId = questionIds[index];
      const questionOptions = question.options.map((option) => [
        questionId,
        option.value,
        option.score,
      ]);
      return [...values, ...questionOptions];
    }, []);
    await connection.query(insertOptionsQuery, [optionValues]);

    await connection.commit();
    return { questions };
  } catch (err) {
    await connection.rollback();
    console.error("Error in createSurveyQuestions:", err);
    throw err;
  } finally {
    connection.release();
  }
};

const getSurveyQuestions = async () => {
  try {
    const query = `
      SELECT q.app_survey_question_id, q.app_survey_question, o.app_survey_question_option_id, o.option_text, o.score
      FROM app_survey_questions q
      LEFT JOIN app_survey_question_options o ON q.app_survey_question_id = o.app_survey_question_id
    `;
    const [results] = await db.query(query);

    const questions = {};
    results.forEach((row) => {
      if (!questions[row.app_survey_question_id]) {
        questions[row.app_survey_question_id] = {
          app_survey_question_id: row.app_survey_question_id,
          app_survey_question: row.app_survey_question,
          options: [],
        };
      }
      questions[row.app_survey_question_id].options.push({
        app_survey_question_option_id: row.app_survey_question_option_id,
        option_text: row.option_text,
        score: row.score,
      });
    });

    return Object.values(questions);
  } catch (error) {
    console.error("Error in getSurveyQuestions:", error);
    throw error;
  }
};

const submitSurveyResponse = async (
  userId,
  investigator_id,
  timer,
  surveyResponses,
  surveyDetails,
  scale_id
) => {
  try {
    const insertResponseQuery = `
      INSERT INTO app_survey_question_responses (user_id, investigator_id, timer, app_survey_question_id, option_id, created_at)
      VALUES ?
    `;
    const responseValues = surveyResponses.map((response) => [
      userId,
      investigator_id,
      timer,
      response.questionId,
      response.response.option_id,
      new Date(),
    ]);
    await db.query(insertResponseQuery, [responseValues]);

    const insertSurveyQuery = `
      INSERT INTO app_survey (drug_name, date, drug_size, drug_percentage, drug_quantity, user_id, scale_id)
      VALUES ?
    `;
    const surveyValues = surveyDetails.map((survey) => [
      survey.drug_name,
      survey.date,
      survey.drug_size,
      survey.drug_percentage,
      survey.drug_quantity,
      userId,
      scale_id,
    ]);
    await db.query(insertSurveyQuery, [surveyValues]);

    return { surveyResponses, surveyDetails };
  } catch (error) {
    console.error("Error in submitSurveyResponse:", error);
    throw error;
  }
};

const submitSurveyResponseForPortal = async (
  userId,
  surveyResponses,
  investigator_id,
  timer,
  scheduleId,
  dayId,
  scaleId,
  scale_start_time,
  scale_end_time,
  filled_by,
  language_code,
  token
) => {
  console.log(filled_by, "Portal Survey PDF check ============1=========");

  try {
    let whoqolScore = null;
    let totalScore = null;

    if (scaleId === 29) {
      whoqolScore = calculateWHOQOLScore(surveyResponses);
    } else {
      const optionIds = [
        ...new Set(surveyResponses.map((response) => response.option_id)),
      ];

      if (optionIds.length > 0) {
        const getScoresQuery = `
          SELECT option_id, score
          FROM scale_question_options
          WHERE option_id IN (?)
        `;
        const [scoreResults] = await db.query(getScoresQuery, [optionIds]);

        const scoreMap = {};
        scoreResults.forEach((item) => {
          scoreMap[item.option_id] = parseFloat(item.score) || 0;
        });

        totalScore = surveyResponses.reduce((acc, curr) => {
          const score = scoreMap[curr.option_id] || 0;
          return acc + score;
        }, 0);
      }
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const checkStatusQuery = `
        SELECT status
        FROM submit_scale_status
        WHERE user_id = ? AND study_schedule_id = ? AND day_id = ? AND scale_id = ?
      `;
      const [statusResults] = await connection.query(checkStatusQuery, [
        userId,
        scheduleId,
        dayId,
        scaleId,
      ]);

      if (statusResults.length > 0 && statusResults[0].status === "Completed") {
        await connection.rollback();
        throw new Error("This scale has already been submitted.");
      }

      const insertResponseQuery = `
        INSERT INTO app_survey_question_responses
        (user_id, investigator_id, timer, app_survey_question_id, option_id, scale_id, scale_start_time, scale_end_time, day_id, description, status, created_at)
        VALUES ?
      `;
      const responseValues = surveyResponses.map((response, index) => {
        const description = response.description ? response.description : "";
        return [
          userId,
          investigator_id,
          timer,
          response.questionId,
          response.option_id,
          scaleId,
          scale_start_time,
          scale_end_time,
          dayId,
          description,
          (status = "Enable"),
          new Date(),
        ];
      });
      console.log(responseValues, "----------scale response------------");

      await connection.query(insertResponseQuery, [responseValues]);

      const updateCurrentScaleQuery = `
        INSERT INTO submit_scale_status
        (study_schedule_id, status, user_id, day_id, scale_id,disable_status)
        VALUES (?, 'Completed', ?, ?, ?,?)
      `;
      await connection.query(updateCurrentScaleQuery, [
        scheduleId,
        userId,
        dayId,
        scaleId,
        (disable_status = "Enable"),
      ]);

      const checkAllScalesCompletedQuery = `
        SELECT
          (SELECT COUNT(*) FROM schedule_day_scales WHERE day_id = ?) as total_scales,
          (SELECT COUNT(DISTINCT scale_id) FROM app_survey_question_responses WHERE user_id = ? AND day_id = ?) as completed_scales
      `;
      const [allScalesResult] = await connection.query(
        checkAllScalesCompletedQuery,
        [dayId, userId, dayId]
      );

      const allScalesCompleted =
        allScalesResult[0].total_scales === allScalesResult[0].completed_scales;

      if (allScalesCompleted) {
        const checkNextDayScheduleQuery = `
          SELECT schedule_date
          FROM schedule
          WHERE user_id = ? AND day_id = ?
        `;
        await connection.query(checkNextDayScheduleQuery, [userId, dayId + 1]);
      } else {
      }

      await connection.commit();

      try {
        const getUserOrganization = `SELECT ecrf_id FROM organization WHERE user_id = ?`;
        const [ecrfIdResults] = await db.query(getUserOrganization, [userId]);

        if (ecrfIdResults.length === 0) {
          throw new Error("No ecrf_id found for user");
        }

        const ecrfId = ecrfIdResults[0].ecrf_id;

        const getOrganizationQuery = `
          SELECT
            o.first_name,
            o.last_name,
            o.ecrf_id,
            s.scale_name
          FROM
            organization AS o
          CROSS JOIN
            scale_translations AS s

          WHERE
            o.user_id = ?
            AND s.scale_id = ?
        `;
        const [orgResults] = await db.query(getOrganizationQuery, [
          investigator_id,
          scaleId,
        ]);

        if (orgResults.length === 0) {
          throw new Error(
            "No organization data found for investigator and scale"
          );
        }

        const investigator = orgResults[0];
        const scaleName = investigator.scale_name;

        const uniqueQuestionIds = [
          ...new Set(surveyResponses.map((res) => res.questionId)),
        ];
        const uniqueOptionIds = [
          ...new Set(surveyResponses.map((res) => res.option_id)),
        ];

        const getQuestionsQuery = `
          SELECT question_id, question_text
          FROM scale_question_translations
          WHERE question_id IN (?)
            AND language_code = ?
        `;
        const getOptionsQuery = `
          SELECT option_id, option_text
          FROM scale_question_option_translations
          WHERE option_id IN (?)
            AND language_code = ?
        `;

        const [questionResults] = await db.query(getQuestionsQuery, [
          uniqueQuestionIds,
          language_code,
        ]);
        const questionMap = {};
        questionResults.forEach((q) => {
          questionMap[q.question_id] = q.question_text;
        });

        const [optionResults] = await db.query(getOptionsQuery, [
          uniqueOptionIds,
          language_code,
        ]);
        const optionMap = {};
        optionResults.forEach((o) => {
          optionMap[o.option_id] = o.option_text;
        });

        const enhancedSurveyResponses = surveyResponses.map((res) => ({
          ...res,
          question_text:
            questionMap[res.questionId] || `Question ${res.questionId}`,
          option_text: optionMap[res.option_id] || "No answer provided",
        }));

        const getDayNamesandScheduleName = `SELECT day_name , schedule_id FROM schedule_days WHERE day_id = ? `;

        const [dayResult] = await db.query(getDayNamesandScheduleName, [dayId]);

        const getName = dayResult[0];
        const day_name = getName.day_name;
        const scheduleid = getName.schedule_id;

        const get_schedule_name = `SELECT schedule_name FROM study_schedules WHERE schedule_id = ?`;
        const [scheduleResult] = await db.query(get_schedule_name, [
          scheduleid,
        ]);

        const getSchedule = scheduleResult[0];
        const schedule_names = getSchedule.schedule_name;

        const query2 = "SELECT ecrf_id FROM organization WHERE user_id =?";
        const ecrfResult = await db.query(query2, [userId]);
        const checkecrf = ecrfResult[0];
        const ecrf_id = checkecrf[0].ecrf_id;

        const pdfBuffer = await generateSurveyPDF(
          scaleId,
          enhancedSurveyResponses,
          investigator,
          scaleName,
          ecrfId,
          filled_by,
          day_name,
          schedule_names,
          totalScore
        );

        console.log(
          filled_by,
          "Portal Survey PDF check ============2========="
        );

        const pdf = await sendPDFToAPI(
          pdfBuffer,
          userId,
          investigator_id,
          scaleName,
          scaleId,
          dayId,
          filled_by,
          day_name,
          schedule_names,
          ecrf_id,
          token
        );

        const excelFilePath = await generateSurveyExcel(
          scaleId,
          userId,
          enhancedSurveyResponses,
          whoqolScore,
          investigator,
          scaleName,
          ecrfId,
          filled_by,
          totalScore
        );

        const insertExcelSignatureQuery = `
          INSERT INTO excel_signature
          (doc_id, user_id, scale_id, day_id, investigatorId, excel_file_path, filled_by,status)
          VALUES (?, ?, ?, ?, ?, ?, ?,?)
        `;
        await db.query(insertExcelSignatureQuery, [
          pdf,
          userId,
          scaleId,
          dayId,
          investigator_id,
          excelFilePath,
          filled_by,
          (status = "Enable"),
        ]);

        return "Survey responses submitted, PDF sent, and Excel file generated successfully";
      } catch (error) {
        console.error("An error occurred:", error);
        throw error;
      }
    } catch (error) {
      await connection.rollback();
      console.error("An error occurred:", error);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
};

const deleteSurveyById = async (surveyId) => {
  try {
    const query = `
      DELETE FROM app_survey WHERE app_survey_id = ?
    `;
    const [result] = await db.query(query, [surveyId]);
    return result;
  } catch (error) {
    console.error("Error in deleteSurveyById:", error);
    throw error;
  }
};

const getScalesforUser = async (user_id) => {
  try {
    const query = `
      SELECT
        st.scale_name,
        r.investigator_id,
        r.timer,
        org.first_name,
        org.last_name,
        u.user_id,
        inv_org.first_name AS investigator_first_name,
        inv_org.last_name AS investigator_last_name
      FROM
        app_survey_question_responses r
        JOIN app_survey_questions q ON r.app_survey_question_id = q.app_survey_question_id
        JOIN scale s ON q.scale_id = s.scale_id
        JOIN scale_translations AS st ON s.scale_id = st.scale_id
        JOIN user u ON r.user_id = u.user_id
        JOIN organization org ON u.user_id = org.user_id
        JOIN organization inv_org ON r.investigator_id = inv_org.user_id
      WHERE
        r.user_id = ?
      GROUP BY
        s.scale_name, r.timer, org.first_name, org.last_name, u.user_id,
        r.investigator_id, inv_org.first_name, inv_org.last_name
      LIMIT 0, 25
    `;
    const [results] = await db.query(query, [user_id]);

    const decryptedResults = results.map((result) => {
      try {
        return {
          ...result,
          first_name: decrypt(result.first_name),
          last_name: decrypt(result.last_name),
          investigator_first_name: decrypt(result.investigator_first_name),
          investigator_last_name: decrypt(result.investigator_last_name),
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return result;
      }
    });

    return decryptedResults;
  } catch (error) {
    console.error("Error in getScalesforUser:", error);
    throw error;
  }
};

// const createScale = async (
//   scaleName,
//   questions,
//   study_id,
//   symptoms = [],
//   role_id
// ) => {
//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     const scaleQuery =
//       "INSERT INTO scale (scale_name, role_id, study_id) VALUES (?, ?, ?)";
//     const [scaleResult] = await connection.query(scaleQuery, [
//       scaleName,
//       role_id,
//       study_id,
//     ]);
//     const scaleId = scaleResult.insertId;

//     if (symptoms.length > 0) {
//       const symptomQuery =
//         "INSERT INTO symptoms (scale_id, symptom_text) VALUES ?";
//       const symptomValues = symptoms.map((symptom) => [scaleId, symptom]);
//       await connection.query(symptomQuery, [symptomValues]);
//     }

//     for (const question of questions) {
//       const questionQuery =
//         "INSERT INTO app_survey_questions (app_survey_question, scale_id) VALUES (?, ?)";
//       const [questionResult] = await connection.query(questionQuery, [
//         question.question,
//         scaleId,
//       ]);
//       const questionId = questionResult.insertId;

//       for (const option of question.options) {
//         const optionQuery =
//           "INSERT INTO app_survey_question_options (app_survey_question_id, option_text, score) VALUES (?, ?, ?)";
//         await connection.query(optionQuery, [
//           questionId,
//           option.option_text,
//           option.score,
//         ]);
//       }
//     }

//     const studyEnrolledQuery =
//       "INSERT INTO study_enrolled_assigned_scale (enrolled_id, scale_id, last_updated) VALUES (?, ?, ?)";
//     await connection.query(studyEnrolledQuery, [
//       study_id,
//       scaleId,
//       new Date().toISOString().split("T")[0],
//     ]);

//     await connection.commit();

//     return {
//       message: "Scale created successfully",
//       scaleId: scaleId,
//     };
//   } catch (error) {
//     await connection.rollback();
//     console.error("Error in createScale:", error);
//     throw error;
//   } finally {
//     connection.release();
//   }
// };
const createScale = async (
  scaleName,
  questions,
  study_id,
  symptoms = [],
  role_id
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const scaleQuery =
      "INSERT INTO scale (scale_name, role_id, study_id) VALUES (?, ?, ?)";
    const [scaleResult] = await connection.query(scaleQuery, [
      scaleName,
      role_id,
      study_id,
    ]);
    const scaleId = scaleResult.insertId;

    if (symptoms.length > 0) {
      const symptomQuery =
        "INSERT INTO symptoms (scale_id, symptom_text) VALUES ?";
      const symptomValues = symptoms.map((symptom) => [scaleId, symptom]);
      await connection.query(symptomQuery, [symptomValues]);
    }

    for (const question of questions) {
      const questionQuery =
        "INSERT INTO app_survey_questions (app_survey_question, scale_id) VALUES (?, ?)";
      const [questionResult] = await connection.query(questionQuery, [
        question.question,
        scaleId,
      ]);
      const questionId = questionResult.insertId;

      for (const option of question.options) {
        const optionQuery =
          "INSERT INTO app_survey_question_options (app_survey_question_id, option_text, score) VALUES (?, ?, ?)";
        await connection.query(optionQuery, [
          questionId,
          option.option_text,
          option.score,
        ]);
      }
    }

    const studyEnrolledQuery =
      "INSERT INTO study_enrolled_assigned_scale (enrolled_id, scale_id, last_updated) VALUES (?, ?, ?)";
    await connection.query(studyEnrolledQuery, [
      study_id,
      scaleId,
      new Date().toISOString().split("T")[0],
    ]);

    await connection.commit();

    return scaleId; // Return only the scaleId
  } catch (error) {
    await connection.rollback();
    console.error("Error in createScale:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const getScale = async (scaleId) => {
  try {
    const query = `
      SELECT q.app_survey_question_id, q.app_survey_question, o.app_survey_question_option_id, o.option_text, o.score, s.scale_name, s.start_description, s.end_description
      FROM app_survey_questions q
      LEFT JOIN scale AS s ON q.scale_id = s.scale_id
      LEFT JOIN app_survey_question_options o ON q.app_survey_question_id = o.app_survey_question_id
      WHERE q.scale_id = ?
    `;
    const [results] = await db.query(query, [scaleId]);

    const questions = {};
    results.forEach((row) => {
      if (!questions[row.app_survey_question_id]) {
        questions[row.app_survey_question_id] = {
          app_survey_question_id: row.app_survey_question_id,
          app_survey_question: row.app_survey_question,
          scale_name: row.scale_name,
          start_description: row.start_description,
          end_description: row.end_description,
          options: [],
        };
      }
      questions[row.app_survey_question_id].options.push({
        app_survey_question_option_id: row.app_survey_question_option_id,
        option_text: row.option_text,
        score: row.score,
      });
    });

    return Object.values(questions);
  } catch (error) {
    console.error("Error in getScale:", error);
    throw error;
  }
};

const getSpanishScalebyScaleid = async (scaleId) => {
  try {
    const query = `
      SELECT
        q.app_survey_question_id,
        q.app_survey_question,
        o.app_survey_question_option_id,
        o.option_text,
        o.score,
        s.scale_name,
        s.start_description,
        s.end_description
      FROM spa_scale s
      INNER JOIN app_survey_questions AS q ON s.scale_id = q.spa_scale_id
      LEFT JOIN app_survey_question_options o ON q.app_survey_question_id = o.app_survey_question_id
      WHERE q.spa_scale_id = ?
    `;
    const [results] = await db.query(query, [scaleId]);

    const questions = {};
    results.forEach((row) => {
      if (!questions[row.app_survey_question_id]) {
        questions[row.app_survey_question_id] = {
          app_survey_question_id: row.app_survey_question_id,
          app_survey_question: row.app_survey_question,
          scale_name: row.scale_name || "Unknown Scale",
          start_description: row.start_description,
          end_description: row.end_description,
          options: [],
        };
      }
      questions[row.app_survey_question_id].options.push({
        app_survey_question_option_id: row.app_survey_question_option_id,
        option_text: row.option_text,
        score: row.score,
      });
    });

    return Object.values(questions);
  } catch (error) {
    console.error("Error in getSpanishScalebyScaleid:", error);
    throw error;
  }
};

// const scaleCount = async () => {
//   try {
//     const query = "SELECT COUNT(*) AS count FROM scale_translations";
//     const [result] = await db.query(query);
//     return result[0].count;
//   } catch (error) {
//     console.error("Error in scaleCount:", error);
//     throw error;
//   }
// };

const scaleCount = async () => {
  try {
    let query = `
      SELECT COUNT(DISTINCT st.scale_name) AS count
      FROM scale AS s
      JOIN scale_translations AS st ON s.scale_id = st.scale_id
      JOIN scale_questions AS sq ON s.scale_id = sq.scale_id
      JOIN scale_question_translations AS q ON sq.question_id = q.question_id
      JOIN scale_question_options AS sqo ON sq.question_id = sqo.question_id
      JOIN scale_question_option_translations AS o ON sqo.option_id = o.option_id
      WHERE st.language_code IN ('en', 'spa', 'ro')
        AND q.language_code IN ('en', 'spa', 'ro')
        AND o.language_code IN ('en', 'spa', 'ro')
    `;

    const [result] = await db.query(query);
    return result[0].count;
  } catch (error) {
    console.error("Error in scaleCount:", error);
    throw error;
  }
};

const getAllScales = async (role_id) => {
  try {
    let query = `
    SELECT
        s.scale_id,
        st.scale_name,
        sq.question_id,
        q.question_text,
        sq.question_type,
        sqo.option_id,
        o.option_text,
        st.language_code
      FROM
        scale AS s
      JOIN
        scale_translations AS st ON s.scale_id = st.scale_id
      JOIN
        scale_questions AS sq ON s.scale_id = sq.scale_id
      JOIN
        scale_question_translations AS q ON sq.question_id = q.question_id
      JOIN
        scale_question_options AS sqo ON sq.question_id = sqo.question_id
      JOIN
        scale_question_option_translations AS o ON sqo.option_id = o.option_id
      WHERE
        (st.language_code = 'en' OR st.language_code = 'spa' OR st.language_code = 'ro') AND
        (q.language_code = 'en' OR q.language_code = 'spa' OR q.language_code = 'ro') AND
        (o.language_code = 'en' OR o.language_code = 'spa' OR o.language_code = 'ro')
    `;

    const queryParams = [];
    if (role_id !== 9 && role_id !== 12 && role_id !== 18) {
      query += ` AND s.role_id = ?`;
      queryParams.push(role_id);
    }

    const [result] = await db.query(query, queryParams);

    const groupedResult = result.reduce((acc, row) => {
      const {
        scale_id,
        scale_name,
        language_code,
        question_id,
        question_text,
        option_id,
        option_text,
      } = row;

      if (!acc[scale_name]) {
        acc[scale_name] = {
          scale_id,
          language_code,
          scale_name,
          questions: {},
        };
      }

      if (!acc[scale_name].questions[question_text]) {
        acc[scale_name].questions[question_text] = {
          question_id,
          options: [],
        };
      }

      acc[scale_name].questions[question_text].options.push({
        option_id,
        option_text,
      });

      return acc;
    }, {});

    const formattedResult = Object.values(groupedResult).map((scale) => ({
      ...scale,

      questions: Object.entries(scale.questions).map(
        ([question_text, questionData]) => ({
          question_text,
          question_id: questionData.question_id,
          options: questionData.options,
        })
      ),
    }));

    return formattedResult;
  } catch (error) {
    console.error("Error in getAllScales:", error);
    throw error;
  }
};

const getAllScaleName = async () => {
  try {
    const query = `SELECT * FROM scale`;
    const [result] = await db.query(query);
    return result;
  } catch (error) {
    console.error("Error in getAllScaleName:", error);
    throw error;
  }
};

const getScaleByScaleid = async (id) => {
  try {
    const query = `SELECT * FROM scale WHERE scale_id = ?`;
    const [result] = await db.query(query, [id]);
    return result[0] || null;
  } catch (error) {
    console.error("Error in getScaleByScaleid:", error);
    throw error;
  }
};

const getQuestionResponsesByUserIdforportal = async (user_id) => {
  try {
    const query = `
      SELECT
        r.app_survey_question_id,
        q.app_survey_question,
        o.option_text,
        o.score
      FROM
        app_survey_question_responses r
        JOIN app_survey_questions q ON r.app_survey_question_id = q.app_survey_question_id
        JOIN app_survey_question_options o ON r.option_id = o.app_survey_question_option_id
      WHERE
        r.user_id = ?
    `;
    const [results] = await db.query(query, [user_id]);
    console.log("Question responses:", results);
    return results;
  } catch (error) {
    console.error("Error in getQuestionResponsesByUserIdforportal:", error);
    throw error;
  }
};

const updateScale = async (scaleId, scaleName, questions) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updateScaleQuery =
      "UPDATE scale SET scale_name = ? WHERE scale_id = ?";
    await connection.query(updateScaleQuery, [scaleName, scaleId]);

    const getQuestionsQuery =
      "SELECT app_survey_question_id, app_survey_question FROM app_survey_questions WHERE scale_id = ?";
    const [existingQuestions] = await connection.query(getQuestionsQuery, [
      scaleId,
    ]);

    for (const question of questions) {
      let questionId;
      const existingQuestion = existingQuestions.find(
        (q) => q.app_survey_question_id === question.id
      );

      if (existingQuestion) {
        questionId = existingQuestion.app_survey_question_id;
        const updateQuestionQuery =
          "UPDATE app_survey_questions SET app_survey_question = ? WHERE app_survey_question_id = ?";
        await connection.query(updateQuestionQuery, [
          question.question,
          questionId,
        ]);
      } else {
        continue;
      }

      const getOptionsQuery =
        "SELECT app_survey_question_option_id, option_text, score FROM app_survey_question_options WHERE app_survey_question_id = ?";
      const [existingOptions] = await connection.query(getOptionsQuery, [
        questionId,
      ]);

      for (const option of question.options) {
        const existingOption = existingOptions.find(
          (o) => o.app_survey_question_option_id === option.id
        );
        if (existingOption) {
          const updateOptionQuery =
            "UPDATE app_survey_question_options SET option_text = ?, score = ? WHERE app_survey_question_option_id = ?";
          await connection.query(updateOptionQuery, [
            option.option_text,
            option.score,
            option.id,
          ]);
        }
      }
    }

    await connection.commit();

    return {
      message: "Scale updated successfully",
      scaleId: scaleId,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error updating scale:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const getScaleById = async (scaleId) => {
  try {
    const query = `
      SELECT
        s.scale_id,
        s.start_description,
        s.end_description,
        s.scale_name,
        q.app_survey_question,
        o.option_text,
        o.score
      FROM
        scale AS s
      JOIN
        app_survey_questions AS q ON s.scale_id = q.scale_id
      JOIN
        app_survey_question_options AS o ON q.app_survey_question_id = o.app_survey_question_id
      WHERE
        s.scale_id = ?
    `;
    const [results] = await db.query(query, [scaleId]);

    if (results.length === 0) {
      return null;
    }

    const groupedResult = results.reduce((acc, row) => {
      const {
        scale_id,
        scale_name,
        start_description,
        end_description,
        app_survey_question,
        option_text,
        score,
      } = row;

      if (!acc.questions) {
        acc.scale_id = scale_id;
        acc.scale_name = scale_name;
        acc.start_description = start_description;
        acc.end_description = end_description;
        acc.questions = {};
      }

      if (!acc.questions[app_survey_question]) {
        acc.questions[app_survey_question] = [];
      }

      acc.questions[app_survey_question].push({
        option_text,
        score,
      });
      return acc;
    }, {});

    groupedResult.questions = Object.entries(groupedResult.questions).map(
      ([question, options]) => ({
        question,
        options,
      })
    );

    return groupedResult;
  } catch (error) {
    console.error("Error in getScaleById:", error);
    throw error;
  }
};

const submitMobileAppModelRessponse = async (userId, surveyDetails) => {
  console.log("Received survey details:", surveyDetails);
  try {
    const insertSurveyQuery = `
      INSERT INTO app_survey (drug_name, date, drug_size, drug_percentage, drug_quantity, user_id)
      VALUES ?
    `;
    const surveyValues = surveyDetails.map((survey) => [
      survey.drug_name,
      survey.date,
      survey.drug_size,
      survey.drug_percentage,
      survey.drug_quantity,
      userId,
    ]);
    await db.query(insertSurveyQuery, [surveyValues]);

    return { surveyDetails };
  } catch (error) {
    console.error("Error in submitMobileAppModelRessponse:", error);
    throw error;
  }
};

const createSpanishScale = async (
  scaleName,
  questions,
  study_id,
  symptoms = [],
  role_id
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const scaleQuery =
      "INSERT INTO spa_scale (scale_name, role_id, study_id) VALUES (?, ?, ?)";
    const [scaleResult] = await connection.query(scaleQuery, [
      scaleName,
      role_id,
      study_id,
    ]);
    const scaleId = scaleResult.insertId;

    if (symptoms.length > 0) {
      const symptomQuery =
        "INSERT INTO symptoms (spa_scale_id, symptom_text) VALUES ?";
      const symptomValues = symptoms.map((symptom) => [scaleId, symptom]);
      await connection.query(symptomQuery, [symptomValues]);
    }

    for (const question of questions) {
      const questionQuery =
        "INSERT INTO app_survey_questions (app_survey_question, spa_scale_id) VALUES (?, ?)";
      const [questionResult] = await connection.query(questionQuery, [
        question.question,
        scaleId,
      ]);
      const questionId = questionResult.insertId;

      for (const option of question.options) {
        const optionQuery =
          "INSERT INTO app_survey_question_options (app_survey_question_id, option_text, score) VALUES (?, ?, ?)";
        await connection.query(optionQuery, [
          questionId,
          option.option_text,
          option.score,
        ]);
      }
    }

    const studyEnrolledQuery =
      "INSERT INTO study_enrolled_assigned_scale (enrolled_id, scale_id, last_updated) VALUES (?, ?, ?)";
    await connection.query(studyEnrolledQuery, [
      study_id,
      scaleId,
      new Date().toISOString().split("T")[0],
    ]);

    await connection.commit();

    return {
      message: "Spanish Scale created successfully",
      scaleId: scaleId,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error in createSpanishScale:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const getSpanishScale = async (scaleId) => {
  try {
    const query = `
      SELECT
        q.app_survey_question_id,
        q.app_survey_question,
        o.app_survey_question_option_id,
        o.option_text,
        o.score,
        s.scale_name,
        s.start_description,
        s.end_description
      FROM
        app_survey_questions q
      LEFT JOIN
        spa_scale AS s ON q.spa_scale_id = s.scale_id
      LEFT JOIN
        app_survey_question_options o ON q.app_survey_question_id = o.app_survey_question_id
      WHERE
        q.spa_scale_id = ?
    `;
    const [results] = await db.query(query, [scaleId]);

    if (results.length === 0) {
      return null;
    }

    const questions = {};

    results.forEach((row) => {
      if (!questions[row.app_survey_question_id]) {
        questions[row.app_survey_question_id] = {
          app_survey_question_id: row.app_survey_question_id,
          app_survey_question: row.app_survey_question,
          scale_name: row.scale_name,
          start_description: row.start_description,
          end_description: row.end_description,
          options: [],
        };
      }
      questions[row.app_survey_question_id].options.push({
        app_survey_question_option_id: row.app_survey_question_option_id,
        option_text: row.option_text,
        score: row.score,
      });
    });

    return Object.values(questions);
  } catch (error) {
    console.error("Error in getSpanishScale:", error);
    throw error;
  }
};

const getAllSpanishScaleName = async () => {
  try {
    const query = `SELECT * FROM spa_scale`;
    const [result] = await db.query(query);
    return result;
  } catch (error) {
    console.error("Error in getAllSpanishScaleName:", error);
    throw error;
  }
};

const createRomanionScale = async (
  scaleName,
  questions,
  study_id,
  symptoms = [],
  role_id
) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const scaleQuery =
      "INSERT INTO romanion_scale (scale_name, role_id, study_id) VALUES (?, ?, ?)";
    const [scaleResult] = await connection.query(scaleQuery, [
      scaleName,
      role_id,
      study_id,
    ]);
    const scaleId = scaleResult.insertId;

    if (symptoms.length > 0) {
      const symptomQuery =
        "INSERT INTO symptoms (rom_scale_id, symptom_text) VALUES ?";
      const symptomValues = symptoms.map((symptom) => [scaleId, symptom]);
      await connection.query(symptomQuery, [symptomValues]);
    }

    for (const question of questions) {
      const questionQuery =
        "INSERT INTO app_survey_questions (app_survey_question, rom_scale_id) VALUES (?, ?)";
      const [questionResult] = await connection.query(questionQuery, [
        question.question,
        scaleId,
      ]);
      const questionId = questionResult.insertId;

      for (const option of question.options) {
        const optionQuery =
          "INSERT INTO app_survey_question_options (app_survey_question_id, option_text, score) VALUES (?, ?, ?)";
        await connection.query(optionQuery, [
          questionId,
          option.option_text,
          option.score,
        ]);
      }
    }

    const studyEnrolledQuery =
      "INSERT INTO study_enrolled_assigned_scale (enrolled_id, rom_scale_id, last_updated) VALUES (?, ?, ?)";
    await connection.query(studyEnrolledQuery, [
      study_id,
      scaleId,
      new Date().toISOString().split("T")[0],
    ]);

    await connection.commit();

    return {
      message: "Romanion Scale created successfully",
      scaleId: scaleId,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error creating Romanion scale:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const getRomanionScale = async (scaleId) => {
  try {
    const query = `
      SELECT
        q.app_survey_question_id,
        q.app_survey_question,
        o.app_survey_question_option_id,
        o.option_text,
        o.score,
        s.scale_name,
        s.start_description,
        s.end_description
      FROM
        app_survey_questions q
      LEFT JOIN
        romanion_scale AS s ON q.rom_scale_id = s.scale_id
      LEFT JOIN
        app_survey_question_options o ON q.app_survey_question_id = o.app_survey_question_id
      WHERE
        q.rom_scale_id = ?
    `;
    const [results] = await db.query(query, [scaleId]);

    if (results.length === 0) {
      return null;
    }

    const questions = {};

    results.forEach((row) => {
      if (!questions[row.app_survey_question_id]) {
        questions[row.app_survey_question_id] = {
          app_survey_question_id: row.app_survey_question_id,
          app_survey_question: row.app_survey_question,
          scale_name: row.scale_name,
          start_description: row.start_description,
          end_description: row.end_description,
          options: [],
        };
      }
      questions[row.app_survey_question_id].options.push({
        app_survey_question_option_id: row.app_survey_question_option_id,
        option_text: row.option_text,
        score: row.score,
      });
    });

    return Object.values(questions);
  } catch (error) {
    console.error("Error in getRomanionScale:", error);
    throw error;
  }
};

// const getAllPatientsResponses = async (language_code, scaleId) => {
//   try {
//     const query = `
//       SELECT
//         ar.app_survey_question_response_id,
//         ar.user_id,
//         ar.scale_start_time,
//         ar.scale_end_time,
//         user_org.first_name AS user_first_name,
//         user_org.last_name AS user_last_name,
//         ar.investigator_id,
//         investigator_org.first_name AS investigator_first_name,
//         investigator_org.last_name AS investigator_last_name,
//         o.ecrf_id,
//         o.middle_name,
//         o.status,
//         o.gender,
//         o.address,
//         o.contact_number,
//         o.date_of_birth,
//         o.stipend,
//         o.date_enrolled,
//         stu.enrolled_id,
//         stu.study_name,
//         stu.start_date AS study_start_date,
//         stu.end_date AS study_end_date,
//         stu.lower_age_limit,
//         stu.upper_age_limit,
//         org.organization_detail_id,
//         org.organization_name,
//         org.organization_address,
//         ar.app_survey_question_id AS question_id,
//         qt.question_text,
//         ar.option_id,
//         ot.option_text,
//         sqo.score,
//         ar.description,
//         ar.day_id,
//         d.day_name,
//         ss.schedule_name,
//         d.day_order,
//         ar.scale_id,
//         st.scale_name,
//         s.filled_by,
//         ar.created_at
//       FROM
//         app_survey_question_responses ar
//       LEFT JOIN organization user_org ON ar.user_id = user_org.user_id
//       LEFT JOIN organization investigator_org ON ar.investigator_id = investigator_org.user_id
//       LEFT JOIN organization o ON ar.user_id = o.user_id
//       LEFT JOIN study_enrolled AS stu ON o.study_enrolled_id = stu.enrolled_id
//       LEFT JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
//       LEFT JOIN (
//         SELECT
//           user_id,
//           GROUP_CONCAT(medication_id) AS medication_ids,
//           GROUP_CONCAT(medication_name) AS medication_names
//         FROM patientmedications
//         GROUP BY user_id
//       ) m ON ar.user_id = m.user_id
//       LEFT JOIN scale_question_translations qt ON ar.app_survey_question_id = qt.question_id AND qt.language_code = ?
//       LEFT JOIN scale_question_option_translations ot ON ar.option_id = ot.option_id AND ot.language_code = ?
//       LEFT JOIN scale_question_options sqo ON ar.option_id = sqo.option_id
//       LEFT JOIN schedule_days d ON ar.day_id = d.day_id
//       LEFT JOIN study_schedules ss ON d.schedule_id = ss.schedule_id
//       LEFT JOIN scale_translations st ON ar.scale_id = st.scale_id AND st.language_code = ?
//       LEFT JOIN scale s ON ar.scale_id = s.scale_id
//       INNER JOIN submit_scale_status sss ON ar.user_id = sss.user_id AND ar.scale_id = sss.scale_id AND ar.day_id = sss.day_id
//       WHERE
//       ar.status = 'Enable' AND sss.disable_status = 'Enable' AND sss.status = 'Completed'
//       AND ar.scale_id = ?
//       ORDER BY ar.user_id, ar.app_survey_question_response_id;
//     `;
//     const [result] = await db.query(query, [
//       language_code,
//       language_code,
//       language_code,
//       scaleId,
//     ]);
//     return result;
//   } catch (error) {
//     console.error("Error in getAllPatientsResponses:", error);
//     throw error;
//   }
// };

const getAllPatientsResponses = async (language_code, scaleId) => {
  let isScaleASC;
  if (parseInt(scaleId) === 4) {
    isScaleASC = true;
    console.log(
      "===========================================================COMBINING ALL ALCOHOL SYMPTOPS CHECKLISTS SCALES==========================================================="
    );
  }

  try {
    const query = isScaleASC
      ? `
      SELECT
        ar.app_survey_question_response_id,
        ar.user_id,
        ar.scale_start_time,
        ar.scale_end_time,
        user_org.first_name AS user_first_name,
        user_org.last_name AS user_last_name,
        ar.investigator_id,
        investigator_org.first_name AS investigator_first_name,
        investigator_org.last_name AS investigator_last_name,
        o.ecrf_id,
        o.middle_name,
        o.status,
        o.gender,
        o.address,
        o.contact_number,
        o.date_of_birth,
        o.stipend,
        o.date_enrolled,
        stu.enrolled_id,
        stu.study_name,
        stu.start_date AS study_start_date,
        stu.end_date AS study_end_date,
        stu.lower_age_limit,
        stu.upper_age_limit,
        org.organization_detail_id,
        org.organization_name,
        org.organization_address,
        ar.app_survey_question_id AS question_id,
        qt.question_text,
        ar.option_id,
        ot.option_text,
        sqo.score,
        ar.description,
        ar.day_id,
        d.day_name,
        ss.schedule_name,
        d.day_order,
        ar.scale_id,
        st.scale_name,
        s.filled_by,
        ar.created_at
      FROM
        app_survey_question_responses ar
      LEFT JOIN organization user_org ON ar.user_id = user_org.user_id
      LEFT JOIN organization investigator_org ON ar.investigator_id = investigator_org.user_id
      LEFT JOIN organization o ON ar.user_id = o.user_id
      LEFT JOIN study_enrolled AS stu ON o.study_enrolled_id = stu.enrolled_id
      LEFT JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
      LEFT JOIN (
        SELECT
          user_id,
          GROUP_CONCAT(medication_id) AS medication_ids,
          GROUP_CONCAT(medication_name) AS medication_names
        FROM patientmedications
        GROUP BY user_id
      ) m ON ar.user_id = m.user_id
      LEFT JOIN scale_question_translations qt ON ar.app_survey_question_id = qt.question_id AND qt.language_code = "en"
      LEFT JOIN scale_question_option_translations ot ON ar.option_id = ot.option_id AND ot.language_code = "en"
      LEFT JOIN scale_question_options sqo ON ar.option_id = sqo.option_id
      LEFT JOIN schedule_days d ON ar.day_id = d.day_id
      LEFT JOIN study_schedules ss ON d.schedule_id = ss.schedule_id
      LEFT JOIN scale_translations st ON ar.scale_id = st.scale_id AND st.language_code = "en"
      LEFT JOIN scale s ON ar.scale_id = s.scale_id
      INNER JOIN submit_scale_status sss ON ar.user_id = sss.user_id AND ar.scale_id = sss.scale_id AND ar.day_id = sss.day_id
      WHERE
      ar.status = 'Enable' AND sss.disable_status = 'Enable' AND sss.status = 'Completed'
      AND ar.scale_id IN (4,70,71)
      ORDER BY ar.user_id, ar.app_survey_question_response_id;`
      : `
      SELECT
        ar.app_survey_question_response_id,
        ar.user_id,
        ar.scale_start_time,
        ar.scale_end_time,
        user_org.first_name AS user_first_name,
        user_org.last_name AS user_last_name,
        ar.investigator_id,
        investigator_org.first_name AS investigator_first_name,
        investigator_org.last_name AS investigator_last_name,
        o.ecrf_id,
        o.middle_name,
        o.status,
        o.gender,
        o.address,
        o.contact_number,
        o.date_of_birth,
        o.stipend,
        o.date_enrolled,
        stu.enrolled_id,
        stu.study_name,
        stu.start_date AS study_start_date,
        stu.end_date AS study_end_date,
        stu.lower_age_limit,
        stu.upper_age_limit,
        org.organization_detail_id,
        org.organization_name,
        org.organization_address,
        ar.app_survey_question_id AS question_id,
        qt.question_text,
        ar.option_id,
        ot.option_text,
        sqo.score,
        ar.description,
        ar.day_id,
        d.day_name,
        ss.schedule_name,
        d.day_order,
        ar.scale_id,
        st.scale_name,
        s.filled_by,
        ar.created_at
      FROM
        app_survey_question_responses ar
      LEFT JOIN organization user_org ON ar.user_id = user_org.user_id
      LEFT JOIN organization investigator_org ON ar.investigator_id = investigator_org.user_id
      LEFT JOIN organization o ON ar.user_id = o.user_id
      LEFT JOIN study_enrolled AS stu ON o.study_enrolled_id = stu.enrolled_id
      LEFT JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
      LEFT JOIN (
        SELECT
          user_id,
          GROUP_CONCAT(medication_id) AS medication_ids,
          GROUP_CONCAT(medication_name) AS medication_names
        FROM patientmedications
        GROUP BY user_id
      ) m ON ar.user_id = m.user_id
      LEFT JOIN scale_question_translations qt ON ar.app_survey_question_id = qt.question_id AND qt.language_code = ?
      LEFT JOIN scale_question_option_translations ot ON ar.option_id = ot.option_id AND ot.language_code = ?
      LEFT JOIN scale_question_options sqo ON ar.option_id = sqo.option_id
      LEFT JOIN schedule_days d ON ar.day_id = d.day_id
      LEFT JOIN study_schedules ss ON d.schedule_id = ss.schedule_id
      LEFT JOIN scale_translations st ON ar.scale_id = st.scale_id AND st.language_code = ?
      LEFT JOIN scale s ON ar.scale_id = s.scale_id
      INNER JOIN submit_scale_status sss ON ar.user_id = sss.user_id AND ar.scale_id = sss.scale_id AND ar.day_id = sss.day_id
      WHERE
      ar.status = 'Enable' AND sss.disable_status = 'Enable' AND sss.status = 'Completed'
      AND ar.scale_id = ?
      ORDER BY ar.user_id, ar.app_survey_question_response_id;
    `;
    const [result] = await db.query(query, [
      language_code,
      language_code,
      language_code,
      scaleId,
    ]);
    return result;
  } catch (error) {
    console.error("Error in getAllPatientsResponses:", error);
    throw error;
  }
};





const ArchivalScaleChangeStatus = async (userId, scaleId, dayId) => {
  try {
    const query1 = `
      UPDATE app_survey_question_responses
      SET status = 'Disable'
      WHERE user_id = ? AND scale_id = ? AND day_id = ?
    `;
    await db.query(query1, [userId, scaleId, dayId]);

    const query2 = `
      UPDATE submit_scale_status
      SET disable_status = 'Disable' , status = 'Pending'
      WHERE user_id = ? AND scale_id = ? AND day_id = ?
    `;
    await db.query(query2, [userId, scaleId, dayId]);

    const query3 = `
      UPDATE excel_signature
      SET status = 'Disable'
      WHERE user_id = ? AND scale_id = ? AND day_id = ?
    `;
    await db.query(query3, [userId, scaleId, dayId]);

    const query4 = `
      UPDATE signature
      SET status = 'Disable'
      WHERE user_id = ? AND scale_id = ? AND day_id = ?
    `;
    await db.query(query4, [userId, scaleId, dayId]);

    return { success: true, message: "All statuses updated to Disable." };
  } catch (error) {
    console.error("Error in ArchivalScaleChangeStatus:", error);
    throw error;
  }
};

const deleteScaleById = async (scaleId) => {
  try {
    // scale
    const query = `
      DELETE FROM scale WHERE scale_id = ?
    `;
    const [result] = await db.query(query, [scaleId]);
    // scale translation
    const scaletranslationQuery = `
      DELETE FROM scale_translations WHERE scale_id = ?
    `;
    await db.query(scaletranslationQuery, [scaleId]);

    // get sectionid from scale_sections
    const sectionQuery = `
      SELECT section_id FROM scale_sections WHERE scale_id = ?
    `;

    const [sectionResult] = await db.query(sectionQuery, [scaleId]);
    const sectionIds = sectionResult.map((row) => row.section_id);
    console.log(sectionIds);

    // scale section translation
    const scalesectiontranslationQuery = `
      DELETE FROM scale_section_translations WHERE section_id IN (?)
    `;
    await db.query(scalesectiontranslationQuery, [sectionIds]);
    console.log("scale section translation deleted");

    // scale section
    const scalesectionQuery = `
      DELETE FROM scale_sections WHERE scale_id = ?
    `;
    await db.query(scalesectionQuery, [scaleId]);

    // get question_id from scale_questions
    const questionQuery = `
      SELECT question_id FROM scale_questions WHERE scale_id = ?
    `;
    const [questionResult] = await db.query(questionQuery, [scaleId]);
    const questionIds = questionResult.map((row) => row.question_id);
    console.log(questionIds);

    // scale question translation
    const scalequestiontranslationQuery = `
      DELETE FROM scale_question_translations WHERE question_id IN (?)
    `;
    await db.query(scalequestiontranslationQuery, [questionIds]);

    // scale_questions
    const scalequestionQuery = `
      DELETE FROM scale_questions WHERE scale_id = ?
    `;
    await db.query(scalequestionQuery, [scaleId]);

    // get option_id from scale_question_options  where questionIds
    const optionQuery = `
      SELECT option_id FROM scale_question_options WHERE question_id IN (?)
    `;
    const [optionResult] = await db.query(optionQuery, [questionIds]);
    const optionIds = optionResult.map((row) => row.option_id);
    console.log(optionIds);

    // delete scale_question_option_translations where optionIds
    const scalequestionoptiontranslationQuery = `
      DELETE FROM scale_question_option_translations WHERE option_id IN (?)
    `;
    await db.query(scalequestionoptiontranslationQuery, [optionIds]);
    console.log("scale question option translation deleted");

    // delete scale_question_options where questionIds
    const scalequestionoptionQuery = `
      DELETE FROM scale_question_options WHERE question_id IN (?)
    `;
    await db.query(scalequestionoptionQuery, [questionIds]);
    console.log("scale question option deleted");

    return result;
  } catch (error) {
    console.error("Error in deleteScaleById:", error);
    throw error;
  }
};

module.exports = {
  getAllSurveys,
  getAllSurveysForInvestigator,
  getSurveyDetails,
  getSurveysByUserId,
  createSurveyQuestions,
  getSurveyQuestions,
  submitSurveyResponse,
  submitSurveyResponseForPortal,
  deleteSurveyById,
  getScalesforUser,
  createScale,
  getScale,
  scaleCount,
  getAllScales,
  getAllScaleName,
  getScaleByScaleid,
  getQuestionResponsesByUserIdforportal,
  submitMobileAppModelRessponse,
  createSpanishScale,
  getSpanishScale,
  getAllSpanishScaleName,
  createRomanionScale,
  getRomanionScale,
  getSpanishScalebyScaleid,

  getAllPatientsResponses,
  ArchivalScaleChangeStatus,
  deleteScaleById,
};
