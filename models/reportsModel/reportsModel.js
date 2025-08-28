const db = require("../../config/DBConnection3");
const crypto = require("crypto");
const moment = require("moment");
const { formatReportDateTime } = require("../../utils/utils");

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

const getScaleReportModel = async () => {
  try {
    const query = `
    SELECT org.organization_name,org.organization_address, o.user_id, o.ecrf_id, o.date_enrolled,o.stipend,  st.scale_name, sd.day_name, ss.schedule_name, s.filled_by, sig.investigatorId,sig.created_at, o.status FROM signature AS sig JOIN organization AS o ON sig.user_id = o.user_id JOIN organization_details AS org On o.organization_detail_id = org.organization_detail_id JOIN schedule_days AS sd ON sig.day_id = sd.day_id JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id JOIN scale AS s ON sig.scale_id = s.scale_id JOIN scale_translations AS st ON s.scale_id = st.scale_id
    `;
    const [result] = await db.execute(query);

    const decryptDate = result.map((data) => {
      return {
        ...data,
        investigator_first_name: decrypt(data.investigator_first_name),
        investigator_last_name: decrypt(data.investigator_last_name),
      };
    });

    const enrollmentlog = `SELECT o.ecrf_id ,  o.status, o.date_enrolled FROM organization AS o JOIN user_role AS ur ON o.user_id = ur.user_id WHERE ur.role_id = 10;`;
    const [result2] = await db.execute(enrollmentlog);
    const enroll_decrypt = result2.map((data) => {
      return {
        ...data,
        gender: decrypt(data.gender),
      };
    });

    const scheduleLog = `SELECT o.ecrf_id, DATE_FORMAT(s.schedule_date,"%Y-%m-%d") AS schedule_date, s.schedule_time,s.status,d.day_name FROM schedule AS s
JOIN organization AS o ON s.user_id = o.user_id
JOIN schedule_days AS d ON s.day_id = d.day_id;
`;
    const [result3] = await db.execute(scheduleLog);
    const schedule_decrypt = result3.map((data) => {
      return {
        ...data,
        gender: decrypt(data.gender),
      };
    });

    const subjectIdentificationLog = `SELECT se.study_name, o.ecrf_id FROM organization AS o
JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id
JOIN user_role AS ur ON o.user_id = ur.user_id
WHERE ur.role_id = 10;
`;
    const [result4] = await db.execute(subjectIdentificationLog);
    const subjectIdentification_decrypt = result4.map((data) => {
      return {
        ...data,
        first_name: decrypt(data.first_name),
        last_name: decrypt(data.last_name),
        gender: decrypt(data.gender),
        contact_number: decrypt(data.contact_number),
      };
    });

    //     const medicineComplaince = `SELECT o.ecrf_id, m.medication_name, m.dosage, m.frequency_type,smr.intake_quantity, smr.date AS dosageDate, smr.time AS dosageTime, smr.created_at FROM patientmedications AS m
    // JOIN organization AS o ON m.user_id = o.user_id
    // JOIN submit_medicine_records AS smr ON m.medication_id = smr.medicine_id
    // `;
    const medicineComplaince = `SELECT
    o.ecrf_id,
    pm.medication_name,
    pm.dosage,
    pm.frequency_type,
    smr.intake_quantity,
    REPLACE(smr.date, '-', '/') AS local_dosageDate,
    smr.time AS local_dosageTime,
    DATE_FORMAT(smr.created_at, '%Y-%m-%d %H:%i:%s') AS utc_created_at,

    rd.reason,
    DATE_FORMAT(rd.record_time, '%Y-%m-%d %H:%i:%s.%f') AS reason_created_at,
    u.email AS reason_created_by,
    GROUP_CONCAT(
        DISTINCT CASE
            WHEN mc.comments IS NOT NULL THEN
                CONCAT(
                    COALESCE(mc.comments, ''),
                    ' (Created: ',
                    COALESCE(DATE_FORMAT(mc.created_at, '%Y-%m-%d %H:%i:%s'), ''),
                    ' by ',
                    COALESCE(ur.email, ''),
                    ')'
                )
            ELSE NULL
        END
        ORDER BY mc.created_at ASC
        SEPARATOR '\n---\n'
    ) AS comments,
    GROUP_CONCAT(
        DISTINCT DATE_FORMAT(mc.created_at, '%Y-%m-%d %H:%i:%s.%f')
        ORDER BY mc.created_at ASC
        SEPARATOR '\n---\n'
    ) AS comment_created_at,
    GROUP_CONCAT(
        DISTINCT COALESCE(ur.email, '')
        ORDER BY mc.created_at ASC
        SEPARATOR '\n---\n'
    ) AS comment_created_by,
    smr.status


FROM submit_medicine_records AS smr


JOIN patientmedications AS pm ON smr.medicine_id = pm.medication_id

JOIN organization AS o ON smr.user_id = o.user_id

LEFT JOIN medicine_comments AS mc ON smr.record_id = mc.record_id

LEFT JOIN user AS ur ON mc.investigator_id = ur.user_id
LEFT JOIN reason_description AS rd ON rd.track_id = smr.record_id
    AND rd.update_entity = 'MEDICINE_INTAKE'

LEFT JOIN user AS u ON rd.investigator_id = u.user_id

GROUP BY
    smr.record_id,
    o.ecrf_id,
    pm.medication_name,
    pm.dosage,
    pm.frequency_type,
    smr.intake_quantity,
    smr.date,
    smr.time,
    smr.created_at,
    rd.reason,
    rd.record_time,
    u.email,
    smr.status
   
`;
    const [result5] = await db.execute(medicineComplaince);

    const medicineTakenHistory = `SELECT o.ecrf_id,m.created_at, m.dosage,m.dosageType, m.allot_medicine, md.dosage_time, m.frequency_time,m.frequency_condition, m.route FROM patientmedications AS m JOIN organization AS o ON m.user_id = o.user_id JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
`;
    const [result6] = await db.execute(medicineTakenHistory);



    const AEIncidentLog = `SELECT
        ats.ticket_id AS "Ticket ID",
        o.ecrf_id,
        CONCAT(COALESCE(org.organization_name, ''), ' ', COALESCE(org.organization_address, '')) AS "Site Name",
        irq.question_text AS "Adverse Question",
        iqr.response_text AS "Adverse Question Answer",
        ir.description AS "Describe Adverse Event (description)",
        iqr.incident_severety AS "Incident Severity",
        iqr.start_date  AS "Ticket Start Date",
        iqr.start_time  AS "Ticket Start Time",
        ats.start_date AS ticket_start_date,

        CONCAT('(', COALESCE(ua.email, ''), ' (Date&Time:', COALESCE(ta.created_at, ''), ') ', COALESCE(ta.history_text, '')) AS ticket_history_entry,
        ta.created_at AS Ticket_History_Created_At,
        ta.history_text AS Ticket_History_Text,
        ua.email AS Ticket_History_User_Email,
        u2.email AS "filled_by",

        eq.question AS ecrf_question,
        ea.answer AS ecrf_answer,


        iaq.question_text AS aesi_question,
        iaqo.option_text AS aesi_option,
        aqr.description AS aesi_description,
        aqr.created_at AS aesi_created_at,


        ats.status AS "Ticket Status",

        (
            SELECT ua2.email
            FROM ticket_activity ta2
            JOIN user ua2 ON ta2.user_id = ua2.user_id
            WHERE
                ta2.ticket_id = ats.ticket_id
                AND ta2.action_type = 'status_change'
                AND ta2.history_text LIKE '%Closed%'
            ORDER BY ta2.created_at DESC
            LIMIT 1
        ) AS person_who_closed

    FROM adverse_ticketing_system ats
    INNER JOIN incident_reports ir ON ats.incident_report_id = ir.id
    INNER JOIN user u ON ir.user_id = u.user_id
    INNER JOIN organization o ON u.user_id = o.user_id
    INNER JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
    INNER JOIN incident_question_response iqr ON ir.id = iqr.incident_report_id
    INNER JOIN incident_report_question irq ON iqr.question_id = irq.question_id

    LEFT JOIN ecrf_submissions es ON ats.ticket_id = es.ticket_id
    LEFT JOIN user u2 ON es.user_id = u2.user_id
    LEFT JOIN ecrf_answers ea ON es.id = ea.submission_id AND ats.ticket_id = es.ticket_id
    LEFT JOIN ecrf_questions eq ON ea.question_id = eq.id

    LEFT JOIN aesi_question_response aqr ON ats.ticket_id = aqr.ticket_id
    LEFT JOIN investigator_aesi_question iaq ON aqr.question_id = iaq.question_id
    LEFT JOIN investigator_aesi_question_option iaqo ON aqr.option_id = iaqo.option_id

    LEFT JOIN ticket_activity ta ON ats.ticket_id = ta.ticket_id
    LEFT JOIN user ua ON ta.user_id = ua.user_id

    ORDER BY
        ats.ticket_id,
        ats.start_date,
        iqr.start_date,
        es.id,
        eq.id,
        aqr.created_at,
        ta.created_at`;
    const [result8] = await db.execute(AEIncidentLog);
    const result7 = processAEIncidentData(result8);

    return (data = {
      scale_report: decryptDate,
      enrollment_log: enroll_decrypt,
      schedule_log: schedule_decrypt,
      subject_identification_log: subjectIdentification_decrypt,
      dosage_compliance: result5,
      dosage_taken_history: result6,
      AE_incident_log: result7,
    });
  } catch (error) {
    throw error;
  }
};

