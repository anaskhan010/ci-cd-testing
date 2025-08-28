"use strict";
const dotenv = require("dotenv");
const pbMail = require("paubox-node");
const {
  encodeInternationalText,
  getEmailFontStack,
  processScaleNameForEmail
} = require("../utils/fontUtils");

dotenv.config({ path: "./config/Config.env" });

/**
 * Sends a passcode email to the recipient using Paubox
 * @param {string} to - Recipient email address
 * @param {string} passcode - The passcode to be sent
 * @param {string} firstName - Recipient's first name
 * @param {string} lastName - Recipient's last name
 * @returns {Promise} - Promise resolving to the email sending response
 */
const sendPasscodeEmail = async (
  to,
  passcode,
  firstName,
  lastName,
  scaleName = null
) => {
  const logoUrl = "https://myresearchhero.org/logo/logo.png";

  // Process scale name with proper international character handling
  const scaleData = processScaleNameForEmail(scaleName);
  const encodedFirstName = firstName ? encodeInternationalText(firstName) : "";
  const encodedLastName = lastName ? encodeInternationalText(lastName) : "";

  // Log scale processing for debugging
  console.log("Scale name processing:", {
    original: scaleName,
    encoded: scaleData.encoded,
    hasInternational: scaleData.hasInternational
  });

  // Use the processed scale name for the subject
  const subject = scaleData.encoded
    ? `${scaleData.encoded}`
    : "Your Document Signing Passcode";

  // Get the appropriate font stack for email clients
  const emailFontStack = getEmailFontStack();

  const options = {
    from: "Research Hero OTP <info@myresearchhero.org>",
    to: [to],
    subject: subject,
    html_content: `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: ${emailFontStack};
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }

            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 10px;
            }
            .passcode-container {
              background-color: #f5f7fa;
              border-radius: 5px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .passcode {
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 2px;
              color: #2c3e50;
              font-family: ${emailFontStack};
            }
            .scale-name {
              font-family: ${emailFontStack};
              font-weight: bold;
              color: #1D3557;
              font-size: 16px;
              margin: 15px 0;
              padding: 10px;
              background-color: #f8f9fa;
              border-left: 4px solid #1D3557;
              border-radius: 4px;
              text-rendering: optimizeLegibility;
            }
            .footer {
              font-size: 12px;
              color: #777;
              text-align: center;
              margin-top: 30px;
              border-top: 1px solid #eee;
              padding-top: 20px;
              font-family: ${emailFontStack};
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" alt="Research Hero Logo" class="logo">
            <h2>Document Signing Passcode</h2>
            ${scaleData.encoded ? `<div class="scale-name">Scale: ${scaleData.encoded}</div>` : ''}
          </div>

          <p>Hello ${encodedFirstName} ${encodedLastName},</p>

          <p>You have a document waiting for your signature. Please use the passcode below when prompted during the signing process:</p>

          <div class="passcode-container">
            <p class="passcode">${passcode}</p>
          </div>

          <p><strong>IMPORTANT:</strong> This passcode is strictly confidential and only intended for this recipient. It should not be shared or forwarded to anyone under any circumstances. Do not forward this email. It will expire once the document is signed.</p>

          <p>If you did not request to sign a document, please contact our support team immediately.</p>

          <p>This email contains confidential information intended only for the named recipient. If you are not the intended recipient, please delete this email and notify the sender immediately.</p>

          <p>Thank you,<br>Research Hero Team</p>

          <div class="footer">
            <p>This email contains confidential information and is intended only for the recipient specified above. The passcode provided in this email is strictly confidential and should not be shared or forwarded to anyone under any circumstances. Do not forward this email.</p>
            <p>If you received this email in error, please delete it immediately and notify the sender.</p>
            <p>&copy; ${new Date().getFullYear()} Research Hero. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
  };

  const service = pbMail.emailService();

  try {
    const message = pbMail.message(options);
    const response = await service.sendMessage(message);
    console.log("Passcode email sent response:", JSON.stringify(response));
    return response.data;
  } catch (error) {
    console.error(
      "Passcode email sending error details:",
      JSON.stringify(error)
    );
    throw new Error("Passcode email sending failed");
  }
};

module.exports = sendPasscodeEmail;
