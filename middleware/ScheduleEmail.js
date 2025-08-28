// "use strict";
// const dotenv = require("dotenv");
// const pbMail = require("paubox-node");
// dotenv.config({ path: "./config/Config.env" });

// const sendEmail = async (to, subject, firstName, lastName) => {
//   const logoUrl = "https://myresearchhero.org/logo/logo.png";

//   const options = {
//     from: "info@myresearchhero.org",
//     to: [to],
//     subject: subject,

//     html_content: `
//       <html>
//       <head>
//         <style>
//           body {
//             font-family: Arial, sans-serif;
//             background-color: #f5f5f5;
//             margin: 0;
//             padding: 20px;
//           }
//           .container {
//             max-width: 600px;
//             margin: 0 auto;
//             background-color: #ffffff;
//             padding: 20px;
//             border-radius: 8px;
//             box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//           }
//           .header {
//             text-align: center;
//             padding-bottom: 20px;
//           }
//           .header img {
//             max-width: 150px;
//           }
//           .content {
//             font-size: 16px;
//             line-height: 1.5;
//           }
//           .content h1 {
//             font-family: 'Georgia', serif;
//             font-size: 24px;
//             color: #333333;
//             margin-bottom: 20px;
//           }
//           .content p {
//             margin-bottom: 10px;
//           }
//           .footer {
//             text-align: center;
//             font-size: 14px;
//             color: #999999;
//             padding-top: 20px;
//             border-top: 1px solid #eeeeee;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <img src="${logoUrl}" alt="ResearchHero Logo">
//           </div>
//           <div class="content">
//             <h1>Dear Investigator!</h1>
//             <p>A new patient, ${firstName} ${lastName}, has been scheduled for an appointment. Please review the details at your earliest convenience. </p>

//             <p>Thank you for your attention.</p>
//             <p>Best regards,</p>
//             <p>The ResearchHero Team</p>
//           </div>
//           <div class="footer">
//             &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
//           </div>
//         </div>
//       </body>
//       </html>
//     `,
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

"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const sendEmail = async (to, subject, firstName, lastName) => {
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
            <h1>Dear ${firstName} ${lastName}!</h1>
            <p>Your appointment has been scheduled. Please review the details on your ResearchHero Application at your earliest convenience. </p>
            
            <p>Thank you for your attention.</p>
            <p>Best regards,</p>
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
