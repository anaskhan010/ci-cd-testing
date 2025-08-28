"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
dotenv.config({ path: "./config/Config.env" });

const sendEmail = async (to, subject, text, ecrf_id) => {
  const logoUrl = "https://myresearchhero.org/logo/logo.png"; // Replace with your hosted image URL

  const tableRows = ecrf_id
    .map((patient) => {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.ecrf_id}</td>
         
        </tr>
      `;
    })
    .join("");

  const options = {
    from: "info@myresearchhero.org",
    to: [to],
    subject: subject,
    text_content: text,
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
        .patient-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .patient-table th, .patient-table td {
              padding: 8px;
              border: 1px solid #ddd;
              text-align: left;
            }
            .patient-table th {
              background-color: #f8f9fa;
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
          
            <p>${text}</p>
            <table class="patient-table">
                <thead>
                  <tr>
                    <th>ECRF ID</th>
                    
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
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
