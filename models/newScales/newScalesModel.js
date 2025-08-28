const util = require("util");
const db = require("../../config/DBConnection3");

const checkScale = async () => {
  const query = `SELECT scale_name FROM scale_translations`;
  const result = await db.query(query);
  return result;
};

const createScale = async (scaleData) => {
  // Ensure fields aren't undefined at the top level
  scaleData.role_id = scaleData.role_id ?? null;
  scaleData.study_id = scaleData.study_id ?? null;
  scaleData.translations = Array.isArray(scaleData.translations)
    ? scaleData.translations
    : [];
  scaleData.sections = Array.isArray(scaleData.sections)
    ? scaleData.sections
    : [];

  // Insert the scale
  const scaleId = await insertScale(scaleData);

  // Insert translations
  await insertScaleTranslations(scaleId, scaleData.translations);

  // Insert sections recursively
  if (Array.isArray(scaleData.sections)) {
    for (const section of scaleData.sections) {
      await insertSection(scaleId, null, section);
    }
  }

  return scaleId;
};

// -- Insert Scale --
const insertScale = async (scaleData) => {
  // "role_id" and "study_id" already defaulted to null if undefined
  const query = `INSERT INTO scale (role_id, study_id) VALUES (?, ?)`;
  const values = [scaleData.role_id, scaleData.study_id];
  const [result] = await db.execute(query, values);
  return result.insertId;
};

