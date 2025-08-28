require("dotenv").config();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const FolderManagementModel = require("../../models/TLFB_Management/TLFB_Management_Model");

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  ONE_DRIVE_FOLDER_NAME,
  ONE_DRIVE_USER_PRINCIPAL,
} = process.env;

if (!ONE_DRIVE_USER_PRINCIPAL) {
  throw new Error(
    "ONE_DRIVE_USER_PRINCIPAL is not defined in environment variables."
  );
}

// Acquire an Azure access token
const getAzureToken = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", AZURE_CLIENT_ID);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("client_secret", AZURE_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");

  try {
    const response = await axios.post(tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data.access_token;
  } catch (error) {
    throw new Error(
      `Failed to acquire token: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

// Get the OneDrive drive id for the given user
const getOneDriveDriveId = async (accessToken, userPrincipalName) => {
  const url = `https://graph.microsoft.com/v1.0/users/${userPrincipalName}/drive`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data.id;
  } catch (error) {
    throw new Error(
      `Error fetching OneDrive drive: ${
        error.response?.data?.error?.message || error.message
      }`
    );
  }
};

// Get an existing folder by name (within a parent folder) or create it if not found
const getOrCreateFolder = async (
  accessToken,
  driveId,
  parentFolderId,
  folderName
) => {
  // Determine the URL to list children of the parent folder (or root if no parent)
  const listUrl = parentFolderId
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}/children`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;

  try {
    const response = await axios.get(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const folders = response.data.value;
    const folder = folders.find(
      (item) => item.name.toLowerCase() === folderName.toLowerCase()
    );
    if (folder) {
      return folder.id;
    }
  } catch (error) {
    throw new Error(`Failed to list folders: ${error.message}`);
  }

  // Folder not found; create it
  try {
    const createResponse = await axios.post(
      listUrl,
      {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return createResponse.data.id;
  } catch (error) {
    throw new Error(
      `Failed to create folder "${folderName}": ${
        error.response?.data?.error?.message || error.message
      }`
    );
  }
};

// Upload a file to OneDrive into a given folder and return both the webUrl and source id
const uploadFileToOneDrive = async (
  accessToken,
  driveId,
  parentFolderId,
  filePath,
  name
) => {
  const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}:/${name}:/content`;
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const response = await axios.put(uploadUrl, fileBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    // Return both the webUrl and the file's source id
    return {
      fileWebUrl: response.data.webUrl,
      sourceId: response.data.id,
    };
  } catch (error) {
    throw new Error(
      `File upload failed: ${
        error.response?.data?.error?.message || error.message
      }`
    );
  }
};

