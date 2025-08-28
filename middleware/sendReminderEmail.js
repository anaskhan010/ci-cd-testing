"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const sendReminderEmail = async (to, firstName, lastName, medicationName) => {
  const subject = "Medication Reminder";
  const logoUrl = "https://myresearchhero.org/logo/logo.png";

  const options = {
    from: "info@myresearchhero.org",
    to: [to],
    subject: subject,
    html_content: `
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
            <h1>Medication Reminder</h1>
            <p>Dear ${firstName} ${lastName},</p>
            <p>This is a reminder to take your medication: <strong>${medicationName}</strong>. Please ensure that you follow the prescribed schedule.</p>
            <p>Best regards,<br>ResearchHero Team</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const service = pbMail.emailService();

  try {
    const message = pbMail.message(options);
    const response = await service.sendMessage(message);
    console.log("Email sent response:", JSON.stringify(response));
    return response.data;
  } catch (error) {
    console.error("Email sending error details:", JSON.stringify(error));
    throw new Error("Email sending failed");
  }
};

module.exports = sendReminderEmail;
