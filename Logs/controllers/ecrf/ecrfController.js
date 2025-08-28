// ecrfController.js
const ecrfModel = require("../../models/ecrf/ecrfModel");
const auditLog = require("../../middleware/audit_logger.js");
const crypto = require("crypto");
const ecrfAnswerSubmitEmail = require("../../middleware/ecrfAnswerSubmitEmail.js");

// Create ECRF question controller
const createEcrfQuestion = async (req, res) => {
  try {
    const { question, isYesNo, allowsDetails } = req.body;
    const result = await ecrfModel.createEcrfQuestion(
      question,
      isYesNo,
      allowsDetails
    );
    res
      .status(201)
      .json({ message: "ECRF question created successfully", result });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get all ECRF questions controller
const getAllEcrfQuestions = async (req, res) => {
  try {
    const result = await ecrfModel.getAllEcrfQuestions();
    res
      .status(200)
      .json({ message: "ECRF questions retrieved successfully", result });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

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

// const submitEcrfAnswers = async (req, res) => {
//   try {
//     const { userId, ticketId, answers } = req.body;

//     const oldValue = null;
//     const newValue = { userId, ticketId, answers };

//     const reason = "Submitted ECRF answers";

//     const result = await ecrfModel.submitEcrfAnswers(userId, ticketId, answers);

//     auditLog(
//       "SUBMIT",
//       "eCRF Answers",
//       oldValue,
//       newValue,
//       reason
//     )(req, res, () => {});

//     const organizationByTicket = await ecrfModel.getOrganizationByTicket(
//       ticketId
//     );
//     const roles = await ecrfModel.getRolesExcluding(
//       10,
//       organizationByTicket[0].study_enrolled_id,
//       organizationByTicket[0].organization_detail_id
//     );
//     console.log(roles, "***check roles******");
//     const users = await ecrfModel.getUsersByRolesForAEForm(
//       roles[0].user_id,
//       organizationByTicket[0].study_enrolled_id
//     );
//     console.log("============User id====================");
//     console.log(users);
//     console.log("================================");
//     const logoUrl = "https://myresearchhero.org/logo/logo.png";

//     const filteredUsersByOrganization = users.filter(
//       (user) =>
//         user.organization_detail_id ===
//         organizationByTicket[0].organization_detail_id
//     );

//     console.log("===========Filter User===========");
//     console.log("================================");
//     console.log(filteredUsersByOrganization);
//     console.log("================================");
//     console.log("===========End Filter User===========");

//     const emailPromises = filteredUsersByOrganization.map((user) => {
//       const subject = "ECRF Answers Submitted";
//       const content = `
//         <html>
//             <head>
//               <style>
//                  body {
//                   font-family: Arial, sans-serif;
//                   background-color: #f5f5f5;
//                   margin: 0;
//                   padding: 20px;
//                 }
//                 .container {
//                   max-width: 600px;
//                   margin: 0 auto;
//                   background-color: #ffffff;
//                   padding: 20px;
//                   border-radius: 8px;
//                   box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//                 }
//                 .header {
//                   text-align: center;
//                   padding-bottom: 20px;
//                 }
//                 .header img {
//                   max-width: 150px;
//                 }
//                 .content {
//                   font-size: 16px;
//                   line-height: 1.5;
//                 }
//                 .content h1 {
//                   font-family: 'Georgia', serif;
//                   font-size: 24px;
//                   color: #333333;
//                   margin-bottom: 20px;
//                 }
//                 .content p {
//                   margin-bottom: 10px;
//                 }
//                 .footer {
//                   text-align: center;
//                   font-size: 14px;
//                   color: #999999;
//                   padding-top: 20px;
//                   border-top: 1px solid #eeeeee;
//                 }
//               </style>
//             </head>
//             <body>
//               <div class="container">
//                 <div class="header">
//                   <img src="${logoUrl}" alt="ResearchHero Logo">
//                 </div>
//                 <div class="content">
//                    <p>Hello ${decrypt(user.first_name)} ${decrypt(
//         user.last_name
//       )},</p>
//         <p>ECRF answers have been submitted for ticket id ${ticketId}.</p>
//                 </div>
//                 <div class="footer">
//                   &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
//                 </div>
//               </div>
//             </body>
//             </html>

//       `;
//       return ecrfAnswerSubmitEmail(subject, user.email, content);
//     });

//     await Promise.all(emailPromises);

//     res.status(201).json({
//       message: "ECRF answers submitted and emails sent successfully",
//       submissionId: result,
//     });
//   } catch (error) {
//     if (error.message === "A submission for this ticket already exists today") {
//       res.status(400).json({ message: error.message });
//     } else {
//       auditLog(
//         req,
//         "CREATE_FAILED",
//         "ecrf_answers",
//         null,
//         req.body,
//         `Failed to submit ECRF answers: ${error.message}`
//       );
//       res
//         .status(500)
//         .json({ message: "Internal server error", error: error.message });
//     }
//   }
// };

const submitEcrfAnswers = async (req, res) => {
  try {
    const { userId, ticketId, answers } = req.body;

    const oldValue = null;
    const newValue = { userId, ticketId, answers };
    const reason = "Submitted ECRF answers";

    // Submit the answers first
    const result = await ecrfModel.submitEcrfAnswers(userId, ticketId, answers);

    // Log the submission
    auditLog(
      "SUBMIT",
      "eCRF Answers",
      oldValue,
      newValue,
      reason
    )(req, res, () => {});

    // Get organization details for the ticket
    const organizationByTicket = await ecrfModel.getOrganizationByTicket(
      ticketId
    );
    if (!organizationByTicket || organizationByTicket.length === 0) {
      return res
        .status(404)
        .json({ message: "Organization details not found for ticket" });
    }
    const orgDetails = organizationByTicket[0];

    // Retrieve roles excluding role 10 for the given study and organization
    const roles = await ecrfModel.getRolesExcluding(
      10,
      orgDetails.study_enrolled_id,
      orgDetails.organization_detail_id
    );
    console.log(roles, "***check roles******");

    // Get users by roles that belong to the same study and site, and who have email notifications enabled
    const users = await ecrfModel.getUsersByRolesForAEForm(
      roles,
      orgDetails.study_enrolled_id,
      orgDetails.organization_detail_id
    );
    console.log("Users receiving emails: ", users);

    // Define the logo URL
    const logoUrl = "https://myresearchhero.org/logo/logo.png";

    // Send emails to each of the users returned by the query.
    // (Assumes that the `decrypt` function is available in your scope to decrypt the first/last names.)
    const emailPromises = users.map((user) => {
      const subject = "ECRF Answers Submitted";
      const content = `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
              .header {
                text-align: center;
                padding-bottom: 20px;
              }
              .header img {
                max-width: 150px;
              }
              .content {
                font-size: 16px;
                line-height: 1.5;
              }
              .content h1 {
                font-family: 'Georgia', serif;
                font-size: 24px;
                color: #333333;
                margin-bottom: 20px;
              }
              .content p {
                margin-bottom: 10px;
              }
              .footer {
                text-align: center;
                font-size: 14px;
                color: #999999;
                padding-top: 20px;
                border-top: 1px solid #eeeeee;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="${logoUrl}" alt="ResearchHero Logo">
              </div>
              <div class="content">
                <p>Hello ${decrypt(user.first_name)} ${decrypt(
        user.last_name
      )},</p>
                <p>ECRF answers have been submitted for ticket id ${ticketId}.</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
              </div>
            </div>
          </body>
        </html>
      `;
      return ecrfAnswerSubmitEmail(subject, user.email, content);
    });

    await Promise.all(emailPromises);

    res.status(201).json({
      message: "ECRF answers submitted and emails sent successfully",
      submissionId: result,
    });
  } catch (error) {
    if (error.message === "A submission for this ticket already exists today") {
      res.status(400).json({ message: error.message });
    } else {
      auditLog(
        req,
        "CREATE_FAILED",
        "ecrf_answers",
        null,
        req.body,
        `Failed to submit ECRF answers: ${error.message}`
      );
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  }
};

// Get ECRF submissions by ticket controller
const getEcrfSubmissionsByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const results = await ecrfModel.getEcrfSubmissionsByTicket(ticketId);

    // Group answers by submission
    const submissions = results.reduce((acc, row) => {
      if (!acc[row.submission_id]) {
        acc[row.submission_id] = {
          submissionId: row.submission_id,
          userId: row.user_id,
          ticketId: row.ticket_id,
          createdAt: row.created_at,
          answers: [],
        };
      }
      acc[row.submission_id].answers.push({
        questionId: row.question_id,
        question: row.question,
        isYesNo: row.is_yes_no,
        allowsDetails: row.allows_details,
        answer: row.answer,
      });
      return acc;
    }, {});

    res.status(200).json({
      message: "ECRF submissions retrieved successfully",
      submissions: Object.values(submissions),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  createEcrfQuestion,
  submitEcrfAnswers,
  getEcrfSubmissionsByTicket,
  getAllEcrfQuestions,
};