// Main controller function for creating the folder structure and uploading the file
const createTLFBFolder = async (req, res) => {
  console.log(req.file, "-----check file---");

  const { site_id, study_id, name } = req.body;
  if (!site_id || !study_id || !name || !req.file) {
    return res.status(400).json({
      error: "Missing required parameters: site_id, study_id, name, or file",
    });
  }

  let userPrincipalName = ONE_DRIVE_USER_PRINCIPAL;

  // Get token from header and decode to extract personnelId (adjust secret as needed)
  const token = req.headers.authorization.split(" ")[1];
  const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
  const personnelId = decoded.user_id;

  console.log(personnelId, "-----personnelId---");

  try {
    // 1. Get Azure access token and OneDrive drive id
    const accessToken = await getAzureToken();
    const driveId = await getOneDriveDriveId(accessToken, userPrincipalName);

    // 2. Get (or create) the root folder on OneDrive from the environment variable
    const rootFolderId = await getOrCreateFolder(
      accessToken,
      driveId,
      null,
      ONE_DRIVE_FOLDER_NAME
    );

    // 3. Retrieve the study name from the study enrolled table using study_id
    const studyName = await FolderManagementModel.getStudyName(study_id);
    if (!studyName) {
      return res
        .status(404)
        .json({ error: "Study not found for the provided study_id" });
    }

    // 4. Create (or get) a subfolder within the root folder named after the study
    const studyFolderId = await getOrCreateFolder(
      accessToken,
      driveId,
      rootFolderId,
      studyName
    );

    // 5. Retrieve the organization name from the database using the provided site_id
    const organizationName = await FolderManagementModel.getOrganizationName(
      site_id
    );
    if (!organizationName) {
      return res
        .status(404)
        .json({ error: "Organization not found for the provided site_id" });
    }

    // 6. Create (or get) a subfolder within the study folder named after the organization
    const organizationFolderId = await getOrCreateFolder(
      accessToken,
      driveId,
      studyFolderId,
      organizationName
    );

    // 7. Upload the Excel file into the organization folder using the provided file name
    const uploadResult = await uploadFileToOneDrive(
      accessToken,
      driveId,
      organizationFolderId,
      req.file.path,
      name
    );
    const fileWebUrl = uploadResult.fileWebUrl;
    const sourceId = uploadResult.sourceId;

    // 8. Record file details in the database, including the source id
    const dbRecord = await FolderManagementModel.createTLFBFolder({
      site_id,
      study_id,
      source_id: sourceId,
      name,
      file_path: req.file.path,
      personnelId,
    });

    return res.status(200).json({
      success: true,
      root_folder: ONE_DRIVE_FOLDER_NAME,
      study_folder: studyName,
      study_folder_id: studyFolderId,
      organization: organizationName,
      organization_folder_id: organizationFolderId,
      file_url: fileWebUrl,
      db_record: dbRecord,
    });
  } catch (error) {
    console.error("Error in createTLFBFolder:", error);
    return res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data?.error || {},
    });
  }
};

module.exports = {
  createTLFBFolder,
};

// require("dotenv").config();
// const axios = require("axios");
// const jwt = require("jsonwebtoken");
// const fs = require("fs");
// const FolderManagementModel = require("../../models/TLFB_Management/TLFB_Management_Model");

// const {
//   AZURE_TENANT_ID,
//   AZURE_CLIENT_ID,
//   AZURE_CLIENT_SECRET,
//   ONE_DRIVE_FOLDER_NAME,
//   ONE_DRIVE_USER_PRINCIPAL,
// } = process.env;

// if (!ONE_DRIVE_USER_PRINCIPAL) {
//   throw new Error(
//     "ONE_DRIVE_USER_PRINCIPAL is not defined in environment variables."
//   );
// }

// // Acquire an Azure access token
// const getAzureToken = async () => {
//   const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
//   const params = new URLSearchParams();
//   params.append("client_id", AZURE_CLIENT_ID);
//   params.append("scope", "https://graph.microsoft.com/.default");
//   params.append("client_secret", AZURE_CLIENT_SECRET);
//   params.append("grant_type", "client_credentials");

//   try {
//     const response = await axios.post(tokenUrl, params, {
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     });
//     return response.data.access_token;
//   } catch (error) {
//     throw new Error(
//       `Failed to acquire token: ${
//         error.response?.data?.error_description || error.message
//       }`
//     );
//   }
// };

// // Get the OneDrive drive id for the given user
// const getOneDriveDriveId = async (accessToken, userPrincipalName) => {
//   const url = `https://graph.microsoft.com/v1.0/users/${userPrincipalName}/drive`;
//   try {
//     const response = await axios.get(url, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });
//     return response.data.id;
//   } catch (error) {
//     throw new Error(
//       `Error fetching OneDrive drive: ${
//         error.response?.data?.error?.message || error.message
//       }`
//     );
//   }
// };

// // Get an existing folder by name (within a parent folder) or create it if not found
// const getOrCreateFolder = async (
//   accessToken,
//   driveId,
//   parentFolderId,
//   folderName
// ) => {
//   // Determine the URL to list children of the parent folder (or root if no parent)
//   const listUrl = parentFolderId
//     ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}/children`
//     : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;

//   try {
//     const response = await axios.get(listUrl, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });
//     const folders = response.data.value;
//     const folder = folders.find(
//       (item) => item.name.toLowerCase() === folderName.toLowerCase()
//     );
//     if (folder) {
//       return folder.id;
//     }
//   } catch (error) {
//     throw new Error(`Failed to list folders: ${error.message}`);
//   }

