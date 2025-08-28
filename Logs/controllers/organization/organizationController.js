var organizationModel = require("../../models/organization/organizationModel.js");
var crypto = require("crypto");
var { authMiddleware } = require("../../middleware/authMiddleware.js");
const roleModel = require("../../models/role/roleModel.js");
const { body, validationResult } = require("express-validator");
const sendEmail = require("../../middleware/sendMail.js");
const auditLog = require("../../middleware/audit_logger.js");
const auditLogs = require("../../middleware/auditLog_without_token.js");
const forgotPasswordEmail = require("../../middleware/forgotPasswordEmail.js");
var jwt = require("jsonwebtoken");
const {
  createMedicineLogic,
} = require("../../controllers/medication/medicineController.js");

const medicineModelCallForgetOrganizationByIdForDelete = require("../../models/medication/medicineModel.js");
require("dotenv").config();
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
); // Decoding Base64 key to Buffer

const {
  getAuthenticatedClient,
  getOrCreateFolderGraph,
  getSourceFileId,
  createFolder,
  copyFileToFolder,
} = require("./graphHelpers");

const axios = require("axios");
require("dotenv").config();
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}
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
const { ONE_DRIVE_FOLDER_NAME } = process.env;

var createOrganization = [
  // Validation rules…
  body("first_name").notEmpty().withMessage("First name is required"),
  body("middle_name").optional(),
  body("last_name").notEmpty().withMessage("Last name is required"),
  body("email")
    .isEmail()
    .withMessage("Invalid email address")
    .matches(/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)
    .withMessage("Invalid email format"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&]/)
    .withMessage("Password must contain at least one special character"),
  body("ecrf_id")
    .notEmpty()
    .withMessage("ecrf_id is required")
    .isLength({ min: 8, max: 8 })
    .withMessage("ecrf_id must be exactly 8 characters long")
    .custom(async (value) => {
      const ecrfIdExists = await organizationModel.ecrfIdExists(value);
      if (ecrfIdExists) {
        throw new Error("This ecrf_id already exists");
      }
      return true;
    }),

  // Actual route handler
  async function (req, res) {
    // Validation check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let {
      first_name,
      last_name,
      middle_name,
      email,
      password,
      status,
      gender,
      address,
      contact_number,
      date_of_birth,
      stipend,
      study_enrolled_id,
      notification,
      note,
      role_id,
      organization_detail_id,
      ecrf_id,
      timezone,
    } = req.body;

    // Convert study_enrolled_id to string if necessary
    const study_enrolled_ids = Array.isArray(study_enrolled_id)
      ? study_enrolled_id.join(",")
      : study_enrolled_id?.toString() || "";

    // Optional image file processing
    const image = req.file ? "patients/" + req.file.filename : null;

    // Hash sensitive fields
    const hashPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    const hashFirstName = encrypt(first_name);
    const hashMiddleName = middle_name ? encrypt(middle_name) : null;
    const hashLastName = encrypt(last_name);
    const hashGender = encrypt(gender);
    const hashContactNumber = encrypt(contact_number);
    const hashImage = image ? encrypt(image) : null;

    try {
      // Create organization record.
      // Your organizationModel.createOrganization should handle inserting the record
      // and return an object that contains at least the new user's id (result.userId).
      const result = await organizationModel.createOrganization(
        hashFirstName,
        hashMiddleName,
        hashLastName,
        status,
        hashGender,
        address,
        hashContactNumber,
        date_of_birth,
        stipend,
        study_enrolled_ids,
        notification,
        note,
        email,
        hashPassword,
        role_id,
        organization_detail_id,
        hashImage,
        ecrf_id,
        timezone
      );

      // Audit log and send welcome email
      const newData = {
        first_name,
        last_name,
        middle_name,
        email,
        status,
        gender,
        address,
        contact_number,
        date_of_birth,
        stipend,
        study_enrolled_ids,
        notification,
        note,
        role_id,
        organization_detail_id,
        ecrf_id,
        timezone,
      };
      auditLog(
        "CREATE",
        "Organization",
        null,
        newData,
        "New organization created"
      )(req, res, () => {});

      const emailSubject = `Welcome to ResearchHero – Account Activation Pending`;
      const emailText = `Dear ${first_name} ${last_name},

Thank you for registering with ResearchHero! Your account is under review and will be activated within the next 24 hours.

Best regards,
The Research Hero Team`;
      try {
        await sendEmail(email, emailSubject, emailText, first_name, last_name);
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
        return res.status(500).json({
          status: false,
          message: "Email sending failed",
          error: emailError.message,
        });
      }

      // --- Graph API Operations for OneDrive Folder Structure ---
      // Check for the authorization header to get the Graph API token
      if (!req.headers.authorization) {
        return res.status(401).json({
          status: false,
          message: "Authorization header is required for Graph API token.",
        });
      }
      const jwtToken = req.headers.authorization.split(" ")[1];
      if (!jwtToken) {
        return res.status(401).json({
          status: false,
          message: "Bearer token is missing or invalid.",
        });
      }
      // Get the Graph token from your auth endpoint
      async function getGraphToken() {
        try {
          const graphTokenResponse = await axios.get(
            "https://backend.research-hero.xyz/azure-auth/token",
            { headers: { Authorization: `Bearer ${jwtToken}` } }
          );
          return graphTokenResponse.data?.accessToken || null;
        } catch (error) {
          console.error("Error fetching Graph token:", error.message);
          return null;
        }
      }
      const newAccessToken = await getGraphToken();
      if (!newAccessToken) {
        return res.status(500).json({
          status: false,
          message: "Graph API access token is not available. Please try again.",
        });
      }
      const client = getAuthenticatedClient(newAccessToken);
      if (!client) {
        return res.status(500).json({
          status: false,
          message: "Failed to initialize Microsoft Graph client.",
        });
      }

      const rootFolderId = await getOrCreateFolderGraph(
        client,
        null,
        process.env.ONE_DRIVE_FOLDER_NAME
      );

      // 2. Retrieve the study name from your database using study_enrolled_id
      const studyName = await organizationModel.getStudyName(study_enrolled_id);
      if (!studyName) {
        return res
          .status(404)
          .json({ error: "Study not found for the provided study_id" });
      }
      const studyFolderId = await getOrCreateFolderGraph(
        client,
        rootFolderId,
        studyName
      );

      // 3. Retrieve the organization name using organization_detail_id
      const organizationName = await organizationModel.getOrganizationName(
        organization_detail_id
      );
      if (!organizationName) {
        return res.status(404).json({
          error:
            "Organization not found for the provided organization_detail_id",
        });
      }
      const organizationFolderId = await getOrCreateFolderGraph(
        client,
        studyFolderId,
        organizationName
      );

      // 4. Locate the source file in the Organization Folder (first Excel file)
      const sourceFileId = await getSourceFileId(client, organizationFolderId);

      // 5. Create a new subfolder under the Organization Folder named after the new user's ID.
      const userFolderId = await createFolder(
        client,
        organizationFolderId,
        result.userId.toString()
      );

      // 6. Copy the file from the Organization Folder into the new User Folder.
      // The copy function will now append the userId to the file name.
      const newFileId = await copyFileToFolder(
        client,
        sourceFileId,
        userFolderId,
        result.userId.toString()
      );

      // 7. Insert a record into the tlfb_subject table with the new file's source id and the new user's id.
      await organizationModel.createTLFBSubject({
        user_id: result.userId,
        source_id: newFileId,
      });

      return res.status(200).json({
        status: true,
        message: "Organization created and file copied successfully",
        result: result,
      });
    } catch (error) {
      console.error("Organization creation error:", error.message || error);
      if (
        error.message &&
        (error.message.includes("This email already exists") ||
          error.message.includes("This ecrf_id already exists"))
      ) {
        return res.status(400).json({
          status: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message || error,
      });
    }
  },
];

