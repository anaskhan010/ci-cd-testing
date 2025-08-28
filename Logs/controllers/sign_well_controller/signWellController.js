const fs = require("fs");
const fsPromises = fs.promises;
const signwell = require("@api/signwell");
const signModel = require("../../models/sign_well_model/signWellModel");
const organization = require("../../models/medication/medicineModel");
const multer = require("multer");
const path = require("path");
const { message } = require("paubox-node");
const crypto = require("crypto");
const sendPasscodeEmail = require("../../middleware/signwellPasscodeEmail");
const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);

function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined

  try {
    let textParts = text.split(":");

    // Handle case where there might be multiple colons in the encrypted text
    if (textParts.length < 2) {
      console.warn(
        "Warning: Encrypted text doesn't contain expected format. Returning original text."
      );
      return text;
    }

    // First part is the IV, the rest is the encrypted text (might contain colons)
    let iv = Buffer.from(textParts[0], "hex");
    let encryptedText = Buffer.from(textParts.slice(1).join(":"), "hex");

    let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.warn(
      `Decryption error: ${error.message}. Returning original text.`
    );
    return text; // Return the original text if decryption fails
  }
}

require("dotenv").config();

signwell.auth(process.env.SIGNWELL_API_KEY);

// Set up file upload handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../public/signed"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"), false);
    } else {
      cb(null, true);
    }
  },
});

// Generate a random passcode.

function generatePasscode() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let passcode = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    passcode += chars[randomIndex];
  }
  return passcode;
}

