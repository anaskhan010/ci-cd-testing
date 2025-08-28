const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

const ONE_DRIVE_USER_PRINCIPAL = process.env.ONE_DRIVE_USER_PRINCIPAL;
if (!ONE_DRIVE_USER_PRINCIPAL) {
  throw new Error(
    "ONE_DRIVE_USER_PRINCIPAL is not defined in environment variables."
  );
}

/**
 * Returns an authenticated Microsoft Graph client using the provided token.
 */
const getAuthenticatedClient = (token) => {
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

/**
 * Gets (or creates) a folder using the Graph client.
 * Checks under the specified parent (or root if parentFolderId is null) for a folder
 * with the given name (case-insensitive). If found, returns its id; otherwise, creates it.
 */
async function getOrCreateFolderGraph(client, parentFolderId, folderName) {
  try {
    const endpoint = parentFolderId
      ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
      : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
    const response = await client.api(endpoint).get();
    const folder = response.value.find(
      (item) =>
        item.name.toLowerCase() === folderName.toLowerCase() && item.folder
    );
    if (folder) {
      return folder.id;
    }
  } catch (error) {
    console.error("Error listing folders:", error);
    throw error;
  }
  // Folder not found; create it.
  return await createFolder(client, parentFolderId, folderName);
}

/**
 * Retrieves the ID of a source Excel file within the specified folder.
 * If fileName is provided, it searches for an exact match; otherwise, returns the first Excel file found.
 */
async function getSourceFileId(client, parentFolderId, fileName) {
  try {
    const endpoint = parentFolderId
      ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
      : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
    const response = await client.api(endpoint).get();
    let foundItem;
    if (fileName) {
      foundItem = response.value.find(
        (item) => item.name === fileName && item.file
      );
    } else {
      // If no fileName is provided, pick the first Excel file.
      foundItem = response.value.find(
        (item) => item.file && item.name.toLowerCase().endsWith(".xlsx")
      );
    }
    if (!foundItem) {
      throw new Error("Source file not found under the specified folder.");
    }
    return foundItem.id;
  } catch (error) {
    console.error("Error retrieving source file ID:", error);
    throw error;
  }
}

/**
 * Creates a folder in OneDrive under the specified parent folder.
 */
async function createFolder(client, parentFolderId, folderName) {
  try {
    const folderPayload = {
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    };
    const endpoint = parentFolderId
      ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
      : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
    const createdFolder = await client.api(endpoint).post(folderPayload);
    return createdFolder.id;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

/**
 * Polls the specified folder for a file with the expected name.
 * Retries for a fixed number of times with a delay in between.
 */
async function pollForFileInFolder(
  client,
  folderId,
  expectedName,
  maxRetries = 5,
  interval = 2000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const endpoint = folderId
        ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${folderId}/children`
        : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
      const response = await client.api(endpoint).get();
      const file = response.value.find(
        (item) => item.name === expectedName && item.file
      );
      if (file) {
        return file.id;
      }
    } catch (e) {
      console.error("Error polling folder:", e);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Copied file not found in destination folder after polling.");
}

/**
 * Copies a file from one folder to another in OneDrive.
 * The new file retains the original file name with an appended underscore and userId.
 * Returns the new file's id.
 */
async function copyFileToFolder(client, sourceFileId, folderId, userId) {
  console.log("Copying file to folder...");
  console.log("sourceFileId:", sourceFileId);
  console.log("folderId:", folderId);
  try {
    // Retrieve the original file's details to get its name.
    const fileDetails = await client
      .api(`/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${sourceFileId}`)
      .get();
    let originalFileName = fileDetails.name; // e.g., "Sun2003A.xlsx"
    // Compute new file name: append "_" + userId before extension.
    const dotIndex = originalFileName.lastIndexOf(".");
    let newName;
    if (dotIndex === -1) {
      newName = `${originalFileName}_${userId}`;
    } else {
      const baseName = originalFileName.substring(0, dotIndex);
      const ext = originalFileName.substring(dotIndex); // includes the dot
      newName = `${baseName}_${userId}${ext}`;
    }
    // Initiate the copy operation.
    await client
      .api(
        `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${sourceFileId}/copy`
      )
      .post({
        parentReference: { id: folderId },
        name: newName,
      });
    console.log("File copy initiated (async).");
    // Poll for the copied file in the destination folder.
    const newFileId = await pollForFileInFolder(client, folderId, newName);
    console.log("New file copied with id:", newFileId);
    return newFileId;
  } catch (error) {
    console.error("Error copying file:", error);
    throw error;
  }
}

module.exports = {
  getAuthenticatedClient,
  getOrCreateFolderGraph,
  getSourceFileId,
  createFolder,
  copyFileToFolder,
};

// const { Client } = require("@microsoft/microsoft-graph-client");
// require("isomorphic-fetch");
// require("dotenv").config();

// const ONE_DRIVE_USER_PRINCIPAL = process.env.ONE_DRIVE_USER_PRINCIPAL;

// if (!ONE_DRIVE_USER_PRINCIPAL) {
//   throw new Error(
//     "ONE_DRIVE_USER_PRINCIPAL is not defined in environment variables."
//   );
// }

// const getAuthenticatedClient = (token) => {
//   if (!token) {
//     console.error("Cannot initialize Graph client without a valid token.");
//     return null;
//   }
//   return Client.init({
//     authProvider: (done) => {
//       done(null, token);
//     },
//   });
// };

// async function getOrCreateFolderGraph(client, parentFolderId, folderName) {
//   try {
//     const endpoint = parentFolderId
//       ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
//       : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
//     const response = await client.api(endpoint).get();
//     const folder = response.value.find(
//       (item) =>
//         item.name.toLowerCase() === folderName.toLowerCase() && item.folder
//     );
//     if (folder) {
//       return folder.id;
//     }
//   } catch (error) {
//     console.error("Error listing folders:", error);
//     throw error;
//   }
//   // Folder not found; create it.
//   return await createFolder(client, parentFolderId, folderName);
// }

// async function getSourceFileId(client, parentFolderId, fileName) {
//   try {
//     const endpoint = parentFolderId
//       ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
//       : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
//     const response = await client.api(endpoint).get();
//     let foundItem;
//     if (fileName) {
//       foundItem = response.value.find(
//         (item) => item.name === fileName && item.file
//       );
//     } else {
//       // If no fileName is provided, pick the first Excel file
//       foundItem = response.value.find(
//         (item) => item.file && item.name.toLowerCase().endsWith(".xlsx")
//       );
//     }
//     if (!foundItem) {
//       throw new Error("Source file not found under the specified folder.");
//     }
//     return foundItem.id;
//   } catch (error) {
//     console.error("Error retrieving source file ID:", error);
//     throw error;
//   }
// }

// async function createFolder(client, parentFolderId, folderName) {
//   try {
//     const folderPayload = {
//       name: folderName,
//       folder: {},
//       "@microsoft.graph.conflictBehavior": "rename",
//     };
//     const endpoint = parentFolderId
//       ? `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/items/${parentFolderId}/children`
//       : `/users/${ONE_DRIVE_USER_PRINCIPAL}/drive/root/children`;
//     const createdFolder = await client.api(endpoint).post(folderPayload);
//     return createdFolder.id;
//   } catch (error) {
//     console.error("Error creating folder:", error);
//     throw error;
//   }
// }

// async function copyFileToFolder(client, sourceFileId, folderId, userId) {
//   console.log("Copying file to folder...");
//   console.log("sourceFileId:", sourceFileId);
//   console.log("folderId:", folderId);
//   try {
//     // Retrieve the original file's details to get its name.
//     const fileDetails = await client
//       .api(
//         `/users/${process.env.ONE_DRIVE_USER_PRINCIPAL}/drive/items/${sourceFileId}`
//       )
//       .get();

//     let originalFileName = fileDetails.name; // e.g., "Sun2003A.xlsx"

//     // Split the file name into base and extension.
//     const dotIndex = originalFileName.lastIndexOf(".");
//     let newName;
//     if (dotIndex === -1) {
//       // No extension found.
//       newName = `${originalFileName}_${userId}`;
//     } else {
//       const baseName = originalFileName.substring(0, dotIndex);
//       const ext = originalFileName.substring(dotIndex); // includes the dot, e.g., ".xlsx"
//       newName = `${baseName}_${userId}${ext}`;
//     }

//     // Initiate the copy operation using the new file name.
//     await client
//       .api(
//         `/users/${process.env.ONE_DRIVE_USER_PRINCIPAL}/drive/items/${sourceFileId}/copy`
//       )
//       .post({
//         parentReference: { id: folderId },
//         name: newName,
//       });

//     console.log("File copy initiated (async).");
//     return;
//   } catch (error) {
//     console.error("Error copying file:", error);
//     throw error;
//   }
// }

// module.exports = {
//   getAuthenticatedClient,
//   getOrCreateFolderGraph,
//   getSourceFileId,
//   createFolder,
//   copyFileToFolder,
// };