// -- Insert Scale Translations --
const insertScaleTranslations = async (scaleId, translations) => {
  for (const translation of translations) {
    translation.language_code = translation.language_code ?? null;
    translation.scale_name = translation.scale_name ?? null;
    translation.start_description = translation.start_description ?? null;
    translation.end_description = translation.end_description ?? null;

    const query = `
      INSERT INTO scale_translations
      (scale_id, language_code, scale_name, start_description, end_description)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
      scaleId,
      translation.language_code,
      translation.scale_name,
      translation.start_description,
      translation.end_description,
    ];
    await db.execute(query, values);
  }
};

const insertSection = async (scaleId, parentSectionId, sectionData) => {
  // Make sure each property is not undefined
  sectionData.section_order = sectionData.section_order ?? null;
  sectionData.translations = Array.isArray(sectionData.translations)
    ? sectionData.translations
    : [];
  sectionData.questions = Array.isArray(sectionData.questions)
    ? sectionData.questions
    : [];
  sectionData.subsections = Array.isArray(sectionData.subsections)
    ? sectionData.subsections
    : [];

  // Insert into scale_sections
  const query = `
    INSERT INTO scale_sections (scale_id, parent_section_id, section_order)
    VALUES (?, ?, ?)
  `;
  const values = [scaleId, parentSectionId, sectionData.section_order];
  const [result] = await db.execute(query, values);
  const sectionId = result.insertId;

  // Insert translations for this section
  await insertSectionTranslations(sectionId, sectionData.translations);

  // Insert questions
  for (const question of sectionData.questions) {
    await insertQuestion(scaleId, sectionId, question);
  }

  // Recursively insert subsections
  for (const subsection of sectionData.subsections) {
    await insertSection(scaleId, sectionId, subsection);
  }
};

// -- Insert Section Translations --
const insertSectionTranslations = async (sectionId, translations) => {
  for (const translation of translations) {
    translation.language_code = translation.language_code ?? null;
    translation.section_name = translation.section_name ?? null;
    translation.section_description = translation.section_description ?? null;

    const query = `
      INSERT INTO scale_section_translations
      (section_id, language_code, section_name, section_description)
      VALUES (?, ?, ?, ?)
    `;
    const values = [
      sectionId,
      translation.language_code,
      translation.section_name,
      translation.section_description,
    ];
    await db.execute(query, values);
  }
};

// -- Insert Questions --
const insertQuestion = async (scaleId, sectionId, questionData) => {
  // Defaults
  questionData.question_order = questionData.question_order ?? null;
  questionData.question_type = questionData.question_type ?? null;
  questionData.is_mandatory = questionData.is_mandatory ?? 0;
  questionData.metadata = questionData.metadata ?? {};
  questionData.translations = Array.isArray(questionData.translations)
    ? questionData.translations
    : [];
  questionData.options = Array.isArray(questionData.options)
    ? questionData.options
    : [];

  const query = `
    INSERT INTO scale_questions
    (scale_id, section_id, question_order, question_type, is_mandatory, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [
    scaleId,
    sectionId,
    questionData.question_order,
    questionData.question_type,
    questionData.is_mandatory ? 1 : 0,
    JSON.stringify(questionData.metadata),
  ];
  const [result] = await db.execute(query, values);
  const questionId = result.insertId;

  // Insert question translations
  await insertQuestionTranslations(questionId, questionData.translations);

  // Insert options
  for (const option of questionData.options) {
    await insertOption(questionId, option);
  }
};

// -- Insert Question Translations --
const insertQuestionTranslations = async (questionId, translations) => {
  for (const translation of translations) {
    translation.language_code = translation.language_code ?? null;
    translation.question_text = translation.question_text ?? null;

    const query = `
      INSERT INTO scale_question_translations
      (question_id, language_code, question_text)
      VALUES (?, ?, ?)
    `;
    const values = [
      questionId,
      translation.language_code,
      translation.question_text,
    ];
    await db.execute(query, values);
  }
};

// -- Insert Options --
const insertOption = async (questionId, optionData) => {
  optionData.option_order = optionData.option_order ?? null;
  optionData.score = optionData.score ?? null;
  optionData.metadata = optionData.metadata ?? {};
  optionData.translations = Array.isArray(optionData.translations)
    ? optionData.translations
    : [];

  const query = `
    INSERT INTO scale_question_options
    (question_id, option_order, score, metadata)
    VALUES (?, ?, ?, ?)
  `;
  const values = [
    questionId,
    optionData.option_order,
    optionData.score,
    JSON.stringify(optionData.metadata),
  ];
  const [result] = await db.execute(query, values);
  const optionId = result.insertId;

  // Insert option translations
  await insertOptionTranslations(optionId, optionData.translations);
};

// -- Insert Option Translations --
const insertOptionTranslations = async (optionId, translations) => {
  for (const translation of translations) {
    translation.language_code = translation.language_code ?? null;
    translation.option_text = translation.option_text ?? null;

    const query = `
      INSERT INTO scale_question_option_translations
      (option_id, language_code, option_text)
      VALUES (?, ?, ?)
    `;
    const values = [
      optionId,
      translation.language_code,
      translation.option_text,
    ];
    await db.execute(query, values);
  }
};

const getScaleById = async (scaleId, languageCode) => {
  try {
    // Fetch scale
    const [scaleRows] = await db.query(
      "SELECT * FROM scale WHERE scale_id = ?",
      [scaleId]
    );

    if (scaleRows.length === 0) {
      return null; // Scale not found
    }
    const scale = scaleRows[0];

    // Fetch scale translation
    const [scaleTranslationRows] = await db.query(
      "SELECT * FROM scale_translations WHERE scale_id = ? AND language_code = ?",
      [scaleId, languageCode]
    );
    const scaleTranslation = scaleTranslationRows[0] || null;

    // Fetch top-level sections
    const sections = await getSections(scaleId, null, languageCode);

    // Build the scale data
    const scaleData = {
      scale_id: scale.scale_id,
      filled_by: scale.filled_by,
      role_id: scale.role_id,
      study_id: scale.study_id,
      created_at: scale.created_at,
      updated_at: scale.updated_at,
      ...(scaleTranslation && {
        scale_name: scaleTranslation.scale_name,
        start_description: scaleTranslation.start_description,
        end_description: scaleTranslation.end_description,
      }),
      sections: sections,
    };

    return scaleData;
  } catch (error) {
    console.error("Error in fetchScaleById:", error);
    throw error;
  }
};

const getSections = async (scaleId, parentSectionId = null, languageCode) => {
  try {
    const sectionQuery = `
      SELECT * FROM scale_sections
      WHERE scale_id = ? AND ${
        parentSectionId ? "parent_section_id = ?" : "parent_section_id IS NULL"
      }
      ORDER BY section_order
    `;
    const sectionParams = parentSectionId
      ? [scaleId, parentSectionId]
      : [scaleId];

    // Execute section query
    const [sectionRows] = await db.query(sectionQuery, sectionParams);

    const sections = [];
    for (const sectionRow of sectionRows) {
      const sectionId = sectionRow.section_id;

      // Fetch section translation
      const [sectionTranslationRows] = await db.query(
        "SELECT * FROM scale_section_translations WHERE section_id = ? AND language_code = ?",
        [sectionId, languageCode]
      );
      const sectionTranslation = sectionTranslationRows[0] || null;

      // Fetch questions in the section
      const questions = await getQuestions(sectionId, languageCode);

      // Fetch subsections recursively
      const subsections = await getSections(scaleId, sectionId, languageCode);

      const sectionData = {
        section_id: sectionId,
        parent_section_id: sectionRow.parent_section_id,
        section_order: sectionRow.section_order,
        created_at: sectionRow.created_at,
        updated_at: sectionRow.updated_at,
        ...(sectionTranslation && {
          section_name: sectionTranslation.section_name,
          section_description: sectionTranslation.section_description,
        }),
        questions: questions,
        subsections: subsections,
      };

      sections.push(sectionData);
    }

    return sections;
  } catch (error) {
    console.error("Error in getSections:", error);
    throw error;
  }
};

const getQuestions = async (sectionId, languageCode) => {
  try {
    const questionQuery = `
      SELECT * FROM scale_questions
      WHERE section_id = ?
      ORDER BY question_order
    `;
    const [questionRows] = await db.query(questionQuery, [sectionId]);

    const questions = [];
    for (const questionRow of questionRows) {
      const questionId = questionRow.question_id;

      // Fetch question translation
      const [questionTranslationRows] = await db.query(
        "SELECT * FROM scale_question_translations WHERE question_id = ? AND language_code = ?",
        [questionId, languageCode]
      );
      const questionTranslation = questionTranslationRows[0] || null;

      // Fetch options for the question
      const options = await getOptions(questionId, languageCode);

      const questionData = {
        question_id: questionId,
        scale_id: questionRow.scale_id,
        section_id: questionRow.section_id,
        question_order: questionRow.question_order,
        question_type: questionRow.question_type,
        is_mandatory: !!questionRow.is_mandatory,
        metadata: questionRow.metadata ? JSON.parse(questionRow.metadata) : {},
        created_at: questionRow.created_at,
        updated_at: questionRow.updated_at,
        ...(questionTranslation && {
          question_text: questionTranslation.question_text,
        }),
        options: options,
      };

      questions.push(questionData);
    }

    return questions;
  } catch (error) {
    console.error("Error in getQuestions:", error);
    throw error;
  }
};

const getOptions = async (questionId, languageCode) => {
  try {
    const optionQuery = `
      SELECT * FROM scale_question_options
      WHERE question_id = ?
      ORDER BY option_order
    `;
    const [optionRows] = await db.query(optionQuery, [questionId]);

    const options = [];
    for (const optionRow of optionRows) {
      const optionId = optionRow.option_id;

      // Fetch option translation
      const [optionTranslationRows] = await db.query(
        "SELECT * FROM scale_question_option_translations WHERE option_id = ? AND language_code = ?",
        [optionId, languageCode]
      );
      const optionTranslation = optionTranslationRows[0] || null;

      const optionData = {
        option_id: optionId,
        question_id: optionRow.question_id,
        option_order: optionRow.option_order,
        score: optionRow.score,
        metadata: optionRow.metadata ? JSON.parse(optionRow.metadata) : {},
        created_at: optionRow.created_at,
        updated_at: optionRow.updated_at,
        ...(optionTranslation && {
          option_text: optionTranslation.option_text,
        }),
      };

      options.push(optionData);
    }

    return options;
  } catch (error) {
    console.error("Error in getOptions:", error);
    throw error;
  }
};

const updateScale = async (scaleId, scaleData) => {
  try {
    // Ensure fields aren't undefined at the top level
    scaleData.role_id = scaleData.role_id ?? null;
    scaleData.study_id = scaleData.study_id ?? null;
    scaleData.translations = Array.isArray(scaleData.translations)
      ? scaleData.translations
      : [];
    scaleData.sections = Array.isArray(scaleData.sections)
      ? scaleData.sections
      : [];

    // Check if any of the translations have a scale_name that already exists
    // but belongs to a different scale
    for (const translation of scaleData.translations) {
      if (translation.scale_name) {
        const [existingScales] = await db.query(
          "SELECT * FROM scale_translations WHERE scale_name = ? AND scale_id != ?",
          [translation.scale_name, scaleId]
        );

        if (existingScales.length > 0) {
          // Scale with this name already exists for a different scale
          const error = new Error(
            `A scale with the name "${translation.scale_name}" already exists.`
          );
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Update the scale basic info
    await updateScaleBasic(scaleId, scaleData);

    // Update translations - first delete existing ones
    await db.execute("DELETE FROM scale_translations WHERE scale_id = ?", [
      scaleId,
    ]);
    await insertScaleTranslations(scaleId, scaleData.translations);

    // Handle sections update
    if (Array.isArray(scaleData.sections)) {
      // Get existing sections to determine what to delete
      const [existingSections] = await db.query(
        "SELECT section_id FROM scale_sections WHERE scale_id = ? AND parent_section_id IS NULL",
        [scaleId]
      );

      // Delete all existing sections and their related data
      for (const section of existingSections) {
        await deleteSection(section.section_id);
      }

      // Insert new sections
      for (const section of scaleData.sections) {
        await insertSection(scaleId, null, section);
      }
    }

    return scaleId;
  } catch (error) {
    console.error("Error in updateScale:", error);
    throw error;
  }
};

// Helper function to update basic scale information
const updateScaleBasic = async (scaleId, scaleData) => {
  const query = `UPDATE scale SET role_id = ?, study_id = ?, updated_at = NOW() WHERE scale_id = ?`;
  const values = [scaleData.role_id, scaleData.study_id, scaleId];
  await db.execute(query, values);
};

// Helper function to delete a section and all its related data
const deleteSection = async (sectionId) => {
  try {
    // Get all questions in this section
    const [questions] = await db.query(
      "SELECT question_id FROM scale_questions WHERE section_id = ?",
      [sectionId]
    );

    // Delete all questions and their related data
    for (const question of questions) {
      await deleteQuestion(question.question_id);
    }

    // Get all subsections
    const [subsections] = await db.query(
      "SELECT section_id FROM scale_sections WHERE parent_section_id = ?",
      [sectionId]
    );

    // Recursively delete subsections
    for (const subsection of subsections) {
      await deleteSection(subsection.section_id);
    }

    // Delete section translations
    await db.execute(
      "DELETE FROM scale_section_translations WHERE section_id = ?",
      [sectionId]
    );

    // Delete the section itself
    await db.execute("DELETE FROM scale_sections WHERE section_id = ?", [
      sectionId,
    ]);
  } catch (error) {
    console.error("Error in deleteSection:", error);
    throw error;
  }
};

// Helper function to delete a question and all its related data
const deleteQuestion = async (questionId) => {
  try {
    // Get all options for this question
    const [options] = await db.query(
      "SELECT option_id FROM scale_question_options WHERE question_id = ?",
      [questionId]
    );

    // Delete all options and their translations
    for (const option of options) {
      await db.execute(
        "DELETE FROM scale_question_option_translations WHERE option_id = ?",
        [option.option_id]
      );
    }

    // Delete all options
    await db.execute(
      "DELETE FROM scale_question_options WHERE question_id = ?",
      [questionId]
    );

    // Delete question translations
    await db.execute(
      "DELETE FROM scale_question_translations WHERE question_id = ?",
      [questionId]
    );

    // Delete the question itself
    await db.execute("DELETE FROM scale_questions WHERE question_id = ?", [
      questionId,
    ]);
  } catch (error) {
    console.error("Error in deleteQuestion:", error);
    throw error;
  }
};

// Update the module.exports to include the new function
module.exports = {
  createScale,
  getScaleById,
  updateScale,
  checkScale,
};
