const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

const excelModel = require("../../models/excelModel/excelModel");
const { default: axios } = require("axios");

// ------------------------------------------------------------------------
// CONFIG: The actual user ID in Azure AD whose OneDrive we want to access.
// Replace with your real user’s Azure AD object ID.
const GRAPH_USER_ID = "75753b25-54be-4430-be0d-8bd8e0c6da6a";
// ------------------------------------------------------------------------

// Initialize Microsoft Graph client with authentication
const getAuthenticatedClient = (token) => {
  // NEW: If token is missing or null, return null to avoid crashing
  if (!token) {
    console.error("Cannot initialize Graph client without a valid token.");
    return null;
  }

  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
};

// Retrieve a file (by ID) from that user's OneDrive
const getFileById = async (client, fileId) => {
  try {
    const response = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${fileId}`)
      .get();

    if (response && response.file) {
      return response; // Return the file item
    } else {
      return null; // Not a file
    }
  } catch (error) {
    if (error.statusCode === 404) {
      return null; // File not found
    } else {
      console.error("Error fetching file by ID:", error);
      throw error;
    }
  }
};

// Copy the master workbook to create a user-specific copy
const copyWorkbook = async (
  client,
  sourceFileId,
  destinationFolderId,
  newFileName
) => {
  try {
    // 1) Initiate the copy
    await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${sourceFileId}/copy`)
      .post({
        parentReference: {
          id: destinationFolderId,
        },
        name: newFileName,
      });

    // 2) The copy operation is asynchronous. We must poll for the file.
    const pollForCopy = async (maxRetries = 10, interval = 2000) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const folderContents = await client
          .api(
            `/users/${GRAPH_USER_ID}/drive/items/${destinationFolderId}/children`
          )
          .get();

        const newFile = folderContents.value.find(
          (file) => file.name === newFileName
        );
        if (newFile) {
          return newFile.id;
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      throw new Error("Timed out waiting for the copy operation to complete.");
    };

    // 3) Start polling
    const userCopyId = await pollForCopy();
    if (userCopyId) {
      return userCopyId;
    } else {
      throw new Error("Copied file not found after polling.");
    }
  } catch (error) {
    console.error("Error copying workbook:", error);
    throw error;
  }
};

// Set visibility for a specific sheet
const setSheetVisibility = async (client, fileId, sheetId, visibility) => {
  try {
    await client
      .api(
        `/users/${GRAPH_USER_ID}/drive/items/${fileId}/workbook/worksheets/${sheetId}`
      )
      .patch({ visibility: visibility });
  } catch (error) {
    console.error(`Error setting visibility for sheet ${sheetId}:`, error);
    throw error;
  }
};

// Check copy job status
async function checkCopyJobStatus(client, jobId) {
  try {
    const jobStatus = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${jobId}`)
      .get();
    return jobStatus; // Return the job status
  } catch (error) {
    console.error("Error checking copy job status:", error);
    throw error;
  }
}

async function copyFileToFolder(client, sourceFileId, folderId) {
  try {
    const copyResponse = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${sourceFileId}/copy`)
      .post({
        parentReference: { id: folderId },
        name: "TLFB_Master_New.xlsx",
      });

    console.log("File copy initiated. Waiting for completion...");

    // Wait for the copy job to complete
    const jobId = copyResponse.id;
    const jobStatus = await checkCopyJobStatus(client, jobId);

    if (jobStatus.status === "completed") {
      return jobStatus.id; // Return the file ID of the copied file
    } else {
      throw new Error("File copy did not complete successfully.");
    }
  } catch (error) {
    console.error("Error copying file:", error);
    throw error;
  }
}

// Construct an embedded link with forced 'embed view'
const getEmbeddedLink = (embedUrl) => {
  let finalEmbedUrl = embedUrl;

  // Ensure action=embedview is present
  if (!finalEmbedUrl.includes("action=embedview")) {
    if (finalEmbedUrl.includes("?")) {
      finalEmbedUrl += "&action=embedview";
    } else {
      finalEmbedUrl += "?action=embedview";
    }
  }

  // For Excel files, disable editing & interactivity
  finalEmbedUrl += "&wdAllowInteractivity=False";

  return finalEmbedUrl;
};

// Create an anonymous sharing link (VIEW)
const createAnonymousSharingLink = async (client, fileId) => {
  try {
    const response = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${fileId}/createLink`)
      .post({
        type: "view",
        scope: "anonymous",
      });

    const webUrl = response.link.webUrl;
    const embedLink = getEmbeddedLink(webUrl);
    return embedLink;
  } catch (error) {
    console.error(`Error creating anonymous sharing link:`, error);
    throw error;
  }
};

// Generate an embed link (VIEW)
const generateEmbedLink = async (client, fileId) => {
  try {
    const embedLinkResponse = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${fileId}/createLink`)
      .post({
        type: "view",
        scope: "anonymous",
      });

    return embedLinkResponse.link.webUrl;
  } catch (error) {
    console.error("Error generating embed link:", error);
    throw error;
  }
};

