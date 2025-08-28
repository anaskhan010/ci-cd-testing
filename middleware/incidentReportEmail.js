"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const sendEmail = async (subject, toEmail, content) => {
  const logoUrl = "https://myresearchhero.org/logo/logo.png";

  const options = {
    from: "info@myresearchhero.org",
    to: [toEmail], // Use toEmail here as a parameter
    subject: subject,
    html_content: content, // Use the content parameter directly
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

module.exports = sendEmail;
