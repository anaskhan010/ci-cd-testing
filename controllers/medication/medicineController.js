const db = require("../../config/DBConnection3.js");

const { body, param, validationResult } = require("express-validator");
var medicineModel = require("../../models/medication/medicineModel.js");
const organizationModel = require("../../models/organization/organizationModel.js");
const sendEmail = require("../../middleware/MedicationTracker.js");
const auditLog = require("../../middleware/audit_logger.js");
const cron = require("node-cron");
const sendReminderEmail = require("../../middleware/sendReminderEmail.js");
const medicationLogEmail = require("../../middleware/mediciationLogEmail.js");
const crypto = require("crypto");
const overDoseEmail = require("../../middleware/overDoseEmail.js");
var jwt = require("jsonwebtoken");
// Validation rules
const validateCreateMedicine = [
  body("medication_name").notEmpty().withMessage("Medication name is required"),
  body("dosage").notEmpty().withMessage("Dosage is required"),
  // body("frequency").notEmpty().withMessage("Frequency is required"),
  body("note").optional(),
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required")
    .isNumeric()
    .withMessage("User ID must be a number"),
];

const validateGetMedicationById = [
  param("id")
    .notEmpty()
    .withMessage("ID is required")
    .isNumeric()
    .withMessage("ID must be a number"),
];

const validateGetMedicationByUserId = [
  param("id")
    .notEmpty()
    .withMessage("User ID is required")
    .isNumeric()
    .withMessage("User ID must be a number"),
];

const validateUpdateMedication = [
  param("medication_id")
    .notEmpty()
    .withMessage("Medication ID is required")
    .isNumeric()
    .withMessage("Medication ID must be a number"),
  body("medication_name").notEmpty().withMessage("Medication name is required"),
  body("dosage").notEmpty().withMessage("Dosage is required"),
  // body("frequency").notEmpty().withMessage("Frequency is required"),
  body("note").optional(),
];

const validateDeleteMedication = [
  param("id")
    .notEmpty()
    .withMessage("ID is required")
    .isNumeric()
    .withMessage("ID must be a number"),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: false, errors: errors.array() });
  }
  next();
};