function processAEIncidentData(queryResults) {
  try {
    // The queryResults should be the result from your SQL query
    const results = queryResults;

    // Group data by composite key: ticket_id and ticket_start_date
    const groupedData = {};

    results.forEach((row) => {
      // Filter out rows whose ecrf_id starts with B or b (uncomment if needed)
      // if (row.ecrf_id && row.ecrf_id.trim()[0].toLowerCase() === "b") {
      //   return; // skip this row
      // }


      // Use original ticket_start_date string as part of the key
      const groupKey = `${row["Ticket ID"]}_${row.ticket_start_date}`;

      // Use the start_date and start_time directly from the query results
      // The query already provides these as "Ticket Start Date" and "Ticket Start Time"
      const formattedDate = row["Ticket Start Date"] || "";
      const formattedTime = row["Ticket Start Time"] || "";

      // Log any missing date/time for debugging
      if (!formattedDate || !formattedTime) {
        console.warn("Missing date/time for ticket:", row["Ticket ID"], "Date:", formattedDate, "Time:", formattedTime);
      }

      // Initialize the group if it doesn't exist
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          "Ticket ID": row["Ticket ID"],
          ecrf_id: row.ecrf_id,
          "Site Name": row["Site Name"],
          "Adverse Question": row["Adverse Question"],
          "Adverse Question Answer": row["Adverse Question Answer"],
          "Describe Adverse Event (description)":
            row["Describe Adverse Event (description)"],
          "Incident Severity": row["Incident Severity"],
          "Ticket Start Date": formattedDate,
          "Ticket Start Time": formattedTime,
          // Use a Set to avoid duplicate history entries
          "Ticket Comment": new Set(),
          // Use a Set for unique AE Form Submission entries
          "AE Form Submission (ecrf)": new Set(),
          // For AESI, store entries in an object keyed by question text
          "AESI Questions & Response Option": {},
          "Ticket Status": row["Ticket Status"],
          // Capture the filled_by value from the query
          filled_by: row.filled_by || "",
          // Capture the aesi_filled_by value from the query

        };
      }

      const group = groupedData[groupKey];

      // Process Ticket History:
      // Format as: (User Email (Date&Time:<Ticket_History_Created_At>) <Ticket_History_Text>
      if (
        row.Ticket_History_Text ||
        row.Ticket_History_Created_At ||
        row.Ticket_History_User_Email
      ) {
        const historyEntry = `(${
          row.Ticket_History_User_Email || ""
        } (Date&Time:${row.Ticket_History_Created_At || ""}) ${
          row.Ticket_History_Text || ""
        }`;
        group["Ticket Comment"].add(historyEntry);
      }

      // Process AE Form Submission (ecrf)
      if (row.ecrf_question) {
        const ecrfQuestion =
          typeof row.ecrf_question === "string"
            ? row.ecrf_question.trim()
            : String(row.ecrf_question);
        const ecrfAnswer = row.ecrf_answer
          ? typeof row.ecrf_answer === "string"
            ? row.ecrf_answer
            : String(row.ecrf_answer)
          : "";

        // Instead of storing as a formatted string, store as a map of questions to answers
        if (!group["AE Form Questions"]) {
          group["AE Form Questions"] = new Map();
        }

        // Store each question and its answer separately
        group["AE Form Questions"].set(ecrfQuestion, ecrfAnswer);
      }

      // Process AESI entry if aesi_question exists
      if (row.aesi_question) {
        const questionKey =
          typeof row.aesi_question === "string"
            ? row.aesi_question.trim()
            : String(row.aesi_question);

        // Create a structured AESI entry
        let aesiData = {
          question: questionKey,
          answer: "",
          description: "",
          createdAt: "",
        };

        // Handle the answer, including NULL values
        if (row.aesi_option) {
          // Preserve NULL values as is
          if (
            typeof row.aesi_option === "string" &&
            row.aesi_option.trim().toUpperCase() === "NULL"
          ) {
            aesiData.answer = "NULL";
          } else if (
            typeof row.aesi_option === "string" &&
            row.aesi_option.trim() !== ""
          ) {
            aesiData.answer = row.aesi_option.trim();
          } else if (row.aesi_option && typeof row.aesi_option !== "string") {
            aesiData.answer = String(row.aesi_option);
          }
        }

        if (
          row.aesi_description &&
          typeof row.aesi_description === "string" &&
          row.aesi_description.trim() !== ""
        ) {
          aesiData.description = row.aesi_description.trim();
        } else if (
          row.aesi_description &&
          typeof row.aesi_description !== "string"
        ) {
          aesiData.description = String(row.aesi_description);
        }

        if (row.aesi_created_at) {
          if (
            typeof row.aesi_created_at === "string" &&
            row.aesi_created_at.trim() !== ""
          ) {
            aesiData.createdAt = row.aesi_created_at.trim();
          } else if (typeof row.aesi_created_at !== "string") {
            // Handle Date objects or other types
            aesiData.createdAt = String(row.aesi_created_at);
          }
        }

        // Save the structured AESI entry if not already present
        if (!group["AESI Questions & Response Option"][questionKey]) {
          group["AESI Questions & Response Option"][questionKey] = aesiData;
        }
      }
    });

    // Collect all unique eCRF questions across all entries
    const allEcrfQuestions = new Set();
    Object.values(groupedData).forEach((item) => {
      if (item["AE Form Questions"]) {
        for (const question of item["AE Form Questions"].keys()) {
          // Skip questions that are just "NULL"
          if (question.trim().toUpperCase() !== "NULL") {
            allEcrfQuestions.add(question);
          }
        }
      }
    });

    // Convert to array for consistent ordering
    const ecrfQuestionsList = Array.from(allEcrfQuestions);

    // Collect all unique AESI questions across all entries
    const allAesiQuestions = new Set();
    Object.values(groupedData).forEach((item) => {
      if (item["AESI Questions & Response Option"]) {
        for (const question in item["AESI Questions & Response Option"]) {
          // Skip questions that are just "NULL"
          if (question.trim().toUpperCase() !== "NULL") {
            allAesiQuestions.add(question);
          }
        }
      }
    });

    // Convert to array for consistent ordering
    const aesiQuestionsList = Array.from(allAesiQuestions);

    // Prepare the final output array
    let output = Object.values(groupedData).map((item) => {
      // Build Ticket Comment header using Ticket Start Date and Time
      const header = `Ticket Submission Date & Time :${item["Ticket Start Date"]} ${item["Ticket Start Time"]}`;
      // Join history entries (each already formatted) with a newline
      const historyEntries = Array.from(item["Ticket Comment"]).join("\n");
      const ticketComment = `${header}\n${historyEntries}`;

      // Create the base output object with common fields
      const outputRow = {
        "Ticket ID": item["Ticket ID"],
        ecrf_id: item["ecrf_id"],
        "Site Name": item["Site Name"],
        "Adverse Question": item["Adverse Question"],
        "Adverse Question Answer": item["Adverse Question Answer"],
        "Describe Adverse Event (description)":
          item["Describe Adverse Event (description)"],
        "Incident Severity": item["Incident Severity"],
        "Ticket Start Date": item["Ticket Start Date"],
        "Ticket Start Time": item["Ticket Start Time"],
        "Ticket Comment": ticketComment,
        "AE Form Filled BY": item["filled_by"] || "",

      };

      // Add each eCRF question as a separate column
      if (item["AE Form Questions"]) {
        ecrfQuestionsList.forEach((question) => {
          const answer = item["AE Form Questions"].get(question) || "";
          outputRow[question] = answer;
        });
      }



      // Add each AESI question as a separate column
      if (item["AESI Questions & Response Option"]) {
        aesiQuestionsList.forEach((question) => {
          const aesi = item["AESI Questions & Response Option"][question];
          if (aesi) {
            // For NULL values, just show "NULL"
            if (aesi.answer && aesi.answer.trim().toUpperCase() === "") {
              outputRow[question] = "";
            } else {
              // For other values, show the answer without the creation date in the column header
              let aesiAnswer = aesi.answer || "";

              // Add description if available
              if (aesi.description && aesi.description.trim() !== "") {
                aesiAnswer = aesiAnswer
                  ? `${aesiAnswer}\n${aesi.description}`
                  : aesi.description;
              }

              // Add creation date to the answer if available
              if (aesi.createdAt && aesi.createdAt.trim() !== "") {
                aesiAnswer = aesiAnswer ? `${aesiAnswer}` : ``;
              }

              outputRow[question] = aesiAnswer;
            }
          } else {
            outputRow[question] = "";
          }
        });
      }
      outputRow["Ticket Status"] = item["Ticket Status"];

      return outputRow;
    });

    // Sort the output by Ticket Start Date and then by Ticket Start Time
    output.sort((a, b) => {
      const dateA = moment(a["Ticket Start Date"], "YYYY/MM/DD");
      const dateB = moment(b["Ticket Start Date"], "YYYY/MM/DD");
      if (dateA.isBefore(dateB)) return -1;
      if (dateA.isAfter(dateB)) return 1;
      // If dates are equal, compare times
      const timeA = moment(a["Ticket Start Time"], "HH:mm:ss");
      const timeB = moment(b["Ticket Start Time"], "HH:mm:ss");
      if (timeA.isBefore(timeB)) return -1;
      if (timeA.isAfter(timeB)) return 1;
      return 0;
    });

    // Return the processed data with column information
    return {
      success: true,
      data: output,
      columns: {
        baseColumns: [
          "Ticket ID",
          "ecrf_id",
          "Site Name",
          "Adverse Question",
          "Adverse Question Answer",
          "Describe Adverse Event (description)",
          "Incident Severity",
          "Ticket Start Date",
          "Ticket Start Time",
          "Ticket Comment",
          "AE Form Filled BY",
        ],
        ecrfColumns: ecrfQuestionsList,
        aesiColumns: aesiQuestionsList,
        finalColumns: ["Ticket Status"],
      },
      totalRecords: output.length,
    };
  } catch (error) {
    console.error("Error processing AE incident data:", error);
    return {
      success: false,
      error: error.message,
      data: [],
      columns: {},
    };
  }
}

