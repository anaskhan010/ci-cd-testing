"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });


const logoUrl = "https://myresearchhero.org/logo/logo.png";

const wrapHtmlTemplate = (html_content) => {
  return `
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
        .content h2 {
          font-size: 20px;
          margin-bottom: 10px;
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
          ${html_content}
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};


const sendLockedUserEmail = async (to, subject, html_content) => {

  console.log("Email sending to :", to)
  const options = {
    from: "Research Hero <info@myresearchhero.org>",
    to: [to],
    subject: subject,
    html_content: wrapHtmlTemplate(html_content),
  };

  const service = pbMail.emailService();

  try {
    const message = pbMail.message(options);
    const response = await service.sendMessage(message);
    ("Email sent response:", JSON.stringify(response));
    return response.data;
  } catch (error) {
    console.error("Email sending error details:", JSON.stringify(error));
    throw new Error("Email sending failed");
  }

};

module.exports = {
  sendLockedUserEmail
};