// Modify getEmbeddedLink to construct the correct embed link
const getEmbeddedLink = (embedUrl) => {
  let finalEmbedUrl = embedUrl;

  // Ensure action=embedview is present to enforce view mode
  if (!finalEmbedUrl.includes("action=embedview")) {
    if (finalEmbedUrl.includes("?")) {
      finalEmbedUrl += "&action=embedview";
    } else {
      finalEmbedUrl += "?action=embedview";
    }
  }

  // Add parameters to disable editing and interactivity
  // For Excel files, you can add wdAllowInteractivity=False
  finalEmbedUrl += "&wdAllowInteractivity=False";

  return finalEmbedUrl;
};

const createAnonymousSharingLink = async (client, fileId) => {
  try {
    // Create a sharing link with view permissions
    const response = await client
      .api(`/me/drive/items/${fileId}/createLink`)
      .post({
        type: "view",
        scope: "anonymous",
      });

    const webUrl = response.link.webUrl;

    // Construct the embed link
    const embedLink = getEmbeddedLink(webUrl);

    return embedLink;
  } catch (error) {
    console.error(`Error creating anonymous sharing link:`, error);
    throw error;
  }
};

const getTLFBMasterViewLink = async (req, res) => {
  const userId = req.params.user_id;

  console.log("User ID:", userId);

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "user_id parameter is required.",
    });
  }

  try {
    // Retrieve access token
    const accessToken = getGraphAccessToken();
    console.log("Access Token:", accessToken);
    if (!accessToken) {
      return res.status(500).json({
        status: false,
        message: "Graph API access token is not configured.",
      });
    }

    // Initialize the Microsoft Graph Client
    const client = getAuthenticatedClient(accessToken);

    // Step 1: Check if the folder exists
    const folderName = userId.toString();
    const folder = await getFolderByName(client, folderName);

    console.log("Folder found:", folder);

    if (!folder) {
      return res.status(404).json({
        status: false,
        message: `Folder for user_id ${userId} does not exist.`,
      });
    }

    // Step 2: Check if TLFB_Master_New.xlsx exists in the folder
    const fileName = "TLFB_Master_New.xlsx";
    const file = await getFileInFolder(client, folderName, fileName);

    if (!file) {
      return res.status(404).json({
        status: false,
        message: `File ${fileName} does not exist in the folder for user_id ${userId}.`,
      });
    }

    console.log("File found:", file);

    // Step 3: Create an embed link for the file
    let embedLink;
    try {
      const embedUrl = await createAnonymousSharingLink(client, file.id);
      embedLink = getEmbeddedLink(embedUrl);
    } catch (sharingError) {
      console.warn("Error creating anonymous sharing link:", sharingError);
      return res.status(500).json({
        status: false,
        message: "Failed to create embed link.",
        error: sharingError.message || sharingError,
      });
    }

    console.log("Embed Link:", embedLink);

    return res.status(200).json({
      status: true,
      message: `Embed link for ${fileName} retrieved successfully.`,
      viewLink: embedLink,
    });
  } catch (error) {
    console.error(
      "Error retrieving embed link for TLFB_Master_New.xlsx:",
      error
    );

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};
// Create Personnel Controller