module.exports = {
  processAEIncidentData,
  getScaleReportModel,
};

// const db = require("../../config/DBConnection3");
// const crypto = require("crypto");
// const moment = require("moment");

// const ENCRYPTION_KEY = Buffer.from(
//   "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
//   "base64"
// ); // Decoding Base64 key to Buffer
// const IV_LENGTH = 16; // For AES, this is always 16

// function decrypt(text) {
//   if (!text) return text; // Return if text is null or undefined
//   let textParts = text.split(":");
//   let iv = Buffer.from(textParts.shift(), "hex");
//   let encryptedText = Buffer.from(textParts.join(":"), "hex");
//   let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
//   let decrypted = decipher.update(encryptedText, "hex", "utf8");
//   decrypted += decipher.final("utf8");
//   return decrypted;
// }

// const getScaleReportModel = async () => {
//   try {
//     const query = `
//     SELECT org.organization_name,org.organization_address, o.user_id, o.ecrf_id, o.date_enrolled,o.stipend,  st.scale_name, sd.day_name, ss.schedule_name, s.filled_by, sig.investigatorId,sig.created_at, o.status FROM signature AS sig JOIN organization AS o ON sig.user_id = o.user_id JOIN organization_details AS org On o.organization_detail_id = org.organization_detail_id JOIN schedule_days AS sd ON sig.day_id = sd.day_id JOIN study_schedules AS ss ON sd.schedule_id = ss.schedule_id JOIN scale AS s ON sig.scale_id = s.scale_id JOIN scale_translations AS st ON s.scale_id = st.scale_id
//     `;
//     const [result] = await db.execute(query);

