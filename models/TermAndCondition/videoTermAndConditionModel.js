// models/terms_and_conditions_model.js

const db = require("../../config/DBConnection3.js"); // Ensure this uses mysql2/promise

// Function to create terms and conditions with options
const createTermAndCondition = async (questions) => {
  if (!Array.isArray(questions)) {
    throw new Error("Questions must be an array");
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const insertQuestionQuery = `
      INSERT INTO videotermsandcondition (term_text)
      VALUES ?
    `;
    const questionValues = questions.map((question) => [question.term_text]);

    const [result] = await connection.query(insertQuestionQuery, [
      questionValues,
    ]);

    const firstQuestionId = result.insertId;
    const questionIds = questions.map((_, index) => firstQuestionId + index);

    const insertOptionsQuery = `
      INSERT INTO vediotermandconditionoptions (term_id, option_text)
      VALUES ?
    `;
    const optionValues = questions.flatMap((question, questionIndex) => {
      const questionId = questionIds[questionIndex];
      return question.options.map((opt) => [questionId, opt.option_text]);
    });

    await connection.query(insertOptionsQuery, [optionValues]);

    await connection.commit();

    return { message: "Questions and options created successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Function to get all questions with their options
const getAllQuestionsWithOptions = async () => {
  const query = `
    SELECT q.term_id AS question_id, q.term_text AS question_text, o.option_id, o.option_text
    FROM videotermsandcondition q
    LEFT JOIN vediotermandconditionoptions o ON q.term_id = o.term_id
  `;

  try {
    const [results] = await db.query(query);

    const questionsMap = {};

    results.forEach((row) => {
      const { question_id, question_text, option_id, option_text } = row;
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
        });
      }
    });

    const questions = Object.values(questionsMap);
    return questions;
  } catch (err) {
    throw err;
  }
};

// Function to create responses to terms and conditions
const createResponse = async (responses) => {
  if (!Array.isArray(responses)) {
    throw new Error("Responses must be an array");
  }

  const insertResponseQuery = `
    INSERT INTO videotermandconditionconsent (term_id, option_id, date, user_id)
    VALUES ?
  `;
  const responseValues = responses.map((response) => [
    response.term_id,
    response.option_id,
    new Date(),
    response.user_id,
  ]);

  try {
    await db.query(insertResponseQuery, [responseValues]);
    return { message: "Responses recorded successfully" };
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createTermAndCondition,
  getAllQuestionsWithOptions,
  createResponse,
};