var createPersonnel = [
  // Validation rules
  body("first_name").notEmpty().withMessage("First name is required"),
  body("middle_name").optional(),
  body("last_name").notEmpty().withMessage("Last name is required"),
  body("email")
    .isEmail()
    .withMessage("Invalid email address")
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage("Invalid email format"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("role_id")
    .isInt()
    .withMessage("Role ID must be an integer")
    .custom((value) => {
      if (value === 10) {
        throw new Error("Role Not Acceptable");
      }
      return true;
    }),
  // New validations for arrays of study and site IDs:
  // body("study_enrolled_ids")
  //   .isArray({ min: 1 })
  //   .withMessage("At least one study enrolled id is required"),
  // body("organization_detail_ids")
  //   .isArray({ min: 1 })
  //   .withMessage("At least one organization detail id is required"),

  // Request handler
  async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Destructure variables from req.body
    var {
      first_name,
      last_name,
      middle_name,
      email,
      password,
      status,
      gender,
      address,
      contact_number,
      date_of_birth,
      notification,
      note,
      role_id,
      study_enrolled_ids,
      organization_detail_ids,
      timezone,
    } = req.body;

    study_enrolled_ids = JSON.parse(study_enrolled_ids);
    organization_detail_ids = JSON.parse(organization_detail_ids);

    console.log(
      "ORGANIZATION DETAIL IDS AND STUDY ENROLLED IDS ----------==========="
    );
    console.log(study_enrolled_ids);
    console.log(typeof study_enrolled_ids);
    console.log(organization_detail_ids);
    console.log(typeof organization_detail_ids);

    var image = req.file ? "patients/" + req.file.filename : null;
    var hashPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    var hashFirstName = encrypt(first_name);
    var hashMiddleName = middle_name ? encrypt(middle_name) : null;
    var hashLastName = encrypt(last_name);
    var hashGender = encrypt(gender);
    var hashContactNumber = encrypt(contact_number);
    var hashImage = image ? encrypt(image) : null;

    // For the primary insertion into the organization table, pick the first element from the arrays.
    const primaryStudyEnrolledId = study_enrolled_ids[0];
    const primaryOrganizationDetailId = organization_detail_ids[0];

    try {
      // Create the personnel record
      var result = await organizationModel.createPersonnelModel(
        hashFirstName,
        hashMiddleName,
        hashLastName,
        status,
        hashGender,
        address,
        hashContactNumber,
        date_of_birth,
        primaryStudyEnrolledId,
        notification,
        note,
        email,
        hashPassword,
        role_id,
        primaryOrganizationDetailId,
        hashImage,
        timezone
      );

      // NEW FUNCTIONALITY:
      // For each combination of organization_detail_id (site) and study_enrolled_id (study),
      // insert a record into personnel_assigned_sites_studies and then assign subjects.
      await organizationModel.assignSitesStudiesAndSubjects(
        result.userId, // personnel_id
        organization_detail_ids, // array of site IDs
        study_enrolled_ids // array of study IDs
      );

      // Audit Log for personnel creation
      auditLog(
        "CREATE",
        "personnel",
        null, // No old value since it's a new record
        result, // Log the created personnel as the new value
        `Personnel created with email: ${email}`
      )(req, res, () => {});

      // Email sending code remains the same
      const emailSubject = `Welcome to ResearchHero – Account Activation Pending`;

      try {
        const emailResponse = await sendEmail(
          email,
          emailSubject,

          first_name,
          last_name
        );
        console.log("Email sent response:", emailResponse);
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
        return res.status(500).json({
          status: false,
          message: "Email sending failed",
          error: emailError.message,
        });
      }

      res.status(200).json({
        status: true,
        message: "Personnel Created Successfully",
        result: result,
      });
    } catch (error) {
      console.log("Personnel creation error:", error.message || error);
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message || error,
      });
    }
  },
];