//     const decryptDate = result.map((data) => {
//       return {
//         ...data,
//         investigator_first_name: decrypt(data.investigator_first_name),
//         investigator_last_name: decrypt(data.investigator_last_name),
//       };
//     });

//     const enrollmentlog = `SELECT o.ecrf_id ,  o.status, o.date_enrolled FROM organization AS o JOIN user_role AS ur ON o.user_id = ur.user_id WHERE ur.role_id = 10;`;
//     const [result2] = await db.execute(enrollmentlog);
//     const enroll_decrypt = result2.map((data) => {
//       return {
//         ...data,
//         gender: decrypt(data.gender),
//       };
//     });

//     const scheduleLog = `SELECT o.ecrf_id,  s.schedule_date, s.schedule_time,s.status,d.day_name FROM schedule AS s 
// JOIN organization AS o ON s.user_id = o.user_id
// JOIN schedule_days AS d ON s.day_id = d.day_id;
// `;
//     const [result3] = await db.execute(scheduleLog);
//     const schedule_decrypt = result3.map((data) => {
//       return {
//         ...data,
//         gender: decrypt(data.gender),
//       };
//     });

//     const subjectIdentificationLog = `SELECT se.study_name, o.ecrf_id FROM organization AS o
// JOIN study_enrolled AS se ON o.study_enrolled_id = se.enrolled_id
// JOIN user_role AS ur ON o.user_id = ur.user_id
// WHERE ur.role_id = 10;
// `;
//     const [result4] = await db.execute(subjectIdentificationLog);
//     const subjectIdentification_decrypt = result4.map((data) => {
//       return {
//         ...data,
//         first_name: decrypt(data.first_name),
//         last_name: decrypt(data.last_name),
//         gender: decrypt(data.gender),
//         contact_number: decrypt(data.contact_number),
//       };
//     });

