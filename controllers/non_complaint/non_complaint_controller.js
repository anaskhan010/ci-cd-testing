const { message } = require("paubox-node");
const nonComplaintModel = require("../../models/non_complaint/non_complaint_model");
const auditLog = require("../../middleware/audit_logger.js");

var jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/DBConnection3.js");
const sendEmail = require("../../middleware/non_compliant_email.js");
const cron = require("node-cron");

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16;

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

const make_compliant_controller = async (req, res) => {
  const user_id = req.params.id;
  const { reason } = req.body;
  console.log(reason, "controller reason");
  try {
    // Get the patient data before update for audit logging
    const [patientBefore] = await db.query(
      "SELECT * FROM organization WHERE user_id = ?",
      [user_id]
    );

    const result = await nonComplaintModel.make_compliant_model(user_id);

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);
    const investigator_id = decoded.user_id;

    // Get the patient data after update for audit logging
    const [patientAfter] = await db.query(
      "SELECT * FROM organization WHERE user_id = ?",
      [user_id]
    );

    const newData = {
      reason,
      investigator_id,
    };

    // Use both the old audit log for backward compatibility
    await auditLog(
      "Update",
      "Non-Compliant --> Compliant",
      null,
      newData,
      "Update Non-Compliant to Compliant"
    )(req, res, () => {});

    res
      .status(200)
      .json({ message: `Non-Compliant --> Compliant `, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// const non_complaint_controller = async (req, res) => {
//   console.log("Non-compliant Controller function called!");
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     console.log(token, "token for non compliant");

//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const userId = decoded.user_id;
//     const role = decoded.role;

//     console.log("Decoded token:", decoded);
//     console.log("User ID:", userId);

//     // Get non-compliant patients based on the user's role
//     // For superadmin (role_id = 9), get all non-compliant subjects
//     // For other roles, get only subjects assigned to this personnel through personel_subject table
//     const result = await nonComplaintModel.non_complaint_model(userId, role);

//     // Decrypt patient names
//     const newResult = result.map((user) => ({
//       ...user,
//       first_name: decrypt(user.first_name),
//       last_name: decrypt(user.last_name),
//     }));

//     res.status(200).json({ data: newResult });
//   } catch (error) {
//     console.error("Error in non_complaint_controller:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// async function getNonCompliantSubjectsByGroup(
//   study_enrolled_id,
//   organization_detail_id
// ) {
//   const query = `
//     SELECT
//       u.user_id,
//       u.email,
//       o.ecrf_id,
//       o.study_enrolled_id,
//       o.organization_detail_id,
//       o.status,
//       o.is_compliant,
//       o.first_name,
//       o.last_name,
//       pm.created_at AS allotment_date,
//       (
//         SELECT MAX(smr.created_at)
//         FROM submit_medicine_records smr
//         WHERE smr.user_id = u.user_id
//           AND smr.created_at >= pm.created_at
//       ) AS last_submission_time,
//       CASE
//         WHEN (
//           SELECT MAX(smr.created_at)
//           FROM submit_medicine_records smr
//           WHERE smr.user_id = u.user_id
//             AND smr.created_at >= pm.created_at
//         ) IS NULL THEN TIMESTAMPDIFF(MINUTE, pm.created_at, NOW())
//         ELSE TIMESTAMPDIFF(
//           MINUTE,
//           (
//             SELECT MAX(smr.created_at)
//             FROM submit_medicine_records smr
//             WHERE smr.user_id = u.user_id
//               AND smr.created_at >= pm.created_at
//           ),
//           NOW()
//         )
//       END AS minutes_since_last_submission
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     JOIN patient_account_status pas ON o.user_id = pas.user_id
//     JOIN patientmedications pm ON u.user_id = pm.user_id
//     WHERE
//       r.role_name = 'Subject'
//       AND o.status = 'Randomized'
//       AND pas.account_status = 'Accepted'
//       AND o.study_enrolled_id = ?
//       AND o.organization_detail_id = ?
//       -- Only consider subjects whose medicine allotment is at least 3 days old
//       AND TIMESTAMPDIFF(MINUTE, pm.created_at, NOW()) >= 4320
//       -- Mark as non-compliant when there is no submission OR the last submission was 3+ days ago
//       AND (
//         (
//           SELECT MAX(smr.created_at)
//           FROM submit_medicine_records smr
//           WHERE smr.user_id = u.user_id
//             AND smr.created_at >= pm.created_at
//         ) IS NULL
//         OR TIMESTAMPDIFF(
//           MINUTE,
//           (
//             SELECT MAX(smr.created_at)
//             FROM submit_medicine_records smr
//             WHERE smr.user_id = u.user_id
//               AND smr.created_at >= pm.created_at
//           ),
//           NOW()
//         ) >= 4320
//       )
//   `;
//   try {
//     const [rows] = await db.query(query, [
//       study_enrolled_id,
//       organization_detail_id,
//     ]);
//     return rows;
//   } catch (error) {
//     console.error("Error fetching non-compliant subjects:", error);
//     throw error;
//   }
// }

// /**
//  * Retrieves personnel (users whose role_id is not 10) for a given study and organization detail.
//  */
// async function getPersonnelByGroup(study_enrolled_id, organization_detail_id) {
//   const emailEnabledSubquery = `
//       SELECT personel_id
//       FROM email_sent_notification
//       WHERE email_type_id = 12
//       GROUP BY personel_id
//       HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
//     `;
//   const query = `
//     SELECT DISTINCT u.user_id, u.email, o.study_enrolled_id, o.organization_detail_id
//     FROM user u
//     JOIN user_role ur ON u.user_id = ur.user_id
//     JOIN role r ON ur.role_id = r.role_id
//     JOIN organization o ON u.user_id = o.user_id
//     JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
//     WHERE
//       r.role_id != 10
//       AND o.study_enrolled_id = ?
//       AND o.organization_detail_id = ?
//   `;
//   try {
//     const [rows] = await db.query(query, [
//       study_enrolled_id,
//       organization_detail_id,
//     ]);
//     return rows;
//   } catch (error) {
//     console.error("Error fetching personnel:", error);
//     throw error;
//   }
// }

// /**
//  * Gets the timezone for a given organization_detail_id from the organization_detail table.
//  * If no timezone is found, defaults to "UTC".
//  */
// async function getOrganizationTimezone(organization_detail_id) {
//   const query = `
//     SELECT DISTINCT timezone
//     FROM organization_details
//     WHERE organization_detail_id = ?
//     LIMIT 1
//   `;
//   try {
//     const [rows] = await db.query(query, [organization_detail_id]);
//     if (rows.length > 0) {
//       return rows[0].timezone;
//     }
//     return "UTC";
//   } catch (error) {
//     console.error("Error fetching organization timezone:", error);
//     return "UTC";
//   }
// }

// /**
//  * For a specific study and organization group, this function:
//  *   - Retrieves non-compliant subjects (i.e. subjects that did not take medicine in the last 3 days).
//  *   - Retrieves personnel in that group (all users except those with role_id 10).
//  *   - Builds an HTML table (via the sendEmail module) listing the subjects' ecrf_id.
//  *   - Sends an email alert to the personnel.
//  */
// async function processNonComplianceEmailByGroup(
//   study_enrolled_id,
//   organization_detail_id
// ) {
//   try {
//     console.log("\n========== Starting Email Process ==========");
//     console.log(`Processing for:`);
//     console.log(`Study ID: ${study_enrolled_id}`);
//     console.log(`Organization Detail ID: ${organization_detail_id}`);
//     console.log("==========================================\n");

//     const subjects = await getNonCompliantSubjectsByGroup(
//       study_enrolled_id,
//       organization_detail_id
//     );
//     if (!subjects || subjects.length === 0) {
//       console.log(`⚠️ No non-compliant subjects found for:`);
//       console.log(`   Study ID: ${study_enrolled_id}`);
//       console.log(`   Organization Detail ID: ${organization_detail_id}`);
//       return;
//     }

//     console.log("\n--- Non-compliant Subjects Details ---");
//     subjects.forEach((s) => {
//       console.log(`ECRF ID: ${s.ecrf_id}`);
//       console.log(`Study ID: ${s.study_enrolled_id}`);
//       console.log(`Org Detail ID: ${s.organization_detail_id}`);
//       console.log(
//         `Last Submission: ${s.last_submission_time || "No submission"}`
//       );
//       console.log("-----------------------------------");
//     });

//     const personnel = await getPersonnelByGroup(
//       study_enrolled_id,
//       organization_detail_id
//     );
//     if (!personnel || personnel.length === 0) {
//       console.log(`⚠️ No personnel found for:`);
//       console.log(`   Study ID: ${study_enrolled_id}`);
//       console.log(`   Organization Detail ID: ${organization_detail_id}`);
//       return;
//     }

//     console.log("\n--- Personnel Details ---");
//     personnel.forEach((p) => {
//       console.log(`Email: ${p.email}`);
//       console.log(`Study ID: ${p.study_enrolled_id}`);
//       console.log(`Org Detail ID: ${p.organization_detail_id}`);
//       console.log("----------------------");
//     });

//     // Prepare the data for email
//     const ecrfData = subjects.map((subject) => ({ ecrf_id: subject.ecrf_id }));
//     const emailSubject = `Non-Compliance Alert`;
//     const emailText = `The following subjects have not taken their medicine in the last 3 days:`;

//     // Send email to each personnel
//     for (const person of personnel) {
//       try {
//         console.log("\n=== Sending Email ===");
//         console.log(`To: ${person.email}`);
//         console.log(`For Study ID: ${person.study_enrolled_id}`);
//         console.log(`For Org Detail ID: ${person.organization_detail_id}`);
//         console.log("Non-compliant ECRFs in this email:");
//         ecrfData.forEach((d) => console.log(`- ${d.ecrf_id}`));

//         await sendEmail(person.email, emailSubject, emailText, ecrfData);
//         console.log(`✓ Email sent successfully to ${person.email}`);
//       } catch (emailError) {
//         console.error(`\n✗ Email Failed`);
//         console.error(`Recipient: ${person.email}`);
//         console.error(`Study ID: ${person.study_enrolled_id}`);
//         console.error(`Org Detail ID: ${person.organization_detail_id}`);
//         console.error("Error:", emailError);
//       }
//     }

//     console.log("\n========== Process Summary ==========");
//     console.log(`Study ID: ${study_enrolled_id}`);
//     console.log(`Organization Detail ID: ${organization_detail_id}`);
//     console.log(`Total non-compliant subjects: ${subjects.length}`);
//     console.log(`Total personnel notified: ${personnel.length}`);
//     console.log(`Total ECRFs included: ${ecrfData.length}`);
//     console.log("====================================\n");
//   } catch (error) {
//     console.error("\n❌ Process Error");
//     console.error(`Study ID: ${study_enrolled_id}`);
//     console.error(`Organization Detail ID: ${organization_detail_id}`);
//     console.error("Error details:", error);

//     // Create a mock request object for audit logging
//     const mockReq = {
//       method: "CRON",
//       originalUrl: "/internal/non-compliant-email-notification",
//       headers: {
//         "user-agent": "ResearchHero/1.0 (Automated Cron Job)",
//       },
//       ip: "127.0.0.1",
//     };
//   }
// }

// /**
//  * Schedules separate cron jobs for each distinct (study_enrolled_id, organization_detail_id) group.
//  * For each group, we get the local timezone from the organization_detail table and schedule a job
//  * to run daily at 9 AM in that timezone.
//  */
// async function scheduleCronJobs() {
//   try {
//     // Retrieve distinct groups from the organization table.
//     const query = `
//       SELECT DISTINCT study_enrolled_id, organization_detail_id
//       FROM organization
//     `;
//     const [groups] = await db.query(query);

//     groups.forEach(async (group) => {
//       const { study_enrolled_id, organization_detail_id } = group;
//       const timezone = await getOrganizationTimezone(organization_detail_id);

//       // Schedule a cron job for this group – runs daily at 9 AM in the organization's timezone.
//       cron.schedule(
//         "00 09 * * *",
//         async () => {
//           console.log(
//             `Running cron job for Study: ${study_enrolled_id}, Org Detail: ${organization_detail_id} at ${new Date().toISOString()}`
//           );
//           await processNonComplianceEmailByGroup(
//             study_enrolled_id,
//             organization_detail_id
//           );
//         },
//         { timezone: timezone }
//       );

//       console.log(
//         `Scheduled cron job for Study: ${study_enrolled_id}, Org Detail: ${organization_detail_id} in timezone: ${timezone}`
//       );
//     });
//   } catch (error) {
//     console.error("Error scheduling cron jobs:", error);
//   }
// }

// // Start the scheduling process.
// scheduleCronJobs();







const non_complaint_controller = async (req, res) => {
  console.log("Non-compliant Controller function called!");
  try {
    const token = req.headers.authorization.split(" ")[1];
    console.log(token, "token for non compliant");

    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const userId = decoded.user_id;
    const role = decoded.role;

    console.log("Decoded token:", decoded);
    console.log("User ID:", userId);

    // Get non-compliant patients based on the user's role
    // For superadmin (role_id = 9), get all non-compliant subjects
    // For other roles, get only subjects assigned to this personnel through personel_subject table
    const result = await nonComplaintModel.non_complaint_model(userId, role);

    // Decrypt patient names
    const newResult = result.map((user) => ({
      ...user,
      first_name: decrypt(user.first_name),
      last_name: decrypt(user.last_name),
    }));

    res.status(200).json({ data: newResult });
  } catch (error) {
    console.error("Error in non_complaint_controller:", error);
    res.status(500).json({ error: error.message });
  }
};

async function getNonCompliantSubjectsByGroup(
  study_enrolled_id,
  organization_detail_id
) {
  const query = `
    SELECT DISTINCT  
      u.user_id,
      u.email,
      o.ecrf_id,
      o.study_enrolled_id,
      o.organization_detail_id,
      o.status,
      o.is_compliant,
      o.first_name,
      o.last_name,
      pm.created_at AS allotment_date,
      (
        SELECT MAX(smr.created_at)
        FROM submit_medicine_records smr
        WHERE smr.user_id = u.user_id
          AND smr.created_at >= pm.created_at
      ) AS last_submission_time,
      CASE
        WHEN (
          SELECT MAX(smr.created_at)
          FROM submit_medicine_records smr
          WHERE smr.user_id = u.user_id
            AND smr.created_at >= pm.created_at
        ) IS NULL THEN TIMESTAMPDIFF(MINUTE, pm.created_at, NOW())
        ELSE TIMESTAMPDIFF(
          MINUTE,
          (
            SELECT MAX(smr.created_at)
            FROM submit_medicine_records smr
            WHERE smr.user_id = u.user_id
              AND smr.created_at >= pm.created_at
          ),
          NOW()
        )
      END AS minutes_since_last_submission
    FROM user u
    JOIN user_role ur ON u.user_id = ur.user_id
    JOIN role r ON ur.role_id = r.role_id
    JOIN organization o ON u.user_id = o.user_id
    JOIN patient_account_status pas ON o.user_id = pas.user_id
    JOIN patientmedications pm ON u.user_id = pm.user_id
    WHERE
      r.role_name = 'Subject'
      AND o.status = 'Randomized'
      AND o.status != 'Safety Follow-up'
      AND pas.account_status = 'Accepted'
      AND o.study_enrolled_id = ?
      AND o.organization_detail_id = ?
      -- Only consider subjects whose medicine allotment is at least 3 days old
      AND TIMESTAMPDIFF(MINUTE, pm.created_at, NOW()) >= 4320
      -- Mark as non-compliant when there is no submission OR the last submission was 3+ days ago
      AND (
        (
          SELECT MAX(smr.created_at)
          FROM submit_medicine_records smr
          WHERE smr.user_id = u.user_id
            AND smr.created_at >= pm.created_at
        ) IS NULL
        OR TIMESTAMPDIFF(
          MINUTE,
          (
            SELECT MAX(smr.created_at)
            FROM submit_medicine_records smr
            WHERE smr.user_id = u.user_id
              AND smr.created_at >= pm.created_at
          ),
          NOW()
        ) >= 4320
      )
  `;
  try {
    const [rows] = await db.query(query, [
      study_enrolled_id,
      organization_detail_id,
    ]);
    return rows;
  } catch (error) {
    console.error("Error fetching non-compliant subjects:", error);
    throw error;
  }
}

async function getAllPersonnel() {
  const emailEnabledSubquery = `
    SELECT personel_id
    FROM email_sent_notification
    WHERE email_type_id = 12
    GROUP BY personel_id
    HAVING SUM(CASE WHEN status != 'Enable' THEN 1 ELSE 0 END) = 0
  `;

  // Some MySQL versions have issues with JSON_ARRAYAGG - using a simpler approach
  const query = `
    SELECT 
      u.user_id, 
      u.email,
      ps.study_id,
      ps.site_id
    FROM user u
    JOIN user_role ur ON u.user_id = ur.user_id
    JOIN role r ON ur.role_id = r.role_id
    JOIN personnel_assigned_sites_studies AS ps ON u.user_id = ps.personnel_id
    JOIN (${emailEnabledSubquery}) AS esn ON u.user_id = esn.personel_id
    WHERE r.role_id != 10
  `;

  try {
    const [rows] = await db.query(query);

    // Group the results by personnel
    const personnelMap = new Map();

    rows.forEach((row) => {
      if (!personnelMap.has(row.user_id)) {
        personnelMap.set(row.user_id, {
          user_id: row.user_id,
          email: row.email,
          assignments: [],
        });
      }

      personnelMap.get(row.user_id).assignments.push({
        study_id: row.study_id,
        site_id: row.site_id,
      });
    });

    return Array.from(personnelMap.values());
  } catch (error) {
    console.error("Error fetching personnel with assignments:", error);
    throw error;
  }
}

async function getOrganizationTimezone(organization_detail_id) {
  const query = `
    SELECT DISTINCT timezone
    FROM organization_details
    WHERE organization_detail_id = ?
    LIMIT 1
  `;
  try {
    const [rows] = await db.query(query, [organization_detail_id]);
    if (rows.length > 0) {
      return rows[0].timezone;
    }
    return "UTC";
  } catch (error) {
    console.error("Error fetching organization timezone:", error);
    return "UTC";
  }
}

async function processAllNonComplianceEmails() {
  try {
    console.log("\n========== Starting Global Email Process ==========");

    // Get all unique study/organization combinations
    const query = `
      SELECT DISTINCT study_enrolled_id, organization_detail_id
      FROM organization
      WHERE status = 'Randomized'
    `;
    const [studyOrgGroups] = await db.query(query);

    // Map to store non-compliant subjects by study/org combination
    const nonCompliantSubjectsMap = new Map();

    // Collect all non-compliant subjects across all study/org combinations
    console.log(
      `\nCollecting non-compliant subjects from ${studyOrgGroups.length} study/org groups...`
    );
    for (const group of studyOrgGroups) {
      const { study_enrolled_id, organization_detail_id } = group;
      const key = `${study_enrolled_id}-${organization_detail_id}`;

      const subjects = await getNonCompliantSubjectsByGroup(
        study_enrolled_id,
        organization_detail_id
      );

      if (subjects && subjects.length > 0) {
        nonCompliantSubjectsMap.set(key, subjects);
        console.log(
          `Found ${subjects.length} non-compliant subjects for Study: ${study_enrolled_id}, Org: ${organization_detail_id}`
        );
      }
    }

    if (nonCompliantSubjectsMap.size === 0) {
      console.log(
        "No non-compliant subjects found across any study/org combination."
      );
      return;
    }

    // Get all personnel with their study/site assignments
    const allPersonnel = await getAllPersonnel();
    console.log(
      `\nRetrieved ${allPersonnel.length} personnel with their study/site assignments`
    );

    // For each personnel, create a consolidated list of non-compliant subjects
    // based on their assignments
    for (const person of allPersonnel) {
      try {
        // Track all applicable ECRFs for this personnel based on their assignments
        const applicableEcrfData = [];

        for (const assignment of person.assignments) {
          const { study_id, site_id } = assignment;
          const key = `${study_id}-${site_id}`;

          // If there are non-compliant subjects for this study/org combination
          if (nonCompliantSubjectsMap.has(key)) {
            const subjects = nonCompliantSubjectsMap.get(key);

            // Add ECRFs from these subjects to the personnel's list
            subjects.forEach((subject) => {
              applicableEcrfData.push({
                ecrf_id: subject.ecrf_id,
                study_id: subject.study_enrolled_id,
                org_id: subject.organization_detail_id,
              });
            });
          }
        }

        // If this personnel has applicable non-compliant subjects, send a consolidated email
        if (applicableEcrfData.length > 0) {
          console.log(`\n=== Preparing Email for ${person.email} ===`);
          console.log(
            `Total non-compliant ECRFs: ${applicableEcrfData.length}`
          );

          const emailSubject = `Non-Compliance Alert`;

          // Group ECRFs by study and site for better email organization
          const ecrfsByStudySite = {};
          applicableEcrfData.forEach((ecrf) => {
            const groupKey = `Study ${ecrf.study_id} - Site ${ecrf.org_id}`;
            if (!ecrfsByStudySite[groupKey]) {
              ecrfsByStudySite[groupKey] = [];
            }
            ecrfsByStudySite[groupKey].push(ecrf.ecrf_id);
          });

          // Create email text with grouped ECRFs
          let emailText = `The following subjects have not taken their medicine in the last 3 days:\n\n`;

          // Send consolidated email
          await sendEmail(
            person.email,
            emailSubject,
            emailText,
            applicableEcrfData
          );
          console.log(
            `✓ Consolidated email sent successfully to ${person.email}`
          );
        } else {
          console.log(
            `No applicable non-compliant subjects for ${person.email} - no email sent`
          );
        }
      } catch (personError) {
        console.error(
          `\n✗ Error processing personnel ${person.email}:`,
          personError
        );
      }
    }

    console.log("\n========== Global Process Summary ==========");
    console.log(
      `Total study/org combinations with non-compliant subjects: ${nonCompliantSubjectsMap.size}`
    );
    console.log(`Total personnel processed: ${allPersonnel.length}`);
    console.log("==========================================\n");
  } catch (error) {
    console.error("\n❌ Global Process Error:", error);
  }
}

async function scheduleCronJobs() {
  try {
    // Get all unique organization detail IDs to determine timezones
    const query = `
      SELECT DISTINCT organization_detail_id 
      FROM organization_details
    `;
    const [orgDetails] = await db.query(query);

    // Map to store timezones by organization
    const timezoneMap = new Map();

    // Get timezone for each organization
    for (const org of orgDetails) {
      const timezone = await getOrganizationTimezone(
        org.organization_detail_id
      );
      timezoneMap.set(org.organization_detail_id, timezone);
    }

    // Group organizations by timezone for efficiency
    const timezoneGroups = new Map();
    for (const [orgId, timezone] of timezoneMap.entries()) {
      if (!timezoneGroups.has(timezone)) {
        timezoneGroups.set(timezone, []);
      }
      timezoneGroups.get(timezone).push(orgId);
    }

    // Schedule a cron job for each timezone group - runs daily at 8 AM in respective timezone
    for (const [timezone, orgIds] of timezoneGroups.entries()) {
      cron.schedule(
        "00 08 * * *", // Daily at 8 AM
        async () => {
          console.log(
            `Running daily non-compliance check at ${new Date().toLocaleString()} in timezone ${timezone}`
          );
          await processAllNonComplianceEmails();
        },
        {
          timezone: timezone,
          scheduled: true, // Ensures the job is scheduled
        }
      );

      console.log(
        `Scheduled daily cron job for timezone: ${timezone} covering ${orgIds.length} organizations`
      );
    }
  } catch (error) {
    console.error("Error scheduling cron jobs:", error);
  }
}


scheduleCronJobs();







module.exports = {
  non_complaint_controller,
  make_compliant_controller,
};
