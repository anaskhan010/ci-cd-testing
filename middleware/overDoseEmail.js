"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
const crypto = require("crypto");

dotenv.config({ path: "./config/Config.env" });

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

const overDoseEmail = function (recipients, patientData) {
  const subject = "Overdose Alert";
  const logoUrl = "https://myresearchhero.org/logo/logo.png";

  // Create table rows for each patient
  const tableRows = patientData
    .map((patient) => {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${patient.ecrf_id}</td>
         
        </tr>
      `;
    })
    .join("");

  // Create personalized emails for each recipient
  const emailPromises = recipients.map((recipient) => {
    // Decrypt recipient's first name and last name
    const decryptedFirstName = decrypt(recipient.firstName);
    const decryptedLastName = decrypt(recipient.lastName);

    const options = {
      from: "info@myresearchhero.org",
      to: [recipient.email],
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
              max-width: 800px;
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
              <h1>Overdose Alert</h1>
              <p>Dear ${decryptedFirstName} ${decryptedLastName},</p>
              <p>The following patient has taken a medication dosage that does not match the prescribed amount:</p>
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
              <p>Please review the patient's medication records and take the necessary actions.</p>
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

    return new Promise((resolve, reject) => {
      try {
        const message = pbMail.message(options);
        service
          .sendMessage(message)
          .then((response) => {
            console.log("Email sent response:", JSON.stringify(response));
            resolve(response.data);
          })
          .catch((error) => {
            console.error(
              "Email sending error details:",
              JSON.stringify(error)
            );
            reject(new Error("Email sending failed"));
          });
      } catch (error) {
        console.error("Email sending error:", error);
        reject(new Error("Email sending failed"));
      }
    });
  });

  return Promise.all(emailPromises);
};

module.exports = overDoseEmail;
