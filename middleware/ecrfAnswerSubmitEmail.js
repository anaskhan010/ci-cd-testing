// sendEmail.js
"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const ecrfAnswerSubmitEmail = async (subject, toEmail, content) => {
  const options = {
    from: "info@myresearchhero.org",
    to: [toEmail],
    subject: subject,
    html_content: content,
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

module.exports = ecrfAnswerSubmitEmail;