const createMedicineLogic = async (params, req, res) => {
  const {
    medication_name,
    dosage,
    dosage_times,
    frequencyType,
    frequencyTime,
    frequencyCondition,
    dosageType,
    allot_medicine,
    route,
    note,
    investigator_id,
    user_id,
    tracker_time,
  } = params;

  console.log("Received request to create medicine:", params);

  // Validate frequency
  const validFrequencies = ["QD", "BID", "TID", "QID"];
  if (!validFrequencies.includes(frequencyType)) {
    const errorMsg = "Invalid frequency value.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Determine the expected number of dosage times based on frequency
  const frequencyMap = {
    QD: 1,
    BID: 2,
    TID: 3,
    QID: 4,
  };
  const expectedDosageTimes = frequencyMap[frequencyType];

  // Validate dosage_times
  if (
    !Array.isArray(dosage_times) ||
    dosage_times.length !== expectedDosageTimes
  ) {
    const errorMsg = `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Create the medicine entry in the database
  const result = await medicineModel.createMedicine(
    medication_name,
    dosage,
    dosage_times,
    frequencyType,
    frequencyTime,
    frequencyCondition,
    dosageType,
    allot_medicine,
    route,
    note,
    user_id,
    investigator_id,
    tracker_time
  );

  const newData = {
    medication_name,
    dosage,
    dosage_times,
    frequencyType,
    frequencyTime,
    frequencyCondition,
    dosageType,
    allot_medicine,
    route,
    note,
    investigator_id,
    user_id,
    tracker_time,
  };

  // Log the action
  await auditLog(
    "CREATE",
    "Manually medication Created",
    null,
    newData,
    "Manually medication created"
  )(req, res, () => {});

  // Send an initial email to the user
  const user = await medicineModel.getOrganizationById(user_id);
  const { email, first_name, last_name } = user;
  await sendEmail(
    email,
    "New Medication Assigned",
    `You have been assigned ${medication_name}. Please follow the prescribed dosage times.`,
    first_name,
    last_name
  );

  return result;
};

const createMedicine = async (req, res) => {
  try {
    const result = await createMedicineLogic(req.body, req, res);
    res.status(201).json({
      message: "Medicine created successfully",
      medicine: result,
    });
  } catch (error) {
    console.error("Error creating medicine:", error.message);
    res.status(500).json({ error: error.message });
  }
};

var getAllMedication = async function (req, res) {
  try {
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const userId = decoded.user_id;

    const result = await medicineModel.getAllMedication(userId);
    res.status(200).json({ medication: result });
  } catch (error) {
    console.error("Error in getAllMedication:", error);
    res.status(500).json({ error: error.message });
  }
};

// var getAllMedication = async function (req, res) {
//   try {
//     var result = await medicineModel.getAllMedication();
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// get all medication for investigator
var getAllMedicationForInvestigator = async function (req, res) {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  try {
    var result = await medicineModel.getAllMedicationForInvestigator(
      investigatorId
    );
    res.status(200).json({ medication: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get medication by id
var getMedicationById = async function (req, res) {
  var id = req.params.id;
  try {
    var result = await medicineModel.getMedicationById(id);
    res.status(200).json({ medication: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET medication by user id
var getMedicationByUserId = async function (req, res) {
  var id = req.params.id;

  try {
    var result = await medicineModel.getMedicationByUserId(id);
    res.status(200).json({ medication: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// update medication
// var updateMedication = async function (req, res) {
//   var id = req.params.medication_id;
//   console.log(id, "check ");

//   var {
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     user_id,
//     tracker_time,
//     status,
//     disable_status,
//     reason,
//   } = req.body;

//   console.log("Received request to update medication:", req.body);

//   const validFrequencies = ["QD", "BID", "TID", "QID"];
//   if (!validFrequencies.includes(frequencyType)) {
//     return res.status(400).json({ error: "Invalid frequency value." });
//   }

//   const frequencyMap = {
//     QD: 1,
//     BID: 2,
//     TID: 3,
//     QID: 4,
//   };
//   const expectedDosageTimes = frequencyMap[frequencyType];
//   console.log(expectedDosageTimes, "expectedDosageTimes");

//   if (
//     !Array.isArray(dosage_times) ||
//     dosage_times.length !== expectedDosageTimes
//   ) {
//     return res.status(400).json({
//       error: `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`,
//     });
//   }

//   try {
//     const oldMedication = await medicineModel.getMedicationById(id);
//     if (!oldMedication) {
//       return res.status(404).json({ error: "Medication not found." });
//     }

//     var result = await medicineModel.updateMedication(
//       id,
//       medication_name,
//       dosage,
//       dosage_times,
//       frequencyType,
//       frequencyTime,
//       frequencyCondition,
//       dosageType,
//       allot_medicine,
//       route,
//       note,
//       tracker_time,
//       status,
//       disable_status,
//       reason
//     );

//     const newMedication = {
//       medication_name,
//       dosage,
//       dosage_times,
//       frequencyType,
//       frequencyTime,
//       frequencyCondition,
//       dosageType,
//       allot_medicine,
//       route,
//       note,
//       tracker_time,
//       status,
//       disable_status,
//       reason,
//     };

//     auditLog(
//       "UPDATE",
//       "Medication",
//       oldMedication,
//       newMedication,
//       `Medication log added`
//     )(req, res, () => {});

//     const user = await organizationModel.getOrganizationById(user_id);
//     if (user) {
//       const { email, first_name, last_name } = user;
//       await sendEmail(
//         email,
//         "Medication Updated",
//         `Your medication ${medication_name} has been updated. Please review the changes.`,
//         first_name,
//         last_name
//       );
//     }

//     res
//       .status(200)
//       .json({ message: "Medication updated successfully", result });
//   } catch (error) {
//     console.error("Error updating medication:", error);

//     auditLog(
//       "UPDATE_ERROR",
//       "Medication",
//       { medication_id: id },
//       null,
//       `Error updating medication: ${error.message}`
//     )(req, res, () => {});

//     res.status(500).json({ error: error.message });
//   }
// };
var updateMedication = async function (req, res) {
  var id = req.params.medication_id;
  console.log(id, "check ");

  var {
    medication_name,
    dosage,
    dosage_times,
    frequencyType,
    frequencyTime,
    frequencyCondition,
    dosageType,
    allot_medicine,
    route,
    note,
    user_id,
    tracker_time,
    status,
    disable_status,
    reason,
  } = req.body;

  console.log(
    "Received request to update medication-------------------:",
    user_id
  );

  const validFrequencies = ["QD", "BID", "TID", "QID"];
  if (!validFrequencies.includes(frequencyType)) {
    return res.status(400).json({ error: "Invalid frequency value." });
  }

  const frequencyMap = {
    QD: 1,
    BID: 2,
    TID: 3,
    QID: 4,
  };
  const expectedDosageTimes = frequencyMap[frequencyType];

  if (
    !Array.isArray(dosage_times) ||
    dosage_times.length !== expectedDosageTimes
  ) {
    return res.status(400).json({
      error: `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`,
    });
  }

  try {
    const oldMedication = await medicineModel.getMedicationById(id);
    console.log(
      oldMedication,
      "------------------------Medicine------------------------"
    );
    if (!oldMedication) {
      return res.status(404).json({ error: "Medication not found." });
    }

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

    const investigator_id = decoded.user_id;

    var result = await medicineModel.updateMedication(
      id,
      medication_name,
      dosage,
      dosage_times,
      frequencyType,
      frequencyTime,
      frequencyCondition,
      dosageType,
      allot_medicine,
      route,
      note,
      tracker_time,
      status,
      disable_status,
      user_id,
      investigator_id,
      reason
    );

    // Build oldData from the fetched old medication record.
    const oldData = {
      medication_name: oldMedication.medication_name,
      dosage: oldMedication.dosage,
      dosage_times: oldMedication.dosage_time,
      frequencyType: oldMedication.frequency_type,
      frequencyTime: oldMedication.frequency_time,
      frequencyCondition: oldMedication.frequency_condition,
      dosageType: oldMedication.dosageType,
      allot_medicine: oldMedication.allot_medicine,
      route: oldMedication.route,
      note: oldMedication.note,
      tracker_time: oldMedication.tracker_time,
      reason: oldMedication.reason,
    };

    // Build newMedication from the incoming request data.
    const newData = {
      user_id,
      medication_name,
      dosage,
      //dosage_times,
      frequencyType,
      frequencyTime,
      frequencyCondition,
      dosageType,
      allot_medicine,
      route,
      note,
      // tracker_time,
      reason,
    };

    const user = await medicineModel.getOrganizationById(user_id);
    if (user) {
      const { email, first_name, last_name } = user;
      await sendEmail(
        email,
        "Medication Updated",
        `Your medication ${medication_name} has been updated. Please review the changes.`,
        first_name,
        last_name
      );
    }
    const changedFieldsOld = {};
    const changedFieldsNew = {};

    for (const key in newData) {
      const newValue = newData[key];

      // Skip if the new value is null (or you can add additional checks if needed)
      if (newValue === "" || newValue === "N/A") continue;

      const oldValue = oldData[key];
      if (oldValue === "") continue;
      // Only record the field if there's a difference
      if (oldValue !== newValue) {
        changedFieldsOld[key] = oldValue;
        changedFieldsNew[key] = newValue;
      }
    }

    changedFieldsOld.user_id = user_id;
    await auditLog(
      "UPDATE",
      "Medication",
      changedFieldsOld,
      changedFieldsNew,
      "Medicine Updated Successfully"
    )(req, res, () => {});

    res
      .status(200)
      .json({ message: "Medication updated successfully", result });
  } catch (error) {
    console.error("Error updating medication:", error);

    try {
      await auditLog(
        "UPDATE_ERROR",
        "Medication",
        { medication_id: id },
        null,
        `Error updating medication: ${error.message}`
      )(req, res, () => {
        console.log("Error audit log created successfully");
      });
    } catch (logError) {
      console.error("Error creating error audit log:", logError);
    }

    res.status(500).json({ error: error.message });
  }
};

const deleteMedication = async function (req, res) {
  const id = req.params.id;
  const { reason, user_id } = req.body;

  if (!reason) {
    return res.status(400).json({ error: "Reason is required" });
  }

  try {
    // Retrieve the existing medication data before deletion
    const oldData = await medicineModel.getMedicationById(id);
    if (!oldData) {
      return res.status(404).json({ error: "Medication not found" });
    }

    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const investigator_id = decoded.user_id;

    // Perform the deletion
    await medicineModel.deleteMedication(id, investigator_id, reason, user_id);

    // Log the deletion action with the correct old value and reason
    auditLog("DELETE", "Medication", oldData, null, reason)(req, res, () => {});

    res.status(200).json({ message: "Medication deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

var getMedicationByUserIdforPortal = async function (req, res) {
  var id = req.params.id;
  try {
    var result = await medicineModel.getMedicationByUserIdForPortal(id);
    res.status(200).json({ medication: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// const submitMedicineRecordController = async (req, res) => {
//   const {
//     medicine_id,
//     intake_quantity,
//     user_id,
//     study_id,
//     date,
//     time,
//     reason,
//   } = req.body;

//   try {
//     // Submit the medicine record
//     const result = await medicineModel.submitMedicineRecord(
//       medicine_id,
//       intake_quantity,
//       user_id,
//       study_id,
//       date,
//       time,
//       reason
//     );

//     const oldData = null;
//     const newData = {
//       medicine_id,
//       intake_quantity,
//       user_id,
//       study_id,
//       date,
//       time,
//       reason,
//     };
//     auditLog(
//       "SUBMIT",
//       "medicine record",
//       oldData,
//       newData,
//       req.body.reason || "No Reason Provided"
//     )(req, res, () => {});

//     // Additional logic for overdose checking and email notifications
//     const isOverdose = await medicineModel.checkOverdose(
//       medicine_id,
//       intake_quantity,
//       user_id
//     );

//     if (isOverdose) {
//       const patientData = await medicineModel.getPatientData(user_id);

//       if (patientData) {
//         const { study_enrolled_id, ecrf_id } = patientData;
//         const recipients = await medicineModel.getRecipients(study_enrolled_id);

//         if (recipients && recipients.length > 0) {
//           const patientDataForEmail = [
//             {
//               ecrf_id: ecrf_id,
//             },
//           ];
//           await overDoseEmail(recipients, patientDataForEmail);
//         }
//       }
//     }

//     res
//       .status(200)
//       .json({ message: "Medicine record submitted successfully", result });
//   } catch (error) {
//     console.error("Error in submitMedicineRecordController:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

const submitMedicineRecordController = async (req, res) => {
  const {
    medicine_id,
    intake_quantity,
    user_id,
    study_id,
    date,
    time,
    reason,
    previous_date_reason,
  } = req.body;

  if (!intake_quantity || !date || !time) {
    return res.status(404).json({ message: "Field are missing" });
  }

  try {
    // Check user status first
    const userStatusResult = await medicineModel.checkStatus(user_id);

    if (!userStatusResult || userStatusResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userStatus = userStatusResult[0].status;

    // Only allow Randomized users to submit medicine records
    if (userStatus !== "Randomized") {
      return res.status(403).json({
        message: "Only Randomized Subjects Can Take IP",
        userStatus: userStatus
      });
    }

    const changeDate = await medicineModel.getPriscribeATDate(user_id);
    const newDate = changeDate[0].created_at;
    console.log("Database date and time: ", changeDate[0].created_at)
    const splitDate = newDate.split(" ")[0];
    console.log("splitDate:", splitDate)
    console.log(splitDate, "changeDate---------------");
    if (date < splitDate) {
      return res.status(400).json({
        error:
          "Invalid date selection. The selected date must be on or after the medication prescription date.",
        prescriptionDate: splitDate,
      });
    }

    // Submit the medicine record (only for Randomized users)
    const result = await medicineModel.submitMedicineRecord(
      medicine_id,
      intake_quantity,
      user_id,
      study_id,
      date,
      time,
      reason,
      previous_date_reason
    );

    const oldData = null;
    const newData = {
      medicine_id,
      intake_quantity,
      user_id,
      study_id,
      date,
      time,
      reason,
      previous_date_reason,
    };
    auditLog(
      "SUBMIT",
      "medicine record",
      oldData,
      newData,
      req.body.reason || "No Reason Provided"
    )(req, res, () => {});

    // Additional logic for overdose checking and email notifications
    const isOverdose = await medicineModel.checkOverdose(
      medicine_id,
      intake_quantity,
      user_id
    );

    if (isOverdose) {
      const patientData = await medicineModel.getPatientData(user_id);

      if (patientData) {
        const { study_enrolled_id, ecrf_id, organization_detail_id } =
          patientData;
        const recipients = await medicineModel.getRecipients(
          study_enrolled_id,
          organization_detail_id
        );

        if (recipients && recipients.length > 0) {
          const patientDataForEmail = [
            {
              ecrf_id: ecrf_id,
            },
          ];
          await overDoseEmail(
            recipients,
            patientDataForEmail,
            patientData.organization_detail_id
          );
        }
      }
    }

    res
      .status(200)
      .json({ message: "Medicine record submitted successfully", result });
  } catch (error) {
    console.error("Error in submitMedicineRecordController:", error);
    res.status(500).json({ error: error.message });
  }
};

const getMedicineRecordByUserId = async (req, res) => {
  const userId = req.params.id;
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const token_user_id = decoded.user_id;

    const result = await medicineModel.getSubmitMedicationRecordByUserId(
      userId,
      token_user_id
    );
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const disableMedicineRecord = async (req, res) => {
  const recordId = req.params.id;
  const { user_id, medicine_id, reason } = req.body;

  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const investigatorId = decoded.user_id;
  
   const commentExists = await medicineModel.checkMedicineComment(recordId);
    
    if (!commentExists) {
      return res.status(400).json({ 
        error: "Please add a comment for this record before disabling it" 
      });
    }

  try {
    const data = await medicineModel.disbaleMedicineRecord(
      recordId,
      user_id,
      investigatorId,
      medicine_id,
      reason
    );

    auditLog(
      "DELETE",
      "medicine record",
      { recordId, user_id, investigatorId, medicine_id, reason },
      null,
      req.body.reason || "No Reason Provided"
    )(req, res, () => {});

    res.status(200).json({ message: "Medicine record disabled successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMedicineQuestionAndOptions = async (req, res) => {
  try {
    const result = await medicineModel.getQuestionsAndOptions();
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitMedicineQuestionResponses = async (req, res) => {
  try {
    const { medicine_id, submit_date, responses } = req.body;

    // Validate that responses is an array
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({
        error: "Invalid or missing responses. It should be a non-empty array.",
      });
    }

    // Validate that the required fields are provided
    if (!medicine_id || !submit_date) {
      return res.status(400).json({
        error: "Missing required fields: medicine_id or submit_date.",
      });
    }

    // Prepare the array of responses for batch insert
    const responsesData = responses.map((response) => {
      if (!response.question_id || !response.response_text) {
        throw new Error(
          "Each response must contain a valid question_id and response_text."
        );
      }
      return {
        question_id: response.question_id,
        response_text: response.response_text,
        medicine_id,
        submit_date,
      };
    });

    // Call the model to save all responses at once
    await medicineModel.submitmedicineResponseModel(responsesData);

    res.status(200).json({ message: "Responses submitted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkDosageTimesAndSendReminder = async () => {
  try {
    const medications = await medicineModel.getMedicationsWithDosageTimes();

    if (!Array.isArray(medications) || medications.length === 0) {
      return;
    }

    const currentTime = new Date();

    await Promise.all(
      medications.map(async (medication) => {
        // Parse the dosage_time
        const dosageTimeString = medication.dosage_time;

        let dosageHours, dosageMinutes;

        if (
          dosageTimeString.includes("AM") ||
          dosageTimeString.includes("PM")
        ) {
          const [time, meridiem] = dosageTimeString.split(" ");
          let [hoursStr, minutesStr] = time.split(":");

          dosageHours = parseInt(hoursStr, 10);
          dosageMinutes = parseInt(minutesStr, 10);

          if (meridiem.toUpperCase() === "PM" && dosageHours < 12) {
            dosageHours += 12;
          } else if (meridiem.toUpperCase() === "AM" && dosageHours === 12) {
            dosageHours = 0;
          }
        } else {
          const [hoursStr, minutesStr] = dosageTimeString.split(":");
          dosageHours = parseInt(hoursStr, 10);
          dosageMinutes = parseInt(minutesStr, 10);
        }

        const dosageDate = new Date(currentTime);
        dosageDate.setHours(dosageHours, dosageMinutes, 0, 0);

        const reminderDate = new Date(dosageDate.getTime() - 30 * 60 * 1000);

        const isDosageTime =
          currentTime.getHours() === dosageDate.getHours() &&
          currentTime.getMinutes() === dosageDate.getMinutes();

        const isReminderTime =
          currentTime.getHours() === reminderDate.getHours() &&
          currentTime.getMinutes() === reminderDate.getMinutes();

        if (isDosageTime || isReminderTime) {
          const {
            user_id,
            email,
            first_name,
            last_name,
            is_randomized,
            status,
          } = medication;

          console.log(medication, "-----------------");

          //   if (parseInt(is_randomized) !== 1 || status !== "Randomized") {
          //     console.log(
          //       `User ${user_id} is not randomized or status is not 'Randomized'. Skipping email.`
          //     );
          //     return;
          //   }

          if (status !== "Randomized") {
            console.log(
              `User ${user_id} is not randomized or status is not 'Randomized'. Skipping email.`
            );
            return;
          }

          const medicineName = medication.medication_name;

          const reminderType = isReminderTime
            ? "first reminder (30 minutes before)"
            : "second reminder (at dosage time)";

          try {
            await sendReminderEmail(
              email,
              decrypt(first_name),
              decrypt(last_name),
              medicineName,
              reminderType
            );

            console.log(
              `Reminder sent to ${email} for ${medicineName} (${reminderType})`
            );
          } catch (error) {
            console.error("Error sending reminder email:", error);
          }
        }
      })
    );
  } catch (error) {
    console.error("Error fetching medications:", error);
  }
};

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

async function checkPatientsMedicineIntake(timezone) {
  try {
    // 1) Get all subjects who haven't submitted in the last 24-hour window
    const missedSubjects =
      await medicineModel.getSubjectsWhoHaveNotSubmittedInLast24Hours();

    // If none missed, do nothing
    if (!Array.isArray(missedSubjects) || missedSubjects.length === 0) {
      console.log(
        "No subjects have missed medication in the last 24 hours (8AM-8AM)."
      );
      return;
    }

    // 2) Group subjects by both study_enrolled_id and organization_detail_id
    const subjectsByGroup = missedSubjects.reduce((acc, sub) => {
      const studyId = sub.study_enrolled_id || "NOSTUDY";
      const orgDetailId = sub.organization_detail_id || "NOORGDETAIL";
      const key = `${studyId}-${orgDetailId}`;

      if (!acc[key]) acc[key] = [];
      acc[key].push(sub);

      return acc;
    }, {});

    // 3) Get all potential recipients
    const allRecipients = await medicineModel.getUsersToNotify(timezone);

    // 4) Create a map to collect subjects for each recipient
    const recipientSubjectsMap = new Map(); // Map<user_id, Array<subject>>

    // 5) For each site-study group, find matching recipients and assign subjects
    for (const [groupKey, subjects] of Object.entries(subjectsByGroup)) {
      const [studyId, orgDetailId] = groupKey.split("-");

      // Find recipients who are assigned to this site and study
      const matchingRecipients = allRecipients.filter(
        (user) =>
          String(user.study_id) === String(studyId) &&
          String(user.site_id) === String(orgDetailId)
      );

      // For each matching recipient, add these subjects to their list
      matchingRecipients.forEach((recipient) => {
        if (!recipientSubjectsMap.has(recipient.user_id)) {
          recipientSubjectsMap.set(recipient.user_id, {
            recipient: recipient,
            subjects: [],
          });
        }

        // Add all subjects from this group to this recipient's list
        const recipientData = recipientSubjectsMap.get(recipient.user_id);
        recipientData.subjects = [...recipientData.subjects, ...subjects];
      });
    }

    // No special handling for role_id 18 - they are treated like other roles
    // All users (including role_id 18) receive notifications based on their assigned sites and studies

    // 6) Send a single email to each recipient with all their relevant subjects
    for (const [userId, data] of recipientSubjectsMap.entries()) {
      const { recipient, subjects } = data;

      // Deduplicate subjects by ecrf_id to ensure we don't show duplicates
      const uniqueSubjects = Array.from(
        new Map(subjects.map((sub) => [sub.ecrf_id, sub])).values()
      );

      // Get ECRF IDs for the email
      const ecrfIds = uniqueSubjects.map((s) => s.ecrf_id);

      // Skip if no subjects to report
      if (ecrfIds.length === 0) {
        console.log(
          `No subjects to report for user ${userId} (${recipient.email})`
        );
        continue;
      }

      // Log information
      console.log(
        `Sending email to user ${userId} (${recipient.email}) with ${ecrfIds.length} subjects`
      );

      // Create simplified logs for subjects
      const simplifiedSubjects = uniqueSubjects.map((sub) => ({
        ecrf_id: sub.ecrf_id,
        study_id: sub.study_enrolled_id,
        org_detail_id: sub.organization_detail_id,
      }));
      console.log("Subjects for this recipient:");
      console.log(JSON.stringify(simplifiedSubjects, null, 2));

      // Send the email with all relevant subjects
      try {
        await medicationLogEmail([recipient], ecrfIds);
        console.log(
          `Missed medication email sent to ${recipient.email} with ${ecrfIds.length} subjects`
        );
      } catch (err) {
        console.error(
          `Error sending email to ${recipient.email}:`,
          err.message || err
        );
      }
    }
  } catch (error) {
    console.error("Error in checkPatientsMedicineIntake:", error);
  }
}

async function TimezoneHandler() {
  console.log("Timezone handler function called!");
  try {
    const result = await organizationModel.getAllOrganizationDetails();
    console.log("Fetched all organization details result: ", result);

    // Get unique timezones using Set
    const uniqueTimezones = [...new Set(result.map((org) => org.timezone))];

    uniqueTimezones.forEach((timezone) => {
      console.log("Running cron job for " + timezone);
      cron.schedule(
        "00 08 * * *",
        async () => {
          try {
            console.log("Check time");
            await checkPatientsMedicineIntake(timezone);
          } catch (error) {
            console.error("Medication check failed:", error);
          }
        },
        {
          timezone: timezone,
        }
      );
    });
  } catch (error) {
    console.log("error occurred while fetching organization details : ", error);
  }
}

TimezoneHandler();

module.exports = {
  createMedicine: [
    validateCreateMedicine,
    handleValidationErrors,
    createMedicine,
  ],
  createMedicineLogic,
  getAllMedication,
  getAllMedicationForInvestigator,
  getMedicationById: [
    validateGetMedicationById,
    handleValidationErrors,
    getMedicationById,
  ],
  getMedicationByUserId: [
    validateGetMedicationByUserId,
    handleValidationErrors,
    getMedicationByUserId,
  ],
  updateMedication: [
    validateUpdateMedication,
    handleValidationErrors,
    updateMedication,
  ],
  deleteMedication: [
    validateDeleteMedication,
    handleValidationErrors,
    deleteMedication,
  ],
  getMedicationByUserIdforPortal,

  submitMedicineRecordController,
  getMedicineQuestionAndOptions,
  submitMedicineQuestionResponses,
  getMedicineRecordByUserId,
  checkDosageTimesAndSendReminder,
  disableMedicineRecord,
};


// const db = require("../../config/DBConnection3.js");

// const { body, param, validationResult } = require("express-validator");
// var medicineModel = require("../../models/medication/medicineModel.js");
// const organizationModel = require("../../models/organization/organizationModel.js");
// const sendEmail = require("../../middleware/MedicationTracker.js");
// const auditLog = require("../../middleware/audit_logger.js");
// const cron = require("node-cron");
// const sendReminderEmail = require("../../middleware/sendReminderEmail.js");
// const medicationLogEmail = require("../../middleware/mediciationLogEmail.js");
// const crypto = require("crypto");
// const overDoseEmail = require("../../middleware/overDoseEmail.js");
// var jwt = require("jsonwebtoken");
// // Validation rules
// const validateCreateMedicine = [
//   body("medication_name").notEmpty().withMessage("Medication name is required"),
//   body("dosage").notEmpty().withMessage("Dosage is required"),
//   // body("frequency").notEmpty().withMessage("Frequency is required"),
//   body("note").optional(),
//   body("user_id")
//     .notEmpty()
//     .withMessage("User ID is required")
//     .isNumeric()
//     .withMessage("User ID must be a number"),
// ];

// const validateGetMedicationById = [
//   param("id")
//     .notEmpty()
//     .withMessage("ID is required")
//     .isNumeric()
//     .withMessage("ID must be a number"),
// ];

// const validateGetMedicationByUserId = [
//   param("id")
//     .notEmpty()
//     .withMessage("User ID is required")
//     .isNumeric()
//     .withMessage("User ID must be a number"),
// ];

// const validateUpdateMedication = [
//   param("medication_id")
//     .notEmpty()
//     .withMessage("Medication ID is required")
//     .isNumeric()
//     .withMessage("Medication ID must be a number"),
//   body("medication_name").notEmpty().withMessage("Medication name is required"),
//   body("dosage").notEmpty().withMessage("Dosage is required"),
//   // body("frequency").notEmpty().withMessage("Frequency is required"),
//   body("note").optional(),
// ];

// const validateDeleteMedication = [
//   param("id")
//     .notEmpty()
//     .withMessage("ID is required")
//     .isNumeric()
//     .withMessage("ID must be a number"),
// ];

// // Middleware to handle validation errors
// const handleValidationErrors = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ status: false, errors: errors.array() });
//   }
//   next();
// };

// const createMedicineLogic = async (params, req, res) => {
//   const {
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     investigator_id,
//     user_id,
//     tracker_time,
//   } = params;

//   console.log("Received request to create medicine:", params);

//   // Validate frequency
//   const validFrequencies = ["QD", "BID", "TID", "QID"];
//   if (!validFrequencies.includes(frequencyType)) {
//     const errorMsg = "Invalid frequency value.";
//     console.error(errorMsg);
//     throw new Error(errorMsg);
//   }

//   // Determine the expected number of dosage times based on frequency
//   const frequencyMap = {
//     QD: 1,
//     BID: 2,
//     TID: 3,
//     QID: 4,
//   };
//   const expectedDosageTimes = frequencyMap[frequencyType];

//   // Validate dosage_times
//   if (
//     !Array.isArray(dosage_times) ||
//     dosage_times.length !== expectedDosageTimes
//   ) {
//     const errorMsg = `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`;
//     console.error(errorMsg);
//     throw new Error(errorMsg);
//   }

//   // Create the medicine entry in the database
//   const result = await medicineModel.createMedicine(
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     user_id,
//     investigator_id,
//     tracker_time
//   );

//   const newData = {
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     investigator_id,
//     user_id,
//     tracker_time,
//   };

//   // Log the action
//   await auditLog(
//     "CREATE",
//     "Manually medication Created",
//     null,
//     newData,
//     "Manually medication created"
//   )(req, res, () => {});

//   // Send an initial email to the user
//   const user = await medicineModel.getOrganizationById(user_id);
//   const { email, first_name, last_name } = user;
//   await sendEmail(
//     email,
//     "New Medication Assigned",
//     `You have been assigned ${medication_name}. Please follow the prescribed dosage times.`,
//     first_name,
//     last_name
//   );

//   return result;
// };

// const createMedicine = async (req, res) => {
//   try {
//     const result = await createMedicineLogic(req.body, req, res);
//     res.status(201).json({
//       message: "Medicine created successfully",
//       medicine: result,
//     });
//   } catch (error) {
//     console.error("Error creating medicine:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// };

// var getAllMedication = async function (req, res) {
//   try {
//     const token = req.headers.authorization.split(" ")[1];

//     // Decode the token
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     console.log("decoded", decoded);

//     const userId = decoded.user_id;

//     const result = await medicineModel.getAllMedication(userId);
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     console.error("Error in getAllMedication:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// // var getAllMedication = async function (req, res) {
// //   try {
// //     var result = await medicineModel.getAllMedication();
// //     res.status(200).json({ medication: result });
// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // };

// // get all medication for investigator
// var getAllMedicationForInvestigator = async function (req, res) {
//   const investigatorId = req.params.id;

//   if (!investigatorId) {
//     return res.status(400).json({ error: "Investigator ID is required" });
//   }

//   try {
//     var result = await medicineModel.getAllMedicationForInvestigator(
//       investigatorId
//     );
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // get medication by id
// var getMedicationById = async function (req, res) {
//   var id = req.params.id;
//   try {
//     var result = await medicineModel.getMedicationById(id);
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // GET medication by user id
// var getMedicationByUserId = async function (req, res) {
//   var id = req.params.id;

//   try {
//     var result = await medicineModel.getMedicationByUserId(id);
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // update medication
// // var updateMedication = async function (req, res) {
// //   var id = req.params.medication_id;
// //   console.log(id, "check ");

// //   var {
// //     medication_name,
// //     dosage,
// //     dosage_times,
// //     frequencyType,
// //     frequencyTime,
// //     frequencyCondition,
// //     dosageType,
// //     allot_medicine,
// //     route,
// //     note,
// //     user_id,
// //     tracker_time,
// //     status,
// //     disable_status,
// //     reason,
// //   } = req.body;

// //   console.log("Received request to update medication:", req.body);

// //   const validFrequencies = ["QD", "BID", "TID", "QID"];
// //   if (!validFrequencies.includes(frequencyType)) {
// //     return res.status(400).json({ error: "Invalid frequency value." });
// //   }

// //   const frequencyMap = {
// //     QD: 1,
// //     BID: 2,
// //     TID: 3,
// //     QID: 4,
// //   };
// //   const expectedDosageTimes = frequencyMap[frequencyType];
// //   console.log(expectedDosageTimes, "expectedDosageTimes");

// //   if (
// //     !Array.isArray(dosage_times) ||
// //     dosage_times.length !== expectedDosageTimes
// //   ) {
// //     return res.status(400).json({
// //       error: `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`,
// //     });
// //   }

// //   try {
// //     const oldMedication = await medicineModel.getMedicationById(id);
// //     if (!oldMedication) {
// //       return res.status(404).json({ error: "Medication not found." });
// //     }

// //     var result = await medicineModel.updateMedication(
// //       id,
// //       medication_name,
// //       dosage,
// //       dosage_times,
// //       frequencyType,
// //       frequencyTime,
// //       frequencyCondition,
// //       dosageType,
// //       allot_medicine,
// //       route,
// //       note,
// //       tracker_time,
// //       status,
// //       disable_status,
// //       reason
// //     );

// //     const newMedication = {
// //       medication_name,
// //       dosage,
// //       dosage_times,
// //       frequencyType,
// //       frequencyTime,
// //       frequencyCondition,
// //       dosageType,
// //       allot_medicine,
// //       route,
// //       note,
// //       tracker_time,
// //       status,
// //       disable_status,
// //       reason,
// //     };

// //     auditLog(
// //       "UPDATE",
// //       "Medication",
// //       oldMedication,
// //       newMedication,
// //       `Medication log added`
// //     )(req, res, () => {});

// //     const user = await organizationModel.getOrganizationById(user_id);
// //     if (user) {
// //       const { email, first_name, last_name } = user;
// //       await sendEmail(
// //         email,
// //         "Medication Updated",
// //         `Your medication ${medication_name} has been updated. Please review the changes.`,
// //         first_name,
// //         last_name
// //       );
// //     }

// //     res
// //       .status(200)
// //       .json({ message: "Medication updated successfully", result });
// //   } catch (error) {
// //     console.error("Error updating medication:", error);

// //     auditLog(
// //       "UPDATE_ERROR",
// //       "Medication",
// //       { medication_id: id },
// //       null,
// //       `Error updating medication: ${error.message}`
// //     )(req, res, () => {});

// //     res.status(500).json({ error: error.message });
// //   }
// // };
// var updateMedication = async function (req, res) {
//   var id = req.params.medication_id;
//   console.log(id, "check ");

//   var {
//     medication_name,
//     dosage,
//     dosage_times,
//     frequencyType,
//     frequencyTime,
//     frequencyCondition,
//     dosageType,
//     allot_medicine,
//     route,
//     note,
//     user_id,
//     tracker_time,
//     status,
//     disable_status,
//     reason,
//   } = req.body;

//   console.log(
//     "Received request to update medication-------------------:",
//     user_id
//   );

//   const validFrequencies = ["QD", "BID", "TID", "QID"];
//   if (!validFrequencies.includes(frequencyType)) {
//     return res.status(400).json({ error: "Invalid frequency value." });
//   }

//   const frequencyMap = {
//     QD: 1,
//     BID: 2,
//     TID: 3,
//     QID: 4,
//   };
//   const expectedDosageTimes = frequencyMap[frequencyType];

//   if (
//     !Array.isArray(dosage_times) ||
//     dosage_times.length !== expectedDosageTimes
//   ) {
//     return res.status(400).json({
//       error: `Dosage times should be an array with ${expectedDosageTimes} time(s) for frequency ${frequencyType}.`,
//     });
//   }

//   try {
//     const oldMedication = await medicineModel.getMedicationById(id);
//     console.log(
//       oldMedication,
//       "------------------------Medicine------------------------"
//     );
//     if (!oldMedication) {
//       return res.status(404).json({ error: "Medication not found." });
//     }

//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");

//     const investigator_id = decoded.user_id;

//     var result = await medicineModel.updateMedication(
//       id,
//       medication_name,
//       dosage,
//       dosage_times,
//       frequencyType,
//       frequencyTime,
//       frequencyCondition,
//       dosageType,
//       allot_medicine,
//       route,
//       note,
//       tracker_time,
//       status,
//       disable_status,
//       user_id,
//       investigator_id,
//       reason
//     );

//     // Build oldData from the fetched old medication record.
//     const oldData = {
//       medication_name: oldMedication.medication_name,
//       dosage: oldMedication.dosage,
//       dosage_times: oldMedication.dosage_time,
//       frequencyType: oldMedication.frequency_type,
//       frequencyTime: oldMedication.frequency_time,
//       frequencyCondition: oldMedication.frequency_condition,
//       dosageType: oldMedication.dosageType,
//       allot_medicine: oldMedication.allot_medicine,
//       route: oldMedication.route,
//       note: oldMedication.note,
//       tracker_time: oldMedication.tracker_time,
//       reason: oldMedication.reason,
//     };

//     // Build newMedication from the incoming request data.
//     const newData = {
//       user_id,
//       medication_name,
//       dosage,
//       //dosage_times,
//       frequencyType,
//       frequencyTime,
//       frequencyCondition,
//       dosageType,
//       allot_medicine,
//       route,
//       note,
//       // tracker_time,
//       reason,
//     };

//     const user = await medicineModel.getOrganizationById(user_id);
//     if (user) {
//       const { email, first_name, last_name } = user;
//       await sendEmail(
//         email,
//         "Medication Updated",
//         `Your medication ${medication_name} has been updated. Please review the changes.`,
//         first_name,
//         last_name
//       );
//     }
//     const changedFieldsOld = {};
//     const changedFieldsNew = {};

//     for (const key in newData) {
//       const newValue = newData[key];

//       // Skip if the new value is null (or you can add additional checks if needed)
//       if (newValue === "" || newValue === "N/A") continue;

//       const oldValue = oldData[key];
//       if (oldValue === "") continue;
//       // Only record the field if there's a difference
//       if (oldValue !== newValue) {
//         changedFieldsOld[key] = oldValue;
//         changedFieldsNew[key] = newValue;
//       }
//     }

//     changedFieldsOld.user_id = user_id;
//     await auditLog(
//       "UPDATE",
//       "Medication",
//       changedFieldsOld,
//       changedFieldsNew,
//       "Medicine Updated Successfully"
//     )(req, res, () => {});

//     res
//       .status(200)
//       .json({ message: "Medication updated successfully", result });
//   } catch (error) {
//     console.error("Error updating medication:", error);

//     try {
//       await auditLog(
//         "UPDATE_ERROR",
//         "Medication",
//         { medication_id: id },
//         null,
//         `Error updating medication: ${error.message}`
//       )(req, res, () => {
//         console.log("Error audit log created successfully");
//       });
//     } catch (logError) {
//       console.error("Error creating error audit log:", logError);
//     }

//     res.status(500).json({ error: error.message });
//   }
// };

// const deleteMedication = async function (req, res) {
//   const id = req.params.id;
//   const { reason, user_id } = req.body;

//   if (!reason) {
//     return res.status(400).json({ error: "Reason is required" });
//   }

//   try {
//     // Retrieve the existing medication data before deletion
//     const oldData = await medicineModel.getMedicationById(id);
//     if (!oldData) {
//       return res.status(404).json({ error: "Medication not found" });
//     }

//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const investigator_id = decoded.user_id;

//     // Perform the deletion
//     await medicineModel.deleteMedication(id, investigator_id, reason, user_id);

//     // Log the deletion action with the correct old value and reason
//     auditLog("DELETE", "Medication", oldData, null, reason)(req, res, () => {});

//     res.status(200).json({ message: "Medication deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// var getMedicationByUserIdforPortal = async function (req, res) {
//   var id = req.params.id;
//   try {
//     var result = await medicineModel.getMedicationByUserIdForPortal(id);
//     res.status(200).json({ medication: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // const submitMedicineRecordController = async (req, res) => {
// //   const {
// //     medicine_id,
// //     intake_quantity,
// //     user_id,
// //     study_id,
// //     date,
// //     time,
// //     reason,
// //   } = req.body;

// //   try {
// //     // Submit the medicine record
// //     const result = await medicineModel.submitMedicineRecord(
// //       medicine_id,
// //       intake_quantity,
// //       user_id,
// //       study_id,
// //       date,
// //       time,
// //       reason
// //     );

// //     const oldData = null;
// //     const newData = {
// //       medicine_id,
// //       intake_quantity,
// //       user_id,
// //       study_id,
// //       date,
// //       time,
// //       reason,
// //     };
// //     auditLog(
// //       "SUBMIT",
// //       "medicine record",
// //       oldData,
// //       newData,
// //       req.body.reason || "No Reason Provided"
// //     )(req, res, () => {});

// //     // Additional logic for overdose checking and email notifications
// //     const isOverdose = await medicineModel.checkOverdose(
// //       medicine_id,
// //       intake_quantity,
// //       user_id
// //     );

// //     if (isOverdose) {
// //       const patientData = await medicineModel.getPatientData(user_id);

// //       if (patientData) {
// //         const { study_enrolled_id, ecrf_id } = patientData;
// //         const recipients = await medicineModel.getRecipients(study_enrolled_id);

// //         if (recipients && recipients.length > 0) {
// //           const patientDataForEmail = [
// //             {
// //               ecrf_id: ecrf_id,
// //             },
// //           ];
// //           await overDoseEmail(recipients, patientDataForEmail);
// //         }
// //       }
// //     }

// //     res
// //       .status(200)
// //       .json({ message: "Medicine record submitted successfully", result });
// //   } catch (error) {
// //     console.error("Error in submitMedicineRecordController:", error);
// //     res.status(500).json({ error: error.message });
// //   }
// // };

// const submitMedicineRecordController = async (req, res) => {
//   const {
//     medicine_id,
//     intake_quantity,
//     user_id,
//     study_id,
//     date,
//     time,
//     reason,
//     previous_date_reason,
//   } = req.body;

//   if (!intake_quantity || !date || !time) {
//     res.status(404).json({ message: "Field are missing" });
//   }

//   const changeDate = await medicineModel.getPriscribeATDate(user_id);
//   const newDate = new Date(changeDate[0].created_at);
//   const splitDate = newDate.toISOString().split("T")[0];
//   console.log(splitDate, "changeDate---------------");
//   if (date < splitDate) {
//     return res.status(400).json({
//       error:
//         "Invalid date selection. The selected date must be on or after the medication prescription date.",
//       prescriptionDate: splitDate,
//     });
//   }

//   try {
//     // Submit the medicine record
//     const result = await medicineModel.submitMedicineRecord(
//       medicine_id,
//       intake_quantity,
//       user_id,
//       study_id,
//       date,
//       time,
//       reason,
//       previous_date_reason
//     );

//     const oldData = null;
//     const newData = {
//       medicine_id,
//       intake_quantity,
//       user_id,
//       study_id,
//       date,
//       time,
//       reason,
//       previous_date_reason,
//     };
//     auditLog(
//       "SUBMIT",
//       "medicine record",
//       oldData,
//       newData,
//       req.body.reason || "No Reason Provided"
//     )(req, res, () => {});

//     // Additional logic for overdose checking and email notifications
//     const isOverdose = await medicineModel.checkOverdose(
//       medicine_id,
//       intake_quantity,
//       user_id
//     );

//     if (isOverdose) {
//       const patientData = await medicineModel.getPatientData(user_id);

//       if (patientData) {
//         const { study_enrolled_id, ecrf_id, organization_detail_id } =
//           patientData;
//         const recipients = await medicineModel.getRecipients(
//           study_enrolled_id,
//           organization_detail_id
//         );

//         if (recipients && recipients.length > 0) {
//           const patientDataForEmail = [
//             {
//               ecrf_id: ecrf_id,
//             },
//           ];
//           await overDoseEmail(
//             recipients,
//             patientDataForEmail,
//             patientData.organization_detail_id
//           );
//         }
//       }
//     }

//     res
//       .status(200)
//       .json({ message: "Medicine record submitted successfully", result });
//   } catch (error) {
//     console.error("Error in submitMedicineRecordController:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// const getMedicineRecordByUserId = async (req, res) => {
//   const userId = req.params.id;
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const token_user_id = decoded.user_id;

//     const result = await medicineModel.getSubmitMedicationRecordByUserId(
//       userId,
//       token_user_id
//     );
//     res.status(200).json({ result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const disableMedicineRecord = async (req, res) => {
//   const recordId = req.params.id;
//   const { user_id, medicine_id, reason } = req.body;

//   const token = req.headers.authorization.split(" ")[1];
//   const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//   const investigatorId = decoded.user_id;

//   try {
//     const data = await medicineModel.disbaleMedicineRecord(
//       recordId,
//       user_id,
//       investigatorId,
//       medicine_id,
//       reason
//     );

//     auditLog(
//       "DELETE",
//       "medicine record",
//       { recordId, user_id, investigatorId, medicine_id, reason },
//       null,
//       req.body.reason || "No Reason Provided"
//     )(req, res, () => {});

//     res.status(200).json({ message: "Medicine record disabled successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const getMedicineQuestionAndOptions = async (req, res) => {
//   try {
//     const result = await medicineModel.getQuestionsAndOptions();
//     res.status(200).json({ result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const submitMedicineQuestionResponses = async (req, res) => {
//   try {
//     const { medicine_id, submit_date, responses } = req.body;

//     // Validate that responses is an array
//     if (!Array.isArray(responses) || responses.length === 0) {
//       return res.status(400).json({
//         error: "Invalid or missing responses. It should be a non-empty array.",
//       });
//     }

//     // Validate that the required fields are provided
//     if (!medicine_id || !submit_date) {
//       return res.status(400).json({
//         error: "Missing required fields: medicine_id or submit_date.",
//       });
//     }

//     // Prepare the array of responses for batch insert
//     const responsesData = responses.map((response) => {
//       if (!response.question_id || !response.response_text) {
//         throw new Error(
//           "Each response must contain a valid question_id and response_text."
//         );
//       }
//       return {
//         question_id: response.question_id,
//         response_text: response.response_text,
//         medicine_id,
//         submit_date,
//       };
//     });

//     // Call the model to save all responses at once
//     await medicineModel.submitmedicineResponseModel(responsesData);

//     res.status(200).json({ message: "Responses submitted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const checkDosageTimesAndSendReminder = async () => {
//   try {
//     const medications = await medicineModel.getMedicationsWithDosageTimes();

//     if (!Array.isArray(medications) || medications.length === 0) {
//       return;
//     }

//     const currentTime = new Date();

//     await Promise.all(
//       medications.map(async (medication) => {
//         // Parse the dosage_time
//         const dosageTimeString = medication.dosage_time;

//         let dosageHours, dosageMinutes;

//         if (
//           dosageTimeString.includes("AM") ||
//           dosageTimeString.includes("PM")
//         ) {
//           const [time, meridiem] = dosageTimeString.split(" ");
//           let [hoursStr, minutesStr] = time.split(":");

//           dosageHours = parseInt(hoursStr, 10);
//           dosageMinutes = parseInt(minutesStr, 10);

//           if (meridiem.toUpperCase() === "PM" && dosageHours < 12) {
//             dosageHours += 12;
//           } else if (meridiem.toUpperCase() === "AM" && dosageHours === 12) {
//             dosageHours = 0;
//           }
//         } else {
//           const [hoursStr, minutesStr] = dosageTimeString.split(":");
//           dosageHours = parseInt(hoursStr, 10);
//           dosageMinutes = parseInt(minutesStr, 10);
//         }

//         const dosageDate = new Date(currentTime);
//         dosageDate.setHours(dosageHours, dosageMinutes, 0, 0);

//         const reminderDate = new Date(dosageDate.getTime() - 30 * 60 * 1000);

//         const isDosageTime =
//           currentTime.getHours() === dosageDate.getHours() &&
//           currentTime.getMinutes() === dosageDate.getMinutes();

//         const isReminderTime =
//           currentTime.getHours() === reminderDate.getHours() &&
//           currentTime.getMinutes() === reminderDate.getMinutes();

//         if (isDosageTime || isReminderTime) {
//           const {
//             user_id,
//             email,
//             first_name,
//             last_name,
//             is_randomized,
//             status,
//           } = medication;

//           console.log(medication, "-----------------");

//           //   if (parseInt(is_randomized) !== 1 || status !== "Randomized") {
//           //     console.log(
//           //       `User ${user_id} is not randomized or status is not 'Randomized'. Skipping email.`
//           //     );
//           //     return;
//           //   }

//           if (status !== "Randomized") {
//             console.log(
//               `User ${user_id} is not randomized or status is not 'Randomized'. Skipping email.`
//             );
//             return;
//           }

//           const medicineName = medication.medication_name;

//           const reminderType = isReminderTime
//             ? "first reminder (30 minutes before)"
//             : "second reminder (at dosage time)";

//           try {
//             await sendReminderEmail(
//               email,
//               decrypt(first_name),
//               decrypt(last_name),
//               medicineName,
//               reminderType
//             );

//             console.log(
//               `Reminder sent to ${email} for ${medicineName} (${reminderType})`
//             );
//           } catch (error) {
//             console.error("Error sending reminder email:", error);
//           }
//         }
//       })
//     );
//   } catch (error) {
//     console.error("Error fetching medications:", error);
//   }
// };

// const ENCRYPTION_KEY = Buffer.from(
//   "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
//   "base64"
// ); // Decoding Base64 key to Buffer
// const IV_LENGTH = 16; // For AES, this is always 16

// function decrypt(text) {
//   if (!text) return text; // Return if text is null or undefined
//   let textParts = text.split(":");
//   let iv = Buffer.from(textParts.shift(), "hex");
//   let encryptedText = Buffer.from(textParts.join(":"), "hex");
//   let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
//   let decrypted = decipher.update(encryptedText, "hex", "utf8");
//   decrypted += decipher.final("utf8");
//   return decrypted;
// }

// async function checkPatientsMedicineIntake(timezone) {
//   try {
//     // 1) Get all subjects who haven't submitted in the last 24-hour window
//     const missedSubjects =
//       await medicineModel.getSubjectsWhoHaveNotSubmittedInLast24Hours();

//     // If none missed, do nothing
//     if (!Array.isArray(missedSubjects) || missedSubjects.length === 0) {
//       console.log(
//         "No subjects have missed medication in the last 24 hours (8AM-8AM)."
//       );
//       return;
//     }

//     // 2) Group subjects by both study_enrolled_id and organization_detail_id
//     const subjectsByGroup = missedSubjects.reduce((acc, sub) => {
//       const studyId = sub.study_enrolled_id || "NOSTUDY";
//       const orgDetailId = sub.organization_detail_id || "NOORGDETAIL";
//       const key = `${studyId}-${orgDetailId}`;

//       if (!acc[key]) acc[key] = [];
//       acc[key].push(sub);

//       return acc;
//     }, {});

//     // 3) Get all potential recipients
//     const allRecipients = await medicineModel.getUsersToNotify(timezone);

//     // 4) For each group, gather ECRF IDs for those who missed and find matching recipients
//     for (const [groupKey, subjects] of Object.entries(subjectsByGroup)) {
//       const [studyId, orgDetailId] = groupKey.split("-");

//       // Filter recipients by both studyId and orgDetailId
//       const recipientsForGroup = allRecipients.filter(
//         (user) =>
//           String(user.study_enrolled_id) === String(studyId) &&
//           String(user.organization_detail_id) === String(orgDetailId)
//       );

//       // Create simplified logs for recipients
//       const simplifiedRecipients = recipientsForGroup.map((user) => ({
//         email: user.email,
//         study_id: user.study_enrolled_id,
//         org_detail_id: user.organization_detail_id,
//       }));

//       // Create simplified logs for subjects
//       const simplifiedSubjects = subjects.map((sub) => ({
//         ecrf_id: sub.ecrf_id,
//         study_id: sub.study_enrolled_id,
//         org_detail_id: sub.organization_detail_id,
//       }));

//       // Log group information
//       console.log("--- Group:", studyId, orgDetailId, "---");
//       console.log("Recipients:");
//       console.log(JSON.stringify(simplifiedRecipients, null, 2));
//       console.log("Subjects:");
//       console.log(JSON.stringify(simplifiedSubjects, null, 2));

//       if (!recipientsForGroup || recipientsForGroup.length === 0) {
//         console.log(
//           `No recipients found for study ${studyId} and org detail ${orgDetailId}`
//         );
//         continue;
//       }

//       // ECRF IDs for patients that missed
//       const ecrfIds = subjects.map((s) => s.ecrf_id);

//       // 5) Send email
//       try {
//         await medicationLogEmail(recipientsForGroup, ecrfIds);
//         console.log(
//           `Missed medication email sent to ${recipientsForGroup.length} recipient(s) for study ${studyId} and org detail ${orgDetailId}`
//         );
//       } catch (err) {
//         console.error(
//           `Error sending email for study ${studyId} and org detail ${orgDetailId}:`,
//           err.message || err
//         );
//       }
//     }
//   } catch (error) {
//     console.error("Error in checkPatientsMedicineIntake:", error);
//   }
// }

// async function TimezoneHandler() {
//   console.log("Timezone handler function called!");
//   try {
//     const result = await organizationModel.getAllOrganizationDetails();
//     console.log("Fetched all organization details result: ", result);

//     // Get unique timezones using Set
//     const uniqueTimezones = [...new Set(result.map((org) => org.timezone))];

//     uniqueTimezones.forEach((timezone) => {
//       console.log("Running cron job for " + timezone);
//       cron.schedule(
//         "00 08 * * *",
//         async () => {
//           try {
//             console.log("Check time");
//             await checkPatientsMedicineIntake(timezone);
//           } catch (error) {
//             console.error("Medication check failed:", error);
//           }
//         },
//         {
//           timezone: timezone,
//         }
//       );
//     });
//   } catch (error) {
//     console.log("error occurred while fetching organization details : ", error);
//   }
// }

// TimezoneHandler();

// module.exports = {
//   createMedicine: [
//     validateCreateMedicine,
//     handleValidationErrors,
//     createMedicine,
//   ],
//   createMedicineLogic,
//   getAllMedication,
//   getAllMedicationForInvestigator,
//   getMedicationById: [
//     validateGetMedicationById,
//     handleValidationErrors,
//     getMedicationById,
//   ],
//   getMedicationByUserId: [
//     validateGetMedicationByUserId,
//     handleValidationErrors,
//     getMedicationByUserId,
//   ],
//   updateMedication: [
//     validateUpdateMedication,
//     handleValidationErrors,
//     updateMedication,
//   ],
//   deleteMedication: [
//     validateDeleteMedication,
//     handleValidationErrors,
//     deleteMedication,
//   ],
//   getMedicationByUserIdforPortal,

//   submitMedicineRecordController,
//   getMedicineQuestionAndOptions,
//   submitMedicineQuestionResponses,
//   getMedicineRecordByUserId,
//   checkDosageTimesAndSendReminder,
//   disableMedicineRecord,
// };
