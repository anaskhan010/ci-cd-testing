const { param, body, validationResult, header } = require("express-validator");
const registrationManagementModel = require("../../models/userRegistrationManagement/registrationManagementModel");
const axios = require("axios");
const sendEmail = require("../../middleware/AcceptedPatientEmail");
const auditLog = require("../../middleware/audit_logger.js");
const {
  sendAccountUnlockedEmailToUser,
} = require("../../services/emailService.js");
const {
  isUnlockEmailEnabledByUserId,
} = require("../../models/userAccess/userAccess.model.js");
const jwt = require("jsonwebtoken");

const validateUpdateRegistrationStatus = [
  param("id")
    .notEmpty()
    .withMessage("ID is required")
    .isInt()
    .withMessage("ID must be an integer"),
  body("status").notEmpty().withMessage("Status is required"),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const getAllAcceptedStatus = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id
    const roleId = decoded.role; // Ensure your token includes role_id

    if (!userId || !roleId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result = await registrationManagementModel.getAllAcceptedStatus(
      userId,
      roleId
    );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const getAllPendingStatus = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id
    const roleId = decoded.role; // Ensure your token includes role_id

    if (!userId || !roleId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result = await registrationManagementModel.getAllPendingStatus(
      userId,
      roleId
    );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const getPendingUsersController = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    ("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id
    const roleId = decoded.role; // Ensure your token includes role_id

    if (!userId || !roleId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result = await registrationManagementModel.fetchPendingUsersByAccess(
      userId,
      roleId
    );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const getAllDisableStatusController = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  // Decode the token
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  console.log("decoded", decoded);

  const userId = decoded.user_id; // Ensure your token includes user_id
  const roleId = decoded.role; // Ensure your token includes role_id

  if (!userId || !roleId) {
    return res.status(400).json({ error: "Invalid token payload" });
  }

  try {
    const result = await registrationManagementModel.getAllDisableStatus(
      userId,
      roleId
    );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const updateRegistrationStatus = [
  validateUpdateRegistrationStatus,
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const { status, reason, user_id } = req.body;

    console.log("Received data:", { id, status, reason });

    try {
      // Fetch the current registration status for audit logging
      const oldStatus =
        await registrationManagementModel.getRegistrationStatusById(id);
      if (!oldStatus) {
        return res
          .status(404)
          .json({ message: "Registration record not found." });
      }

      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

      const investigator_id = decoded.user_id;

      // Update the registration status in the database
      const result = await registrationManagementModel.updateRegistrationStatus(
        status,
        id,
        investigator_id,
        reason
      );
      let scheduleResponse = null;
      // Handle schedule creation for accepted status and first-time users
      if (status === "Accepted" && result.first_time === "1") {
        try {
          const token = req.headers.authorization;
          if (!token) {
            throw new Error("Authorization token not found");
          }

          const user = await registrationManagementModel.getOrganizationById(
            user_id
          );
          console.log("User data for scheduling:", user);

          if (!user) {
            throw new Error("User not found");
          }

          const { role_id, study_enrolled_id } = user;

          if (role_id === 10) {
            console.log("Creating schedule for user:", user_id);

            const scheduleData = {
              schedule_date: new Date().toISOString().split("T")[0],
              schedule_time: "09:00",
              study_enrolled_id: study_enrolled_id,
              status: "Scheduled",
              user_id: user_id,
              note: "Auto-Created Schedule",
            };

            console.log("Schedule payload:", scheduleData);

            const schedule = await axios.post(
              "http://localhost:5000/schedule/createSchedule",
              scheduleData,
              {
                headers: {
                  Authorization: token, // Remove Bearer prefix as it might already be included
                  "Content-Type": "application/json",
                },
              }
            );

            console.log("Schedule creation response:", schedule.data);
            scheduleResponse = schedule.data;
            // Log successful schedule creation
            auditLog(
              "SCHEDULE_CREATED",
              "Registration",
              null,
              { user_id, schedule: scheduleData },
              `Auto-schedule created for user ${user_id}`
            )(req, res, () => {});
          }
        } catch (scheduleError) {
          console.error("Error creating schedule:", scheduleError);

          // Log schedule creation error but don't fail the registration update
          auditLog(
            "SCHEDULE_ERROR",
            "Registration",
            null,
            { user_id, error: scheduleError.message },
            `Failed to create auto-schedule: ${scheduleError.message}`
          )(req, res, () => {});
        }
      }

      // Handle email sending for accepted status whose account's last status was Pending
      if (status === "Accepted" && oldStatus[0]?.account_status === "Pending") {
        const user = await registrationManagementModel.getOrganizationById(
          user_id
        );
        if (user) {
          const { first_name, last_name, email } = user;
          const emailSubject = `Welcome to ResearchHero!`;

          try {
            const emailResponse = await sendEmail(
              email,
              emailSubject,
              first_name,
              last_name
            );

            auditLog(
              "EMAIL_SENT",
              "Registration",
              null,
              { user_id, email, subject: emailSubject },
              `Welcome email sent to ${first_name} ${last_name} (${email})`
            )(req, res, () => {});
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            auditLog(
              "EMAIL_ERROR",
              "Registration",
              null,
              { user_id, email, subject: emailSubject },
              `Error sending welcome email: ${emailError.message}`
            )(req, res, () => {});
          }
        }
      }
      
      // Check if the account status is being changed from "Blocked" to "Accepted"
      if (status === "Accepted" && oldStatus[0]?.account_status === "Blocked") {
        console.log("Preparing to send 'Account Unlocked' email...");

        // 1) Verify email notifications are enabled for this user
        let canEmail = false;
        try {
          canEmail = await isUnlockEmailEnabledByUserId(user_id, 17); // 17 = unlocked email type
        } catch (prefErr) {
          console.error(
            "Email preference check failed; skipping email.",
            prefErr
          );
          // Optional: audit the skip
          auditLog(
            "EMAIL_PREF_CHECK_ERROR",
            "Registration",
            null,
            { user_id, email_type_id: 17 },
            "Error while checking email preferences; skipped unlocked email."
          )(req, res, () => {});
        }

        if (!canEmail) {
          // No permission or not enabled – log a no-op and continue the flow
          auditLog(
            "EMAIL_SKIPPED",
            "Registration",
            null,
            { user_id, reason: "Email not enabled for type 17" },
            "Skipped sending Account Unlocked email due to preferences."
          )(req, res, () => {});
        } else {
          // 2) Fetch user details and send
          const user = await registrationManagementModel.getOrganizationById(
            user_id
          );
          if (user) {
            const { first_name, last_name, email } = user;
            const emailSubject = "Account Unlocked";

            try {
              await sendAccountUnlockedEmailToUser(user);

              auditLog(
                "EMAIL_SENT",
                "Registration",
                null,
                { user_id, email, subject: emailSubject },
                `Account unlocked email sent to ${first_name} ${last_name} (${email})`
              )(req, res, () => {});

              console.log("Unlocked email sent.");
            } catch (emailError) {
              console.error("Error sending unlocked email:", emailError);
              auditLog(
                "EMAIL_ERROR",
                "Registration",
                null,
                { user_id, email, subject: emailSubject },
                `Error sending Account unlocked email: ${emailError.message}`
              )(req, res, () => {});
            }
          }
        }
      }

      // Log the status update
      let newStatusData = { status, reason, user_id };

      // If status is Blocked, show "locked" in the audit log
      if (status === "Blocked") {
        // Create a copy of newStatusData with status changed to "locked" for audit logging only
        newStatusData = { ...newStatusData, status: "locked" };
      }

      // Build objects with only the changed fields.
      const changedFieldsOld = {};
      const changedFieldsNew = {};

      for (const key in newStatusData) {
        // Using strict equality; if the value has changed, record it.
        if (oldStatus[key] !== newStatusData[key]) {
          changedFieldsOld[key] = oldStatus[key];
          changedFieldsNew[key] = newStatusData[key];
        }
      }

      changedFieldsNew.user_id = user_id;
      if (Object.keys(changedFieldsOld).length > 0) {
        auditLog(
          "UPDATE",
          "RegistrationStatus",
          changedFieldsOld,
          changedFieldsNew,
          `Registration status updated to ${status} for ID ${id}`
        )(req, res, () => {});
      } else {
        console.log("No changes detected for registration status audit log.");
      }

      data = {
        result: result,
        schedule: scheduleResponse,
      };

      res.status(200).send(data);
    } catch (error) {
      console.error("Error updating registration status:", error);
      auditLog(
        "UPDATE_ERROR",
        "RegistrationStatus",
        { id, status, reason, user_id },
        null,
        `Error updating registration status: ${error.message}`
      )(req, res, () => {});

      res
        .status(500)
        .send({ message: "Internal Server Error", error: error.message });
    }
  },
];

const getAllBlockedStatusController = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id
    const roleId = decoded.role; // Ensure your token includes role_id

    if (!userId || !roleId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result = await registrationManagementModel.getAllBlockedStatus(
      userId,
      roleId
    );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const getAllAwaitingStatus = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id; // Ensure your token includes user_id
    const roleId = decoded.role; // Ensure your token includes role_id

    if (!userId || !roleId) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const result =
      await registrationManagementModel.getAllAwaitingDisableStatus(
        userId,
        roleId
      );
    res.status(200).send(result);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

const getAllCountStatusController = async (req, res) => {
  try {
    const result = await registrationManagementModel.getAllCountStuatus();
    res.status(200).send({ data: result });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  getAllAcceptedStatus,
  getAllPendingStatus,
  updateRegistrationStatus,
  getAllDisableStatusController,
  getAllBlockedStatusController,
  getAllAwaitingStatus,
  getAllCountStatusController,
  getPendingUsersController
};