//     //     const medicineComplaince = `SELECT o.ecrf_id, m.medication_name, m.dosage, m.frequency_type,smr.intake_quantity, smr.date AS dosageDate, smr.time AS dosageTime, smr.created_at FROM patientmedications AS m
//     // JOIN organization AS o ON m.user_id = o.user_id
//     // JOIN submit_medicine_records AS smr ON m.medication_id = smr.medicine_id
//     // `;
//     const medicineComplaince = `SELECT
//     o.ecrf_id,
//     pm.medication_name,
//     pm.dosage,
//     pm.frequency_type,
//     smr.intake_quantity,
//     smr.date AS dosageDate,
//     smr.time AS dosageTime,
//     DATE_FORMAT(smr.created_at, '%Y-%m-%d %H:%i:%s') AS record_created_at,
    
//     rd.reason,
//     DATE_FORMAT(rd.record_time, '%Y-%m-%d %H:%i:%s') AS reason_created_at,
//     u.email AS reason_created_by,
//     mc.comments,
//     DATE_FORMAT(mc.created_at, '%Y-%m-%d %H:%i:%s') AS comment_created_at,
//     ur.email AS comment_created_by,
//     smr.status
    

// FROM submit_medicine_records AS smr


// JOIN patientmedications AS pm ON smr.medicine_id = pm.medication_id

// JOIN organization AS o ON smr.user_id = o.user_id

// LEFT JOIN medicine_comments AS mc ON smr.record_id = mc.record_id

// LEFT JOIN user AS ur ON mc.investigator_id = ur.user_id 
// LEFT JOIN reason_description AS rd ON rd.track_id = smr.record_id
//     AND rd.update_entity = 'MEDICINE_INTAKE'

// LEFT JOIN user AS u ON rd.investigator_id = u.user_id`
    
//     const [result5] = await db.execute(medicineComplaince);

