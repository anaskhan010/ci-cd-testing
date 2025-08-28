const jwt = require("jsonwebtoken");
const emailManagementModel = require("../../models/emailManagementModel/emailManagemenetModel");

const getAllEmailTypesController = async (req, res) => {
  try {
    const result = await emailManagementModel.getAllEmailTypes();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

const createEmailTypeController = async (req, res) => {
  const { name, description } = req.body;

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const investigatorId = decoded.user_id;
    const result = await emailManagementModel.createEmailType(
      name,
      description,
      investigatorId
    );
    res.status(200).json({ message: "email Type created Sucessfully", result });
  } catch (error) {
    res.status(500).json(error);
  }
};

const getAllPersonelController = async (req, res) => {
  try {
    const result = await emailManagementModel.getAllPersonels();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

const getAllNotificationByPersonelIdController = async (req, res) => {
  const { personel_id } = req.query;
  console.log(personel_id, "==personel_id===");
  try {
    const result = await emailManagementModel.getAllNotificationByPersonelId(
      personel_id
    );
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json(error);
  }
};


const updateNotificationEnableDisableController = async (req, res) => {
  const { personel_id, notifications } = req.body;
  // notifications should be an array of objects with email_type_id and status
  
  try {
    if (!personel_id || !notifications || !Array.isArray(notifications)) {
      return res.status(400).json({ 
        error: "Invalid request format. Expected personel_id and notifications array." 
      });
    }
    
    const results = [];
    
    // Process each notification update
    for (const notification of notifications) {
      const { email_type_id, status } = notification;
      
      if (!email_type_id || status === undefined) {
        continue; // Skip invalid entries
      }
      
      const result = await emailManagementModel.updateNotificationEnableDisable(
        email_type_id,
        personel_id,
        status
      );
      
      results.push({
        email_type_id,
        status,
        updated: result.affectedRows > 0
      });
    }
    
    res.status(200).json({ 
      message: "Email notification preferences updated", 
      results 
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  createEmailTypeController,
  getAllEmailTypesController,
  getAllPersonelController,
  getAllNotificationByPersonelIdController,
  updateNotificationEnableDisableController,
};

// const jwt = require("jsonwebtoken");
// const emailManagementModel = require("../../models/emailManagementModel/emailManagemenetModel");

// const getAllEmailTypesController = async (req, res) => {
//   try {
//     const result = await emailManagementModel.getAllEmailTypes();
//     res.status(200).json(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };
// const getAllPersonel = async (req, res) => {
//   const { site_id, study_id } = req.query;
//   try {
//     const result = await emailManagementModel.getAllPersonels(
//       site_id,
//       study_id
//     );
//     res.status(200).json({ result });
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };
// const getAllSubject = async (req, res) => {
//   const { personel_id } = req.query;
//   try {
//     const result = await emailManagementModel.getAllSubjects(personel_id);
//     res.status(200).json({ result });
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const getEmailControlByidController = async (req, res) => {
//   const { email_type_id, personel_id } = req.query;
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const result = await emailManagementModel.getEmailControlByidModel(
//       email_type_id,
//       personel_id
//     );
//     res.status(200).json({ message: "Email Control fetched", result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const createEmailTypeController = async (req, res) => {
//   const { name, description } = req.body;

//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const investigatorId = decoded.user_id;
//     const result = await emailManagementModel.createEmailType(
//       name,
//       description,
//       investigatorId
//     );
//     res.status(200).json({ message: "email Type created Sucessfully", result });
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const createEmailControlController = async (req, res) => {
//   const { email_type_id, site_id, study_id, user_ids, personel_id } = req.body;
//   console.log(req.body, "==== email controller===");
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const investigatorId = decoded.user_id;
//     console.log(investigatorId, "==controller investigator id===");
//     const result = await emailManagementModel.createEmailControlModel(
//       email_type_id,
//       site_id,
//       study_id,
//       investigatorId,
//       user_ids,
//       personel_id
//     );
//     res.status(200).json({ message: "Email Assigned to Personel", result });
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const updateEmailControlController = async (req, res) => {
//   const { email_type_id, site_id, study_id, user_ids, personel_id } = req.body;
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//     const investigatorId = decoded.user_id;
//     const result = await emailManagementModel.updateEmailControlModel(
//       email_type_id,
//       site_id,
//       study_id,
//       investigatorId,
//       user_ids,
//       personel_id
//     );
//     res.status(200).json({ message: "Email Control updated", result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// module.exports = {
//   createEmailTypeController,
//   getAllEmailTypesController,
//   createEmailControlController,
//   getEmailControlByidController,
//   updateEmailControlController,
//   getAllPersonel,
//   getAllSubject,
// };
