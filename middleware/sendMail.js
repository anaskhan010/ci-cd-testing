"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const sendEmail = async (to, subject, firstName, lastName) => {
  const logoUrl = "https://myresearchhero.org/logo/logo.png"; // Replace with your hosted image URL

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
          .qr{
          width: 70%;
          height: 70%;
            }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="ResearchHero Logo">
          </div>
          <div class="content">
            <h1>Welcome to ResearchHero, ${firstName} ${lastName}!</h1>
            <p>Dear ${firstName} ${lastName},</p>
            <p>Thank you for registering with ResearchHero! We're excited to have you join our community and look forward to supporting your research endeavors.</p>
            <p>
              Your account is currently under review. As part of our commitment to maintaining a secure and efficient platform, each registration is individually verified. You can expect your account to be activated within the next 24 hours.
            </p>
            <p>
              Should you have any questions, our support team is here to help—just reach out to us at <a href="mailto:moe@sentrixmedia.com">moe@sentrixmedia.com</a>.
            </p>
            <p>Thank you for choosing ResearchHero. We're eager to be a part of your research journey!</p>
            <p>Warm regards,</p>
            <p>The ResearchHero Team</p>
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

module.exports = sendEmail;

// "use strict";
// const dotenv = require("dotenv");
// const pbMail = require("paubox-node");

// dotenv.config({ path: "./config/Config.env" });

// const sendEmail = async (to, subject, text) => {
//   const options = {
//     from: "info@myresearchhero.org",
//     to: [to],
//     subject: subject,
//     text_content: text,
//     html_content: `<html><head></head><body><p>${text.replace(
//       /\n/g,
//       "<br>"
//     )}</p></body></html>`,
//   };

//   const service = pbMail.emailService();

//   try {
//     const message = pbMail.message(options);
//     const response = await service.sendMessage(message);
//     console.log("Email sent response:", JSON.stringify(response));
//     return response.data;
//   } catch (error) {
//     console.error("Email sending error details:", JSON.stringify(error));
//     throw new Error("Email sending failed");
//   }
// };

// module.exports = sendEmail;