//     const medicineTakenHistory = `SELECT o.ecrf_id,m.created_at, m.dosage,m.dosageType, m.allot_medicine, md.dosage_time, m.frequency_time,m.frequency_condition, m.route FROM patientmedications AS m JOIN organization AS o ON m.user_id = o.user_id JOIN medication_dosage_times AS md ON m.medication_id = md.medication_id
// `;
//     const [result6] = await db.execute(medicineTakenHistory);
//       const AEIncidentLog = `SELECT
//         ats.ticket_id AS "Ticket ID",
//         o.ecrf_id,
//         CONCAT(COALESCE(org.organization_name, ''), ' ', COALESCE(org.organization_address, '')) AS "Site Name",
//         irq.question_text AS "Adverse Question",
//         iqr.response_text AS "Adverse Question Answer",
//         ir.description AS "Describe Adverse Event (description)",
//         iqr.incident_severety AS "Incident Severity",
//         iqr.start_date  AS "Ticket Start Date",
//         iqr.start_time  AS "Ticket Start Time",
//         ats.start_date AS ticket_start_date,
        
//         CONCAT('(', COALESCE(ua.email, ''), ' (Date&Time:', COALESCE(ta.created_at, ''), ') ', COALESCE(ta.history_text, '')) AS ticket_history_entry,
//         ta.created_at AS Ticket_History_Created_At,
//         ta.history_text AS Ticket_History_Text,
//         ua.email AS Ticket_History_User_Email,
//         u2.email AS "filled_by",
        
//         eq.question AS ecrf_question,
//         ea.answer AS ecrf_answer,
        
        
//         iaq.question_text AS aesi_question,
//         iaqo.option_text AS aesi_option,
//         aqr.description AS aesi_description,
//         aqr.created_at AS aesi_created_at,
        
        
//         ats.status AS "Ticket Status",
        
//         (
//             SELECT ua2.email
//             FROM ticket_activity ta2
//             JOIN user ua2 ON ta2.user_id = ua2.user_id
//             WHERE
//                 ta2.ticket_id = ats.ticket_id
//                 AND ta2.action_type = 'status_change'
//                 AND ta2.history_text LIKE '%Closed%'
//             ORDER BY ta2.created_at DESC
//             LIMIT 1
//         ) AS person_who_closed

//     FROM adverse_ticketing_system ats
//     INNER JOIN incident_reports ir ON ats.incident_report_id = ir.id
//     INNER JOIN user u ON ir.user_id = u.user_id
//     INNER JOIN organization o ON u.user_id = o.user_id
//     INNER JOIN organization_details AS org ON o.organization_detail_id = org.organization_detail_id
//     INNER JOIN incident_question_response iqr ON ir.id = iqr.incident_report_id
//     INNER JOIN incident_report_question irq ON iqr.question_id = irq.question_id

//     LEFT JOIN ecrf_submissions es ON ats.ticket_id = es.ticket_id
//     LEFT JOIN user u2 ON es.user_id = u2.user_id
//     LEFT JOIN ecrf_answers ea ON es.id = ea.submission_id AND ats.ticket_id = es.ticket_id
//     LEFT JOIN ecrf_questions eq ON ea.question_id = eq.id

//     LEFT JOIN aesi_question_response aqr ON ats.ticket_id = aqr.ticket_id
//     LEFT JOIN investigator_aesi_question iaq ON aqr.question_id = iaq.question_id
//     LEFT JOIN investigator_aesi_question_option iaqo ON aqr.option_id = iaqo.option_id

//     LEFT JOIN ticket_activity ta ON ats.ticket_id = ta.ticket_id
//     LEFT JOIN user ua ON ta.user_id = ua.user_id

//     ORDER BY
//         ats.ticket_id,
//         ats.start_date,
//         iqr.start_date,
//         es.id,
//         eq.id,
//         aqr.created_at,
//         ta.created_at`;
//     const [result8] = await db.execute(AEIncidentLog);
//     const result7 = processAEIncidentData(result8);

//     return (data = {
//       scale_report: decryptDate,
//       enrollment_log: enroll_decrypt,
//       schedule_log: schedule_decrypt,
//       subject_identification_log: subjectIdentification_decrypt,
//       dosage_compliance: result5,
//       dosage_taken_history: result6,
//       AE_incident_log: result7,
//     });
//   } catch (error) {
//     throw error;
//   }
// };

// function processAEIncidentData(queryResults) {
//   try {
//     // The queryResults should be the result from your SQL query
//     const results = queryResults;

//     // Group data by composite key: ticket_id and ticket_start_date
//     const groupedData = {};

//     results.forEach((row) => {
//       // Filter out rows whose ecrf_id starts with B or b (uncomment if needed)
//       // if (row.ecrf_id && row.ecrf_id.trim()[0].toLowerCase() === "b") {
//       //   return; // skip this row
//       // }
    

//       // Use original ticket_start_date string as part of the key
//       const groupKey = `${row["Ticket ID"]}_${row.ticket_start_date}`;

//       // Parse date/time using moment.
//       // Format date as YYYY/MM/DD and time in 24-hour format HH:mm:ss.
//       const m = moment(new Date(row.ticket_start_date));
//       const formattedDate = m.format("YYYY/MM/DD");
//       const formattedTime = m.format("HH:mm ");