const createDocumentForSigning = async (req, res) => {
  const { userId, scale_id, day_id, investigatorId, filled_by } = req.body;

  let signee1_passcode = generatePasscode();
  let signee2_passcode = generatePasscode();

  // Check if a file is uploaded
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Step 1: Read the uploaded file and convert it to base64
    const fileBuffer = await fsPromises.readFile(req.file.path);
    const fileBase64 = fileBuffer.toString("base64");

    // Step 2: Get the organization/signee information
    const Signee1 = await organization.getOrganizationById(userId, userId);
    const Signee2 = await organization.getOrganizationById(
      investigatorId,
      investigatorId
    );

    console.log("Signee1 data:", JSON.stringify(Signee1, null, 2));
    console.log("Signee2 data:", JSON.stringify(Signee2, null, 2));

    // decrypt the first and last names for investigator
    const { first_name, last_name, email: investigatorEmail } = Signee2 || {};

    // Add additional logging to debug the decryption process
    console.log("Investigator first_name before decryption:", first_name);
    console.log("Investigator last_name before decryption:", last_name);

    const investigatorFirstName = first_name ? decrypt(first_name) : "Unknown";
    const investigatorLastName = last_name ? decrypt(last_name) : "Unknown";

    console.log(
      "Investigator first_name after decryption:",
      investigatorFirstName
    );
    console.log(
      "Investigator last_name after decryption:",
      investigatorLastName
    );

    let {
      first_name: subjectFirstName,
      last_name: subjectLastName,
      email: subjectEmail,
    } = Signee1 || {};

    // Add additional logging to debug the decryption process for subject
    console.log("Subject first_name before decryption:", subjectFirstName);
    console.log("Subject last_name before decryption:", subjectLastName);

    // Make sure we have valid values for the subject's name
    if (subjectFirstName) {
      try {
        subjectFirstName = decrypt(subjectFirstName);
      } catch (error) {
        console.warn(`Error decrypting subject first name: ${error.message}`);
        // Keep the original value if decryption fails
      }
    } else {
      subjectFirstName = "Unknown";
    }

    if (subjectLastName) {
      try {
        subjectLastName = decrypt(subjectLastName);
      } catch (error) {
        console.warn(`Error decrypting subject last name: ${error.message}`);
        // Keep the original value if decryption fails
      }
    } else {
      subjectLastName = "Unknown";
    }

    console.log("Subject first_name after decryption:", subjectFirstName);
    console.log("Subject last_name after decryption:", subjectLastName);

    // Step 3: Create the document data for SignWell API
    const documentData = {
      test_mode: false,
      files: [
        {
          name: req.file.originalname,
          file_base64: fileBase64,
        },
      ],
      name: "Document for Signing",
      subject: "Please sign this document",
      message: "This document requires your signature",
      recipients: [],
      embedded_signing: true,
      fields: [],
    };

    // Add recipients and fields based on filledBy value
    if (filled_by === "Investigator") {
      // Only send email to recipient2 (Investigator)
      documentData.recipients.push({
        id: "2",
        name: `${investigatorFirstName} ${investigatorLastName}`,
        email: investigatorEmail || "moe@sentrixmedia.com",
        send_email: true,
        message:
          "Your passcode has been sent to you through a separate email. This is a confidential email only intended for this recipient and should not be shared or forwarded to anyone under any circumstances.",
        passcode: signee2_passcode,
      });

      // Send the actual passcode via Paubox
      try {
        await sendPasscodeEmail(
          investigatorEmail || "moe@sentrixmedia.com",
          signee2_passcode,
          investigatorFirstName,
          investigatorLastName
        );
        console.log("Passcode email sent to investigator successfully");
      } catch (error) {
        console.error("Error sending passcode email to investigator:", error);
        // If Paubox email fails, revert to sending passcode through SignWell
        documentData.recipients[0].message = `Your passcode: ${signee2_passcode}. We attempted to send this through a separate email but encountered an issue. This is a confidential passcode only intended for this recipient and should not be shared or forwarded with anyone under any circumstances.`;
      }

      // Only add fields for recipient2
      documentData.fields.push([
        {
          x: 588,
          y: 55,
          page: 1,
          recipient_id: "2",
          type: "signature",
          required: true,
          api_id: "signature_2",
        },
      ]);
    } else if (filled_by === "Subject") {
      // Send email to both recipients
      documentData.recipients.push({
        id: "1",
        name: `${subjectFirstName} ${subjectLastName}`,
        email: subjectEmail || "moe@sentrixmedia.com",
        send_email: true,
        message:
          "Your passcode has been sent to you through a separate email. This is a confidential email only intended for this recipient and should not be shared or forwarded to anyone under any circumstances.",
        passcode: signee1_passcode,
      });

      // Send the actual passcode via Paubox
      try {
        await sendPasscodeEmail(
          subjectEmail || "moe@sentrixmedia.com",
          signee1_passcode,
          subjectFirstName,
          subjectLastName
        );
        console.log("Passcode email sent to subject successfully");
      } catch (error) {
        console.error("Error sending passcode email to subject:", error);
        // If Paubox email fails, revert to sending passcode through SignWell
        documentData.recipients[0].message = `Your passcode: ${signee1_passcode}. We attempted to send this through a separate email but encountered an issue. This is a confidential passcode only intended for this recipient and should not be shared or forwarded with anyone under any circumstances.`;
      }

      // Add fields for both recipients
      documentData.fields.push([
        {
          x: 350,
          y: 55,
          page: 1,
          recipient_id: "1",
          type: "signature",
          required: true,
          api_id: "signature_1",
        },
      ]);
    } else {
      throw new Error("Invalid filled_by value");
    }

    // Step 4: Send the document data to SignWell API
    console.log("Sending document data to SignWell with passcode notification");
    const postResponse = await signwell.postApiV1Documents(documentData);
    console.log("SignWell API Response received successfully");

    const documentId = postResponse.data.id;
    if (!documentId) {
      throw new Error("Document ID is missing from SignWell response");
    }

    // Step 5: Fetch the document details using SignWell API
    const getResponse = await signwell.getApiV1DocumentsId({ id: documentId });
    // console.log("Document details fetched:", getResponse.data);

    const recipients = getResponse.data.recipients;

    if (recipients.length < 1) {
      throw new Error(`Expected at least ${1} recipients from SignWell API`);
    }

    const recipient1 = recipients.find((recipient) => recipient.id === "1");
    const recipient2 = recipients.find((recipient) => recipient.id === "2");

    console.log(recipient1);
    console.log(
      "==========================================+++++++++++++++++++++++++++++++"
    );
    console.log(recipient2);

    if (filled_by === "Investigator" && !recipient2) {
      throw new Error("Missing recipient2 information");
    } else if (filled_by === "Subject" && !recipient1) {
      throw new Error("Missing recipient information");
    }

    // Prepare recipient data
    const recipient1_email = subjectEmail || null;
    const recipient2_email = investigatorEmail || null;
    const recipient1_status = recipient1?.status || null;
    const recipient2_status = recipient2?.status || null;
    const recipient1_bounced = recipient1?.bounced || null;
    const recipient2_bounced = recipient2?.bounced || null;
    const embeddedSigningUrl1 = recipient1?.embedded_signing_url || null;
    const embeddedSigningUrl2 = recipient2?.embedded_signing_url || null;

    // Step 6: Save the file to the "public/signed" folder
    const signedFolderPath = path.join(__dirname, "../../public", "signed"); // Adjust __dirname as needed
    // Ensure the 'signed' directory exists
    await fsPromises.mkdir(signedFolderPath, { recursive: true });

    const filePath = path.join(signedFolderPath, req.file.originalname);

    // Save the file to the public/signed directory
    await fsPromises.writeFile(filePath, fileBuffer);
    console.log(`File saved to ${filePath}`);

    // Step 7: Save the document information in your database
    const result = await signModel.saveDocumentForSigning(
      userId,
      scale_id,
      day_id,
      investigatorId,
      filePath,
      documentId,
      embeddedSigningUrl1,
      embeddedSigningUrl2,
      recipient1_email,
      recipient2_email,
      recipient1_status,
      recipient2_status,
      recipient1_bounced,
      recipient2_bounced,
      filled_by
    );

    // Step 8: Respond to the client with the combined data
    res.status(200).json({
      result,
      Signee1,
      Signee2,
      embeddedSigningUrl1,
      embeddedSigningUrl2,
      message: "Document Created for Signing",
      responseData: postResponse.data,
      documentFiles: getResponse.data,
      // Include passcodes in the response for debugging or as a last resort
      // These should be removed in production or handled more securely
      passcodes: {
        signee1_passcode: filled_by === "Subject" ? signee1_passcode : null,
        signee2_passcode:
          filled_by === "Investigator" ? signee2_passcode : null,
      },
    });
  } catch (error) {
    console.error("Error in createDocumentForSigning:", error);

    // Determine the type of error and respond accordingly
    if (error.response && error.response.data) {
      // Error from SignWell API
      res.status(500).json({
        error: "SignWell API Error",
        details: error.response.data,
      });
    } else if (
      error.message &&
      error.message.includes("Invalid encrypted text format")
    ) {
      // Specific error for decryption issues
      res.status(500).json({
        error: "Error creating document for signing",
        details:
          "There was an issue with decrypting user information. Please check that all user data is properly encrypted.",
        originalError: error.message,
        stack: error.stack,
      });
    } else {
      // General errors
      res.status(500).json({
        error: "Error creating document for signing",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  } finally {
    // Optional: Clean up the uploaded file if it's no longer needed
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error("Error deleting temporary file:");
        } else {
          console.log("Temporary file deleted");
        }
      });
    }
  }
};

