const db = require("../../config/DBConnection3.js");
const crypto = require("crypto");
const {detectLanguage} = require("../../services/translation.service.js")

async function createIncidentReportQuestion(question_text, options) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const questionQuery =
      "INSERT INTO incident_report_question (question_text) VALUES (?)";
    const [questionResult] = await connection.query(questionQuery, [
      question_text,
    ]);

    const questionId = questionResult.insertId;
    if (options && options.length > 0) {
      const optionValues = options.map((option) => [questionId, option]);

      const optionQuery =
        "INSERT INTO incident_question_options (question_id, option_text) VALUES ?";
      const [optionResult] = await connection.query(optionQuery, [
        optionValues,
      ]);

      await connection.commit();

      return {
        questionId,
        optionsInserted: optionResult.affectedRows,
      };
    } else {
      // Commit if no options are provided
      await connection.commit();
      return { questionId, optionsInserted: 0 };
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAllIncidentReports() {
  const query = `
    SELECT q.question_id , q.question_text, o.option_text
    FROM incident_report_question AS q
    LEFT JOIN incident_question_options AS o
    ON q.question_id = o.question_id
  `;
  try {
    const [results] = await db.query(query);

    // Group results by question
    const questionsMap = {};
    results.forEach(({ question_id, question_text, option_text }) => {
      if (!questionsMap[question_text]) {
        questionsMap[question_text] = {
          question_id: question_id,
          question_text: question_text,
          options: [],
        };
      }
      if (option_text) {
        questionsMap[question_text].options.push(option_text);
      }
    });

    const questions = Object.values(questionsMap);
    return questions;
  } catch (error) {
    throw error;
  }
}

async function createIncidentReportResponse(incidentData) {
  const {
    study_id,
    user_id,
    responses,
    description,
    incident_severety,
    start_date,
    start_time,
    medical_issue,
    end_date,
    end_time,
    history_text = "Automated Message: Notification Sent to Site Roles (CRA, CRC, PI, PM)",
    actionType = "Email",
  } = incidentData;

  const generateTicketId = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "AE-";
    for (let i = 0; i < 7; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  };

  if (
    !study_id ||
    !user_id ||
    !description ||
    !start_date ||
    !start_time ||
    !Array.isArray(responses) ||
    responses.length === 0
  ) {
    throw new Error("Invalid input data: Missing or incorrect fields");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

       // ✅ Detect language of description
    let detectedLang = "en";
    let confidence = 100.000;

    if (description && description !== "No Description Provided") {
      try {
        const detection = await detectLanguage(description);
        console.log("detection: ", detection)
        detectedLang = detection.language || "en";
        confidence = detection.confidence || 100.000;
      } catch (err) {
        console.error("Language detection failed, falling back to default:", err.message);
      }
    } else {
      // Special case
      detectedLang = "en";
      confidence = 100.000;
    }

    // ✅ Insert with detected_language + detection_confidence
    const createIncidentReportQuery = `
      INSERT INTO incident_reports (user_id, study_id, description, detected_language, detection_confidence) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const [incidentReportResult] = await connection.query(
      createIncidentReportQuery,
      [user_id, study_id, description, detectedLang, confidence]
    );

    const incidentReportId = incidentReportResult.insertId;

    const insertResponseQuery = `INSERT INTO incident_question_response
      (incident_report_id, question_id, response_text,  incident_severety, start_date, start_time, medical_issue, end_date, end_time)
      VALUES ?`;

    const responseValues = responses.map((r) => [
      incidentReportId,
      r.question_id,
      r.response_text,
      incident_severety,
      start_date,
      start_time,
      medical_issue,
      end_date,
      end_time,
    ]);
    ("--------------------------------------");
    (start_date, "Check start date ---------------------------");
    ("--------------------------------------");
    await connection.query(insertResponseQuery, [responseValues]);

    const ticket_id = generateTicketId();
    const ticketQuery =
      "INSERT INTO adverse_ticketing_system (ticket_id, status, ecrf_submission, start_date, incident_report_id) VALUES (?,?,?, ?, ?)";

    function convertTo24HourTime(time12h) {
      // Ensure there is a space between the time and the meridiem (handles cases like "09:14AM")
      time12h = time12h.replace(/(\d)(AM|PM)$/i, "$1 $2");

      // Match formats like "09:14 AM" or "09:14:30 PM"
      const regex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
      const match = time12h.match(regex);
      if (!match) {
        throw new Error("Invalid time format");
      }
      let [, hour, minute, second, meridiem] = match;
      // If seconds are missing, default to "00"
      second = second || "00";

      hour = parseInt(hour, 10);
      meridiem = meridiem.toUpperCase();

      if (meridiem === "PM" && hour < 12) {
        hour += 12;
      } else if (meridiem === "AM" && hour === 12) {
        hour = 0;
      }

      return `${String(hour).padStart(2, "0")}:${minute}:${second}`;
    }

    ("Raw start_date:", start_date); // e.g. "01/10/2025"
    ("Raw start_time:", start_time); // e.g. "4:54:00 PM"

    const [month, day, year] = start_date.split("/");
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    const time24h = convertTo24HourTime(start_time); // e.g. "16:54:00"
    const dateTimeString = `${isoDate}T${time24h}`;

    // Now this is something like "2025-01-10T16:54:00"
    ("Final dateTimeString:", dateTimeString);

    const dateNow = new Date(dateTimeString);
    ("Resulting dateNow:", dateNow);

    if (isNaN(dateNow.getTime())) {
      throw new Error("Date parsing failed. Check your input format.");
    }
    const status = "Open";
    const ecrf_submission = "Pending";
    const [ticketResult] = await connection.query(ticketQuery, [
      ticket_id,
      status,
      ecrf_submission,
      dateNow,
      incidentReportId,
    ]);

    const getSite = `SELECT organization_detail_id from organization where user_id=?`
    const checkSiteResult = await connection.query(getSite,[user_id])

    const organization_dettail_id = checkSiteResult[0][0].organization_detail_id

    // **New Step**: Insert into ticket_activity table
    const investigatorQuery = `
      SELECT u.email, pas.personnel_id as investigator_id FROM personnel_assigned_sites_studies as pas
      JOIN study_enrolled as se on pas.study_id = se.enrolled_id 
      JOIN user_role as ur ON pas.personnel_id = ur.user_id 
      JOIN user as u ON u.user_id = pas.personnel_id 
      JOIN role as r ON ur.role_id = r.role_id 
      WHERE se.enrolled_id = ? AND r.role_id = 12 AND pas.site_id = ?`;

    const [investigatorResult] = await connection.query(investigatorQuery, [
      study_id,
      organization_dettail_id,
    ]);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    }

    (investigatorResult, "Check investigatorResult");

    const investigator_id = investigatorResult[0].investigator_id;
    (investigator_id, "check investigator_id");
    const ticketActivityQuery = `
      INSERT INTO ticket_activity
      (user_id, history_text,action_type, ticket_id)
      VALUES (?, ?, ?,?)`;

    await connection.query(ticketActivityQuery, [
      investigator_id,
      history_text,
      actionType,
      ticket_id,
    ]);

    await connection.commit();

    return {
      incidentReportId,
      responses: responses,
      responseCount: responses.length,
      ticketId: ticketResult.insertId,
      investigatorId: investigator_id,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// async function createIncidentReportResponse(incidentData) {
//   const {
//     study_id,
//     user_id,
//     responses,
//     description,
//     incident_severety,
//     start_date,
//     start_time,
//     medical_issue,
//     end_date,
//     end_time,
//     history_text = "Automated Message: Notification Sent to Site Roles (CRA, CRC, PI, PM)",
//     actionType = "Email",
//   } = incidentData;

//   const generateTicketId = () => {
//     const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//     let result = "AE-";
//     for (let i = 0; i < 7; i++) {
//       result += characters.charAt(
//         Math.floor(Math.random() * characters.length)
//       );
//     }
//     return result;
//   };

//   if (
//     !study_id ||
//     !user_id ||
//     !description ||
//     !start_date ||
//     !start_time ||
//     !Array.isArray(responses) ||
//     responses.length === 0
//   ) {
//     throw new Error("Invalid input data: Missing or incorrect fields");
//   }

//   const connection = await db.getConnection();

//   try {
//     await connection.beginTransaction();

//     const createIncidentReportQuery =
//       "INSERT INTO incident_reports (user_id, study_id, description) VALUES (?, ?, ?)";
//     const [incidentReportResult] = await connection.query(
//       createIncidentReportQuery,
//       [user_id, study_id, description]
//     );

//     const incidentReportId = incidentReportResult.insertId;

//     const insertResponseQuery = `INSERT INTO incident_question_response
//       (incident_report_id, question_id, response_text,  incident_severety, start_date, start_time, medical_issue, end_date, end_time)
//       VALUES ?`;

//     const responseValues = responses.map((r) => [
//       incidentReportId,
//       r.question_id,
//       r.response_text,
//       incident_severety,
//       start_date,
//       start_time,
//       medical_issue,
//       end_date,
//       end_time,
//     ]);
//     ("--------------------------------------");
//     (start_date, "Check start date ---------------------------");
//     ("--------------------------------------");
//     await connection.query(insertResponseQuery, [responseValues]);

//     const ticket_id = generateTicketId();
//     const ticketQuery =
//       "INSERT INTO adverse_ticketing_system (ticket_id, status, ecrf_submission, start_date, incident_report_id) VALUES (?,?,?, ?, ?)";

//     function convertTo24HourTime(time12h) {
//       // Ensure there is a space between the time and the meridiem (handles cases like "09:14AM")
//       time12h = time12h.replace(/(\d)(AM|PM)$/i, "$1 $2");

//       // Match formats like "09:14 AM" or "09:14:30 PM"
//       const regex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
//       const match = time12h.match(regex);
//       if (!match) {
//         throw new Error("Invalid time format");
//       }
//       let [, hour, minute, second, meridiem] = match;
//       // If seconds are missing, default to "00"
//       second = second || "00";

//       hour = parseInt(hour, 10);
//       meridiem = meridiem.toUpperCase();

//       if (meridiem === "PM" && hour < 12) {
//         hour += 12;
//       } else if (meridiem === "AM" && hour === 12) {
//         hour = 0;
//       }

//       return `${String(hour).padStart(2, "0")}:${minute}:${second}`;
//     }

//     ("Raw start_date:", start_date); // e.g. "01/10/2025"
//     ("Raw start_time:", start_time); // e.g. "4:54:00 PM"

//     const [month, day, year] = start_date.split("/");
//     const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

//     const time24h = convertTo24HourTime(start_time); // e.g. "16:54:00"
//     const dateTimeString = `${isoDate}T${time24h}`;

//     // Now this is something like "2025-01-10T16:54:00"
//     ("Final dateTimeString:", dateTimeString);

//     const dateNow = new Date(dateTimeString);
//     ("Resulting dateNow:", dateNow);

//     if (isNaN(dateNow.getTime())) {
//       throw new Error("Date parsing failed. Check your input format.");
//     }
//     const status = "Open";
//     const ecrf_submission = "Pending";
//     const [ticketResult] = await connection.query(ticketQuery, [
//       ticket_id,
//       status,
//       ecrf_submission,
//       dateNow,
//       incidentReportId,
//     ]);

//     // **New Step**: Insert into ticket_activity table
//     const investigatorQuery = `
//       SELECT o.user_id AS investigator_id
//       FROM organization o
//       JOIN study_enrolled se ON o.study_enrolled_id = se.enrolled_id
//       JOIN user_role ur ON o.user_id = ur.user_id
//       JOIN role r ON ur.role_id = r.role_id
//       WHERE se.enrolled_id = ? AND r.role_id = 12`;

//     const [investigatorResult] = await connection.query(investigatorQuery, [
//       study_id,
//     ]);

//     if (investigatorResult.length === 0) {
//       throw new Error("Investigator not found");
//     }

//     (investigatorResult, "Check investigatorResult");

//     const investigator_id = investigatorResult[0].investigator_id;
//     (investigator_id, "check investigator_id");
//     const ticketActivityQuery = `
//       INSERT INTO ticket_activity
//       (user_id, history_text,action_type, ticket_id)
//       VALUES (?, ?, ?,?)`;

//     await connection.query(ticketActivityQuery, [
//       investigator_id,
//       history_text,
//       actionType,
//       ticket_id,
//     ]);

//     await connection.commit();

//     return {
//       incidentReportId,
//       responses: responses,
//       responseCount: responses.length,
//       ticketId: ticketResult.insertId,
//       investigatorId: investigator_id,
//     };
//   } catch (error) {
//     await connection.rollback();
//     throw error;
//   } finally {
//     connection.release();
//   }
// }


async function getInvestigatorByStudyId(study_id) {
  const query = `
    SELECT u.user_id, u.email AS investigator_email,
           o.first_name AS investigator_first_name,
           o.last_name AS investigator_last_name
    FROM study_enrolled AS se
    JOIN organization AS o ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
    JOIN user_role AS ur ON o.user_id = ur.user_id
    JOIN user AS u ON o.user_id = u.user_id
    WHERE se.enrolled_id = ? AND ur.role_id = 12
    LIMIT 1;
  `;

  try {
    const [results] = await db.query(query, [study_id]);

    if (results.length === 0) {
      throw new Error("No investigator found for the specified study_id");
    } else {
      const investigator = results[0];

      // Assuming decryption is needed for first_name and last_name
      try {
        investigator.investigator_first_name = decrypt(
          investigator.investigator_first_name
        );
        investigator.investigator_last_name = decrypt(
          investigator.investigator_last_name
        );
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        throw new Error("Error decrypting investigator details");
      }

      return investigator;
    }
  } catch (err) {
    throw err;
  }
}

async function getTicketHistory(ticket_id) {
  const query = `SELECT ta.user_id, ta.history_text,ta.action_type, ta.ticket_id, ta.created_at, o.first_name, o.last_name, o.image, ta.detected_language, ta.detection_confidence
    FROM ticket_activity AS ta
    JOIN organization as o ON ta.user_id = o.user_id WHERE ta.ticket_id = ?`;

  try {
    const [result] = await db.query(query, [ticket_id]);

    // Decrypt first_name, last_name, and image for each result
    const decryptedResult = result.map((item) => ({
      ...item,
      first_name: decrypt(item.first_name), // Decrypt first_name
      last_name: decrypt(item.last_name), // Decrypt last_name
      image: decrypt(item.image), // Decrypt image (if applicable)
    }));

    return decryptedResult;
  } catch (error) {
    throw error;
  }
}

async function updateAdverseTicketingSystem(ticketId, status) {
  (ticketId, status, "model adverse ticketing system");
  const query = `UPDATE adverse_ticketing_system SET ecrf_submission = ? WHERE ticket_id = ?`;

  try {
    const [result] = await db.query(query, [status, ticketId]);
    return result;
  } catch (error) {
    throw error;
  }
}

const getAdverseTicketingSystemById = async (ticket_id) => {
  const query =
    "SELECT status FROM adverse_ticketing_system WHERE ticket_id = ?";
  const [rows] = await db.execute(query, [ticket_id]);
  return rows[0] || null;
};

async function updateHistoryTicket(
  user_id,
  actionType,
  status,
  history_text,
  ticket_id
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Query to insert into ticket_activity
    const insertQuery = `INSERT INTO ticket_activity (user_id, action_type, history_text, ticket_id, detected_language, detection_confidence) VALUES (?,?,?,?,?,?)`;

     let detectedLang = "en";
      let confidence = 100.0;

      if (history_text && history_text?.trim() !== "") {
        try {
          const detection = await detectLanguage(history_text);
          detectedLang = detection.language || "en";
          confidence = detection.confidence || 100.0;
        } catch (err) {
          console.error("Language detection failed:", err.message);
        }
      }



    const [insertResult] = await connection.query(insertQuery, [
      user_id,
      actionType,
      history_text,
      ticket_id,
      detectedLang,
      confidence
    ]);

    // Query to update status in adverse_ticketing_system
    const updateQuery = `UPDATE adverse_ticketing_system SET status = ? WHERE ticket_id = ?`;

    const [updateResult] = await connection.query(updateQuery, [
      status,
      ticket_id,
    ]);

    // Commit the transaction
    await connection.commit();

    // Successfully committed the transaction
    return {
      insertResult,
      updateResult,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
); // Decoding Base64 key to Buffer
const IV_LENGTH = 16; // For AES, this is always 16

function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function getAllIncidentReportResponses() {
  const query = `SELECT inr.id AS incident_report_id, inr.study_id, inr.user_id,tic.ticket_id,tic.status,tic.ecrf_submission, tic.start_date, u.email,
      o.first_name,
      o.last_name,
      site.organization_name,
      o.study_enrolled_id,
      o.ecrf_id,
      st.study_name,
      tic.end_date,
      inr.created_at,
      res.incident_severety
  FROM incident_reports AS inr
  JOIN incident_question_response AS res ON inr.id = res.incident_report_id
  JOIN organization AS o ON inr.user_id = o.user_id
  JOIN organization_details AS site ON o.organization_detail_id = site.organization_detail_id
  JOIN user AS u ON o.user_id = u.user_id
  JOIN study_enrolled AS st ON o.study_enrolled_id = st.enrolled_id
  LEFT JOIN incident_report_question AS irq ON res.question_id = irq.question_id
  LEFT JOIN adverse_ticketing_system AS tic ON inr.id = tic.incident_report_id WHERE tic.status != "Archived"

  ORDER BY inr.created_at DESC`;

  try {
    const [result] = await db.query(query);

    // Group responses by incident_report_id
    const responseGroups = result.reduce((acc, curr) => {
      const {
        ticket_id,
        incident_report_id,
        created_at,
        email,
        first_name,
        last_name,
        study_enrolled_id,
        study_name,
        start_date,
        end_date,
        user_id,
        status,
        organization_name,
        incident_severety,

        ecrf_submission,
        ecrf_id,
      } = curr;

      if (!acc[incident_report_id]) {
        acc[incident_report_id] = {
          incident_report_id,
          created_at,
          email,
          first_name: decrypt(first_name),
          last_name: decrypt(last_name),
          study_enrolled_id,
          study_name,
          start_date,
          end_date,
          user_id,
          status,
          organization_name,
          incident_severety,

          ticket_id,
          ecrf_submission,
          ecrf_id,
        };
      }

      return acc;
    }, {});

    // Convert to array and sort
    const structuredResponse = Object.values(responseGroups).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return {
      message: "Incident Responses retrieved successfully",
      responses: structuredResponse,
    };
  } catch (err) {
    throw err;
  }
}

async function getAllIncidentReportResponsesForInvestigator(investigatorId) {
  // Fetch the investigator's details from the organization table
  const investigatorQuery = `SELECT study_enrolled_id, organization_detail_id FROM organization WHERE user_id = ?`;

  try {
    const [investigatorResult] = await db.query(investigatorQuery, [
      investigatorId,
    ]);

    if (investigatorResult.length === 0) {
      throw new Error("Investigator not found");
    } else {
      const investigator = investigatorResult[0];

      const query = `
        SELECT
          inr.id AS incident_report_id,
          inr.description,
          inr.study_id,
          inr.user_id,
          tic.ticket_id,
          tic.status,
          tic.ecrf_submission,
          tic.start_date,
          tic.end_date,
          inr.created_at,
          u.email,
          o.first_name,
          o.last_name,
          o.ecrf_id,
          site.organization_name,
          o.study_enrolled_id,
          st.study_name,
          res.response_text,
          res.incident_severety
        FROM
          incident_question_response AS res
          JOIN incident_reports AS inr ON res.incident_report_id = inr.id
          JOIN organization AS o ON inr.user_id = o.user_id
          JOIN organization_details AS site ON o.organization_detail_id = site.organization_detail_id
          JOIN user AS u ON o.user_id = u.user_id
          JOIN study_enrolled AS st ON o.study_enrolled_id = st.enrolled_id
          LEFT JOIN adverse_ticketing_system AS tic ON inr.id = tic.incident_report_id
        WHERE
          FIND_IN_SET(?, o.study_enrolled_id) > 0
          AND o.organization_detail_id = ?
        ORDER BY
          inr.created_at DESC`;

      const [result] = await db.query(query, [
        investigator.study_enrolled_id,
        investigator.organization_detail_id,
      ]);

      try {
        const incidentReports = result.map((curr) => {
          const {
            incident_report_id,
            description,
            study_id,
            user_id,
            ticket_id,
            status,
            start_date,
            end_date,
            created_at,
            email,
            first_name,
            last_name,
            organization_name,
            study_enrolled_id,
            study_name,
            response_text,
            incident_severety,
            ecrf_id,
            ecrf_submission,
          } = curr;

          return {
            incident_report_id,
            description,
            study_id,
            user_id,
            ticket_id,
            status,
            start_date,
            end_date,
            created_at: created_at.toISOString().replace("T", " ").slice(0, 19),
            email,
            first_name: decrypt(first_name),
            last_name: decrypt(last_name),
            organization_name,
            study_enrolled_id,
            study_name,
            response_text,
            incident_severety,
            ecrf_id,
            ecrf_submission,
          };
        });

        return {
          message: "Incident Reports retrieved successfully",
          incidentReports: incidentReports,
        };
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
        return {
          message: "Error in decrypting data",
          incidentReports: [],
        };
      }
    }
  } catch (err) {
    throw err;
  }
}

// async function getIncidentReportResponseByUserId(ticket_id, token_user_id) {
//   const getUserFromIncidentTable = `SELECT ir.user_id FROM adverse_ticketing_system AS ads JOIN incident_reports AS ir ON ads.incident_report_id = ir.id WHERE ads.ticket_id = ?`;
//   const [record] = await db.execute(getUserFromIncidentTable, [ticket_id]);
//   const incident_user_id = record[0].user_id;

//   if (Number(token_user_id) !== Number(incident_user_id)) {
//     const [personelRows] = await db.query(
//       `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ? `,
//       [token_user_id, incident_user_id]
//     );
//     if (!personelRows || personelRows.length === 0) {
//       const error = new Error(
//         "Unauthorized: No matching record found in personel_subject"
//       );
//       error.statusCode = 401;
//       throw error;
//     }
//   }

//   const query = `
//     SELECT
//       inr.id AS incident_report_id,
//       inr.description,
//       inr.study_id,
//       inr.user_id,
//       tic.ticket_id,
//       tic.status,
//       tic.ecrf_submission,
//       tic.start_date,
//       tic.end_date,
//       inr.created_at,
//       u.email,
//       o.first_name,
//       o.last_name,
//       site.organization_name,
//       o.study_enrolled_id,
//       o.ecrf_id,
//       st.study_name,
//       res.response_text,
//       res.incident_severety,
//       res.start_date AS input_start_date,
//       res.start_time AS input_start_time,
//       q.question_text,
//       q.question_id,
//       opt.option_text,
//       opt.option_id
//     FROM
//       incident_reports AS inr
//     JOIN
//       incident_question_response AS res ON inr.id = res.incident_report_id
//     JOIN
//       organization AS o ON inr.user_id = o.user_id
//     JOIN
//       organization_details AS site ON o.organization_detail_id = site.organization_detail_id
//     JOIN
//       user AS u ON o.user_id = u.user_id
//     JOIN
//       study_enrolled AS st ON o.study_enrolled_id = st.enrolled_id
//     LEFT JOIN
//       incident_report_question AS q ON res.question_id = q.question_id
//     LEFT JOIN
//       incident_question_options AS opt ON q.question_id = opt.question_id
//     LEFT JOIN
//       adverse_ticketing_system AS tic ON inr.id = tic.incident_report_id
//     WHERE
//       tic.ticket_id = ?
//     ORDER BY
//       inr.created_at DESC
//   `;

//   try {
//     const [result] = await db.query(query, [ticket_id]);

//     try {
//       const incidentReports = result.reduce((acc, curr) => {
//         const {
//           incident_report_id,
//           description,
//           study_id,
//           user_id,
//           ticket_id,
//           status,
//           ecrf_submission,
//           start_date,
//           end_date,
//           created_at,
//           email,
//           first_name,
//           last_name,
//           organization_name,
//           study_enrolled_id,
//           ecrf_id,
//           study_name,
//           question_id,
//           question_text,
//           option_id,
//           option_text,
//           response_text,
//           incident_severety,
//         } = curr;

//         let report = acc.find(
//           (r) => r.incident_report_id === incident_report_id
//         );
//         if (!report) {
//           report = {
//             incident_report_id,

//             study_id,
//             user_id,
//             ticket_id,
//             status,
//             ecrf_submission,
//             start_date,
//             end_date,
//             created_at: created_at.toISOString().replace("T", " ").slice(0, 19),
//             email,
//             first_name: decrypt(first_name),
//             last_name: decrypt(last_name),
//             organization_name,
//             incident_severety,
//             study_enrolled_id,
//             ecrf_id,
//             study_name,
//             questions: {},
//           };
//           acc.push(report);
//         }

//         if (!report.questions[question_id]) {
//           report.questions[question_id] = {
//             question_id,
//             question_text,
//             options: [],
//             response: response_text,
//             description,
//           };
//         }

//         if (
//           option_id &&
//           !report.questions[question_id].options.some(
//             (opt) => opt.option_id === option_id
//           )
//         ) {
//           report.questions[question_id].options.push({
//             option_id,
//             option_text,
//           });
//         }

//         return acc;
//       }, []);

//       // Convert questions object to array
//       incidentReports.forEach((report) => {
//         report.questions = Object.values(report.questions);
//       });

//       return {
//         message: "Incident Reports retrieved successfully",
//         incidentReports: incidentReports,
//       };
//     } catch (decryptionError) {
//       console.error("Decryption error:", decryptionError);
//       return { message: "Error in decrypting data", incidentReports: [] };
//     }
//   } catch (err) {
//     throw err;
//   }
// }

async function getIncidentReportResponseByUserId(ticket_id, token_user_id) {
  // Input validation
  if (!ticket_id || !token_user_id) {
    const error = new Error("Missing required parameters: ticket_id and token_user_id are required");
    error.statusCode = 400;
    throw error;
  }

  try {
    // Get user from incident table with proper error handling
    const getUserFromIncidentTable = `
      SELECT ir.user_id 
      FROM adverse_ticketing_system AS ads 
      JOIN incident_reports AS ir ON ads.incident_report_id = ir.id 
      WHERE ads.ticket_id = ?
    `;
    
    const [record] = await db.execute(getUserFromIncidentTable, [ticket_id]);
    
    // Check if ticket exists
    if (!record || record.length === 0) {
      const error = new Error("Ticket not found");
      error.statusCode = 404;
      throw error;
    }
    
    const incident_user_id = record[0].user_id;

    // Authorization check
    if (Number(token_user_id) !== Number(incident_user_id)) {
      const [personelRows] = await db.query(
        `SELECT * FROM personel_subject WHERE personel_id = ? AND subject_id = ?`,
        [token_user_id, incident_user_id]
      );
      
      if (!personelRows || personelRows.length === 0) {
        const error = new Error("Unauthorized: No matching record found in personel_subject");
        error.statusCode = 401;
        throw error;
      }
    }

    // Optimized single query with timezone information included
    const query = `
      SELECT
        inr.id AS incident_report_id,
        inr.description,
        inr.study_id,
        inr.user_id,
        tic.ticket_id,
        tic.status,
        inr.detected_language,
        inr.detection_confidence,
        tic.ecrf_submission,
        tic.start_date,
        tic.end_date,
        inr.created_at,
        u.email,
        o.first_name,
        o.last_name,
        site.organization_name,
        o.study_enrolled_id,
        o.ecrf_id,
        st.study_name,
        res.response_text,
        res.incident_severety,
        res.start_date AS input_start_date,
        res.start_time AS input_start_time,
        q.question_text,
        q.question_id,
        opt.option_text,
        opt.option_id,
        site.organization_detail_id
      FROM
        incident_reports AS inr
      JOIN
        incident_question_response AS res ON inr.id = res.incident_report_id
      JOIN
        organization AS o ON inr.user_id = o.user_id
      JOIN
        organization_details AS site ON o.organization_detail_id = site.organization_detail_id
      JOIN
        user AS u ON o.user_id = u.user_id
      JOIN
        study_enrolled AS st ON o.study_enrolled_id = st.enrolled_id
      LEFT JOIN
        incident_report_question AS q ON res.question_id = q.question_id
      LEFT JOIN
        incident_question_options AS opt ON q.question_id = opt.question_id
      LEFT JOIN
        adverse_ticketing_system AS tic ON inr.id = tic.incident_report_id
      WHERE
        tic.ticket_id = ?
      ORDER BY
        inr.created_at DESC
    `;

    const [result] = await db.query(query, [ticket_id]);

    // Check if any results found
    if (!result || result.length === 0) {
      return {
        message: "No incident reports found for this ticket",
        incidentReports: []
      };
    }

    // Timezone mapping function
    const getTimezone = (organizationDetailId) => {
      const timezoneMap = {
        1: 'CST', 4: 'CST', 10: 'CST',
        9: 'EST', 2: 'EST',
        11: 'CET', 12: 'CET', 13: 'CET'
      };
      return timezoneMap[organizationDetailId] || '';
    };

    // Process results with timezone (no additional DB queries needed)
    const processedResults = result.map(row => {
      const processedRow = { ...row };
      
      // Add timezone suffix if time exists
      if (row.input_start_time && row.organization_detail_id) {
        const timezone = getTimezone(row.organization_detail_id);
        if (timezone) {
          processedRow.input_start_time = `${row.input_start_time} ${timezone}`;
        }
      }
      
      return processedRow;
    });

    // Group results by incident report
    const incidentReports = processedResults.reduce((acc, curr) => {
      const {
        incident_report_id,
        description,
        detected_language,
        detection_confidence,
        study_id,
        user_id,
        ticket_id,
        status,
        ecrf_submission,
        start_date,
        end_date,
        created_at,
        email,
        first_name,
        last_name,
        organization_name,
        study_enrolled_id,
        ecrf_id,
        study_name,
        question_id,
        question_text,
        option_id,
        option_text,
        response_text,
        incident_severety,
        input_start_date,
        input_start_time
      } = curr;

      // Find existing report or create new one
      let report = acc.find(r => r.incident_report_id === incident_report_id);
      
      if (!report) {
        report = {
          incident_report_id,
          study_id,
          user_id,
          ticket_id,
          status,
          ecrf_submission,
          start_date,
          end_date,
          created_at: created_at ? created_at.toISOString().replace("T", " ").slice(0, 19) : null,
          email,
          first_name: first_name ? decrypt(first_name) : null,
          last_name: last_name ? decrypt(last_name) : null,
          organization_name,
          incident_severety,
          study_enrolled_id,
          ecrf_id,
          study_name,
          input_start_date,
          input_start_time,
          questions: new Map() // Use Map for better performance
        };
        acc.push(report);
      }

      // Add question if it exists and not already added
      if (question_id && !report.questions.has(question_id)) {
        report.questions.set(question_id, {
          question_id,
          question_text,
          options: [],
          response: response_text,
          description,
          detected_language,
          detection_confidence,
        });
      }

      // Add option if it exists and not already added
      if (question_id && option_id) {
        const question = report.questions.get(question_id);
        if (question && !question.options.some(opt => opt.option_id === option_id)) {
          question.options.push({
            option_id,
            option_text
          });
        }
      }

      return acc;
    }, []);

    // Convert questions Map to array for each report
    incidentReports.forEach(report => {
      report.questions = Array.from(report.questions.values());
    });

    return {
      message: "Incident Reports retrieved successfully",
      incidentReports: incidentReports
    };

  } catch (decryptionError) {
    // Handle decryption errors specifically
    if (decryptionError.message && decryptionError.message.includes('decrypt')) {
      console.error("Decryption error:", decryptionError);
      const error = new Error("Error processing encrypted data");
      error.statusCode = 500;
      throw error;
    }
    
    // Re-throw other errors
    throw decryptionError;
  }
}


async function updateAdverseTicketingSystemStatus(ticketId, status) {
  (ticketId, status, "model adverse ticketing system");
  const query = `UPDATE adverse_ticketing_system SET status = ? WHERE ticket_id = ?`;

  try {
    const [result] = await db.query(query, [status, ticketId]);
    return result;
  } catch (error) {
    throw error;
  }
}

async function getInvestigatorAESIQuestionOption() {
  const query = `
    SELECT iq.question_text, iqo.question_id,iq.question_id, iqo.option_id, iqo.option_text
    FROM investigator_aesi_question iq
    LEFT JOIN investigator_aesi_question_option iqo
    ON iq.question_id = iqo.question_id
  `;

  try {
    const [results] = await db.query(query);
    return results;
  } catch (err) {
    throw err;
  }
}

async function saveAESIQuestionResponses(responses) {
  const query = `
    INSERT INTO aesi_question_response 
    (ticket_id, question_id, option_id, description, detected_language, detection_confidence)
    VALUES ?
  `;

  // 🔹 Map each response and run detection
  const values = await Promise.all(
    responses.map(async (response) => {
      let detectedLang = "en";
      let confidence = 100.0;

      if (response.description && response.description.trim() !== "") {
        try {
          const detection = await detectLanguage(response.description);
          detectedLang = detection.language || "en";
          confidence = detection.confidence || 100.0;
        } catch (err) {
          console.error("Language detection failed, fallback to default:", err.message);
        }
      }

      return [
        response.ticket_id,
        response.question_id,
        response.option_id,
        response.description,
        detectedLang,
        confidence,
      ];
    })
  );

  try {
    const [result] = await db.query(query, [values]);
    return result;
  } catch (err) {
    console.error("Error inserting AESI Question Responses:", err.message);
    throw err;
  }
}

async function getRolesExcluding(excludeRoleId) {
  const query = `
    SELECT DISTINCT r.role_id, r.role_name
    FROM role r
    JOIN user_role ur ON r.role_id = ur.role_id
    JOIN organization o ON ur.user_id = o.user_id
    WHERE r.role_id != ?
  `;

  try {
    const [results] = await db.query(query, [excludeRoleId]);
    return results;
  } catch (err) {
    throw err;
  }
}
async function getAllAesiQuestionResponses(ticketId) {
  const query = `
    SELECT aqr.ticket_id, aqr.question_id, aqr.option_id, aqr.description,aqr.created_at, iq.question_text, iqo.option_text, aqr.detected_language, aqr.detection_confidence 
    FROM aesi_question_response aqr
    LEFT JOIN investigator_aesi_question iq ON aqr.question_id = iq.question_id
    LEFT JOIN investigator_aesi_question_option iqo ON aqr.option_id = iqo.option_id WHERE aqr.ticket_id = ?
  `;

  try {
    const [results] = await db.query(query, [ticketId]);
    return results;
  } catch (err) {
    throw err;
  }
}

// async function getUsersByRoleIds(
//   excludedRoleIds,
//   organization_detail_id,
//   study_id,
//   submittingUserId // Add this parameter to exclude the submitting user
// ) {
//   ("Excluded role IDs:", excludedRoleIds);
//   ("Submitting user ID:", submittingUserId);

//   try {
//     // Get all role_ids excluding the ones in excludedRoleIds
//     const [roles] = await db.query(
//       "SELECT role_id FROM role WHERE role_id NOT IN (?)",
//       [excludedRoleIds]
//     );
//     const roleIds = roles.map((role) => role.role_id);

//     // If no roles found, return empty array
//     if (roleIds.length === 0) {
//       return [];
//     }

//     // Split role IDs into special roles (16, 18) and regular roles
//     const specialRoleIds = [16, 18];
//     const regularRoleIds = roleIds.filter((id) => !specialRoleIds.includes(id));
//     const specialRoleIdsInOriginalList = roleIds.filter((id) =>
//       specialRoleIds.includes(id)
//     );

//     let users = [];

//     // Handle regular roles (with study_id and organization_detail_id filters)
//     if (regularRoleIds.length > 0) {
//       const [regularUsers] = await db.query(
//         `SELECT DISTINCT
//            u.user_id,
//            u.email,
//            o.first_name,
//            o.last_name,
//            od.organization_name,
//            od.organization_detail_id
//          FROM user AS u
//          JOIN organization AS o ON u.user_id = o.user_id
//          JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
//          JOIN user_role AS ur ON u.user_id = ur.user_id
//           JOIN email_sent_notification AS esn
//        ON u.user_id = esn.personel_id AND esn.status = "Enable"
//          WHERE
//            ur.role_id IN (?)
//            AND u.user_id != ?
//            AND od.organization_detail_id = ?
//            AND FIND_IN_SET(?, o.study_enrolled_id) > 0
//            `,
//         [regularRoleIds, submittingUserId, organization_detail_id, study_id]
//       );

//       users = [...users, ...regularUsers];
//     }

//     // Handle special roles (16, 18) without study_id and organization_detail_id filters
//     if (specialRoleIdsInOriginalList.length > 0) {
//       const [specialUsers] = await db.query(
//         `SELECT DISTINCT
//            u.user_id,
//            u.email,
//            o.first_name,
//            o.last_name,
//            od.organization_name,
//            od.organization_detail_id
//          FROM user AS u
//          JOIN organization AS o ON u.user_id = o.user_id
//          JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
//          JOIN user_role AS ur ON u.user_id = ur.user_id
//           JOIN email_sent_notification AS esn
//        ON ur.user_id = esn.personel_id AND esn.status = "Enable"
//          WHERE
//            ur.role_id IN (?)
//            AND u.user_id != ?
//           `,
//         [specialRoleIdsInOriginalList, submittingUserId]
//       );

//       users = [...users, ...specialUsers];
//     }

//     (
//       `Found ${users.length} users to notify about the incident report`
//     );

//     return users;
//   } catch (error) {
//     console.error("Error fetching users by role ids:", error);
//     throw error;
//   }
// }

async function getUsersByRoleIdsForIncidentReportResponse(
  excludedRoleIds,
  organization_detail_id,
  study_id,
  submittingUserId // Exclude the submitting user
) {
  try {
    const [roles] = await db.query(
      "SELECT role_id FROM role WHERE role_id NOT IN (?)",
      [excludedRoleIds]
    );
    const roleIds = roles.map((role) => role.role_id);

    if (roleIds.length === 0) {
      return [];
    }

    const specialRoleIds = [16, 18];
    const regularRoleIds = roleIds.filter((id) => !specialRoleIds.includes(id));
    const specialRoleIdsInOriginalList = roleIds.filter((id) =>
      specialRoleIds.includes(id)
    );

    let users = [];

    const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
       WHERE email_type_id = 3
      GROUP BY personel_id
      HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;

    // Handle regular roles (with study_id and organization_detail_id filters)
    if (regularRoleIds.length > 0) {
      const [regularUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
          JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
           AND od.organization_detail_id = ?
           AND FIND_IN_SET(?, o.study_enrolled_id) > 0
           `,
        [regularRoleIds, submittingUserId, organization_detail_id, study_id]
      );
      users = [...users, ...regularUsers];
    }

    // Handle special roles (16, 18) without study_id and organization_detail_id filters
    if (specialRoleIdsInOriginalList.length > 0) {
      const [specialUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
          `,
        [specialRoleIdsInOriginalList, submittingUserId]
      );
      users = [...users, ...specialUsers];
    }

    (
      `Found ${users.length} users to notify about the incident report`
    );

    return users;
  } catch (error) {
    console.error("Error fetching users by role ids:", error);
    throw error;
  }
}

// New model function: getUsersForEmailNotifications

// async function getUsersByRoleIds(
//   excludedRoleIds,
//   organization_detail_id,
//   study_id
// ) {
//   (excludedRoleIds);
//   try {
//     // Get all role_ids excluding the ones in excludedRoleIds
//     const [roles] = await db.query(
//       "SELECT role_id FROM role WHERE role_id NOT IN (?)",
//       [excludedRoleIds]
//     );
//     const roleIds = roles.map((role) => role.role_id);

//     // If no roles found, return empty array
//     if (roleIds.length === 0) {
//       return [];
//     }

//     // Get all user_ids from user_role table for those role_ids
//     const [userRoles] = await db.query(
//       "SELECT DISTINCT ur.user_id, od.organization_detail_id FROM user_role AS ur JOIN organization AS o ON o.user_id = ur.user_id JOIN organization_details AS od ON od.organization_detail_id = ? AND ur.role_id IN (?)",
//       [organization_detail_id, roleIds]
//     );
//     const userIds = userRoles.map((userRole) => userRole.user_id);

//     (
//       "$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$"
//     );
//     (userIds);
//     (
//       "$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$"
//     );

//     if (userIds.length === 0) {
//       return [];
//     }

//     // Get user info from user and organization tables
//     // const [users] = await db.query(
//     //   `SELECT user.user_id, user.email, organization.first_name, organization.last_name, organization_details.organization_name, organization_details.organization_detail_id
//     //      FROM user
//     //      JOIN organization ON user.user_id = organization.user_id
//     //      JOIN organization_details ON organization.organization_detail_id = organization_details.organization_detail_id
//     //      WHERE user.user_id IN (?) AND organization_details.organization_detail_id = ?`,
//     //   [userIds, organization_detail_id]
//     // );

//     const [users] = await db.query(
//       `SELECT
//          u.user_id,
//          u.email,
//          o.first_name,
//          o.last_name,
//          od.organization_name,
//          od.organization_detail_id
//        FROM user AS u
//               JOIN organization AS o
//                    ON u.user_id = o.user_id
//               JOIN organization_details AS od
//                    ON o.organization_detail_id = od.organization_detail_id
//        WHERE
//          u.user_id IN (?)
//          AND od.organization_detail_id = ?
//          AND FIND_IN_SET(?, o.study_enrolled_id) > 0`,
//       [userIds, organization_detail_id, study_id]
//     );

//     return users;
//   } catch (error) {
//     console.error("Error fetching users by role ids:", error);
//     throw error;
//   }
// }


const getOrganizationByTicket = async (ticketId) => {
  try {
    
    const query =  `SELECT o.user_id,o.organization_detail_id, o.study_enrolled_id, ats.ticket_id, ats.ecrf_submission from organization AS o JOIN incident_reports AS ir ON o.user_id = ir.user_id JOIN adverse_ticketing_system AS ats ON ats.incident_report_id = ir.id WHERE ats.ticket_id = ?`

    const [results] = await db.query(query, [ticketId]);
    return results;
  } catch (error) {
    throw error;
  }
};
// const getOrganizationByTicket = async (ticketId) => {
//   try {
//     const query = `SELECT o.user_id,o.organization_detail_id, o.study_enrolled_id, ats.ticket_id from organization AS o JOIN incident_reports AS ir ON o.user_id = ir.user_id JOIN adverse_ticketing_system AS ats ON ats.incident_report_id = ir.id WHERE ats.ticket_id = ?`;

//     const [results] = await db.query(query, [ticketId]);
//     return results;
//   } catch (error) {
//     throw error;
//   }
// };

async function getPendingTickets() {
  try {
    const [tickets] = await db.query(
      `SELECT ats.*,
              o.study_enrolled_id,
              o.organization_detail_id,
              o.ecrf_id
       FROM organization AS o
       JOIN incident_reports AS ir
         ON o.user_id = ir.user_id
       JOIN adverse_ticketing_system AS ats
         ON ats.incident_report_id = ir.id
       WHERE ats.status IN ('Open', 'Under Process','Re-opened')`
    );
    return tickets;
  } catch (error) {
    console.error("Error fetching pending tickets:", error);
    throw error;
  }
}

async function getUsersByRoles(roles, studyEnrolledId) {
  if (roles.length === 0) return [];
  const roleIds = roles.map((r) => r.role_id);
  const emailEnabledSubquery = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = 5
    GROUP BY personel_id
    HAVING COUNT(*) > 0
       AND SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;

  const query = `
    SELECT DISTINCT u.user_id, u.email, o.first_name, o.last_name, org.organization_name, org.organization_detail_id, o.study_enrolled_id
    FROM user u
    JOIN user_role ur ON u.user_id = ur.user_id
    JOIN organization o ON u.user_id = o.user_id
    JOIN organization_details org ON o.organization_detail_id = org.organization_detail_id
    JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
    WHERE ur.role_id IN (?)
      AND FIND_IN_SET(?, o.study_enrolled_id) > 0
  `;

  try {
    const [results] = await db.query(query, [roleIds, studyEnrolledId]);
    return results;
  } catch (err) {
    throw err;
  }
}
// show logs in mobile api

async function getIncidentLogsByUseridModel(user_id) {
  const query = `SELECT
      ats.start_date,
      ats.ticket_id
  FROM
      adverse_ticketing_system ats
  JOIN
      incident_reports ir ON ats.incident_report_id = ir.id
  WHERE
      ir.user_id = ?;
  `;
  try {
    const [result] = await db.query(query, [user_id]);
    return result;
  } catch (err) {
    throw err;
  }
}



async function getAllIncidentReportResponsesAll(personelId) {
  const query = `
    SELECT
      o.user_id,
      inr.id AS incident_report_id,
      inr.study_id,
      inr.user_id,
      tic.ticket_id,
      tic.status,
      tic.ecrf_submission,
      tic.start_date,
      u.email,
      o.first_name,
      o.last_name,
      site.organization_name,
      o.study_enrolled_id,
      o.ecrf_id,
      st.study_name,
      tic.end_date,
      inr.created_at,
      res.start_date AS patient_sent_date,
      res.start_time AS patient_sent_time,
      res.incident_severety
    FROM incident_reports AS inr
           JOIN incident_question_response AS res
                ON inr.id = res.incident_report_id
           JOIN organization AS o
                ON inr.user_id = o.user_id
           JOIN organization_details AS site
                ON o.organization_detail_id = site.organization_detail_id
           JOIN user AS u
                ON o.user_id = u.user_id
           JOIN study_enrolled AS st
                ON o.study_enrolled_id = st.enrolled_id
           LEFT JOIN incident_report_question AS irq
                     ON res.question_id = irq.question_id
           LEFT JOIN personel_subject ps ON inr.user_id = ps.subject_id

           LEFT JOIN adverse_ticketing_system AS tic
                     ON inr.id = tic.incident_report_id WHERE tic.status != "Archived" AND ps.personel_id = ?
    ORDER BY inr.created_at DESC
  `;

  try {
    const [result] = await db.query(query, personelId);

    //
    const processedResults = await Promise.all(
      result.map(async (row) => {
        // Create a copy of the row to avoid modifying the original
        const processedRow = { ...row };

        // Get organization_detail_id for the user
        const checkQuery = `SELECT organization_detail_id FROM organization WHERE user_id = ?`;
        const [orgResult] = await db.query(checkQuery, [row.user_id]);

        if (orgResult && orgResult.length > 0) {
          const { organization_detail_id } = orgResult[0];

          // Add timezone suffix based on organization_detail_id
          if ([1, 4, 10].includes(organization_detail_id)) {
            if (processedRow.patient_sent_time) {
              processedRow.patient_sent_time = `${processedRow.patient_sent_time} CST`;
            }
          } else if ([9, 2].includes(organization_detail_id)) {
            if (processedRow.patient_sent_time) {
              processedRow.patient_sent_time = `${processedRow.patient_sent_time} EST`;
            }
          } else if ([11, 12, 13].includes(organization_detail_id)) {
            if (processedRow.patient_sent_time) {
              processedRow.patient_sent_time = `${processedRow.patient_sent_time} CET`;
            }
          }
        }

        return processedRow;
      })
    );

    // Group responses by incident_report_id
    const responseGroups = processedResults.reduce((acc, curr) => {
      const {
        ticket_id,
        incident_report_id,
        created_at,
        email,
        first_name,
        last_name,
        study_enrolled_id,
        study_name,
        start_date,
        end_date,
        user_id,
        status,
        organization_name,
        incident_severety,
        patient_sent_date,
        patient_sent_time,
        ecrf_submission,
        ecrf_id,
      } = curr;

      if (!acc[incident_report_id]) {
        acc[incident_report_id] = {
          incident_report_id,
          created_at,
          email,
          first_name: decrypt(first_name),
          last_name: decrypt(last_name),
          study_enrolled_id,
          study_name,
          start_date,
          end_date,
          user_id,
          status,
          organization_name,
          incident_severety,
          patient_sent_date,
          patient_sent_time, // Now includes the timezone
          ticket_id,
          ecrf_submission,
          ecrf_id,
        };
      }
      return acc;
    }, {});

    // Convert to array and sort (descending by created_at)
    const structuredResponse = Object.values(responseGroups).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return {
      message: "Incident Responses retrieved successfully",
      responses: structuredResponse,
    };
  } catch (err) {
    throw err;
  }
}

// async function getAllIncidentReportResponsesAll(personelId) {
//   const query = `
//     SELECT
//       inr.id AS incident_report_id,
//       inr.study_id,
//       inr.user_id,
//       tic.ticket_id,
//       tic.status,
//       tic.ecrf_submission,
//       tic.start_date,
//       u.email,
//       o.first_name,
//       o.last_name,
//       site.organization_name,
//       o.study_enrolled_id,
//       o.ecrf_id,
//       st.study_name,
//       tic.end_date,
//       inr.created_at,
//       res.incident_severety
//     FROM incident_reports AS inr
//           JOIN incident_question_response AS res
//                 ON inr.id = res.incident_report_id
//           JOIN organization AS o
//                 ON inr.user_id = o.user_id
//           JOIN organization_details AS site
//                 ON o.organization_detail_id = site.organization_detail_id
//           JOIN user AS u
//                 ON o.user_id = u.user_id
//           JOIN study_enrolled AS st
//                 ON o.study_enrolled_id = st.enrolled_id
//           LEFT JOIN incident_report_question AS irq
//                      ON res.question_id = irq.question_id
//           LEFT JOIN personel_subject ps ON inr.user_id = ps.subject_id

//           LEFT JOIN adverse_ticketing_system AS tic
//                      ON inr.id = tic.incident_report_id WHERE tic.status != "Archived" AND ps.personel_id = ?
//     ORDER BY inr.created_at DESC
//   `;

//   try {
//     const [result] = await db.query(query, personelId);

//     // Group responses by incident_report_id
//     const responseGroups = result.reduce((acc, curr) => {
//       const {
//         ticket_id,
//         incident_report_id,
//         created_at,
//         email,
//         first_name,
//         last_name,
//         study_enrolled_id,
//         study_name,
//         start_date,
//         end_date,
//         user_id,
//         status,
//         organization_name,
//         incident_severety,
//         ecrf_submission,
//         ecrf_id,
//       } = curr;

//       if (!acc[incident_report_id]) {
//         acc[incident_report_id] = {
//           incident_report_id,
//           created_at,
//           email,
//           first_name: decrypt(first_name),
//           last_name: decrypt(last_name),
//           study_enrolled_id,
//           study_name,
//           start_date,
//           end_date,
//           user_id,
//           status,
//           organization_name,
//           incident_severety,
//           ticket_id,
//           ecrf_submission,
//           ecrf_id,
//         };
//       }
//       return acc;
//     }, {});

//     // Convert to array and sort (descending by created_at)
//     const structuredResponse = Object.values(responseGroups).sort(
//       (a, b) => new Date(b.created_at) - new Date(a.created_at)
//     );

//     return {
//       message: "Incident Responses retrieved successfully",
//       responses: structuredResponse,
//     };
//   } catch (err) {
//     throw err;
//   }
// }

async function getAllIncidentReportResponsesForRole(userId, roleId) {
  try {
    // 1) Check if user has the specified role
    const [roleResult] = await db.query(
      `
      SELECT ur.user_id
      FROM user_role ur
      WHERE ur.user_id = ? AND ur.role_id = ?
      `,
      [userId, roleId]
    );
    if (roleResult.length === 0) {
      throw new Error("User does not have the specified role");
    }

    // 2) Fetch the user’s organization info
    const [orgInfo] = await db.query(
      `
      SELECT study_enrolled_id, organization_detail_id
      FROM organization
      WHERE user_id = ?
      `,
      [userId]
    );
    if (orgInfo.length === 0) {
      throw new Error("No organization found for this user");
    }

    const studyEnrolledId = orgInfo[0].study_enrolled_id;
    const organizationDetailId = orgInfo[0].organization_detail_id;

    // 3) Filter the incident report responses by these IDs
    const query = `
      SELECT
        inr.id AS incident_report_id,
        inr.study_id,
        inr.user_id,
        tic.ticket_id,
        tic.status,
        tic.ecrf_submission,
        tic.start_date,
        u.email,
        o.first_name,
        o.last_name,
        site.organization_name,
        o.study_enrolled_id,
        o.ecrf_id,
        st.study_name,
        tic.end_date,
        inr.created_at,
        res.incident_severety
      FROM incident_reports AS inr
      JOIN incident_question_response AS res
        ON inr.id = res.incident_report_id
      JOIN organization AS o
        ON inr.user_id = o.user_id
      JOIN organization_details AS site
        ON o.organization_detail_id = site.organization_detail_id
      JOIN user AS u
        ON o.user_id = u.user_id
      JOIN study_enrolled AS st
        ON o.study_enrolled_id = st.enrolled_id
      LEFT JOIN incident_report_question AS irq
        ON res.question_id = irq.question_id
      LEFT JOIN adverse_ticketing_system AS tic
        ON inr.id = tic.incident_report_id
      WHERE
        o.organization_detail_id = ? AND tic.status != "Archived"
        AND FIND_IN_SET(?, o.study_enrolled_id) > 0
      ORDER BY inr.created_at DESC
    `;

    const [result] = await db.query(query, [
      parseInt(organizationDetailId),
      parseInt(studyEnrolledId),
    ]);

    // Same grouping logic
    const responseGroups = result.reduce((acc, curr) => {
      const {
        ticket_id,
        incident_report_id,
        created_at,
        email,
        first_name,
        last_name,
        study_enrolled_id,
        study_name,
        start_date,
        end_date,
        user_id,
        status,
        organization_name,
        incident_severety,
        ecrf_submission,
        ecrf_id,
      } = curr;

      if (!acc[incident_report_id]) {
        acc[incident_report_id] = {
          incident_report_id,
          created_at,
          email,
          first_name: decrypt(first_name),
          last_name: decrypt(last_name),
          study_enrolled_id,
          study_name,
          start_date,
          end_date,
          user_id,
          status,
          organization_name,
          incident_severety,
          ticket_id,
          ecrf_submission,
          ecrf_id,
        };
      }
      return acc;
    }, {});

    // Convert to array and sort
    const structuredResponse = Object.values(responseGroups).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return {
      message: "Incident Responses retrieved successfully",
      responses: structuredResponse,
    };
  } catch (error) {
    throw error;
  }
}

const getOrganizationById = async (user_id) => {
  try {
    // First, check if the user_id exists in user_role table and get their role_id
    const [userRoleResult] = await db.query(
      `SELECT role_id FROM user_role WHERE user_id = ?`,
      [user_id]
    );

    // Default to role_id 10 (subject) if no role is found
    let userRoleId = 10;
    if (userRoleResult && userRoleResult.length > 0) {
      userRoleId = userRoleResult[0].role_id;
    }

    // Different query based on role_id
    if (userRoleId != 10) {
      // For non-subject roles (roleId != 10), get study_id from personnel_assigned_sites_studies
      const [studyIds] = await db.query(
        `SELECT study_id FROM personnel_assigned_sites_studies WHERE personnel_id = ?`,
        [user_id]
      );

      // Log warning if no studies assigned, but continue with the query
      if (!studyIds || studyIds.length === 0) {
        console.warn(
          `Warning: No studies assigned to personnel with ID ${user_id}`
        );
      }
    } else {
      // For subjects (roleId = 10), check study_enrolled_id in organization table
      const [studyEnrolled] = await db.query(
        `SELECT study_enrolled_id FROM organization WHERE user_id = ?`,
        [user_id]
      );

      if (
        !studyEnrolled ||
        studyEnrolled.length === 0 ||
        !studyEnrolled[0].study_enrolled_id
      ) {
        // Log warning if no studies enrolled, but continue with the query
        console.warn(
          `Warning: No studies enrolled for subject with ID ${user_id}`
        );
      }
    }

    const [result] = await db.query(
      `
      SELECT o.*, u.email,
       org.organization_name, org.organization_address, notes.note,
       GROUP_CONCAT(DISTINCT se.enrolled_id ORDER BY se.enrolled_id) AS enrolled_ids,
       GROUP_CONCAT(DISTINCT se.study_name ORDER BY se.enrolled_id) AS study_names,
       GROUP_CONCAT(DISTINCT inv.user_id ORDER BY inv.user_id) AS investigator_user_ids,
       GROUP_CONCAT(DISTINCT inv.first_name ORDER BY inv.user_id) AS investigator_first_names,
       GROUP_CONCAT(DISTINCT inv.last_name ORDER BY inv.user_id) AS investigator_last_names
      FROM organization AS o
      JOIN user AS u ON o.user_id = u.user_id
      JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
      LEFT JOIN study_enrolled AS se ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
      LEFT JOIN (
        SELECT inv_org.user_id, inv_org.first_name, inv_org.last_name, inv_org.study_enrolled_id
        FROM organization AS inv_org
        JOIN user_role AS r ON inv_org.user_id = r.user_id
        WHERE r.role_id = 12
      ) AS inv ON FIND_IN_SET(se.enrolled_id, inv.study_enrolled_id) > 0
      JOIN (
        SELECT user_id, MAX(note) AS note
        FROM note
        GROUP BY user_id
      ) AS notes ON u.user_id = notes.user_id
      WHERE o.user_id = ?
      GROUP BY o.organization_id, o.user_id, o.organization_detail_id, u.email,
               org.organization_name, org.organization_address, notes.note
      `,
      [user_id]
    );

    if (result.length > 0) {
      let org = result[0];

      try {
        const enrolledIds = org.enrolled_ids ? org.enrolled_ids.split(",") : [];
        const studyNames = org.study_names ? org.study_names.split(",") : [];
        const investigatorUserIds = org.investigator_user_ids
          ? org.investigator_user_ids.split(",")
          : [];
        const investigatorFirstNames = org.investigator_first_names
          ? org.investigator_first_names.split(",")
          : [];
        const investigatorLastNames = org.investigator_last_names
          ? org.investigator_last_names.split(",")
          : [];

        // Decrypt investigator first and last names individually
        const decryptedInvestigators = investigatorUserIds.map((id, index) => ({
          user_id: parseInt(id),
          first_name: decrypt(investigatorFirstNames[index] || ""),
          last_name: decrypt(investigatorLastNames[index] || ""),
        }));

        org = {
          ...org,
          first_name: decrypt(org.first_name),
          middle_name: decrypt(org.middle_name),
          last_name: decrypt(org.last_name),
          gender: decrypt(org.gender),
          contact_number: decrypt(org.contact_number),
          image: org.image ? decrypt(org.image) : null,
          study_enrolled: enrolledIds.map((id, index) => ({
            id: parseInt(id),
            name: studyNames[index] || "",
          })),
          investigators: decryptedInvestigators,
        };

        // Remove raw investigator_first_names and investigator_last_names from the result
        delete org.investigator_first_names;
        delete org.investigator_last_names;
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);
      }

      return org;
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};

async function getUsersByRoleIdForUpdateAETicketStatus(
  excludedRoleIds,
  organization_detail_id,
  study_id
) {
  ("Excluded role IDs:", excludedRoleIds);

  try {
    // 1. Get all role IDs not in the excluded list
    const [roles] = await db.query(
      "SELECT role_id FROM role WHERE role_id NOT IN (?)",
      [excludedRoleIds]
    );
    const roleIds = roles.map((role) => role.role_id);

    if (roleIds.length === 0) {
      ("No role IDs found after exclusion.");
      return [];
    }

    // 2. Define special roles (16 and 18) and split the role IDs accordingly
    const specialRoleIds = [16, 18];
    const regularRoleIds = roleIds.filter((id) => !specialRoleIds.includes(id));
    const specialRoleIdsInOriginalList = roleIds.filter((id) =>
      specialRoleIds.includes(id)
    );

    let users = [];

    // 3. Define subquery to check for email notifications for email_type_id 14 with status 'Enable'
    // HAVING COUNT(*) > 0 ensures the user has at least one record for email_type_id 14.
    // The SUM(...) check guarantees that all such records have status 'Enable'.
    const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
      WHERE email_type_id = 14
      GROUP BY personel_id
      HAVING COUNT(*) > 0
         AND SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;
    ("Email Enabled Subquery:\n", emailEnabledSubquery);

    // 4a. For regular roles: apply organization_detail_id and study_id filters, and join with the subquery
    if (regularRoleIds.length > 0) {
      ("Fetching regular users for role IDs:", regularRoleIds);
      const [regularUsers] = await db.query(
        `SELECT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)

           AND od.organization_detail_id = ?
           AND FIND_IN_SET(?, o.study_enrolled_id) > 0`,
        [regularRoleIds, organization_detail_id, study_id]
      );
      ("Regular users fetched:", regularUsers);
      users = [...users, ...regularUsers];
    }

    // 4b. For special roles (16, 18): no filtering on organization_detail_id or study_id, but still join the subquery
    if (specialRoleIdsInOriginalList.length > 0) {
      (
        "Fetching special users for role IDs:",
        specialRoleIdsInOriginalList
      );
      const [specialUsers] = await db.query(
        `SELECT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           `,
        [specialRoleIdsInOriginalList]
      );
      ("Special users fetched:", specialUsers);
      users = [...users, ...specialUsers];
    }

    (
      `Found ${users.length} users to notify about the adverse event ticket update`
    );
    return users;
  } catch (error) {
    console.error("Error fetching users by role ids:", error);
    throw error;
  }
}

async function getAllUsersByRoleIdsPendingTickets(
  excludedRoleIds,
  organization_detail_id,
  study_id,
  submittingUserId = 0 // Default to 0 if not provided
) {
  try {
    ("Excluded Role IDs:", excludedRoleIds);
    ("Organization Detail ID:", organization_detail_id);
    ("Study ID:", study_id);
    ("Submitting User ID:", submittingUserId);

    // 1. Get all role_ids NOT in the excluded list
    const [roles] = await db.query(
      "SELECT role_id FROM role WHERE role_id NOT IN (?)",
      [excludedRoleIds]
    );
    const roleIds = roles.map((role) => role.role_id);
    ("Role IDs to include:", roleIds);

    if (roleIds.length === 0) {
      return [];
    }

    // 2. Separate regular and special roles
    const specialRoleIds = [16, 18];
    const regularRoleIds = roleIds.filter((id) => !specialRoleIds.includes(id));
    const specialRoleIdsInOriginalList = roleIds.filter((id) =>
      specialRoleIds.includes(id)
    );

    let users = [];

    // 3. Subquery to get only users who have at least one record for email_type_id = 13
    // and all those records have status = 'Enable'
    const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
      WHERE email_type_id = 13
      GROUP BY personel_id
      HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;

    // 4a. Fetch regular users (filtered by organization_detail_id and study_enrolled_id)
    if (regularRoleIds.length > 0) {
      ("Fetching regular users for roles:", regularRoleIds);
      const [regularUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
           AND od.organization_detail_id = ?
           AND FIND_IN_SET(?, o.study_enrolled_id) > 0
        `,
        [regularRoleIds, submittingUserId, organization_detail_id, study_id]
      );
      ("Regular users fetched:", regularUsers);
      users = [...users, ...regularUsers];
    }

    // 4b. Fetch special users (roles 16 and 18) without organization/study filters
    if (specialRoleIdsInOriginalList.length > 0) {
      (
        "Fetching special users for roles:",
        specialRoleIdsInOriginalList
      );
      const [specialUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
        `,
        [specialRoleIdsInOriginalList, submittingUserId]
      );
      ("Special users fetched:", specialUsers);
      users = [...users, ...specialUsers];
    }

    (`Total users found: ${users.length}`);
    return users;
  } catch (error) {
    console.error("Error fetching users by role ids:", error);
    throw error;
  }
}

async function getUsersByRoleIdsForUpdateTicketHistory(
  excludedRoleIds,
  organization_detail_id,
  study_id,
  submittingUserId // Exclude the submitting user
) {
  try {
    const [roles] = await db.query(
      "SELECT role_id FROM role WHERE role_id NOT IN (?)",
      [excludedRoleIds]
    );
    const roleIds = roles.map((role) => role.role_id);

    if (roleIds.length === 0) {
      return [];
    }

    const specialRoleIds = [16, 18];
    const regularRoleIds = roleIds.filter((id) => !specialRoleIds.includes(id));
    const specialRoleIdsInOriginalList = roleIds.filter((id) =>
      specialRoleIds.includes(id)
    );

    let users = [];

    const emailEnabledSubquery = `
      SELECT personel_id
      FROM email_sent_notification
       WHERE email_type_id = 6
      GROUP BY personel_id
      HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
    `;

    // Handle regular roles (with study_id and organization_detail_id filters)
    if (regularRoleIds.length > 0) {
      const [regularUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
          JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
           AND od.organization_detail_id = ?
           AND FIND_IN_SET(?, o.study_enrolled_id) > 0
           `,
        [regularRoleIds, submittingUserId, organization_detail_id, study_id]
      );
      users = [...users, ...regularUsers];
    }

    // Handle special roles (16, 18) without study_id and organization_detail_id filters
    if (specialRoleIdsInOriginalList.length > 0) {
      const [specialUsers] = await db.query(
        `SELECT DISTINCT
           u.user_id,
           u.email,
           o.first_name,
           o.last_name,
           od.organization_name,
           od.organization_detail_id
         FROM user AS u
         JOIN organization AS o ON u.user_id = o.user_id
         JOIN organization_details AS od ON o.organization_detail_id = od.organization_detail_id
         JOIN user_role AS ur ON u.user_id = ur.user_id
         JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
         WHERE
           ur.role_id IN (?)
           AND u.user_id != ?
          `,
        [specialRoleIdsInOriginalList, submittingUserId]
      );
      users = [...users, ...specialUsers];
    }

    (
      `Found ${users.length} users to notify about the incident report`
    );

    return users;
  } catch (error) {
    console.error("Error fetching users by role ids:", error);
    throw error;
  }
}

/**
 * Fetch reports where detected_language or detection_confidence is NULL
 */
async function getReportsWithNullLanguage() {
  try {
    const [rows] = await db.query(
      `SELECT id, description 
       FROM incident_reports 
       WHERE detected_language IS NULL OR detection_confidence IS NULL`
    );
    return rows;
  } catch (error) {
    console.error("❌ Error fetching reports with NULL language:", error.message);
    throw new Error("Database query failed while fetching reports with null language.");
  }
}

/**
 * Update a report with detected language and confidence
 * @param {number} id - Report ID
 * @param {string} detectedLang - Detected language code
 * @param {number} confidence - Detection confidence (0.0 - 1.0)
 */
async function updateReportLanguage(id, detectedLang, confidence) {
  try {
    const [result] = await db.query(
      `UPDATE incident_reports 
       SET detected_language = ?, detection_confidence = ? 
       WHERE id = ?`,
      [detectedLang, confidence, id]
    );

    if (result.affectedRows === 0) {
      throw new Error(`No report found with id ${id}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error updating report ID ${id}:`, error.message);
    throw new Error(`Database update failed for report ID ${id}`);
  }
}

/**
 * Fetch ticket_activity rows where detected_language/confidence is NULL
 */
async function getTicketActivitiesWithNullLanguage() {
  try {
    const [rows] = await db.query(
      `SELECT history_id AS id, history_text AS text
       FROM ticket_activity
       WHERE (detected_language IS NULL OR detection_confidence IS NULL)
         AND history_text IS NOT NULL`
    );
    return rows;
  } catch (error) {
    console.error("❌ Error fetching ticket_activity with NULL language:", error.message);
    throw new Error("Database query failed while fetching ticket_activity rows with null language.");
  }
}

/**
 * Update detected_language and detection_confidence for a ticket_activity record
 */
async function updateTicketActivityLanguage(id, lang, confidence) {
  try {
    const [result] = await db.query(
      `UPDATE ticket_activity
       SET detected_language = ?, detection_confidence = ?
       WHERE history_id = ?`,
      [lang, confidence, id]
    );

    if (result.affectedRows === 0) {
      throw new Error(`No ticket_activity record found with id ${id}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error updating ticket_activity ID ${id}:`, error.message);
    throw new Error(`Database update failed for ticket_activity ID ${id}`);
  }
}

/**
 * Fetch ecrf_answers rows where detected_language/confidence is NULL
 */
async function getEcrfAnswersWithNullLanguage() {
  try {
    const [rows] = await db.query(
      `SELECT id, answer AS text
       FROM ecrf_answers
       WHERE (detected_language IS NULL OR detection_confidence IS NULL)
         AND answer IS NOT NULL`
    );
    return rows;
  } catch (error) {
    console.error("❌ Error fetching ecrf_answers with NULL language:", error.message);
    throw new Error("Database query failed while fetching ecrf_answers with null language.");
  }
}

/**
 * Update detected_language and detection_confidence for an ecrf_answer record
 */
async function updateEcrfAnswerLanguage(id, lang, confidence) {
  try {
    const [result] = await db.query(
      `UPDATE ecrf_answers
       SET detected_language = ?, detection_confidence = ?
       WHERE id = ?`,
      [lang, confidence, id]
    );

    if (result.affectedRows === 0) {
      throw new Error(`No ecrf_answers record found with id ${id}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error updating ecrf_answer ID ${id}:`, error.message);
    throw new Error(`Database update failed for ecrf_answer ID ${id}`);
  }
}

/**
 * Fetch aesi_question_response rows where detected_language/confidence is NULL
 */
async function getAesiResponsesWithNullLanguage() {
  try {
    const [rows] = await db.query(
      `SELECT response_id AS id, description AS text
       FROM aesi_question_response
       WHERE (detected_language IS NULL OR detection_confidence IS NULL)
         AND description IS NOT NULL`
    );
    return rows;
  } catch (error) {
    console.error("❌ Error fetching aesi_question_response with NULL language:", error.message);
    throw new Error("Database query failed while fetching aesi_question_response with null language.");
  }
}

/**
 * Update detected_language and detection_confidence for an aesi_question_response record
 */
async function updateAesiResponseLanguage(id, lang, confidence) {
  try {
    const [result] = await db.query(
      `UPDATE aesi_question_response
       SET detected_language = ?, detection_confidence = ?
       WHERE response_id = ?`,
      [lang, confidence, id]
    );

    if (result.affectedRows === 0) {
      throw new Error(`No aesi_question_response record found with id ${id}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error updating aesi_question_response ID ${id}:`, error.message);
    throw new Error(`Database update failed for aesi_question_response ID ${id}`);
  }
}

module.exports = {
  createIncidentReportQuestion,

  getAllIncidentReports,
  getInvestigatorByStudyId,
  createIncidentReportResponse,
  getIncidentReportResponseByUserId,
  getAllIncidentReportResponses,
  getAllIncidentReportResponsesForInvestigator,
  updateAdverseTicketingSystem,
  updateAdverseTicketingSystemStatus,
  getInvestigatorAESIQuestionOption,
  saveAESIQuestionResponses,
  getTicketHistory,
  updateHistoryTicket,
  getAdverseTicketingSystemById,
  getAllAesiQuestionResponses,
  getUsersByRoleIdsForIncidentReportResponse,
  getUsersByRoleIdForUpdateAETicketStatus,
  getPendingTickets,
  getAllUsersByRoleIdsPendingTickets,
  getUsersByRoleIdsForUpdateTicketHistory,
  getRolesExcluding,
  getUsersByRoles,
  getIncidentLogsByUseridModel,
  getOrganizationByTicket,
  getAllIncidentReportResponsesAll,
  getAllIncidentReportResponsesForRole,
  getOrganizationById,
  getReportsWithNullLanguage,
  updateReportLanguage,
  getTicketActivitiesWithNullLanguage,
  updateTicketActivityLanguage,
  getEcrfAnswersWithNullLanguage,
  updateEcrfAnswerLanguage,
  getAesiResponsesWithNullLanguage,
  updateAesiResponseLanguage,
};
