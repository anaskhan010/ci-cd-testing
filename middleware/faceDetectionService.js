const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const apiKey = "AIzaSyA-l1w4IwGbCSgFATO0PbIRYKmOtX686iM";

// Utility function to convert image to base64
const imageToBase64 = (filePath) => {
  try {
    const absolutePath = path.resolve(filePath);
    return fs.readFileSync(absolutePath, { encoding: "base64" });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    throw error;
  }
};

// Google Vision API call for face detection
const detectFacesWithGoogle = async (base64Image) => {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "FACE_DETECTION", maxResults: 1 }],
      },
    ],
  };

  try {
    const response = await axios.post(url, body);
    return response.data.responses[0].faceAnnotations;
  } catch (error) {
    console.error("Error detecting faces with Google Vision:", error.message);
    throw error;
  }
};

// Main function to compare faces
const compareFaces = async (storedImagePath, uploadedImagePath) => {
  try {
    const storedImageBase64 = imageToBase64(storedImagePath);
    const uploadedImageBase64 = imageToBase64(uploadedImagePath);

    // Google Vision face detection
    const storedFacesVision = await detectFacesWithGoogle(storedImageBase64);
    const uploadedFacesVision = await detectFacesWithGoogle(uploadedImageBase64);

    // If either detection fails, consider it a non-match
    if (
      !storedFacesVision ||
      !uploadedFacesVision ||
      storedFacesVision.length === 0 ||
      uploadedFacesVision.length === 0
    ) {
      return { match: false, message: "Face not detected in one or both images." };
    }

    // Simple matching logic for demonstration purposes
    const match = storedFacesVision[0].detectionConfidence > 0.6 &&
                  uploadedFacesVision[0].detectionConfidence > 0.6;

    return {
      match,
      message: match ? "Face verified" : "Face does not match",
    };
  } catch (error) {
    console.error("Error in compareFaces:", error.message);
    throw error;
  }
};

// Export the compareFaces function as the API entry point
module.exports = {
  compareFaces,
};


// const axios = require("axios");
// const fs = require("fs");
// const path = require("path");

// const apiKey = "AIzaSyA-l1w4IwGbCSgFATO0PbIRYKmOtX686iM";  // Use environment variable for API key

// const imageToBase64 = (filePath) => {
//   try {
//     const absolutePath = path.resolve(filePath);
//     const base64Image = fs.readFileSync(absolutePath, { encoding: "base64" });
//     return base64Image;
//   } catch (error) {
//     console.error(`Error reading file ${filePath}:`, error.message);
//     throw error;
//   }
// };

// const detectFaces = async (base64Image) => {
//   const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
//   const body = {
//     requests: [
//       {
//         image: {
//           content: base64Image,
//         },
//         features: [
//           {
//             type: "FACE_DETECTION",
//             maxResults: 1,
//           },
//         ],
//       },
//     ],
//   };

//   try {
//     const response = await axios.post(url, body);
//     return response.data.responses[0].faceAnnotations;
//   } catch (error) {
//     if (error.response && error.response.status === 401) {
//       console.error("Unauthorized: Check your API key and billing account.");
//     } else {
//       console.error("Error detecting faces:", error.message);
//     }
//     throw error;
//   }
// };

// const compareFaces = async (storedImagePath, uploadedImagePath) => {
//   try {
//     const storedImageBase64 = imageToBase64(storedImagePath);
//     const uploadedImageBase64 = imageToBase64(uploadedImagePath);

//     const storedFaces = await detectFaces(storedImageBase64);
//     const uploadedFaces = await detectFaces(uploadedImageBase64);

//     if (!storedFaces || !uploadedFaces || storedFaces.length === 0 || uploadedFaces.length === 0) {
//       return { match: false, message: "Face not detected in one or both images." };
//     }

//     const storedFace = storedFaces[0];
//     const uploadedFace = uploadedFaces[0];

//     // Compare face landmarks
//     const landmarkMatch = compareLandmarks(storedFace.landmarks, uploadedFace.landmarks);