const getSignedDocs = async (req, res) => {
  const { documentId } = req.params;

  signwell.auth(process.env.SIGNWELL_API_KEY);
  signwell
    .getApiV1DocumentsId({ id: documentId })
    .then(({ data }) => {
      console.log("data:", data);
      res.status(200).json(data.files);
    })
    .catch((err) => {
      console.error("Error fetching document details:", err);
      res.status(500).json({
        error: "Error fetching document details",
        details: err.message,
      });
    });
};

const refreshDocumentStatus = async (req, res) => {
  const { documentId } = req.params;

  try {
    // Fetch the latest document status from SignWell
    const { data } = await signwell.getApiV1DocumentsId({ id: documentId });

    console.log(data, "---------------------------------");

    // Extract the relevant information
    const recipients = data.recipients;
    const recipient1 = recipients.find((r) => r.id === "1");
    const recipient2 = recipients.find((r) => r.id === "2");

    // Prepare the data for database update
    const updateData = {
      recipient1_status: recipient1 && recipient1.status,
      recipient2_status: recipient2 && recipient2.status,
      recipient1_bounced: recipient1 && recipient1.bounced,
      recipient2_bounced: recipient2 && recipient2.bounced,
    };

    // Update the database
    await signModel.updateDocumentStatus(documentId, updateData);

    // Send the updated data back to the client
    res.status(200).json({
      message: "Document status refreshed successfully",
      data: updateData,
    });
  } catch (error) {
    console.error("Error refreshing document status:", error);
    res.status(500).json({
      error: "Error refreshing document status",
      details: error.message,
    });
  }
};

const getDbDocsByUserId = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id parameter" });
  }

  try {
    const result = await signModel.getDBDocumentByUserId(user_id);
    res.status(200).json({ result });
  } catch (error) {
    console.error("Error fetching documents by user_id:", error);
    res.status(500).json({
      error: "Error fetching documents",
      details: error.message,
    });
  }
};

const getCompletedDoucments = async (req, res) => {
  try {
    const { doc_id } = req.params;
    console.log(doc_id, "----------------------------------------");

    // Await the API call to ensure it completes
    const response = await signwell.getApiV1DocumentsIdCompleted_pdf({
      url_only: "true",
      audit_page: "true",
      id: `${doc_id}`,
    });

    // Check if response data exists and log or send it back to the client
    if (response && response.data.file_url) {
      console.log(response.data.file_url);
      res.status(200).json(response.data.file_url); // Respond with the data if successful
    } else {
      throw new Error("No data received from the API.");
    }
  } catch (err) {
    console.error("Error fetching document:", err);
    res.status(500).json({ error: "Failed to fetch completed document" });
  }
};

const archivalScale = async (req, res) => {
  const user_id = req.params.id;
  console.log(user_id, "==========check params===========");
  const { scale_id, day_id } = req.body;
  console.log(req.body, "--------req--------------");
  try {
    const result = await signModel.archivalScaleModel(
      user_id,
      scale_id,
      day_id
    );
    res.status(200).json({ message: "Scale Delete Sucessfully", result });
  } catch (error) {
    res.status(500).json(error);
  }
};

module.exports = {
  upload,
  createDocumentForSigning,
  getSignedDocs,
  getDbDocsByUserId,
  refreshDocumentStatus,
  getCompletedDoucments,
  archivalScale,
};
