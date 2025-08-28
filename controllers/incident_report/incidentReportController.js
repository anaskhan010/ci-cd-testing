const { body, param, validationResult } = require("express-validator");
const IncidentReportModel = require("../../models/incident_report/IncidentReportModel");
const organizationModel = require("../../models/organization/organizationModel.js");
const incidentReportEmail = require("../../middleware/incidentReportEmail.js");
const auditLog = require("../../middleware/audit_logger.js");
const auditLogs = require("../../middleware/auditLog_without_token.js");
const crypto = require("crypto");
const ecrfModel = require("../../models/ecrf/ecrfModel");
const jwt = require("jsonwebtoken");
const ecrfAnswerSubmitEmail = require("../../middleware/ecrfAnswerSubmitEmail.js");
const { ensureEnglish } = require("../../services/translation.service.js");

// Middleware to handle validation errors
const db = require("../../config/DBConnection3.js");

// create an Incident Report
const createIncidentReport = async (req, res) => {
  const { questions } = req.body;

  try {
    // Process each question and its options
    const results = await Promise.all(
      questions.map(async ({ question_text, options }) => {
        const createdQuestion =
          await IncidentReportModel.createIncidentReportQuestion(
            question_text,
            options
          );

        // Audit Log for each question creation
        auditLog(
          "CREATE",
          "Incident Report Question",
          null, // No old value since it's a new record
          {
            question_text: createdQuestion.question_text,
            options: createdQuestion.options,
          }, // Log the created question and its options as the new value
          `Incident report question created: ${question_text}`
        )(req, res, () => {});

        return createdQuestion;
      })
    );

    res.status(201).json({
      message: "Questions and options created successfully",
      data: results,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// get all incident reports Questions
const getAllIncidentReports = async (req, res) => {
  try {
    const results = await IncidentReportModel.getAllIncidentReports();
    res.status(200).json({
      message: "Incident reports fetched successfully",
      questions: results,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// create incident report response
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

const createIncidentReportResponse = async (req, res) => {
  console.log("Received request body:", req.body); // Log the entire request body for debugging

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
  } = req.body;

  // if (new Date(start_date) > new Date()) {
  //   return res.status(400).json({
  //     message: "Start date cannot be in the future",
  //   });
  // }

  // Check if all required fields are present
  if (!study_id || !user_id || !responses || !description) {
    return res.status(400).json({
      message: "Missing required fields",
    });
  }

  // Check if responses is an array and not empty
  if (!Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({
      message: "Invalid responses data. It should be a non-empty array.",
    });
  }

  try {
    const result = await IncidentReportModel.createIncidentReportResponse({
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
    });

    // Full details in Audit logging
   const auditNewValue = {
      study_id,
      user_id,
      description: description || "No description provided",
      incident_severety: incident_severety || "N/A",
      start_date: start_date || "N/A",
      start_time: start_time || "N/A",
      medical_issue: medical_issue || "N/A",
      end_date: end_date || "N/A",
      end_time: end_time || "N/A",
      responses: result.responses.map(response => ({
        question_id: response.question_id,
        response_text: response.response_text
      }))
    };

    // Single audit log entry for the entire incident report
    auditLog(
      "SUBMIT",
      "Incident Report Response",
      null, // No old value since it's a new record
      auditNewValue,
      `Incident report created with ${result.responses.length} responses for user_id: ${user_id}, study_id: ${study_id}`
    )(req, res, () => {});

    const user = await IncidentReportModel.getOrganizationById(user_id);

    if (!user || !user.first_name || !user.last_name || !user.email) {
      throw new Error("User not found or missing information");
    }
    const {
      first_name,
      last_name,
      email: patientEmail,
      ecrf_id,
      organization_detail_id,
    } = user;

    // Get investigator details
    let investigator_email, investigator_first_name, investigator_last_name;
    try {
      const investigator =
        await IncidentReportModel.getInvestigatorByOrganizationId(
          organization_detail_id
        );

      console.log("Investigator", investigator);
      investigator_email = investigator.investigator_email;
      investigator_first_name = investigator.investigator_first_name;
      investigator_last_name = investigator.investigator_last_name;
    } catch (investigatorError) {
      console.log("Error fetching investigator:", investigatorError.message);
      // Handle the error as needed
    }

    // Prepare email subjects
    const patientEmailSubject = `Incident Report Submission Confirmation`;
    const investigatorEmailSubject = `Incident Report Submission by Subject eCRF ID: ${ecrf_id}`;

    // Prepare email contents
    const logoUrl = "https://myresearchhero.org/logo/logo.png";

    const patientEmailContent = `
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
            <h1>Dear ${first_name} ${last_name},</h1>
            <p>Thank you for submitting your incident report. We have received your submission and our team will review it shortly.</p>
            <p>If you have any questions or need further assistance, please feel free to contact us.</p>
            <p>Best regards,</p>
            <p>The ResearchHero Team</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const investigatorEmailContent = `
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
            <h1>Dear ${investigator_first_name} ${investigator_last_name},</h1>
            <p>We wanted to inform you that subject<strong>eCRF ID:  ${ecrf_id} </strong> has submitted an incident report. Please review the details at your earliest convenience.</p>
            <p>If you have any questions or require further information, please feel free to reach out.</p>
            <p>Thank you for your prompt attention to this matter.</p>
            <p>Best regards,</p>
            <p>The ResearchHero Team</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to patient
    try {
      const emailResponse = await incidentReportEmail(
        patientEmailSubject,
        patientEmail,
        patientEmailContent
      );
      console.log("Email sent to patient:", emailResponse);
    } catch (emailError) {
      console.log("Email sending to patient failed:", emailError.message);
    }

    if (investigator_email) {
      try {
        const emailResponse = await incidentReportEmail(
          investigatorEmailSubject,
          investigator_email,
          investigatorEmailContent
        );
        console.log("Email sent to investigator:", emailResponse);
      } catch (emailError) {
        console.log(
          "Email sending to investigator failed:",
          emailError.message
        );
      }
    }

    const excludedRoleIds = [10];

    try {
      const users =
        await IncidentReportModel.getUsersByRoleIdsForIncidentReportResponse(
          excludedRoleIds,
          organization_detail_id,
          study_id,
          user_id
        );

      if (users && users.length > 0) {
        console.log(">>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<");
        console.log("Users found with specified roles to send emails:", users);
        console.log(">>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<");

        // Prepare email subject
        const emailSubject = `Incident Report Submission by Subject eCRF ID: ${ecrf_id}`;

        // For each user, send email
        for (const user of users) {
          const {
            email,
            first_name: userFirstName,
            last_name: userLastName,
          } = user;

          // Prepare email content
          const emailContent = `
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
                  <h1>Dear ${decrypt(userFirstName)} ${decrypt(
            userLastName
          )},</h1>
                  <p>We wanted to inform you that subject <strong>eCRF ID:  ${ecrf_id}</strong> has submitted an incident report. Please review the details at your earliest convenience.</p>
                  <p>If you have any questions or require further information, please feel free to reach out.</p>
                  <p>Thank you for your prompt attention to this matter.</p>
                  <p>Best regards,</p>
                  <p>The ResearchHero Team</p>
                </div>
                <div class="footer">
                  &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
                </div>
              </div>
            </body>
            </html>
          `;

          try {
            const emailResponse = await incidentReportEmail(
              emailSubject,
              email,
              emailContent
            );
            console.log(`Email sent to ${email}:`, emailResponse);
          } catch (emailError) {
            console.log(
              `Email sending to ${email} failed:`,
              emailError.message
            );
          }
        }
      } else {
        console.log("No users found with specified roles to send emails.");
      }
    } catch (error) {
      console.error("Error sending emails to other roles:", error);
    }

    res.status(201).json({
      message: "Incident Report Responses created successfully",
      result: result,
    });
  } catch (error) {
    console.error("Error creating incident report responses:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getHistoryTicketsController = async (req, res) => {
  const { ticket_id } = req.params;
  try {
    const result = await IncidentReportModel.getTicketHistory(ticket_id);
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};

const updateHistoryTicketController = async (req, res) => {
  console.log("Received request body:", req.body); // Log the entire request body for debugging

  const { user_id, actionType, status, history_text, ticket_id } = req.body;

  // Validate required fields
  if (!user_id || !actionType || !status || !history_text || !ticket_id) {
    return res.status(400).json({
      message:
        "Missing required fields: user_id, actionType, status, history_text, ticket_id",
    });
  }
  
  // Ensure history_text is in English
  let translatedHistory_text = history_text;
  let detectedLang = "en";
  let originalHistoryText = history_text;

  try {
    const result = await ensureEnglish(history_text);
    translatedHistory_text = result.translated;
    detectedLang = result.detectedLang;
    originalHistoryText = result.original;
  } catch (error) {
    console.error("Error updating history ticket:", error.message);
  }

  try {
    // Update the ticket history in the database
    const result = await IncidentReportModel.updateHistoryTicket(
      user_id,
      actionType,
      status,
      history_text,
      ticket_id
    );

    // Retrieve details of the ticket to get organization and study info
    const ticketInfo = await IncidentReportModel.getOrganizationByTicket(
      ticket_id
    );
    const { organization_detail_id, study_enrolled_id } = ticketInfo[0];

    // Retrieve the details of the user who performed the update
    const orgUser = await IncidentReportModel.getOrganizationById(user_id);
    const { first_name, last_name } = orgUser; // assuming it returns an array

    const newValue = {
      user_id,
      actionType,
      status,
      history_text,
      ticket_id,
    };

    auditLogs(
      "UPDATE",
      "Ticket History",
      null,
      newValue,
      `Ticket #${ticket_id} updated by user_id: ${user_id}`
    )(req, res, () => {});

    // Define email subject and logo URL
    const emailSubject = `Ticket #${ticket_id} - ${actionType} Update`;
    const logoUrl = "https://myresearchhero.org/logo/logo.png";

    // Prepare HTML email content for the ticket update notification
    const emailContent = `
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
            <h1>Ticket #${ticket_id} Updated</h1>
            <p><strong>Action Type:</strong> ${actionType}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>History:</strong> ${history_text}</p>
            <p><strong>Updated By:</strong> ${first_name} ${last_name}</p>
            <p>If you have any questions or need further assistance, please feel free to contact us.</p>
            <p>Best regards,</p>
            <p>The ResearchHero Team</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Fetch all users (excluding role_id 10) to send the email
    const excludedRoleIds = [10]; // Exclude 'Subject'
    console.log(
      "Study enrolled id:",
      study_enrolled_id,
      "Organization detail id:",
      organization_detail_id
    );

    // Pass the submitting user's id as the fourth parameter to exclude it
    const usersToEmail =
      await IncidentReportModel.getUsersByRoleIdsForUpdateTicketHistory(
        excludedRoleIds,
        organization_detail_id,
        study_enrolled_id,
        user_id
      );

    if (usersToEmail && usersToEmail.length > 0) {
      console.log(`Found ${usersToEmail.length} users to send emails to.`);
      console.log(usersToEmail, "usersToEmail");

      for (const targetUser of usersToEmail) {
        const {
          email,
          first_name: userFirstName,
          last_name: userLastName,
        } = targetUser;
        const decryptedFirstName = decrypt(userFirstName);
        const decryptedLastName = decrypt(userLastName);
        
        const languageMap = {
          en: "English",
          ro: "Romanian",
          es: "Spanish"
        };

        const detectedLangName = languageMap[detectedLang.toLowerCase()] || detectedLang;

        // Personalize email content for each recipient
        const personalizedEmailContent = `
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
                <h1>Dear ${decryptedFirstName} ${decryptedLastName},</h1>
                <p>We wanted to inform you that Ticket #${ticket_id} has been updated.</p>
                <p><strong>Action Type:</strong> ${actionType}</p>
                <p><strong>Status:</strong> ${status}</p>
                ${
                  detectedLang.toLowerCase() === "en"
                    ? `<p><strong>History:</strong> ${translatedHistory_text}</p>`
                    : `
                      <p><strong>History (Original - ${detectedLangName}):</strong> ${originalHistoryText}</p>
                      <p><strong>History (Auto-Translated to English):</strong> ${translatedHistory_text}</p>
                    `
                }
                <p><strong>Updated By:</strong> ${first_name} ${last_name}</p>
                <p>For technical support or any assistance, please contact:</p>
                <p>
                  Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
                  Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
                </p>
                <p>
                  Phone Support is available 24/7.
                </p>
                <p>Best regards,</p>
                <p>The ResearchHero Team</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          const emailResponse = await incidentReportEmail(
            emailSubject,
            email,
            personalizedEmailContent
          );
          console.log(`Email sent to ${email}:`, emailResponse);
        } catch (emailError) {
          console.error(
            `Email sending to ${email} failed:`,
            emailError.message
          );
        }
      }
    } else {
      console.log("No users found with specified roles to send emails.");
    }

    // Respond with success
    res.status(200).json({
      message: "Ticket History Updated Successfully",
      result: result,
    });
  } catch (error) {
    console.error("Error updating ticket history:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const updateAdverseEvenetTicketingStatus = async (req, res) => {
  const { ticket_id } = req.params;
  const { status } = req.body;

  console.log(status, "status for eCRF submission");
  try {
    const oldTicket = await IncidentReportModel.getAdverseTicketingSystemById(
      ticket_id
    );
    if (!oldTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const oldStatus = oldTicket.status;

    const result = await IncidentReportModel.updateAdverseTicketingSystem(
      ticket_id,
      status
    );

    const oldValue = { ticket_id, status: oldStatus };
    const newValue = { ticket_id, status };

    auditLog(
      "UPDATE",
      "eCRF Submission Status",
      oldValue,
      newValue,
      `Ticket status updated for ticket ID: ${ticket_id}`
    )(req, res, () => {});

    res.status(201).json({
      message: "Incident Report Responses updated successfully",
      result: result,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllIncidentReportResponses = async (req, res) => {
  try {
    // 1) Extract token and decode
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const personelId = decoded.user_id;

    const results = await IncidentReportModel.getAllIncidentReportResponsesAll(
      personelId
    );

    // 3) Send response
    res.status(200).json({
      status: true,
      message: "Incident Responses retrieved successfully",
      responses: { responses: results.responses },
    });
  } catch (error) {
    console.error("Error getting incident responses:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// get all incident report responses for investigator
const getAllIncidentReportResponsesForInvestigator = async (req, res) => {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  try {
    const results =
      await IncidentReportModel.getAllIncidentReportResponsesForInvestigator(
        investigatorId
      );
    res.status(200).json({
      message: "Incident Responses retrieved successfully",
      responses: results,
    });
  } catch (error) {
    console.error("Error getting incident responses:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// get survey response by user_id
const getIncidentReportResponseByUserId = async (req, res) => {
  const { ticket_id } = req.params;

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

    const token_user_id = decoded.user_id;

    const result = await IncidentReportModel.getIncidentReportResponseByUserId(
      ticket_id,
      token_user_id
    );
    res.status(200).json({ message: "Survey fetched", result });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const updateStatusAdverseEventTicket = async (req, res) => {
  const { ticket_id } = req.params;
  const { status } = req.body;

  console.log(status, "status for eCRF submission");

  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const user_id = decoded.user_id;

  const ticketInfo = await IncidentReportModel.getOrganizationByTicket(
    ticket_id
  );
  const { organization_detail_id, study_enrolled_id } = ticketInfo[0];

  // Retrieve details of the user who performed the update
  const orgUser = await IncidentReportModel.getOrganizationById(user_id);
  const { first_name, last_name } = orgUser;

  try {
    // Fetch current ticket information for audit logging
    const oldTicket = await IncidentReportModel.getAdverseTicketingSystemById(
      ticket_id
    );
    if (!oldTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const oldStatus = oldTicket.status;

    let isValidTransition = true;
    let errorMessage = "";

    if (status == 'Closed') {
      // Return error if ecrf_submission is still pending
      if (ticketInfo[0].ecrf_submission == 'Pending') {
        return res.status(400).json({
          message: 'e-CRF Submission is pending. Please complete e-CRF Submission before updating AE.',
        });
      }
    }
    // Check if current status is "Open"
    if (oldStatus === "Open") {
      // From Open, only Under Process and Closed are allowed
      if (status !== "Under Process" && status !== "Closed") {
        isValidTransition = false;
        errorMessage = `Cannot change status from 'Open' to '${status}'. Only 'Under Process' and 'Closed' are allowed.`;
      }
    }
    
    // Check if current status is "Closed"
    else if (oldStatus === "Closed") {
      // From Closed, only Re-Opened is allowed
      if (status !== "Re-opened") {
        isValidTransition = false;
        errorMessage = `Cannot change status from 'Closed' to '${status}'. Only 'Re-Opened' is allowed.`;
      }
    }
    // Check if current status is "Under Process"
    else if (oldStatus === "Under Process") {
      // From Under Process, only Closed is allowed
      if (status !== "Closed") {
        isValidTransition = false;
        errorMessage = `Cannot change status from 'Under Process' to '${status}'. Only 'Closed' is allowed.`;
      }
    }
    // For Re-Opened status or any other status not explicitly handled
    else {
      // Default behavior for other statuses - add specific rules if needed
    }

    // Return error if transition is invalid
    if (!isValidTransition) {
      return res.status(400).json({
        message: errorMessage,
      });
    }

    const excludedRoleIds = [10]; // Exclude 'Subject'
    console.log(
      "Study enrolled id:",
      study_enrolled_id,
      "Organization detail id:",
      organization_detail_id
    );

    // Fetch users for notification (passing submitting user to exclude them)
    const usersToEmail =
      await IncidentReportModel.getUsersByRoleIdForUpdateAETicketStatus(
        excludedRoleIds,
        organization_detail_id,
        study_enrolled_id
      );

    if (usersToEmail && usersToEmail.length > 0) {
      console.log(`Found ${usersToEmail.length} users to send emails to.`);
      console.log("Users to email:", usersToEmail);

      for (const targetUser of usersToEmail) {
        const {
          email,
          first_name: userFirstName,
          last_name: userLastName,
        } = targetUser;
        const decryptedFirstName = decrypt(userFirstName);
        const decryptedLastName = decrypt(userLastName);

        const emailSubject = `Ticket #${ticket_id} Update`;
        const logoUrl = "https://myresearchhero.org/logo/logo.png";

        // Personalize email content for each recipient
        const personalizedEmailContent = `
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
                <h1>Dear ${decryptedFirstName} ${decryptedLastName},</h1>
                <p>We wanted to inform you that Ticket #${ticket_id} has been updated.</p>
                <p><strong>Status:</strong> ${status}</p>
                <p><strong>Updated By:</strong> ${first_name} ${last_name}</p>
                <p>If you have any questions or need further assistance, please feel free to contact us.</p>
                <p>Best regards,</p>
                <p>The ResearchHero Team</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        try {
          const emailResponse = await incidentReportEmail(
            emailSubject,
            email,
            personalizedEmailContent
          );
          console.log(`Email sent to ${email}:`, emailResponse);
        } catch (emailError) {
          console.error(
            `Email sending to ${email} failed:`,
            emailError.message
          );
        }
      }
    } else {
      console.log("No users found with specified roles to send emails.");
    }

    // Update the ticket status
    const result = await IncidentReportModel.updateAdverseTicketingSystemStatus(
      ticket_id,
      status
    );

    // Prepare old and new values for audit logging
    const oldValue = { ticket_id, status: oldStatus };
    const newValue = { ticket_id, status };

    // Log the status update with audit logger
    auditLog(
      "UPDATE", // Operation type
      "Ticket Status", // Table name
      oldValue, // Old value
      newValue, // New value
      `Ticket status updated for ticket ID: ${ticket_id}` // Description
    )(req, res, () => {});

    res.status(201).json({
      message: "Incident Report Responses updated successfully",
      result: result,
    });
  } catch (error) {
    console.error("Error in updateStatusAdverseEventTicket:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// const updateStatusAdverseEventTicket = async (req, res) => {
//   const { ticket_id } = req.params;
//   const { status } = req.body;

//   console.log(status, "status for eCRF submission");

//   const token = req.headers.authorization.split(" ")[1];
//   const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//   const user_id = decoded.user_id;

//   const ticketInfo = await IncidentReportModel.getOrganizationByTicket(
//     ticket_id
//   );
//   const { organization_detail_id, study_enrolled_id } = ticketInfo[0];

//   // Retrieve details of the user who performed the update
//   const orgUser = await IncidentReportModel.getOrganizationById(user_id);
//   const { first_name, last_name } = orgUser;

//   try {
//     // Fetch current ticket information for audit logging
//     const oldTicket = await IncidentReportModel.getAdverseTicketingSystemById(
//       ticket_id
//     );
//     if (!oldTicket) {
//       return res.status(404).json({ message: "Ticket not found" });
//     }

//     const oldStatus = oldTicket.status;

//     let isValidTransition = true;
//     let errorMessage = "";

//     // Check if current status is "Open"
//     if (oldStatus === "Open") {
//       // From Open, only Under Process and Closed are allowed
//       if (status !== "Under Process" && status !== "Closed") {
//         isValidTransition = false;
//         errorMessage = `Cannot change status from 'Open' to '${status}'. Only 'Under Process' and 'Closed' are allowed.`;
//       }
//     }
//     // Check if current status is "Closed"
//     else if (oldStatus === "Closed") {
//       // From Closed, only Re-Opened is allowed
//       if (status !== "Re-opened") {
//         isValidTransition = false;
//         errorMessage = `Cannot change status from 'Closed' to '${status}'. Only 'Re-Opened' is allowed.`;
//       }
//     }
//     // Check if current status is "Under Process"
//     else if (oldStatus === "Under Process") {
//       // From Under Process, only Closed is allowed
//       if (status !== "Closed") {
//         isValidTransition = false;
//         errorMessage = `Cannot change status from 'Under Process' to '${status}'. Only 'Closed' is allowed.`;
//       }
//     }
//     // For Re-Opened status or any other status not explicitly handled
//     else {
//       // Default behavior for other statuses - add specific rules if needed
//     }

//     // Return error if transition is invalid
//     if (!isValidTransition) {
//       return res.status(400).json({
//         message: errorMessage,
//       });
//     }

//     const excludedRoleIds = [10]; // Exclude 'Subject'
//     console.log(
//       "Study enrolled id:",
//       study_enrolled_id,
//       "Organization detail id:",
//       organization_detail_id
//     );

//     // Fetch users for notification (passing submitting user to exclude them)
//     const usersToEmail =
//       await IncidentReportModel.getUsersByRoleIdForUpdateAETicketStatus(
//         excludedRoleIds,
//         organization_detail_id,
//         study_enrolled_id
//       );

//     if (usersToEmail && usersToEmail.length > 0) {
//       console.log(`Found ${usersToEmail.length} users to send emails to.`);
//       console.log("Users to email:", usersToEmail);

//       for (const targetUser of usersToEmail) {
//         const {
//           email,
//           first_name: userFirstName,
//           last_name: userLastName,
//         } = targetUser;
//         const decryptedFirstName = decrypt(userFirstName);
//         const decryptedLastName = decrypt(userLastName);

//         const emailSubject = `Ticket #${ticket_id} Update`;
//         const logoUrl = "https://myresearchhero.org/logo/logo.png";

//         // Personalize email content for each recipient
//         const personalizedEmailContent = `
//           <html>
//           <head>
//             <style>
//               body {
//                 font-family: Arial, sans-serif;
//                 background-color: #f5f5f5;
//                 margin: 0;
//                 padding: 20px;
//               }
//               .container {
//                 max-width: 600px;
//                 margin: 0 auto;
//                 background-color: #ffffff;
//                 padding: 20px;
//                 border-radius: 8px;
//                 box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//               }
//               .header {
//                 text-align: center;
//                 padding-bottom: 20px;
//               }
//               .header img {
//                 max-width: 150px;
//               }
//               .content {
//                 font-size: 16px;
//                 line-height: 1.5;
//               }
//               .content h1 {
//                 font-family: 'Georgia', serif;
//                 font-size: 24px;
//                 color: #333333;
//                 margin-bottom: 20px;
//               }
//               .content p {
//                 margin-bottom: 10px;
//               }
//               .footer {
//                 text-align: center;
//                 font-size: 14px;
//                 color: #999999;
//                 padding-top: 20px;
//                 border-top: 1px solid #eeeeee;
//               }
//             </style>
//           </head>
//           <body>
//             <div class="container">
//               <div class="header">
//                 <img src="${logoUrl}" alt="ResearchHero Logo">
//               </div>
//               <div class="content">
//                 <h1>Dear ${decryptedFirstName} ${decryptedLastName},</h1>
//                 <p>We wanted to inform you that Ticket #${ticket_id} has been updated.</p>
//                 <p><strong>Status:</strong> ${status}</p>
//                 <p><strong>Updated By:</strong> ${first_name} ${last_name}</p>
//                 <p>If you have any questions or need further assistance, please feel free to contact us.</p>
//                 <p>Best regards,</p>
//                 <p>The ResearchHero Team</p>
//               </div>
//               <div class="footer">
//                 &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
//               </div>
//             </div>
//           </body>
//           </html>
//         `;

//         try {
//           const emailResponse = await incidentReportEmail(
//             emailSubject,
//             email,
//             personalizedEmailContent
//           );
//           console.log(`Email sent to ${email}:`, emailResponse);
//         } catch (emailError) {
//           console.error(
//             `Email sending to ${email} failed:`,
//             emailError.message
//           );
//         }
//       }
//     } else {
//       console.log("No users found with specified roles to send emails.");
//     }

//     // Update the ticket status
//     const result = await IncidentReportModel.updateAdverseTicketingSystemStatus(
//       ticket_id,
//       status
//     );

//     // Prepare old and new values for audit logging
//     const oldValue = { ticket_id, status: oldStatus };
//     const newValue = { ticket_id, status };

//     // Log the status update with audit logger
//     auditLog(
//       "UPDATE", // Operation type
//       "Ticket Status", // Table name
//       oldValue, // Old value
//       newValue, // New value
//       `Ticket status updated for ticket ID: ${ticket_id}` // Description
//     )(req, res, () => {});

//     res.status(201).json({
//       message: "Incident Report Responses updated successfully",
//       result: result,
//     });
//   } catch (error) {
//     console.error("Error in updateStatusAdverseEventTicket:", error);
//     res
//       .status(500)
//       .json({ message: "Internal Server Error", error: error.message });
//   }
// };

const getAESIQuestionsWithOptions = async (req, res) => {
  try {
    const results =
      await IncidentReportModel.getInvestigatorAESIQuestionOption();
    console.log(results);
    // Grouping questions with their respective options
    const questions = results.reduce((acc, row) => {
      const { question_text, question_id, option_id, option_text } = row;
      if (!acc[question_text]) {
        acc[question_text] = { question_id, question_text, options: [] };
      }
      acc[question_text].options.push({ option_id, option_text });
      return acc;
    }, {});

    return res.status(200).json(Object.values(questions));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const submitAESIQuestionResponses = async (req, res) => {
  try {
    const { ticket_id, responses } = req.body;

    const oldValue = null;

    const formattedResponses = responses.map((response) => ({
      ticket_id,
      question_id: response.question_id,
      option_id: response.option_id || "",
      description: response.description || "",
    }));

    const newValue = { ticket_id, formattedResponses };

    await IncidentReportModel.saveAESIQuestionResponses(formattedResponses);

    auditLog(
      "CREATE",
      "AESI Reponses",
      oldValue,
      newValue,
      req.body.reason || "No Reason Provided"
    )(req, res, () => {});

    // Email sending logic
    const roles = await IncidentReportModel.getRolesExcluding(10);

    const organizationByTicketId =
      await IncidentReportModel.getOrganizationByTicket(ticket_id);

    console.log("AESI Responses by Ticket ID:", organizationByTicketId);

    const users = await IncidentReportModel.getUsersByRoles(
      roles,
      organizationByTicketId[0].study_enrolled_id
    );

    console.log("=====================");
    console.log(users);
    console.log("=====================");

    const filteredUsersByOrganization = users.filter(
      (user) =>
        user.organization_detail_id ===
        organizationByTicketId[0].organization_detail_id
    );

    console.log("AESI Responses email to Users:", users);

    console.log(
      "-------------------------------------------------------------"
    );

    console.log(
      "AESI Responses email to Filtered Users:",
      filteredUsersByOrganization
    );

    const logoUrl = "https://myresearchhero.org/logo/logo.png";
    const emailPromises = filteredUsersByOrganization.map((user) => {
      const subject = "AESI Question Responses Submitted";
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
                <p>AESI question responses have been submitted for ticket id ${ticket_id}.</p>
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

    return res
      .status(201)
      .json({ message: "Responses submitted and emails sent successfully" });
  } catch (error) {
    console.error(error);
    auditLog(
      req,
      "CREATE_FAILED",
      "ecrf_answers",
      null,
      req.body,
      `Failed to submit ECRF answers: ${error.message}`
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getAllAesiQuestionResponses = async (req, res) => {
  const { ticket_id } = req.params;
  try {
    const results = await IncidentReportModel.getAllAesiQuestionResponses(
      ticket_id
    );
    res.status(200).json({
      message: "Incident Responses retrieved successfully",
      responses: results,
    });
  } catch (error) {
    console.error("Error getting incident responses:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

function formatDate(dateString) {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

async function checkAndSendEmails() {
  try {
    // 1) Get all pending tickets with their organization_detail_id / study_enrolled_id
    const tickets = await IncidentReportModel.getPendingTickets();
    if (!tickets || tickets.length === 0) {
      console.log("No pending tickets found.");
      return;
    }

    console.log(
      `Found ${tickets.length} pending/under-process tickets in total.`
    );

    // 2) Group tickets by organization_detail_id + study_enrolled_id
    const groupedTickets = {};
    tickets.forEach((ticket) => {
      const groupKey = `${ticket.organization_detail_id}::${ticket.study_enrolled_id}`;
      if (!groupedTickets[groupKey]) {
        groupedTickets[groupKey] = [];
      }
      groupedTickets[groupKey].push(ticket);
    });

    // We exclude certain roles, e.g. [10]
    const excludedRoleIds = [10];

    // 3) For each group, get the users and send them the grouped tickets
    for (const groupKey of Object.keys(groupedTickets)) {
      const [orgId, studyId] = groupKey.split("::");
      const group = groupedTickets[groupKey]; // Tickets belonging to this org/study pair

      console.log(
        `\n===== Processing Group: orgId=${orgId}, studyId=${studyId} =====`
      );
      console.log(`Number of tickets in this group: ${group.length}`);

      // For debug: list the ticket IDs in this group
      const ticketIds = group.map((t) => t.ticket_id);
      console.log(`Ticket IDs: [${ticketIds.join(", ")}]`);

      // 3a) Fetch users with matching organization_detail_id & study_enrolled_id
      const users =
        await IncidentReportModel.getAllUsersByRoleIdsPendingTickets(
          excludedRoleIds,
          orgId,
          studyId
          // Note: submittingUserId can be passed if needed
        );

      if (!users || users.length === 0) {
        console.log(
          `No users found for org_detail_id=${orgId}, study_id=${studyId}. Skipping...`
        );
        continue;
      }

      console.log(`Number of users in this group: ${users.length}`);
      console.log(users, "users in this group");

      // 3b) Build email content for these tickets
      const subject = "Pending Tickets Notification";
      let content = `
        <h3>The following tickets are pending or under process:</h3>
        <table border="1" style="border-collapse: collapse;">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Status</th>
              <th>Start Date</th>
            </tr>
          </thead>
          <tbody>
      `;

      group.forEach((ticket, index) => {
        const rowColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        content += `
          <tr style="background-color:${rowColor}">
            <td>${ticket.ticket_id}</td>
            <td>${ticket.status}</td>
            <td>${formatDate(ticket.start_date)}</td>
          </tr>
        `;
      });

      content += `
          </tbody>
        </table>
      `;

      // 3c) Send email to each user in this group
      for (const user of users) {
        const toEmail = user.email;
        console.log(
          `Sending email to user=${toEmail} for orgId=${orgId}, studyId=${studyId}. Tickets: [${ticketIds.join(
            ", "
          )}]`
        );

        await incidentReportEmail(subject, toEmail, content);

        console.log(`Email successfully sent to ${toEmail}`);
      }
    }
  } catch (error) {
    console.error("Error in checkAndSendEmails:", error);
  }
}

const getIncidentLogsByUserId = async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await IncidentReportModel.getIncidentLogsByUseridModel(
      user_id
    );

    res.status(200).json({ result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createIncidentReport,
  getAllIncidentReports,
  createIncidentReportResponse,
  getAllIncidentReportResponses,
  getAllIncidentReportResponsesForInvestigator,
  getIncidentReportResponseByUserId,
  updateAdverseEvenetTicketingStatus,
  updateStatusAdverseEventTicket,
  getAESIQuestionsWithOptions,
  submitAESIQuestionResponses,
  getHistoryTicketsController,
  updateHistoryTicketController,
  getAllAesiQuestionResponses,
  checkAndSendEmails,
  getIncidentLogsByUserId,
};
