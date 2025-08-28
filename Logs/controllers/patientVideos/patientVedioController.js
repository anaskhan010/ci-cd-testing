const { body, validationResult } = require("express-validator");
const patientVideoModel = require("../../models/patientVideos/patientVideoModel.js");
const nonCompliantEmail = require("../../middleware/non-compliantEmail.js");
const organizationModel = require("../../models/organization/organizationModel.js");
const auditLog = require("../../middleware/audit_logger.js");
// Validation rules
const validateUploadPatientVideo = [
  body("user_id").notEmpty().withMessage("User ID is required"),
  body("medication_id").notEmpty().withMessage("Medication ID is required"),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: false, errors: errors.array() });
  }
  next();
};

const uploadPatientVideo = async function (req, res) {
  const { user_id, medication_id } = req.body;
  console.log(`Received video upload request for user ${user_id}`);

  try {
    // Check compliance status before proceeding with upload
    const isCompliant = await patientVideoModel.checkComplianceStatus(user_id);

    if (!isCompliant) {
      console.log(`User ${user_id} is Non-Compliant. Rejecting video upload.`);

      // Log the non-compliance rejection
      auditLog(
        "VIDEO_UPLOAD_ATTEMPT",
        "PatientVideo",
        null,
        { user_id, medication_id },
        `Video upload rejected: Non-compliant user ${user_id}`
      )(req, res, () => {});

      return res.status(403).send({
        message:
          "You are currently marked as Non-Compliant. Please contact the administrator for further assistance before uploading a new video.",
        subMessage: `Video upload rejected for non-compliant user ${user_id}`,
      });
    }

    const file = req.file;
    if (!file) {
      console.log(`No file uploaded for user ${user_id}`);

      // Log the missing file issue
      auditLog(
        "VIDEO_UPLOAD_ATTEMPT",
        "PatientVideo",
        null,
        { user_id, medication_id },
        `Video upload rejected: No file uploaded for user ${user_id}`
      )(req, res, () => {});

      return res.status(400).send({
        message: "Please upload a video file.",
        subMessage: `No file received for user ${user_id}`,
      });
    }

    const filePath = "videos/" + file.filename;
    console.log(`File path for user ${user_id}: ${filePath}`);

    // Create patient video entry
    try {
      await patientVideoModel.createPatientVideo(
        user_id,
        filePath,
        medication_id
      );

      // Log the successful video upload
      auditLog(
        "VIDEO_UPLOAD",
        "PatientVideo",
        null,
        { user_id, filePath, medication_id },
        `Video uploaded successfully for user ${user_id}`
      )(req, res, () => {});

      res.send({
        message: "Successfully uploaded video.",
        subMessage: `Successfully created patient video entry for user ${user_id}`,
      });

      // Recheck compliance status after successful upload
      await patientVideoModel.checkComplianceStatus(user_id);
    } catch (error) {
      console.error(
        `Error creating patient video entry for user ${user_id}:`,
        error
      );

      // Log the error in audit log
      auditLog(
        "VIDEO_UPLOAD_ERROR",
        "PatientVideo",
        null,
        { user_id, filePath, medication_id },
        `Error creating patient video entry: ${error.message}`
      )(req, res, () => {});

      res.status(500).send({
        message: error.message,
        subMessage: `Unexpected error during video upload process for user ${user_id}`,
      });
    }
  } catch (error) {
    console.error(
      `Unexpected error during video upload for user ${user_id}:`,
      error
    );

    // Log the unexpected error in audit log
    auditLog(
      "VIDEO_UPLOAD_ERROR",
      "PatientVideo",
      null,
      { user_id, medication_id },
      `Unexpected error during video upload process: ${error.message}`
    )(req, res, () => {});

    res.status(500).send({
      message: error.message,
      subMessage: `Unexpected error during video upload process for user ${user_id}`,
    });
  }
};