//       // Initialize the group if it doesn't exist
//       if (!groupedData[groupKey]) {
//         groupedData[groupKey] = {
//           "Ticket ID": row["Ticket ID"],
//           ecrf_id: row.ecrf_id,
//           "Site Name": row["Site Name"],
//           "Adverse Question": row["Adverse Question"],
//           "Adverse Question Answer": row["Adverse Question Answer"],
//           "Describe Adverse Event (description)":
//             row["Describe Adverse Event (description)"],
//           "Incident Severity": row["Incident Severity"],
//           "Ticket Start Date": formattedDate,
//           "Ticket Start Time": formattedTime,
//           // Use a Set to avoid duplicate history entries
//           "Ticket Comment": new Set(),
//           // Use a Set for unique AE Form Submission entries
//           "AE Form Submission (ecrf)": new Set(),
//           // For AESI, store entries in an object keyed by question text
//           "AESI Questions & Response Option": {},
//           "Ticket Status": row["Ticket Status"],
//           // Capture the filled_by value from the query
//           filled_by: row.filled_by || "",
//           // Capture the aesi_filled_by value from the query
          
//         };
//       }

//       const group = groupedData[groupKey];

//       // Process Ticket History:
//       // Format as: (User Email (Date&Time:<Ticket_History_Created_At>) <Ticket_History_Text>
//       if (
//         row.Ticket_History_Text ||
//         row.Ticket_History_Created_At ||
//         row.Ticket_History_User_Email
//       ) {
//         const historyEntry = `(${
//           row.Ticket_History_User_Email || ""
//         } (Date&Time:${row.Ticket_History_Created_At || ""}) ${
//           row.Ticket_History_Text || ""
//         }`;
//         group["Ticket Comment"].add(historyEntry);
//       }

//       // Process AE Form Submission (ecrf)
//       if (row.ecrf_question) {
//         const ecrfQuestion =
//           typeof row.ecrf_question === "string"
//             ? row.ecrf_question.trim()
//             : String(row.ecrf_question);
//         const ecrfAnswer = row.ecrf_answer
//           ? typeof row.ecrf_answer === "string"
//             ? row.ecrf_answer
//             : String(row.ecrf_answer)
//           : "";

//         // Instead of storing as a formatted string, store as a map of questions to answers
//         if (!group["AE Form Questions"]) {
//           group["AE Form Questions"] = new Map();
//         }

//         // Store each question and its answer separately
//         group["AE Form Questions"].set(ecrfQuestion, ecrfAnswer);
//       }

//       // Process AESI entry if aesi_question exists
//       if (row.aesi_question) {
//         const questionKey =
//           typeof row.aesi_question === "string"
//             ? row.aesi_question.trim()
//             : String(row.aesi_question);

//         // Create a structured AESI entry
//         let aesiData = {
//           question: questionKey,
//           answer: "",
//           description: "",
//           createdAt: "",
//         };

//         // Handle the answer, including NULL values
//         if (row.aesi_option) {
//           // Preserve NULL values as is
//           if (
//             typeof row.aesi_option === "string" &&
//             row.aesi_option.trim().toUpperCase() === "NULL"
//           ) {
//             aesiData.answer = "NULL";
//           } else if (
//             typeof row.aesi_option === "string" &&
//             row.aesi_option.trim() !== ""
//           ) {
//             aesiData.answer = row.aesi_option.trim();
//           } else if (row.aesi_option && typeof row.aesi_option !== "string") {
//             aesiData.answer = String(row.aesi_option);
//           }
//         }

//         if (
//           row.aesi_description &&
//           typeof row.aesi_description === "string" &&
//           row.aesi_description.trim() !== ""
//         ) {
//           aesiData.description = row.aesi_description.trim();
//         } else if (
//           row.aesi_description &&
//           typeof row.aesi_description !== "string"
//         ) {
//           aesiData.description = String(row.aesi_description);
//         }

//         if (row.aesi_created_at) {
//           if (
//             typeof row.aesi_created_at === "string" &&
//             row.aesi_created_at.trim() !== ""
//           ) {
//             aesiData.createdAt = row.aesi_created_at.trim();
//           } else if (typeof row.aesi_created_at !== "string") {
//             // Handle Date objects or other types
//             aesiData.createdAt = String(row.aesi_created_at);
//           }
//         }

//         // Save the structured AESI entry if not already present
//         if (!group["AESI Questions & Response Option"][questionKey]) {
//           group["AESI Questions & Response Option"][questionKey] = aesiData;
//         }
//       }
//     });

//     // Collect all unique eCRF questions across all entries
//     const allEcrfQuestions = new Set();
//     Object.values(groupedData).forEach((item) => {
//       if (item["AE Form Questions"]) {
//         for (const question of item["AE Form Questions"].keys()) {
//           // Skip questions that are just "NULL"
//           if (question.trim().toUpperCase() !== "NULL") {
//             allEcrfQuestions.add(question);
//           }
//         }
//       }
//     });