// Retrieve a folder by name in that user's OneDrive
const getFolderByName = async (client, folderName) => {
  try {
    // Using path-based addressing
    // e.g. /users/{id}/drive/root:/{folderName}
    const response = await client
      .api(`/users/${GRAPH_USER_ID}/drive/root:/${folderName}`)
      .get();

    if (response && response.folder) {
      return response; // It's indeed a folder
    } else {
      return null;
    }
  } catch (error) {
    if (error.statusCode === 404) {
      return null; // Folder not found
    } else {
      console.error("Error fetching folder:", error);
      throw error;
    }
  }
};

// Retrieve a file by folder + filename
const getFileInFolder = async (client, folderName, fileName) => {
  try {
    // e.g. /users/{id}/drive/root:/{folderName}/{fileName}
    const response = await client
      .api(`/users/${GRAPH_USER_ID}/drive/root:/${folderName}/${fileName}`)
      .get();

    if (response && response.file) {
      return response; // Return the file item
    } else {
      return null; // Not a file
    }
  } catch (error) {
    if (error.statusCode === 404) {
      return null; // File not found
    } else {
      console.error("Error fetching file:", error);
      throw error;
    }
  }
};

/**
 * 1) Check that a folder named after `req.params.user_id` exists.
 * 2) Look for "TLFB_Master_New.xlsx" in that folder.
 * 3) Hide all worksheets except "EXPORT".
 * 4) Create an anonymous view link.
 */