const getAllPatientVideos = function (req, res) {
  patientVideoModel
    .getAllPatientVideos()
    .then((allVideos) => {
      Promise.all(
        allVideos.map((video) => {
          return patientVideoModel
            .decryptPath(video.video_url)
            .then((decryptedPath) => {
              return {
                user_id: video.user_id,
                first_name: video.first_name,
                last_name: video.last_name,
                email: video.email,
                note: video.note,
                video_url: decryptedPath,
              };
            })
            .catch((error) => {
              console.error(
                "Error decoding path for video:",
                video.user_id,
                error.message
              );
              return {
                user_id: video.user_id,
                video_url: null,
              };
            });
        })
      )
        .then((decryptedVideos) => {
          res.json(decryptedVideos);
        })
        .catch((error) => {
          res.status(500).send(error.message);
        });
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
};

// get all patient videos for investigator
const getAllPatientVideosForInvestigator = function (req, res) {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  patientVideoModel
    .getAllPatientVideosForInvestigator(investigatorId)
    .then((allVideos) => {
      Promise.all(
        allVideos.map((video) => {
          return patientVideoModel
            .decryptPath(video.video_url)
            .then((decryptedPath) => {
              return {
                user_id: video.user_id,
                first_name: video.first_name,
                last_name: video.last_name,
                email: video.email,
                note: video.note,
                video_url: decryptedPath,
                medication_name: video.medication_name,
                dosage: video.dosage,
                frequency_type: video.frequency_type,
                frequency_time: video.frequency_time,
                frequency_condition: video.frequency_condition,
                medication_note: video.medication_note,
              };
            })
            .catch((error) => {
              console.error(
                "Error decoding path for video:",
                video.user_id,
                error.message
              );
              return {
                user_id: video.user_id,
                video_url: null,
              };
            });
        })
      )
        .then((decryptedVideos) => {
          res.json(decryptedVideos);
        })
        .catch((error) => {
          res.status(500).send(error.message);
        });
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
};

const getAllPatientVideosByid = function (req, res) {
  const user_id = req.params.user_id;
  console.log("user_id", user_id);

  patientVideoModel
    .getAllPatientVideosByid(user_id)
    .then((allVideos) => {
      if (allVideos.length === 0) {
        return res
          .status(404)
          .json({ message: "No videos found for this user" });
      }
      Promise.all(
        allVideos.map((video) => {
          return patientVideoModel
            .decryptPath(video.video_url)
            .then((decryptedPath) => {
              return {
                user_id: video.user_id,
                first_name: video.first_name,
                last_name: video.last_name,
                medication_name: video.medication_name,
                dosage: video.dosage,
                frequency: video.frequency,
                medication_note: video.medication_note,
                email: video.email,
                video_url: decryptedPath,
                date: video.created_at,
              };
            })
            .catch((error) => {
              console.error(
                "Error decoding path for video:",
                video.user_id,
                error.message
              );
              return {
                user_id: video.user_id,
                video_url: null,
              };
            });
        })
      )
        .then((decryptedVideos) => {
          res.json(decryptedVideos);
        })
        .catch((error) => {
          res.status(500).send(error.message);
        });
    })
    .catch((error) => {
      res.status(500).send(error.message);
    });
};

// const getAllPatientVideosByid = function (req, res) {
//   const user_id = req.params.user_id;
//   console.log("user_id", user_id);
//   const totalvideos = [];
//   patientVideoModel
//     .getAllPatientVideosByid(user_id)
//     .then((allVideos) => {
//       totalvideos.push(allVideos);
//       console.log(totalvideos, "ALl Vedios");
//       Promise.all(
//         totalvideos.map((video) => {
//           return patientVideoModel
//             .decryptPath(video.video_url)
//             .then((decryptedPath) => {
//               return {
//                 user_id: video.user_id,
//                 first_name: video.first_name,
//                 last_name: video.last_name,
//                 medication_name: video.medication_name,
//                 dosage: video.dosage,
//                 frequency: video.frequency,
//                 medication_note: video.medication_note,
//                 email: video.email,
//                 video_url: decryptedPath,
//               };
//             })
//             .catch((error) => {
//               console.error(
//                 "Error decoding path for video:",
//                 video.user_id,
//                 error.message
//               );
//               return {
//                 user_id: video.user_id,
//                 video_url: null,
//               };
//             });
//         })
//       )
//         .then((decryptedVideos) => {
//           res.json(decryptedVideos);
//         })
//         .catch((error) => {
//           res.status(500).send(error.message);
//         });
//     })
//     .catch((error) => {
//       res.status(500).send(error.message);
//     });
// };

module.exports = {
  uploadPatientVideo: [
    validateUploadPatientVideo,
    handleValidationErrors,
    uploadPatientVideo,
  ],
  getAllPatientVideos,
  getAllPatientVideosForInvestigator,
  getAllPatientVideosByid,
};