//   // Folder not found; create it
//   const createUrl = listUrl; // same as listing URL for children
//   try {
//     const createResponse = await axios.post(
//       createUrl,
//       {
//         name: folderName,
//         folder: {},
//         "@microsoft.graph.conflictBehavior": "rename",
//       },
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );
//     return createResponse.data.id;
//   } catch (error) {
//     throw new Error(
//       `Failed to create folder "${folderName}": ${
//         error.response?.data?.error?.message || error.message
//       }`
//     );
//   }
// };

// // Upload a file to OneDrive into a given folder and return both the webUrl and source id
// const uploadFileToOneDrive = async (
//   accessToken,
//   driveId,
//   parentFolderId,
//   filePath,
//   name
// ) => {
//   const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}:/${name}:/content`;
//   try {
//     const fileBuffer = fs.readFileSync(filePath);
//     const response = await axios.put(uploadUrl, fileBuffer, {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type":
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       },
//     });
//     // Return both the webUrl and the file's source id
//     return {
//       fileWebUrl: response.data.webUrl,
//       sourceId: response.data.id,
//     };
//   } catch (error) {
//     throw new Error(
//       `File upload failed: ${
//         error.response?.data?.error?.message || error.message
//       }`
//     );
//   }
// };

// // Main controller function for creating the folder structure and uploading the file
// const createTLFBFolder = async (req, res) => {
//   console.log(req.file, "-----check file---");

//   const { site_id, study_id, name } = req.body;
//   if (!site_id || !name) {
//     return res.status(400).json({
//       error: "Missing required parameters: site_id, name, or file",
//     });
//   }

//   let userPrincipalName = ONE_DRIVE_USER_PRINCIPAL;

//   const token = req.headers.authorization.split(" ")[1];
//   const decoded = jwt.verify(token, "HJSDHDSLDLSDJSL");
//   const personnelId = decoded.user_id;

//   console.log(personnelId, "-----personnelId---");

//   try {
//     // 1. Get Azure access token and OneDrive drive id
//     const accessToken = await getAzureToken();
//     const driveId = await getOneDriveDriveId(accessToken, userPrincipalName);

//     // 2. Get (or create) the root folder on OneDrive from the environment variable
//     const rootFolderId = await getOrCreateFolder(
//       accessToken,
//       driveId,
//       null,
//       ONE_DRIVE_FOLDER_NAME
//     );

//     // 3. Retrieve the organization name from the database using the provided site_id
//     const organizationName = await FolderManagementModel.getOrganizationName(
//       site_id
//     );
//     if (!organizationName) {
//       return res
//         .status(404)
//         .json({ error: "Organization not found for the provided site_id" });
//     }

//     // 4. Create (or get) a subfolder within the root folder named after the organization
//     const organizationFolderId = await getOrCreateFolder(
//       accessToken,
//       driveId,
//       rootFolderId,
//       organizationName
//     );

//     // 5. Upload the Excel file into the organization folder using the provided name
//     const uploadResult = await uploadFileToOneDrive(
//       accessToken,
//       driveId,
//       organizationFolderId,
//       req.file.path,
//       name
//     );
//     const fileWebUrl = uploadResult.fileWebUrl;
//     const sourceId = uploadResult.sourceId;

//     // 6. Record file details in the database, including the source id
//     const dbRecord = await FolderManagementModel.createTLFBFolder({
//       site_id,
//       study_id,
//       source_id: sourceId,
//       name,
//       file_path: req.file.path,
//       personnelId,
//     });

//     return res.status(200).json({
//       success: true,
//       root_folder: ONE_DRIVE_FOLDER_NAME,
//       organization: organizationName,
//       organization_folder_id: organizationFolderId,
//       file_url: fileWebUrl,
//       db_record: dbRecord,
//     });
//   } catch (error) {
//     console.error("Error in createOrganizationFolderWithFile:", error);
//     return res.status(error.response?.status || 500).json({
//       error: error.message,
//       details: error.response?.data?.error || {},
//     });
//   }
// };

// module.exports = {
//   createTLFBFolder,
// };