const signinOrganization = async function (req, res) {
  const email = req.body.email;
  const password = req.body.password;

  console.log("============", email, password);

  try {
    const userExist = await organizationModel.isUserExist(email);
    if (userExist.length === 0) {
      // Audit log for non-existent user
      auditLog(
        "SIGNIN_ATTEMPT",
        "Organization",
        null, // No old value as the user does not exist
        { email },
        "Sign-in attempt failed: User does not exist"
      )(req, res, () => {});

      return res
        .status(404)
        .json({ status: false, message: "User Doesn't Exist" });
    }

    const user = await organizationModel.signinOrganization(email, password);

    if (user?.status === "PasswordExpired") {
      auditLog(
        "PASSWORD_EXPIRED",
        "Organization",
        { email },
        null,
        "Sign-in attempt failed: Password expired"
      )(req, res, () => {});

      return res.status(401).json({
        status: false,
        message: user.message,
        requiresPasswordReset: user.requiresPasswordReset,
      });
    }

    if (user && user.status) {
      if (user.status === "Blocked") {
        // Audit log for blocked user
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Blocked" },
          null, // No new value as the action is blocked
          "Sign-in attempt failed: Account blocked"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your Account has been locked. Please contact administrator.",
        });
      } else if (user.status === "Pending") {
        // Audit log for pending account
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Pending" },
          null,
          "Sign-in attempt failed: Account pending approval"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your registration account is still pending. Please wait for approval.",
        });
      } else if (user.status === "Disabled") {
        // Audit log for disabled account
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Disabled" },
          null,
          "Sign-in attempt failed: Account disabled"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your account has been disabled. Please contact administrator.",
        });
      } else if (user.status === "Deleted") {
        // Audit log for deleted account
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Deleted" },
          null,
          "Sign-in attempt failed: Account deleted"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message: "Your account has been deleted.",
        });
      } else if (user.status === "Withdrew Consent") {
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Withdrew Consent" },
          null,
          "Sign-in attempt failed: Withdrew Consent"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your account has been Withdrew Consent. Please contact administrator.",
        });
      } else if (user.status === "Lost to Follow up") {
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Lost to Follow up" },
          null,
          "Sign-in attempt failed: Lost to Follow up"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your account has been Lost to Follow up. Please contact administrator.",
        });
      } else if (user.status === "Dropped") {
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email, status: "Dropped" },
          null,
          "Sign-in attempt failed: Dropped"
        )(req, res, () => {});

        return res.status(403).json({
          status: false,
          message:
            "Your account has been Dropped. Please contact administrator.",
        });
      } else {
        // Audit log for invalid email or password
        auditLog(
          "SIGNIN_ATTEMPT",
          "Organization",
          { email },
          null,
          "Sign-in attempt failed: Invalid email or password"
        )(req, res, () => {});

        return res
          .status(400)
          .json({ status: false, message: "invalid email or password" });
      }
    }

    if (!user) {
      // Audit log for invalid credentials
      auditLogs(
        "SIGNIN_ATTEMPT",
        "Organization",
        { email },
        null,
        "Sign-in attempt failed: Invalid email or password"
      )(req, res, () => {});

      return res
        .status(400)
        .json({ status: false, message: "invalid email or password" });
    }

    const userRole = await roleModel.getUserRole(user.user_id); // Fetch the user role

    if (!userRole) {
      // Audit log for missing role
      auditLog(
        "SIGNIN_ATTEMPT",
        "Organization",
        { email, user_id: user.user_id },
        null,
        "Sign-in attempt failed: Role not found"
      )(req, res, () => {});

      return res.status(500).json({ status: false, message: "Role Not Found" });
    }

    console.log("controller user role", userRole);
    const role = userRole;
    console.log("controller user role", role);

    const token = authMiddleware({
      user_id: user.user_id,
      email: user.email,
      role: userRole.role_id, // Pass the role in token
      role_name: userRole.role_name,
    });

    console.log("Generated Token:", token);

    const newUser = {
      user_id: user.user_id,
      email: user.email,
      role: userRole.role_id,
      role_name: userRole.role_name,
      passwordChangebyAdmin: user.reset_by_admin,
    };

    console.log("checking controller user token", newUser);

    // Audit log for successful sign-in
    auditLog(
      "SIGNIN",
      "Organization",
      null, // No old value for successful login
      null,
      "User signed in successfully",
      (optionalToken = token)
    )(req, res, () => {});

    return res.status(201).json({
      status: true,
      message: "User Signin Successfully",
      user: newUser,
      token: token,
    });
  } catch (error) {
    console.error(error);

    // Audit log for internal server error during sign-in
    auditLog(
      "SIGNIN_ERROR",
      "Organization",
      { email },
      null,
      `Sign-in attempt failed: ${error.message}`
    )(req, res, () => {});

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

var getAllOrganizations = async function (req, res) {
  try {
    var organizations = await organizationModel.getAllOrganizations();
    // Decrypt the fields after fetching the data

    res.status(200).json({
      status: true,
      message: "All Organizations",
      organizations: organizations,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

// get all organization users roles without role id 10
var getAllOrganizationsRolesUser = async function (req, res) {
  try {
    var organizations = await organizationModel.getAllOrganizationsRolesUser();
    // Decrypt the fields after fetching the data

    res.status(200).json({
      status: true,
      message: "All Organizations role users",
      organizations: organizations,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

var getAllOrganizations = async function (req, res) {
  try {
    // Extract the token from the Authorization header
    const token = req.headers.authorization.split(" ")[1];

    // Decode the token
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    console.log("decoded", decoded);

    const personelId = decoded.user_id;

    // Fetch all organizations for role 9
    organizations = await organizationModel.getAllOrganizations(personelId);

    return res.status(200).json({
      status: true,
      message: "All Organizations",
      organizations: organizations,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// get all organizations for an investigator
var getAllOrganizationsForInvestigator = async function (req, res) {
  try {
    const investigatorId = req.params.id;

    if (!investigatorId) {
      return res.status(400).json({
        status: false,
        message: "Investigator ID is required",
      });
    }

    var organizations =
      await organizationModel.getAllOrganizationsForInvestigator(
        investigatorId
      );

    res.status(200).json({
      status: true,
      message: "Organizations for Investigator",
      organizations: organizations,
    });
  } catch (error) {
    if (
      error.message === "User is not a Principal Investigator" ||
      error.message === "No organization found for this investigator"
    ) {
      res.status(403).json({
        status: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
};

var getOrganizationById = async function (req, res) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const tokenUserId = decoded.user_id;
    const roleId = decoded.role;

    const paramUserId = req.params.id;

    // We call the model function
    const organization = await organizationModel.getOrganizationById(
      paramUserId,
      tokenUserId
    );

    if (!organization) {
      // 404 if the query returned no rows
      return res.status(404).json({
        status: false,
        message: "No organization found for this user ID",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Organization info",
      organization: organization,
    });
  } catch (error) {
    // Check for known status codes
    if (error.statusCode === 401) {
      return res.status(401).json({
        status: false,
        message: error.message || "Unauthorized",
      });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({
        status: false,
        message: error.message || "Not found",
      });
    }

    // Otherwise, it's an internal server error
    console.error("Unexpected error in getOrganizationById:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

function isValidStatusTransition(oldStatus, newStatus) {
  // Define valid transitions from each status
  const validTransitions = {
    Screened: ["Randomized", "Screen Failed", "Withdrew Consent"],
    Randomized: [
      "Completed",
      "Early Termination",
      "Dropped",
      "Lost to Follow up",
      "Withdrew Consent",
    ],
    "Screen Failed": ["Screening"],
    "Early Termination": ["Completed"],
    Dropped: ["Completed"],
    Completed: ["Randomized"], // Can only go back to Randomized, not to problem statuses
    "Withdrew Consent": ["Screening", "Randomized"],
    "Lost to Follow up": ["Randomized", "Completed"],
  };

  // If status isn't changing, it's always valid
  if (oldStatus === newStatus) {
    return true;
  }

  // Check if the transition is valid
  return (
    validTransitions[oldStatus] &&
    validTransitions[oldStatus].includes(newStatus)
  );
}

var updateOrganization = [
  // Validation rules
  body("first_name").notEmpty().withMessage("First name is required"),
  body("middle_name").optional(),
  body("last_name").notEmpty().withMessage("Last name is required"),
  body("contact_number").isMobilePhone().withMessage("Invalid contact number"),

  async function (req, res) {
    var organization_id = req.params.id;

    // Retrieve the existing organization data
    let oldData;
    try {
      oldData = await organizationModel.getOrganizationByIdForLog(
        organization_id
      );

      console.log(oldData, "=======old Data====================== ");

      if (!oldData) {
        return res.status(404).json({
          status: false,
          message: "Organization not found",
        });
      }
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "Failed to retrieve organization data",
        error: error,
      });
    }

    // Destructure and process request body
    var {
      email,
      first_name,
      middle_name,
      last_name,
      status,
      gender,
      address,
      contact_number,
      date_of_birth,
      stipend,
      study_enrolled_id,
      notification,
      note,
      ecrf_id,
      user_id,
      investigator_id,
      reason,
    } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
    const roleId = decoded.role;
    if (
      !first_name ||
      !status ||
      !gender ||
      !address ||
      !contact_number ||
      !date_of_birth ||
      !user_id
    ) {
      return res.status(400).json({
        message: "Some required fields are missing.",
      });
    }

    // Validate status transition
    if (status !== oldData.status) {
      if (!isValidStatusTransition(oldData.status, status)) {
        return res.status(400).json({
          status: false,
          message: `Cannot change status from '${oldData.status}' to '${status}'. This transition is not allowed.`,
        });
      }
    }

    var study_enrolled_ids = Array.isArray(study_enrolled_id)
      ? study_enrolled_id.join(",")
      : study_enrolled_id?.toString() || "";

    var image = req.file ? "patients/" + req.file.filename : null;

    // Hash the fields
    var hashFirstName = encrypt(first_name);
    var hashMiddleName = (middle_name && encrypt(middle_name)) || "";
    var hashLastName = encrypt(last_name);
    var hashGender = encrypt(gender);
    var hashContactNumber = encrypt(contact_number);
    var hashimage = image ? encrypt(image) : null;
    //var email = email || "";

    // Prepare new data for logging
    const newData = {
      user_id,
      first_name: decrypt(hashFirstName),
      middle_name: decrypt(hashMiddleName),
      last_name: decrypt(hashLastName),
      status,
      gender: decrypt(hashGender),
      address,
      contact_number: decrypt(hashContactNumber),
      stipend,
      notification,
      ecrf_id,
      reason,
    };

    if (
      oldData.status === "Randomized" &&
      (newData.first_name !== oldData.first_name ||
        newData.last_name !== oldData.last_name)
    ) {
      return res.status(400).json({
        status: false,
        message:
          "The first name and last name  cannot be updated because the subject's status is set to Randomized",
      });
    }

    try {
      // Check if ecrf_id already exists
      if (ecrf_id) {
        const ecrfExists = await organizationModel.checkEcrfIdExists(
          ecrf_id,
          organization_id
        );
        if (ecrfExists) {
          return res.status(400).json({
            status: false,
            message: "ecrf_id already exists",
          });
        }
      }

      if (status === "Screened") {
        const orgRandomizedData = await organizationModel.getisRandomized(
          organization_id
        );
        if (parseInt(orgRandomizedData.is_randomized) === 1) {
          return res.status(400).json({
            status: false,
            message: "Subject is already randomized",
          });
        }
      }

      // Update the organization (without is_randomized)
      await organizationModel.updateOrganization(
        organization_id,
        email,
        hashFirstName,
        hashMiddleName,
        hashLastName,
        status,
        hashGender,
        address,
        hashContactNumber,
        date_of_birth,
        stipend,
        study_enrolled_ids,
        notification,
        note,
        ecrf_id,
        hashimage,
        reason,
        user_id,
        investigator_id
      );

      let orgData = await organizationModel.getisRandomized(organization_id);

      console.log("orgData.is_randomized:", orgData.is_randomized);
      console.log(
        "Type of orgData.is_randomized:",
        typeof orgData.is_randomized
      );

      // If status is "Randomized"
      if (status === "Randomized") {
        // Check if is_randomized is 0
        if (parseInt(orgData.is_randomized) === 0) {
          // Create the medicine
          const params = {
            medication_name: "Sunobinop Or Placebo",
            dosage: "0.5mg or 1.0mg or 2.0mg",
            dosage_times: ["09:00 PM"],
            frequencyType: "QD",
            frequencyTime: "N/A",
            frequencyCondition: "At Bedtime",
            dosageType: "Tablet",
            allot_medicine: "1",
            route: "Oral",
            note: "Auto-created medicine",
            user_id: user_id,
            investigator_id: investigator_id,
            tracker_time: new Date().toISOString(),
          };

          try {
            const medicineResult = await createMedicineLogic(params);
            console.log("Medicine created successfully:", medicineResult);
            await auditLog(
              "CREATE",
              "Auto Create Medicine Due to Subject Status Update",
              null,
              params,
              "Auto Create Medicine"
            )(req, res, () => {});
            // After creating medicine, update is_randomized to 1
            await organizationModel.updateIsRandomized(organization_id, 1);
          } catch (error) {
            console.error("Error creating medicine:", error);
            // Handle the error as needed
          }
        } else {
          // is_randomized == 1, do not create medicine
          console.log("Medicine already created for this organization.");
        }
      }
      const changedFieldsOld = {};
      const changedFieldsNew = {};

      for (const key in newData) {
        const newValue = newData[key];

        // Skip if the new value is null (or an empty string if needed)
        if (newValue === "") {
          continue;
        }

        const oldValue = oldData[key];
        if (oldData === null) {
          continue;
        }
        // If the values differ, log the change
        if (oldValue !== newValue) {
          changedFieldsOld[key] = oldValue;
          changedFieldsNew[key] = newValue;
        }
      }

      changedFieldsOld.user_id = user_id;

      // Log the update
      auditLog(
        "UPDATE",
        "Organization",
        changedFieldsOld, // Old values (only changed fields)
        changedFieldsNew, // New values (only changed fields)
        req.body.reason || "No Reason Provided"
      )(req, res, () => {});

      res.status(200).json({
        status: true,
        message: "Organization Updated Successfully",
        organization: organization_id,
      });
    } catch (error) {
      console.error("Update Error:", error);
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message || error,
      });
    }
  },
];

//delete organization
var deleteOrganization = async function (req, res) {
  var user_id = req.params.id;
  var reason = req.body.reason;

  // Check if the reason field is provided
  if (!reason) {
    return res.status(401).json({ message: "Reason field is required" });
  }

  // Retrieve the existing organization data before deletion
  let oldData;
  try {
    oldData =
      await medicineModelCallForgetOrganizationByIdForDelete.getOrganizationById(
        user_id
      );

    if (!oldData) {
      return res.status(404).json({ message: "Organization not found" });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Failed to retrieve organization data",
      error: error,
    });
  }

  if (
    oldData.status === "Randomized" ||
    oldData.status === "Completed" ||
    oldData.status === "Early Termination"
  ) {
    return res.status(400).json({
      status: false,
      message: `Cannot delete a ${oldData.status} subject`,
    });
  }

  const token = req.headers.authorization.split(" ")[1];

  // Decode the token
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  console.log("decoded", decoded);
  const investigatorId = decoded.user_id;
  try {
    // Perform the delete operation
    var result = await organizationModel.deleteOrganization(
      user_id,
      investigatorId,
      reason
    );

    // Log the delete operation
    auditLog(
      "DELETE",
      "Organization",
      oldData, // Store the old data before deletion
      null, // No new data since it's a delete operation
      reason // Reason for the deletion
    )(req, res, () => {});

    res.status(200).json({
      status: true,
      message: "Organization Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

// =====================Create Organization Details Controller =======================

var createOrganizationDetails = [
  // Validation rules
  body("organization_name")
    .notEmpty()
    .withMessage("Organization name is required"),
  body("organization_address")
    .notEmpty()
    .withMessage("Organization address is required"),

  // Request handler
  async function (req, res) {
    var { organization_name, organization_address, timezone } = req.body;

    try {
      // Check if organization name or address already exists
      const existingOrganization =
        await organizationModel.getOrganizationByNameOrAddress(
          organization_name,
          organization_address
        );

      if (existingOrganization) {
        if (existingOrganization.organization_name === organization_name) {
          return res
            .status(400)
            .json({ message: "Organization name already exists." });
        }
        if (
          existingOrganization.organization_address === organization_address
        ) {
          return res
            .status(400)
            .json({ message: "Organization address already exists." });
        }
      }

      // Create the new organization detail
      var result = await organizationModel.createOrganizationDetail(
        organization_name,
        organization_address,
        timezone
      );

      const newData = {
        organization_name: organization_name,
        organization_address: organization_address,
        timezone: timezone,
      };

      // Log the creation with the new data
      auditLog(
        "CREATE",
        "Site",
        null, // No old value as this is a creation
        newData, // Log the newly created organization details as new value
        "New Site created"
      )(req, res, () => {});

      res.status(200).json({
        status: true,
        message: "Organization Created Successfully",
        result: result,
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
];

var updateOrganizationDetails = [
  // Validation rules
  body("organization_address")
    .notEmpty()
    .withMessage("Organization address is required"),
  body("organization_detail_id")
    .notEmpty()
    .withMessage("Organization detail id is required"),

  // Request handler
  async function (req, res) {
    var { organization_address, organization_detail_id, timezone } = req.body;

    try {
      // Fetch the existing organization detail (old value)
      var oldValue = await organizationModel.getOrganizationDetailById(
        organization_detail_id
      );
      if (!oldValue) {
        return res.status(404).json({ message: "Organization not found." });
      }

      // Check if organization name or address exists for a different ID
      const existingOrganization =
        await organizationModel.getOrganizationByAddressForDifferentId(
          organization_address,
          organization_detail_id
        );

      if (existingOrganization) {
        return res
          .status(400)
          .json({ message: "Organization address already exists." });
      }

      // Update the organization detail
      var result = await organizationModel.updateOrganizationDetail(
        organization_address,
        organization_detail_id,
        timezone
      );

      const newData = {
        organization_detail_id: organization_detail_id,
        organization_address: organization_address,
      };

      // Log the update with old and new values
      auditLog(
        "UPDATE",
        "Site",
        oldValue,
        newData,
        "Site details updated"
      )(req, res, () => {});

      res.status(200).json({
        status: true,
        message: "Organization Updated Successfully",
        result: result,
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
];

// get all organizations details controller

var getAllOrganizationsDetails = async function (req, res) {
  try {
    var organizations = await organizationModel.getAllOrganizationDetails();
    res.status(200).json({
      status: true,
      message: "All Organizations",
      organizations: organizations,
    });
  } catch (error) {
    res
      .status(500)
      .json({ status: false, message: "Internal Server Error", error: error });
  }
};

// get all organization controller where satus = non compaliant
const getPatientNonCompliant = async (req, res) => {
  try {
    const result = await organizationModel.getNonComplaint();
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};

// get Non Compliant patients for investigator
const getPatientNonCompliantForInvestigator = async (req, res) => {
  const investigatorId = req.params.id;

  if (!investigatorId) {
    return res.status(400).json({ error: "Investigator ID is required" });
  }

  try {
    const result = await organizationModel.getNonCompliantForInvestigator(
      investigatorId
    );
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const updatePassword = [
  // Validation Chains for the new password
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&]/)
    .withMessage("Password must contain at least one special character"),

  // Handler Function
  async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { oldPassword, newPassword, userId } = req.body;

    try {
      // Retrieve the user record
      const user = await organizationModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Determine if the password has expired (e.g., older than 6 months)
      let passwordExpired = false;
      if (user.password_set_date) {
        const passwordSetDate = new Date(user.password_set_date);
        const expiryDate = new Date(passwordSetDate);
        expiryDate.setMonth(expiryDate.getMonth() + 6);
        passwordExpired = new Date() > expiryDate;
      } else {
        passwordExpired = true;
      }

      // If the password is not expired, require the old password for verification.
      if (!passwordExpired) {
        if (!oldPassword) {
          return res.status(400).json({ message: "Old password is required" });
        }
        const oldPasswordHash = crypto
          .createHash("sha256")
          .update(oldPassword)
          .digest("hex");

        if (user.password !== oldPasswordHash) {
          return res.status(400).json({ message: "Old password is incorrect" });
        }
      }

      // Always ensure the new password is not the same as the current one.
      const newPasswordHash = crypto
        .createHash("sha256")
        .update(newPassword)
        .digest("hex");

      if (user.password === newPasswordHash) {
        return res.status(400).json({
          message: "New password cannot be the same as the current password",
        });
      }

      // Retrieve the last two passwords from history for this user
      const history = await organizationModel.getPasswordHistory(userId);
      if (history.includes(newPasswordHash)) {
        return res.status(400).json({
          message: "New password cannot be one of your last two passwords",
        });
      }

      // Before updating, add the current password to the password history
      await organizationModel.addPasswordHistory(userId, user.password);

      // Update the user's password (this also updates password_set_date and resets expiration flags)
      await organizationModel.updateUserPassword(userId, newPasswordHash);

      // Log the update (without logging sensitive values)
      auditLog(
        "UPDATE",
        "Password",
        null,
        null,
        `Password updated for user ID: ${userId}`
      )(req, res, () => {});

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
];

var getUserDetails = async function (req, res) {
  var userId = req.params.id;
  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const roleId = decoded.role;

  try {
    var userDetails = await organizationModel.getUserDetails(userId, roleId);

    if (!userDetails) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "User details retrieved successfully",
      data: userDetails,
    });
  } catch (error) {
    console.error("Error retrieving user details:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

const forgotPassword = async function (req, res) {
  const { email } = req.body;

  try {
    const user = await organizationModel.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);

    await organizationModel.storeOtp(email, otp, expireAt);

    const subject = "Your Password Reset OTP";

    await forgotPasswordEmail(email, subject, otp);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyOtp = async function (req, res) {
  const { email, otp } = req.body;
  console.log(
    email,
    otp,
    "===============check email & otp =================="
  );

  try {
    // Step 1: Retrieve the OTP record from the otp_generator table
    const otpRecord = await organizationModel.getOtpRecord(email, otp);
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Step 2: Check if the OTP has expired
    const currentTime = new Date();
    if (currentTime > otpRecord.expire_at) {
      return res.status(400).json({ message: "OTP has expired" });
    }
    // Step 3: Generate a token after successful OTP verification
    const token = jwt.sign(
      { email: email },
      "HJSDHDSLDLSDJSL", // Use a strong secret stored in your environment variables
      { expiresIn: "1h" } // Token validity (e.g., 1 hour)
    );

    // Step 4: Update the otp_generator table with the generated token
    await organizationModel.updateOtpWithToken(otpRecord.otp_id, token);

    // Optionally, invalidate the OTP after successful verification (if needed)

    // Step 5: Return the token to the client
    res.status(200).json({ message: "OTP verified successfully.", token });
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resetPassword = [
  // Validation Chains
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&]/)
    .withMessage("Password must contain at least one special character"),

  // Handler Function
  async function (req, res) {
    // Handle validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, newPassword, token } = req.body;

    try {
      // Step 1: Validate the token by checking it against the otp_generator table
      const otpRecord = await organizationModel.getOtpRecordByToken(
        email,
        token
      );
      if (!otpRecord) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Step 2: Ensure the new password is not the same as the current password or any previous ones
      const user = await organizationModel.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate the hash of the new password
      const newPasswordHash = crypto
        .createHash("sha256")
        .update(newPassword)
        .digest("hex");

      // Check against current password
      if (user.password === newPasswordHash) {
        return res.status(400).json({
          message: "New password must not be the same as the current password",
        });
      }

      // Retrieve the user's password history (all records; sliding window maintained in addPasswordHistory)
      const passwordHistory = await organizationModel.getPasswordHistory(
        user.user_id
      );
      if (passwordHistory.includes(newPasswordHash)) {
        return res.status(400).json({
          message:
            "New password must not be the same as any of your previous passwords",
        });
      }

      // Step 3: Add the current password to the history before updating
      await organizationModel.addPasswordHistory(user.user_id, user.password);

      // Step 4: Update the user's password in the database (this also resets password_set_date and marks the password as expired if needed)
      await organizationModel.updateUserPasswordModel(email, newPasswordHash);

      // Log the password reset without including sensitive values
      auditLog(
        "UPDATE",
        "Password",
        null, // No old value logged
        null, // No new value logged
        `Password reset for user email: ${email}`
      )(req, res, () => {});

      // Respond with a success message
      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
];

const getInvestigatorByStudyId = (study_id) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.user_id, u.email AS investigator_email,
             o.first_name AS investigator_first_name,
             o.last_name AS investigator_last_name
      FROM study_enrolled AS se
      JOIN organization AS o ON FIND_IN_SET(se.enrolled_id, o.study_enrolled_id) > 0
      JOIN user_role AS ur ON o.user_id = ur.user_id
      JOIN user AS u ON o.user_id = u.user_id
      WHERE se.enrolled_id = ? AND ur.role_id = 12;
    `;

    db.query(query, [study_id], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return reject(
          new Error("No investigators found for the specified study_id")
        );
      }

      const investigators = results.map((investigator) => {
        return {
          user_id: investigator.user_id,
          investigator_email: investigator.investigator_email,
          investigator_first_name: decrypt(
            investigator.investigator_first_name
          ),
          investigator_last_name: decrypt(investigator.investigator_last_name),
        };
      });
      resolve(investigators);
    });
  });
};
const getOrganizationByUserIdController = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    const result = await organizationModel.getOrganizationAndRolebyUseridModel(
      user_id
    );
    res.status(200).json({ result });
  } catch (error) {
    res.status(404).json(error);
  }
};
const logoutController = async (req, res) => {
  try {
    // Log audit details for logout action
    await auditLog(
      "LOGOUT", // Operation type
      "N/A", // No specific table
      null, // No old value
      null, // No new value
      "User logged out successfully" // Description or reason
    )(req, res, () => {});

    // Respond to the user
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logoutController:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getReasonDescriptionController = async (req, res) => {
  try {
    const { user_id, track_id } = req.query;

    if (!user_id && !track_id) {
      return res.status(400).json({
        error:
          "Please provide either user_id or track_id as a query parameter.",
      });
    }

    const result = await organizationModel.getReasonDescriptionModel({
      user_id,
      track_id,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createOrganization: createOrganization,
  createPersonnel: createPersonnel,
  signinOrganization: signinOrganization,
  getAllOrganizations: getAllOrganizations,
  getAllOrganizationsRolesUser: getAllOrganizationsRolesUser,
  getAllOrganizationsForInvestigator: getAllOrganizationsForInvestigator,
  getOrganizationById: getOrganizationById,
  updateOrganization: updateOrganization,
  deleteOrganization: deleteOrganization,

  // organization details
  createOrganizationDetails: createOrganizationDetails,
  getAllOrganizationsDetails: getAllOrganizationsDetails,
  updateOrganizationDetails: updateOrganizationDetails,

  getPatientNonCompliant,
  getPatientNonCompliantForInvestigator,
  updatePassword,
  getUserDetails,
  forgotPassword,
  logoutController,
  verifyOtp,
  resetPassword,
  getTLFBMasterViewLink,
  getInvestigatorByStudyId,
  getOrganizationByUserIdController,
  getReasonDescriptionController,
};