//     // Convert to array for consistent ordering
//     const ecrfQuestionsList = Array.from(allEcrfQuestions);

//     // Collect all unique AESI questions across all entries
//     const allAesiQuestions = new Set();
//     Object.values(groupedData).forEach((item) => {
//       if (item["AESI Questions & Response Option"]) {
//         for (const question in item["AESI Questions & Response Option"]) {
//           // Skip questions that are just "NULL"
//           if (question.trim().toUpperCase() !== "NULL") {
//             allAesiQuestions.add(question);
//           }
//         }
//       }
//     });

//     // Convert to array for consistent ordering
//     const aesiQuestionsList = Array.from(allAesiQuestions);

//     // Prepare the final output array
//     let output = Object.values(groupedData).map((item) => {
//       // Build Ticket Comment header using Ticket Start Date and Time
//       const header = `Ticket Submission Date & Time :${item["Ticket Start Date"]} ${item["Ticket Start Time"]}`;
//       // Join history entries (each already formatted) with a newline
//       const historyEntries = Array.from(item["Ticket Comment"]).join("\n");
//       const ticketComment = `${header}\n${historyEntries}`;

//       // Create the base output object with common fields
//       const outputRow = {
//         "Ticket ID": item["Ticket ID"],
//         ecrf_id: item["ecrf_id"],
//         "Site Name": item["Site Name"],
//         "Adverse Question": item["Adverse Question"],
//         "Adverse Question Answer": item["Adverse Question Answer"],
//         "Describe Adverse Event (description)":
//           item["Describe Adverse Event (description)"],
//         "Incident Severity": item["Incident Severity"],
//         "Ticket Start Date": item["Ticket Start Date"],
//         "Ticket Start Time": item["Ticket Start Time"],
//         "Ticket Comment": ticketComment,
//         "AE Form Filled BY": item["filled_by"] || "",
      
//       };

//       // Add each eCRF question as a separate column
//       if (item["AE Form Questions"]) {
//         ecrfQuestionsList.forEach((question) => {
//           const answer = item["AE Form Questions"].get(question) || "";
//           outputRow[question] = answer;
//         });
//       }

     

//       // Add each AESI question as a separate column
//       if (item["AESI Questions & Response Option"]) {
//         aesiQuestionsList.forEach((question) => {
//           const aesi = item["AESI Questions & Response Option"][question];
//           if (aesi) {
//             // For NULL values, just show "NULL"
//             if (aesi.answer && aesi.answer.trim().toUpperCase() === "") {
//               outputRow[question] = "";
//             } else {
//               // For other values, show the answer without the creation date in the column header
//               let aesiAnswer = aesi.answer || "";

//               // Add description if available
//               if (aesi.description && aesi.description.trim() !== "") {
//                 aesiAnswer = aesiAnswer
//                   ? `${aesiAnswer}\n${aesi.description}`
//                   : aesi.description;
//               }

//               // Add creation date to the answer if available
//               if (aesi.createdAt && aesi.createdAt.trim() !== "") {
//                 aesiAnswer = aesiAnswer ? `${aesiAnswer}` : ``;
//               }

//               outputRow[question] = aesiAnswer;
//             }
//           } else {
//             outputRow[question] = "";
//           }
//         });
//       }
//       outputRow["Ticket Status"] = item["Ticket Status"];

//       return outputRow;
//     });

//     // Sort the output by Ticket Start Date and then by Ticket Start Time
//     output.sort((a, b) => {
//       const dateA = moment(a["Ticket Start Date"], "YYYY/MM/DD");
//       const dateB = moment(b["Ticket Start Date"], "YYYY/MM/DD");
//       if (dateA.isBefore(dateB)) return -1;
//       if (dateA.isAfter(dateB)) return 1;
//       // If dates are equal, compare times
//       const timeA = moment(a["Ticket Start Time"], "HH:mm:ss");
//       const timeB = moment(b["Ticket Start Time"], "HH:mm:ss");
//       if (timeA.isBefore(timeB)) return -1;
//       if (timeA.isAfter(timeB)) return 1;
//       return 0;
//     });

//     // Return the processed data with column information
//     return {
//       success: true,
//       data: output,
//       columns: {
//         baseColumns: [
//           "Ticket ID",
//           "ecrf_id",
//           "Site Name",
//           "Adverse Question",
//           "Adverse Question Answer",
//           "Describe Adverse Event (description)",
//           "Incident Severity",
//           "Ticket Start Date",
//           "Ticket Start Time",
//           "Ticket Comment",
//           "AE Form Filled BY",
//         ],
//         ecrfColumns: ecrfQuestionsList,
//         aesiColumns: aesiQuestionsList,
//         finalColumns: ["Ticket Status"],
//       },
//       totalRecords: output.length,
//     };
//   } catch (error) {
//     console.error("Error processing AE incident data:", error);
//     return {
//       success: false,
//       error: error.message,
//       data: [],
//       columns: {},
//     };
//   }
// }

// module.exports = {
//   processAEIncidentData,
//   getScaleReportModel,
// };

    