//     // Compare face attributes
//     const attributeMatch = compareAttributes(storedFace, uploadedFace);

//     // Determine overall match
//     const overallMatch = landmarkMatch && attributeMatch;

//     return {
//       match: overallMatch,
//       message: overallMatch ? "Face verified" : "Face does not match",
//     };
//   } catch (error) {
//     console.error("Error in compareFaces:", error.message);
//     throw error;
//   }
// };

// const compareLandmarks = (storedLandmarks, uploadedLandmarks) => {
//   const threshold = 0.1; // Adjust this value to control strictness
//   for (let i = 0; i < storedLandmarks.length; i++) {
//     const stored = storedLandmarks[i].position;
//     const uploaded = uploadedLandmarks[i].position;
//     const distance = Math.sqrt(
//       Math.pow(stored.x - uploaded.x, 2) +
//       Math.pow(stored.y - uploaded.y, 2) +
//       Math.pow(stored.z - uploaded.z, 2)
//     );
//     if (distance > threshold) {
//       return false;
//     }
//   }
//   return true;
// };

// const compareAttributes = (storedFace, uploadedFace) => {
//   const attributes = ['joyLikelihood', 'sorrowLikelihood', 'angerLikelihood', 'surpriseLikelihood'];
//   for (const attr of attributes) {
//     if (storedFace[attr] !== uploadedFace[attr]) {
//       return false;
//     }
//   }
//   return true;
// };

// module.exports = {
//   compareFaces,
// };




// const axios = require("axios");
// const fs = require("fs");
// const path = require("path");

// const apiKey = "AIzaSyA-l1w4IwGbCSgFATO0PbIRYKmOtX686iM";  // Replace with your actual API key

// const imageToBase64 = (filePath) => {
//   try {
//     const absolutePath = path.resolve(filePath);
//     const base64Image = fs.readFileSync(absolutePath, { encoding: "base64" });
//     return base64Image;
//   } catch (error) {
//     console.error(`Error reading file ${filePath}:`, error.message);
//     throw error;
//   }
// };

// const detectFaces = async (base64Image) => {
//   const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

//   const body = {
//     requests: [
//       {
//         image: {
//           content: base64Image,
//         },
//         features: [
//           {
//             type: "FACE_DETECTION",
//             maxResults: 1,
//           },
//         ],
//       },
//     ],
//   };

//   try {
//     const response = await axios.post(url, body);
//     return response.data.responses[0].faceAnnotations;
//   } catch (error) {
//     if (error.response && error.response.status === 401) {
//       console.error("Unauthorized: Check your API key and billing account.");
//     } else {
//       console.error("Error detecting faces:", error.message);
//     }
//     throw error;
//   }
// };

// const compareFaces = async (storedImagePath, uploadedImagePath) => {
//   try {
//     const storedImageBase64 = imageToBase64(storedImagePath);
//     const uploadedImageBase64 = imageToBase64(uploadedImagePath);

//     const storedFaces = await detectFaces(storedImageBase64);
//     const uploadedFaces = await detectFaces(uploadedImageBase64);

//     if (!storedFaces || !uploadedFaces || storedFaces.length === 0 || uploadedFaces.length === 0) {
//       return false;
//     }

//     const storedLandmarks = storedFaces[0].landmarks;
//     const uploadedLandmarks = uploadedFaces[0].landmarks;

//     let match = true;
//     for (let i = 0; i < storedLandmarks.length; i++) {
//       const stored = storedLandmarks[i].position;
//       const uploaded = uploadedLandmarks[i].position;

//       if (Math.abs(stored.x - uploaded.x) > 10 || Math.abs(stored.y - uploaded.y) > 10) {
//         match = false;
//         break;
//       }
//     }

//     return match;
//   } catch (error) {
//     console.error("Error in compareFaces:", error.message);
//     throw error;
//   }
// };

// module.exports = {
//   compareFaces,
// };

