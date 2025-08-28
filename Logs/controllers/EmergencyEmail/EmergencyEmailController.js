const EmergencyEmailModel = require("../../models/EmergencyEmail/EmergencyEmailModel");
const EmergencyEmail = require("../../middleware/EmergencyEmail");
const organizationModel = require("../../models/organization/organizationModel");
const auditLog = require("../../middleware/audit_logger.js");
const jwt = require("jsonwebtoken");

const emergencyEmailController = async (req, res) => {
  try {
    const { subject, date_time, description, user_id } = req.body;

    if (!subject || !date_time || !description || !user_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const tokenUser_id = decoded.user_id;
    // Get subject's information
    const user = await organizationModel.getOrganizationById(
      user_id,
      tokenUser_id
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      first_name,
      last_name,
      email,
      contact_number,
      study_enrolled_id,
      organization_detail_id,
      ecrf_id,
    } = user;

    const logoUrl = "https://myresearchhero.org/logo/logo.png"; // Replace with your hosted image URL

    // Email content for the subject
    const userHtmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
          .header { text-align: center; padding-bottom: 20px; }
          .header img { max-width: 150px; }
          .content { font-size: 16px; line-height: 1.5; }
          .content h4 { color: #333333; margin-bottom: 20px; }
          .footer { text-align: center; font-size: 14px; color: #999999; padding-top: 20px; border-top: 1px solid #eeeeee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="ResearchHero Logo">
          </div>
          <div class="content">
            <h4>Dear ${first_name} ${last_name},</h4>
            <p>We have received your emergency report submitted on ${date_time}. Our team will contact you shortly.</p>
            <h4>Best Regards,</h4>
            <h4>Research Hero Team</h4>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to the subject
    try {
      await EmergencyEmail(email, "eDiary Callback Scheduled", userHtmlContent);
    } catch (emailError) {
      console.log("Email sending failed:", emailError.message);
      return res.status(500).json({
        status: false,
        message: "Email sending failed",
        error: emailError.message,
      });
    }

    // Get all users with roles associated with the same study (excluding the subject)
    const users = await EmergencyEmailModel.getUsersByStudyId(
      study_enrolled_id,
      organization_detail_id,
      user_id
    );

    console.log("====================users=======================", users);

    // Define email content for users with roles 12, 17, 19 (include email and contact number)
    const adminHtmlContentWithDetails = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
          .header { text-align: center; padding-bottom: 20px; }
          .header img { max-width: 150px; }
          .content { font-size: 16px; line-height: 1.5; }
          .content h4 { color: #333333; margin-bottom: 20px; }
          .footer { text-align: center; font-size: 14px; color: #999999; padding-top: 20px; border-top: 1px solid #eeeeee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="ResearchHero Logo">
          </div>
          <div class="content">
            <h4>eCRF ID: ${ecrf_id}</h4>
            <h4>Email: ${email}</h4>
            <h4>Callback Date: ${date_time}</h4>
            <h4>Patient Phone Number: ${contact_number}</h4>
            <p><strong>Message:</strong> <span>${description}</span></p>
          </div>
          <h4>Research Hero Team</h4>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Define email content for other roles (remove email and contact number)
    const adminHtmlContentWithoutDetails = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
          .header { text-align: center; padding-bottom: 20px; }
          .header img { max-width: 150px; }
          .content { font-size: 16px; line-height: 1.5; }
          .content h4 { color: #333333; margin-bottom: 20px; }
          .footer { text-align: center; font-size: 14px; color: #999999; padding-top: 20px; border-top: 1px solid #eeeeee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="ResearchHero Logo">
          </div>
          <div class="content">
            <h4>eCRF ID: ${ecrf_id}</h4>
            <h4>Callback Date: ${date_time}</h4>
            <p><strong>Message:</strong> <span>${description}</span></p>
          </div>
          <h4>Research Hero Team</h4>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to each user, choosing the template based on their role.
    for (const recipient of users) {
      // Exclude users with role_id 10
      if (recipient.role_id === 10) continue;

      let emailContent;
      // Check if the role_id is one of 12, 17, or 19
      if ([12, 17, 19].includes(recipient.role_id)) {
        emailContent = adminHtmlContentWithDetails;
      } else {
        emailContent = adminHtmlContentWithoutDetails;
      }
      await EmergencyEmail(
        recipient.email,
        "eDiary Callback Scheduled",
        emailContent
      );
    }

    // Store the report in the database
    const reportId = await EmergencyEmailModel.emergencyEmailModel(
      subject,
      date_time,
      description,
      user_id
    );

    // Prepare data for audit log
    const auditData = {
      subject,
      date_time,
      description,
      user_id,
      reportId,
    };

    // Log the emergency email event
    auditLog(
      "SUBMIT",
      "Callback Schedule",
      null, // No old value as this is a creation
      auditData, // New data
      "Emergency email sent and logged successfully"
    )(req, res, () => {});

    res.status(200).json({ message: "Emergency Email Sent" });
  } catch (error) {
    console.error("Error in emergencyEmailController:", error.message || error);
    res.status(400).json({ message: "Error", error: error.message });
  }
};

// const emergencyEmailController = async (req, res) => {
//   try {
//     const { subject, date_time, description, user_id } = req.body;

//     if (!subject || !date_time || !description || !user_id) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const tokenUser_id = decoded.user_id;
//     // Get subject's information
//     const user = await organizationModel.getOrganizationById(
//       user_id,
//       tokenUser_id
//     );
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const {
//       first_name,
//       last_name,
//       email,
//       contact_number,
//       study_enrolled_id,
//       ecrf_id,
//     } = user;

//     const logoUrl = "https://myresearchhero.org/logo/logo.png"; // Replace with your hosted image URL

//     // Email content for the subject
//     const userHtmlContent = `
//       <html>
//       <head>
//         <style>
//           body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
//           .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
//           .header { text-align: center; padding-bottom: 20px; }
//           .header img { max-width: 150px; }
//           .content { font-size: 16px; line-height: 1.5; }
//           .content h4 { color: #333333; margin-bottom: 20px; }
//           .footer { text-align: center; font-size: 14px; color: #999999; padding-top: 20px; border-top: 1px solid #eeeeee; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <img src="${logoUrl}" alt="ResearchHero Logo">
//           </div>
//           <div class="content">
//             <h4>Dear ${first_name} ${last_name},</h4>
//             <p>We have received your emergency report submitted on ${date_time}. Our team will contact you shortly.</p>
//             <h4>Best Regards,</h4>
//             <h4>Research Hero Team</h4>
//           </div>
//           <div class="footer">
//             &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     // Send email to the subject
//     try {
//       await EmergencyEmail(email, "eDiary Callback Scheduled", userHtmlContent);
//     } catch (emailError) {
//       console.log("Email sending failed:", emailError.message);
//       return res.status(500).json({
//         status: false,
//         message: "Email sending failed",
//         error: emailError.message,
//       });
//     }

//     // Get all users with roles associated with the same study (excluding the subject)
//     const users = await EmergencyEmailModel.getUsersByStudyId(
//       study_enrolled_id,
//       user_id
//     );

//     console.log("====================users=======================", users);

//     // Email content for other roles
//     const adminHtmlContent = `
//       <html>
//       <head>
//         <style>
//           body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
//           .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
//           .header { text-align: center; padding-bottom: 20px; }
//           .header img { max-width: 150px; }
//           .content { font-size: 16px; line-height: 1.5; }
//           .content h4 { color: #333333; margin-bottom: 20px; }
//           .footer { text-align: center; font-size: 14px; color: #999999; padding-top: 20px; border-top: 1px solid #eeeeee; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <div class="header">
//             <img src="${logoUrl}" alt="ResearchHero Logo">
//           </div>
//           <div class="content">
//             <h4>eCRF ID: ${ecrf_id}</h4>
//             <h4>Email: ${email}</h4>
//             <h4>Callback Date: ${date_time}</h4>
//             <h4>Patient Phone Number: ${contact_number}</h4>
//             <p><strong>Message:</strong> <span>${description}</span></p>
//           </div>
//           <h4>Research Hero Team</h4>
//           <div class="footer">
//             &copy; ${new Date().getFullYear()} ResearchHero. All rights reserved.
//           </div>
//         </div>
//       </body>
//       </html>
//     `;

//     // Send email to each user
//     for (const user of users) {
//       await EmergencyEmail(
//         user.email,
//         "eDiary Callback Scheduled",
//         adminHtmlContent
//       );
//     }

//     // Store the report in the database
//     const reportId = await EmergencyEmailModel.emergencyEmailModel(
//       subject,
//       date_time,
//       description,
//       user_id
//     );

//     // Prepare data for audit log
//     const auditData = {
//       subject,
//       date_time,
//       description,
//       user_id,
//       reportId,
//     };

//     // Log the emergency email event
//     auditLog(
//       "SUBMIT",
//       "Callback Schedule",
//       null, // No old value as this is a creation
//       auditData, // New data
//       "Emergency email sent and logged successfully"
//     )(req, res, () => {});

//     res.status(200).json({ message: "Emergency Email Sent" });
//   } catch (error) {
//     console.error("Error in emergencyEmailController:", error.message || error);
//     res.status(400).json({ message: "Error", error: error.message });
//   }
// };

module.exports = { emergencyEmailController };