const getTLFBMasterViewLink = async (req, res) => {
  const userId = req.params.user_id;
  const jwtToken = req.headers.authorization?.split(" ")[1];

  // NEW: Handle missing JWT token gracefully
  if (!jwtToken) {
    return res.status(401).json({
      status: false,
      message: "Authorization token is required.",
    });
  }

  // Safe function to fetch Graph token
  async function getGraphToken() {
    try {
      const graphToken = await axios.get(
        "https://backend.research-hero.xyz/azure-auth/token",
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );
      return graphToken.data?.accessToken || null;
    } catch (error) {
      console.error("Error fetching Graph token:", error.message);
      return null;
    }
  }

  // NEW: Wrap token retrieval in try/catch
  let newAccessToken;
  try {
    newAccessToken = await getGraphToken();
  } catch (error) {
    console.error("Error retrieving Graph API access token:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to retrieve Graph API access token.",
      error: error.message || error,
    });
  }

  // NEW: Check if token is null or undefined
  if (!newAccessToken) {
    return res.status(500).json({
      status: false,
      message: "Graph API access token is not available. Please try again.",
    });
  }

  console.log("User ID (folder name):", userId);

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "user_id parameter is required.",
    });
  }

  try {
    // Initialize Graph client
    const client = getAuthenticatedClient(newAccessToken);

    // NEW: If client fails to initialize, handle gracefully
    if (!client) {
      return res.status(500).json({
        status: false,
        message: "Failed to initialize Microsoft Graph client.",
      });
    }

    const subjectRecord = await excelModel.getTLFBSubjectByUserId(userId);
    if (!subjectRecord) {
      return res.status(404).json({
        status: false,
        message: `No TLFB subject record found for user_id ${userId}.`,
      });
    }
    const sourceId = subjectRecord.source_id;

    // Step 3: Retrieve all sheets and hide all except "EXPORT"
    const sheetsResponse = await client
      .api(
        `/users/${GRAPH_USER_ID}/drive/items/${sourceId}/workbook/worksheets`
      )
      .get();

    const sheets = sheetsResponse.value;

    for (const sheet of sheets) {
      const visibility = sheet.name === "EXPORT" ? "Visible" : "Hidden";
      await setSheetVisibility(client, sourceId, sheet.id, visibility);
    }

    // Step 4: Create a shareable embed link
    let embedLink;
    try {
      const embedUrl = await createAnonymousSharingLink(client, sourceId);
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
      message: `Embed link for retrieved successfully.`,
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

/**
 * getTLFBMasterExportViewLink - Example of a different approach
 * This one uses a "master file" ID, copies it, sets "EXPORT" visible, etc.
 * Adjust as needed, but make sure to use /users/{GRAPH_USER_ID} calls.
 */
const getTLFBMasterExportViewLink = async (req, res) => {
  const userId = req.params.user_id;
  const jwtToken = req.headers.authorization?.split(" ")[1];

  // NEW: Handle missing JWT token
  if (!jwtToken) {
    return res.status(401).json({
      status: false,
      message: "Authorization token is required.",
    });
  }

  async function getGraphToken() {
    try {
      const graphToken = await axios.get(
        "https://backend.research-hero.xyz/azure-auth/token",
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );
      return graphToken.data?.accessToken || null;
    } catch (error) {
      console.error("Error fetching Graph token:", error.message);
      return null;
    }
  }

  let newAccessToken;
  try {
    newAccessToken = await getGraphToken();
  } catch (error) {
    console.error("Error retrieving Graph API access token:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to retrieve Graph API access token.",
      error: error.message || error,
    });
  }

  if (!newAccessToken) {
    return res.status(500).json({
      status: false,
      message: "Graph API access token is not configured.",
    });
  }

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "user_id parameter is required.",
    });
  }

  try {
    const client = getAuthenticatedClient(newAccessToken);
    if (!client) {
      return res.status(500).json({
        status: false,
        message: "Failed to initialize Microsoft Graph client.",
      });
    }

    // MASTER FILE ID
    const masterFileId = "01N2VRP7DTNRNLSZNRRNBK4U55CHAXPLOR"; // your real ID
    const userCopyFileName = `TLFB_Master_${userId}.xlsx`;

    // Retrieve the master file
    const masterFile = await getFileById(client, masterFileId);
    if (!masterFile) {
      return res.status(404).json({
        status: false,
        message: `Master file TLFB_Master.xlsx not found.`,
      });
    }

    const destinationFolderId = masterFile.parentReference.id;

    // Check if the user-specific copy already exists in the same folder
    const folderContents = await client
      .api(
        `/users/${GRAPH_USER_ID}/drive/items/${destinationFolderId}/children`
      )
      .get();

    const userCopyFile = folderContents.value.find(
      (file) => file.name === userCopyFileName
    );
    let userCopyId;

    if (userCopyFile) {
      userCopyId = userCopyFile.id;
    } else {
      // Create a user-specific copy
      userCopyId = await copyWorkbook(
        client,
        masterFileId,
        destinationFolderId,
        userCopyFileName
      );
    }

    // Retrieve sheets in that user-specific copy
    const sheetsResponse = await client
      .api(
        `/users/${GRAPH_USER_ID}/drive/items/${userCopyId}/workbook/worksheets`
      )
      .get();
    const sheets = sheetsResponse.value;

    // Hide all but "EXPORT"
    for (const sheet of sheets) {
      const visibility = sheet.name === "EXPORT" ? "Visible" : "Hidden";
      await setSheetVisibility(client, userCopyId, sheet.id, visibility);
    }

    // Generate embed link
    const embedUrl = await generateEmbedLink(client, userCopyId);

    return res.status(200).json({
      status: true,
      message: `Embed link for "EXPORT" sheet retrieved successfully.`,
      embedUrl: embedUrl,
    });
  } catch (error) {
    console.error("Error retrieving embed link for TLFB_Master.xlsx:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

/**
 * Create an anonymous EDIT link for the entire workbook (no hidden sheets).
 */
const createAnonymousEditLink = async (client, fileId) => {
  try {
    const response = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${fileId}/createLink`)
      .post({
        type: "edit",
        scope: "anonymous",
      });
    return response.link.webUrl;
  } catch (error) {
    console.error(`Error creating anonymous edit link:`, error);
    throw error;
  }
};

// const getTLFBMasterEditLink = async (req, res) => {
//   const userId = req.params.user_id;
//   console.log("User ID (folder name):", userId);

//   const jwtToken = req.headers.authorization?.split(" ")[1];

//   // NEW: Handle missing JWT token
//   if (!jwtToken) {
//     return res.status(401).json({
//       status: false,
//       message: "Authorization token is required.",
//     });
//   }

//   async function getGraphToken() {
//     try {
//       const graphToken = await axios.get(
//         "https://backend.research-hero.xyz/azure-auth/token",
//         {
//           headers: {
//             Authorization: `Bearer ${jwtToken}`,
//           },
//         }
//       );
//       return graphToken.data?.accessToken || null;
//     } catch (error) {
//       console.error("Error fetching Graph token:", error.message);
//       return null;
//     }
//   }

//   let newAccessToken;
//   try {
//     newAccessToken = await getGraphToken();
//   } catch (error) {
//     console.error("Error retrieving Graph API access token:", error);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to retrieve Graph API access token.",
//       error: error.message || error,
//     });
//   }

//   if (!newAccessToken) {
//     return res.status(500).json({
//       status: false,
//       message: "Graph API access token is not configured.",
//     });
//   }

//   if (!userId) {
//     return res.status(400).json({
//       status: false,
//       message: "user_id parameter is required.",
//     });
//   }

//   try {
//     const client = getAuthenticatedClient(newAccessToken);
//     if (!client) {
//       return res.status(500).json({
//         status: false,
//         message: "Failed to initialize Microsoft Graph client.",
//       });
//     }

//     // Step 1: Check the user folder
//     const folderName = userId.toString();
//     const folder = await getFolderByName(client, folderName);

//     console.log("Folder found:", folder);
//     if (!folder) {
//       return res.status(404).json({
//         status: false,
//         message: `Folder for user_id ${userId} does not exist.`,
//       });
//     }

//     // Step 2: Check if TLFB_Master_New.xlsx is there
//     const fileName = "TLFB_Master_New.xlsx";
//     const file = await getFileInFolder(client, folderName, fileName);

//     if (!file) {
//       return res.status(404).json({
//         status: false,
//         message: `File ${fileName} not found in folder ${folderName}.`,
//       });
//     }

//     console.log("File found:", file);

//     // Step 3: Retrieve all sheets, set them all to visible
//     const sheetsResponse = await client
//       .api(`/users/${GRAPH_USER_ID}/drive/items/${file.id}/workbook/worksheets`)
//       .get();
//     const sheets = sheetsResponse.value;

//     for (const sheet of sheets) {
//       await setSheetVisibility(client, file.id, sheet.id, "Visible");
//     }

//     // Step 4: Create an EDIT link
//     let editLink;
//     try {
//       editLink = await createAnonymousEditLink(client, file.id);
//     } catch (sharingError) {
//       console.warn("Error creating anonymous edit link:", sharingError);
//       return res.status(500).json({
//         status: false,
//         message: "Failed to create edit link.",
//         error: sharingError.message || sharingError,
//       });
//     }

//     console.log("Edit Link:", editLink);

//     return res.status(200).json({
//       status: true,
//       message: `Edit link for ${fileName} retrieved successfully.`,
//       editLink: editLink,
//     });
//   } catch (error) {
//     console.error(
//       "Error retrieving edit link for TLFB_Master_New.xlsx:",
//       error
//     );
//     return res.status(500).json({
//       status: false,
//       message: "Internal Server Error",
//       error: error.message || error,
//     });
//   }
// };

const getTLFBMasterEditLink = async (req, res) => {
  const userId = req.params.user_id;
  const jwtToken = req.headers.authorization?.split(" ")[1];

  // Handle missing JWT token
  if (!jwtToken) {
    return res.status(401).json({
      status: false,
      message: "Authorization token is required.",
    });
  }

  // Simple utility to get Graph API token
  async function getGraphToken() {
    try {
      const graphToken = await axios.get(
        "https://backend.research-hero.xyz/azure-auth/token",
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      return graphToken.data?.accessToken || null;
    } catch (error) {
      console.error("Error fetching Graph token:", error.message);
      return null;
    }
  }

  // Retrieve Graph token
  let newAccessToken;
  try {
    newAccessToken = await getGraphToken();
  } catch (error) {
    console.error("Error retrieving Graph API access token:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to retrieve Graph API access token.",
      error: error.message || error,
    });
  }

  // Token must not be null
  if (!newAccessToken) {
    return res.status(500).json({
      status: false,
      message: "Graph API access token is not configured.",
    });
  }

  // user_id is required
  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "user_id parameter is required.",
    });
  }

  try {
    // Initialize Microsoft Graph client
    const client = getAuthenticatedClient(newAccessToken);
    if (!client) {
      return res.status(500).json({
        status: false,
        message: "Failed to initialize Microsoft Graph client.",
      });
    }

    // 1) Get the stored source_id from the tlfb_subject table
    const subjectRecord = await excelModel.getTLFBSubjectByUserId(userId);
    if (!subjectRecord) {
      return res.status(404).json({
        status: false,
        message: `No TLFB subject record found for user_id ${userId}.`,
      });
    }
    const sourceId = subjectRecord.source_id;

    // 2) Retrieve all sheets and set them to "Visible"
    const sheetsResponse = await client
      .api(
        `/users/${GRAPH_USER_ID}/drive/items/${sourceId}/workbook/worksheets`
      )
      .get();
    const sheets = sheetsResponse.value;

    for (const sheet of sheets) {
      await client
        .api(
          `/users/${GRAPH_USER_ID}/drive/items/${sourceId}/workbook/worksheets/${sheet.id}`
        )
        .patch({ visibility: "Visible" });
    }

    // 3) Create an anonymous edit link
    const editResponse = await client
      .api(`/users/${GRAPH_USER_ID}/drive/items/${sourceId}/createLink`)
      .post({
        type: "edit",
        scope: "anonymous",
      });
    const editLink = editResponse.link.webUrl;

    console.log("Edit Link:", editLink);

    return res.status(200).json({
      status: true,
      message: "Edit link retrieved successfully.",
      editLink: editLink,
    });
  } catch (error) {
    console.error("Error retrieving edit link:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

module.exports = {
  getTLFBMasterExportViewLink,
  getTLFBMasterViewLink,
  getTLFBMasterEditLink,
};
