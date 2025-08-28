const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Function to create survey questions and options
const OtherSurveyQuestion = async (questions, study_enrolled_id) => {
  if (!Array.isArray(questions)) {
    throw new Error("Questions must be an array");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const insertQuestionQuery = `
      INSERT INTO app_other_question (question_text, study_enrolled_id)
      VALUES ?
    `;
    const questionValues = questions.map((question) => [
      question.question_text,
      study_enrolled_id,
    ]);

    const [result] = await connection.query(insertQuestionQuery, [
      questionValues,
    ]);

    const firstQuestionId = result.insertId;
    const questionIds = questions.map((_, index) => firstQuestionId + index);

    const insertOptionsQuery = `
      INSERT INTO app_other_question_option (question_id, option_text, score)
      VALUES ?
    `;
    const optionValues = questions.flatMap((question, questionIndex) => {
      const questionId = questionIds[questionIndex];
      return question.options.map((opt) => [
        questionId,
        opt.option_text,
        opt.score,
      ]);
    });

    await connection.query(insertOptionsQuery, [optionValues]);

    await connection.commit();

    return { message: "Questions and options created successfully" };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// Function to retrieve all questions with their options
const getAllQuestionsWithOptions = async () => {
  const query = `
    SELECT q.question_id, q.question_text, o.option_id, o.option_text, o.score
    FROM app_other_question q
    LEFT JOIN app_other_question_option o ON q.question_id = o.question_id
  `;

  try {
    const [results] = await db.query(query);

    const questionsMap = {};

    results.forEach((row) => {
      const { question_id, question_text, option_id, option_text, score } = row;
      if (!questionsMap[question_id]) {
        questionsMap[question_id] = {
          question_id,
          question_text,
          options: [],
        };
      }

      if (option_id) {
        questionsMap[question_id].options.push({
          option_id,
          option_text,
          score,
        });
      }
    });

    const questions = Object.values(questionsMap);
    return questions;
  } catch (err) {
    throw err;
  }
};

// Function to record responses to survey questions
const createResponseOtherSurvey = async (responses) => {
  if (!Array.isArray(responses)) {
    throw new Error("Responses must be an array");
  }

  const insertResponseQuery = `
    INSERT INTO app_other_question_response (question_id, option_id, date)
    VALUES ?
  `;
  const responseValues = responses.map((response) => [
    response.question_id,
    response.option_id,
    new Date(),
  ]);

  try {
    await db.query(insertResponseQuery, [responseValues]);
    return { message: "Responses recorded successfully" };
  } catch (err) {
    throw err;
  }
};

module.exports = {
  OtherSurveyQuestion,
  getAllQuestionsWithOptions,
  createResponseOtherSurvey,
};
