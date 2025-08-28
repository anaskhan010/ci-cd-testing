const PDFDocument = require("pdfkit");
const axios = require("axios");
const FormData = require("form-data");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { htmlToText } = require("html-to-text");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// Define font paths
const FONT_PATHS = {
  regular: path.join(__dirname, "./ttf/DejaVuSans.ttf"),
  bold: path.join(__dirname, "./ttf/DejaVuSans-Bold.ttf"),
  italic: path.join(__dirname, "./ttf/DejaVuSans-Oblique.ttf"),
  boldItalic: path.join(__dirname, "./ttf/DejaVuSans-BoldOblique.ttf")
};


const calculateWHOQOLScore = (surveyResponses) => {
  // Define question IDs for each domain
  const domain1Questions = [277, 278, 284, 289, 290, 291, 292];
  const domain2Questions = [279, 280, 281, 285, 293, 300];
  const domain3Questions = [294, 295, 296];
  const domain4Questions = [278, 279, 286, 287, 288, 297, 298, 299];

  // Initialize domain scores
  let domain1 = 0;
  let domain2 = 0;
  let domain3 = 0;
  let domain4 = 0;

  // Helper function to get response score for a question by ID
  const getQuestionScore = (questionId) => {
    console.log(questionId, "check question id");
    const response = surveyResponses.find(
      (res) => res.questionId === questionId
    );

    console.log(response, "check response score");
    // Ensure the score is a number. If it's a string, convert it to a number.
    return response && !isNaN(Number(response.score))
      ? Number(response.score)
      : 0;
  };

  domain1 = domain1Questions.reduce((sum, q) => {
    if (q === 277 || q === 278) {
      // Adjusted conditions based on question IDs
      return sum + (6 - getQuestionScore(q));
    }
    return sum + getQuestionScore(q);
  }, 0);

  domain2 = domain2Questions.reduce((sum, q) => {
    if (q === 279) {
      // Adjusted condition based on question IDs
      return sum + (6 - getQuestionScore(q));
    }
    return sum + getQuestionScore(q);
  }, 0);

  // Domain3 has no reverse-scored questions in your provided code
  domain3 = domain3Questions.reduce((sum, q) => sum + getQuestionScore(q), 0);
  domain4 = domain4Questions.reduce((sum, q) => sum + getQuestionScore(q), 0);

  const totalScore = domain1 + domain2 + domain3 + domain4;

  console.log("Domain Scores:", { domain1, domain2, domain3, domain4 });
  console.log("Total Score:", totalScore);

  return {
    domain1,
    domain2,
    domain3,
    domain4,
    totalScore,
  };
};

const generateSurveyPDF = (
  scaleId,
  enhancedSurveyResponses,
  investigator,
  scaleName,
  ecrfId,
  filledBy,
  day_name,
  schedule_names,
  totalScore // Total score parameter
) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // Register fonts
      doc.registerFont('DejaVuSans', FONT_PATHS.regular);
      doc.registerFont('DejaVuSans-Bold', FONT_PATHS.bold);
      doc.registerFont('DejaVuSans-Oblique', FONT_PATHS.italic);
      doc.registerFont('DejaVuSans-BoldOblique', FONT_PATHS.boldItalic);

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;

      let decryptedFirstName =
        decrypt(investigator.first_name) || investigator.first_name;
      let decryptedLastName =
        decrypt(investigator.last_name) || investigator.last_name;

      function sanitizeText(str) {
        return str
          ? str
              .replace(/<[^>]*>/g, " ")
              .replace(/&nbsp;/g, " ")
              .trim()
          : "";
      }

      const addHeader = () => {
        doc
          .image("./public/logo/logo.png", margin, margin, { width: 50 }) // Add logo if applicable
          .fontSize(12)
          .fillColor("#1D3557");

        // Determine which signature line to show based on filledBy
        if (filledBy === "Subject") {
          doc.text("Subject Sign : ____________", pageWidth - 410, margin + 5);
        } else if (filledBy === "Investigator") {
          doc.text(
            "Investigator Sign : ___________",
            pageWidth - 250,
            margin + 5
          );
        } else {
          // Default case - show both signatures
          doc
            .text("Subject Sign : ____________", pageWidth - 410, margin + 5)
            .text(
              "Investigator Sign : ___________",
              pageWidth - 250,
              margin + 5
            );
        }

        doc
          .moveTo(margin, margin + 20)
          .lineTo(pageWidth - margin, margin + 20)
          .stroke("#1D3557");
      };

      const addFooter = () => {
        const footerY = pageHeight - margin;

        // Define the disclaimer text
        const disclaimerText =
          "Disclaimer: By signing this document electronically, I acknowledge that I have reviewed its contents, understand its implications, and confirm its accuracy. I understand that my electronic signature is legally binding, the content of this document is confidential, and will not be shared with third parties without authorization.";

        // Calculate heights
        const disclaimerHeight = doc.heightOfString(disclaimerText, {
          width: pageWidth - 2 * margin,
          lineGap: 2,
        });

        // Define spacing
        const versionHeight = 15; // Height for version text
        const gapBetween = 15; // Gap between disclaimer and version

        // Calculate positions from the bottom of the page
        const versionY = footerY - versionHeight;
        const lineY = versionY - gapBetween / 2;
        const disclaimerY = lineY - disclaimerHeight - gapBetween / 2;

        // Add the disclaimer text
        doc
          .fontSize(9)
          .fillColor("#333333")
          .text(disclaimerText, margin, disclaimerY, {
            align: "left",
            width: pageWidth - 2 * margin,
            lineGap: 2,
          });

        // Add a line between disclaimer and version
        doc
          .moveTo(margin, lineY)
          .lineTo(pageWidth - margin, lineY)
          .stroke("#CCCCCC");

        // Add the version text
        doc
          .fontSize(10)
          .fillColor("#666666")
          .text("Version 2.0.0", margin, versionY, {
            align: "left",
          });
      };

      const addSurveyDetails = () => {
        const details = [
          {
            label: "Investigator",
            value: `${decryptedFirstName} ${decryptedLastName}`,
          },
          { label: "eCRF ID", value: ecrfId },
          { label: "Filled By", value: filledBy },
          {
            label: "Scale",
            value: schedule_names + " " + "(" + day_name + ")",
          },
          { label: "Date", value: new Date().toLocaleDateString() },
        ];

        let yPosition = margin + 70;
        details.forEach((detail, idx) => {
          doc
            .rect(margin, yPosition, pageWidth - 2 * margin, 40)
            .fill(idx % 2 === 0 ? "#E9ECEF" : "#F7F9FB")
            .fontSize(10)
            .font('DejaVuSans-Bold')
            .fillColor("#1D3557")
            .text(`${detail.label}:`, margin + 10, yPosition + 15)
            .font('DejaVuSans')
            .fillColor("#000000")
            .text(detail.value, margin + 150, yPosition + 15, {
              align: "center",
              width: pageWidth - 2 * margin - 150,
            });

          yPosition += 50;
        });
      };

      function stripHtmlTags(str) {
        if (!str) return "";
        return str.replace(/<[^>]*>/g, "").trim();
      }

      const addSurveyResponses = () => {
        doc.moveDown(2);
        enhancedSurveyResponses.forEach((response, index) => {
          console.log("=========================");
          console.log(response);
          console.log("============================");
          const questionText = htmlToText(response.question_text, {
            wordwrap: false,
            preserveNewlines: true,
          });

          const question = ` ${questionText}`;
          let answerText = "";

          if (
            scaleId === 11 ||
            scaleId === 18 ||
            scaleId === 19 ||
            scaleId === 48 ||
            scaleId === 50 ||
            scaleId === 56 ||
            scaleId === 57
          ) {
            if (response.option_id && response.option_id !== "") {
              answerText = `Answer: ${stripHtmlTags(response.option_text)}`;
            } else {
              const descriptionText = htmlToText(response.description, {
                wordwrap: false,
                preserveNewlines: true,
              });
              answerText = `Answer: ${descriptionText}`;
            }
          } else {
            answerText = `Answer: ${stripHtmlTags(response.option_text)}`;
          }

          const estimatedHeight =
            doc.heightOfString(`${question}\n${answerText}`, {
              width: pageWidth - 2 * margin - 20,
            }) + 30;

          if (doc.y + estimatedHeight > pageHeight - 50) {
            doc.addPage();
            doc.y = margin + 40; // Start new page without header
          }

          doc
            .rect(margin, doc.y, pageWidth - 2 * margin, estimatedHeight)
            .fill(index % 2 === 0 ? "#FAFAFA" : "#FFFFFF");

          let xPosition = margin + 10;
          let yPosition = doc.y + 10;

          doc.fontSize(11).fillColor("#1D3557").font('DejaVuSans-Bold');
          doc.text(question, xPosition, yPosition, {
            width: pageWidth - 2 * margin - 20,
            align: "left",
          });
          yPosition = doc.y + 5;

          doc.fontSize(10).fillColor("#333333").font('DejaVuSans');
          doc.text(answerText, xPosition + 10, yPosition, {
            width: pageWidth - 2 * margin - 30,
            align: "left",
          });

          doc.moveDown(3);
        });

        if (scaleId === 7 || scaleId === 11) {
          const totalScoreText = `Total Score: ${totalScore}`;
          const estimatedHeight =
            doc.heightOfString(totalScoreText, {
              width: pageWidth - 2 * margin - 20,
            }) + 30;

          if (doc.y + estimatedHeight > pageHeight - 50) {
            doc.addPage();
            doc.y = margin + 40;
          }

          doc
            .rect(margin, doc.y, pageWidth - 2 * margin, estimatedHeight)
            .fill("#E9ECEF");

          let xPosition = margin + 10;
          let yPosition = doc.y + 10;

          doc
            .fontSize(12)
            .fillColor("#1D3557")
            .font('DejaVuSans-Bold')
            .text(totalScoreText, xPosition, yPosition, {
              width: pageWidth - 2 * margin - 20,
              align: "center",
            });
        }
      };

      addHeader(); // Add header only once at the beginning
      doc
        .fontSize(12)
        .font('DejaVuSans-Bold')
        .fillColor("#1D3557")
        .text(scaleName, margin, margin + 40, { align: "center" });

      doc.moveDown(2);
      addSurveyDetails();
      addSurveyResponses();
      addFooter();

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const sendPDFToAPI = (
  pdfBuffer,
  userId,
  investigator_id,
  scaleName,
  scaleId,
  dayId,
  filledBy,
  day_name,
  schedule_names,
  ecrf_id,
  token
) => {
  console.log(filledBy, "PDF to API ============1=========");
  return new Promise(async (resolve, reject) => {
    try {
      // Verify required parameters
      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        return reject(new Error("Invalid or undefined pdfBuffer"));
      }
      if (!userId) {
        return reject(new Error("userId is undefined"));
      }
      if (!investigator_id) {
        return reject(new Error("investigator_id is undefined"));
      }
      if (!scaleId) {
        return reject(new Error("scaleId is undefined"));
      }
      if (!dayId) {
        return reject(new Error("dayId is undefined"));
      }
      if (!filledBy) {
        return reject(new Error("filledBy is undefined"));
      }
      if (!token) {
        return reject(new Error("token is undefined"));
      }

      const pdfName = `${ecrf_id}_${scaleName}_${schedule_names}_${day_name}.pdf`;

      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("investigatorId", investigator_id);
      formData.append("scale_id", scaleId);
      formData.append("day_id", dayId);
      formData.append("filled_by", filledBy);

      formData.append("pdf", pdfBuffer, {
        filename: pdfName,
        contentType: "application/pdf",
      });

      const apiEndpoint = "http://localhost:5000/sign/upload-pdf";

      const response = await axios.post(apiEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const docId = response.data.responseData.id;

      if (response.status === 200) {
        resolve(docId);
      } else {
        reject(new Error(`API responded with status ${response.status}`));
      }
    } catch (error) {
      reject(error);
    }
  });
};

// function mannualgenerateSurveyPDF(
//   scaleId,
//   enhancedSurveyResponses,
//   investigator,
//   scaleName,
//   ecrfId,
//   filledBy,
//   dayName,
//   scheduleName,
//   totalScore
// ) {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({ size: "A4", margin: 50 });
//       const buffers = [];
//       doc.on("data", buffers.push.bind(buffers));
//       doc.on("end", () => resolve(Buffer.concat(buffers)));

//       const { width: pageWidth, height: pageHeight } = doc.page;
//       const margin = 50;

//       // --- Header ---
//       const logoPath = path.join(__dirname, "../../public/logo/logo.png");
//       doc
//         .image(logoPath, margin, margin, { width: 50 })
//         .fontSize(12)
//         .fillColor("#1D3557")
//         .text(
//           "Subject Sign : ____________",
//           pageWidth - margin - 360,
//           margin + 5
//         )
//         .text(
//           "Investigator Sign : ___________",
//           pageWidth - margin - 200,
//           margin + 5
//         )
//         .moveTo(margin, margin + 20)
//         .lineTo(pageWidth - margin, margin + 20)
//         .stroke("#1D3557");

//       // --- Title ---
//       doc
//         .font("Helvetica-Bold")
//         .fontSize(14)
//         .fillColor("#1D3557")
//         .text(scaleName, margin, margin + 40, { align: "center" });

//       // --- Survey Details ---
//       const { first_name, last_name } = investigator;

//       const details = [
//         { label: "Investigator", value: `${first_name} ${last_name}` },
//         { label: "eCRF ID", value: ecrfId },
//         { label: "Filled By", value: filledBy },
//         { label: "Scale", value: `${scheduleName} (${dayName})` },
//         { label: "Date", value: new Date().toLocaleDateString() },
//       ];

//       let y = margin + 70;
//       details.forEach((d, i) => {
//         doc
//           .rect(margin, y, pageWidth - 2 * margin, 40)
//           .fill(i % 2 === 0 ? "#E9ECEF" : "#F7F9FB");
//         doc
//           .fillColor("#1D3557")
//           .font("Helvetica-Bold")
//           .fontSize(10)
//           .text(`${d.label}:`, margin + 10, y + 15);
//         doc
//           .fillColor("#000000")
//           .font("Helvetica")
//           .fontSize(10)
//           .text(d.value, margin + 150, y + 15, {
//             width: pageWidth - 2 * margin - 150,
//           });
//         y += 50;
//       });

//       function stripHtmlTags(str) {
//         if (!str) return "";
//         return str.replace(/<[^>]*>/g, "").trim();
//       }

//       // --- Survey Responses ---
//       doc.moveDown(2);
//       enhancedSurveyResponses.forEach((resp, idx) => {
//         const question = htmlToText(resp.question_text, { wordwrap: false });
//         const answerBase = resp.option_id
//           ? stripHtmlTags(resp.option_text)
//           : stripHtmlTags(resp.description);
//         const answer = `Answer: ${answerBase}`;
//         const blockText = `${question}\n${answer}`;
//         const blockHeight =
//           doc.heightOfString(blockText, {
//             width: pageWidth - 2 * margin - 20,
//           }) + 30;

//         if (doc.y + blockHeight > pageHeight - margin) {
//           doc.addPage();
//           doc.y = margin + 40;
//         }

//         doc
//           .rect(margin, doc.y, pageWidth - 2 * margin, blockHeight)
//           .fill(idx % 2 === 0 ? "#FAFAFA" : "#FFFFFF");
//         doc
//           .fillColor("#1D3557")
//           .font("Helvetica-Bold")
//           .fontSize(11)
//           .text(question, margin + 10, doc.y + 10, {
//             width: pageWidth - 2 * margin - 20,
//           });
//         doc
//           .fillColor("#333333")
//           .font("Helvetica")
//           .fontSize(10)
//           .text(answer, margin + 20, doc.y + 20, {
//             width: pageWidth - 2 * margin - 30,
//           });
//         doc.moveDown(2);
//       });

//       // --- Total Score (if applicable) ---
//       if ([7, 11].includes(scaleId)) {
//         const scoreText = `Total Score: ${totalScore}`;
//         const scoreHeight =
//           doc.heightOfString(scoreText, { width: pageWidth - 2 * margin }) + 30;
//         if (doc.y + scoreHeight > pageHeight - margin) {
//           doc.addPage();
//           doc.y = margin + 40;
//         }
//         doc
//           .rect(margin, doc.y, pageWidth - 2 * margin, scoreHeight)
//           .fill("#E9ECEF");
//         doc
//           .fillColor("#1D3557")
//           .font("Helvetica-Bold")
//           .fontSize(12)
//           .text(scoreText, margin + 10, doc.y + 10, {
//             width: pageWidth - 2 * margin,
//             align: "center",
//           });
//       }

//       // --- Footer ---
//       // Define the disclaimer text
//       const disclaimerText = "Disclaimer: By signing this document electronically, I acknowledge that I have reviewed its contents, understand its implications, and confirm its accuracy. I understand that my electronic signature is legally binding, the content of this document is confidential, and will not be shared with third parties without authorization.";
//
//       // Calculate heights
//       const disclaimerHeight = doc.heightOfString(disclaimerText, {
//         width: pageWidth - 2 * margin,
//         lineGap: 2,
//       });
//
//       // Define spacing
//       const versionHeight = 15; // Height for version text
//       const gapBetween = 15; // Gap between disclaimer and version
//
//       // Calculate positions from the bottom of the page
//       const versionY = pageHeight - margin - versionHeight;
//       const lineY = versionY - gapBetween/2;
//       const disclaimerY = lineY - disclaimerHeight - gapBetween/2;
//
//       // Add the disclaimer text
//       doc
//         .fontSize(9)
//         .fillColor("#333333")
//         .text(
//           disclaimerText,
//           margin,
//           disclaimerY,
//           {
//             align: "left",
//             width: pageWidth - 2 * margin,
//             lineGap: 2
//           }
//         );
//
//       // Add a line between disclaimer and version
//       doc
//         .moveTo(margin, lineY)
//         .lineTo(pageWidth - margin, lineY)
//         .stroke("#CCCCCC");
//
//       // Add the version text
//       doc
//         .fontSize(10)
//         .fillColor("#666666")
//         .text("Version 2.0.0", margin, versionY, { align: "left" });

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// }

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);

function decrypt(text) {
  if (!text) return text; // Return if text is null or undefined

  let textParts = text.split(":");
  if (textParts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }

  let iv = Buffer.from(textParts[0], "hex");
  let encryptedText = Buffer.from(textParts[1], "hex");

  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "binary", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

const generateSurveyExcel = async (
  scaleId,
  userId,
  enhancedSurveyResponses,
  whoqolScore,
  investigator,
  scaleName,
  ecrfId,
  filledBy,
  totalScore
) => {
  console.log("...........................................................");
  console.log("...........................................................");
  console.log("...........................................................");
  console.log(whoqolScore, "...////////////////////.........................");
  console.log("...........................................................");
  console.log("...........................................................");
  console.log("...........................................................");
  const ExcelJS = require("exceljs"); // Ensure ExcelJS is installed
  const path = require("path");
  const fs = require("fs");
  const cheerio = require("cheerio"); // Add Cheerio for HTML parsing
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Survey Responses");

  let decryptedFirstName = "";
  let decryptedLastName = "";
  try {
    decryptedFirstName = decrypt(investigator.first_name);
    decryptedLastName = decrypt(investigator.last_name);
  } catch (err) {
    console.error("Error decrypting investigator name:", err);
    decryptedFirstName = investigator.first_name;
    decryptedLastName = investigator.last_name;
  }

  // Define styles
  const headerStyle = {
    font: { bold: true, size: 16, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    }, // Dark blue background
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const dateStyle = {
    font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    }, // Same background as header
    alignment: { horizontal: "right", vertical: "middle" },
  };

  const subHeaderStyle = {
    font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    }, // Lighter blue background
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const dataStyle = {
    font: { size: 11, color: { argb: "FF000000" } },
    alignment: { vertical: "top", wrapText: true },
  };

  const alternatingRowFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" }, // Light gray background for alternating rows
  };

  // Add Header Row
  worksheet.mergeCells("A1:B2"); // Merge cells for the main header
  worksheet.mergeCells("C1:C2"); // Merge cells for the date

  const headerCell = worksheet.getCell("A1");
  headerCell.value = `${scaleName} Scale`;
  headerCell.style = headerStyle;

  const dateCell = worksheet.getCell("C1");
  dateCell.value = new Date().toLocaleDateString();
  dateCell.style = dateStyle;

  // Adjust row height
  worksheet.getRow(1).height = 25; // Increase row height for header

  // Add Survey Details
  worksheet.addRow([]);
  const detailsRow = worksheet.addRow([
    `Investigator: ${decryptedFirstName} ${decryptedLastName}`,
    `eCRF ID: ${ecrfId}`,
    `Filled By: ${filledBy}`,
  ]);
  detailsRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 };
    cell.alignment = { horizontal: "left" };
  });

  // Add a blank row
  worksheet.addRow([]);

  // Add Subheaders
  let subHeaderRow;
  if (scaleId === 18 || scaleId === 19) {
    // For scales 18 and 19, add additional columns
    subHeaderRow = worksheet.addRow([
      "Question",
      "Answer",
      "Description",
      "Selected Option",
      "Time Line",
    ]);
  } else {
    // For other scales, keep existing columns
    subHeaderRow = worksheet.addRow(["Question", "Answer", "Description"]);
  }
  subHeaderRow.eachCell((cell) => {
    cell.style = subHeaderStyle;
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Function to strip HTML tags
  function stripHtmlTags(str) {
    if (!str) return "";
    return str.replace(/<[^>]*>/g, "").trim();
  }

  // Add Survey Responses
  enhancedSurveyResponses.forEach((response, index) => {
    const questionText = stripHtmlTags(
      response.question_text || `Question ${index + 1}`
    );
    let optionText = stripHtmlTags(response.option_text);
    const description = stripHtmlTags(response.description) || "";

    if (scaleId === 18 || scaleId === 19) {
      if (!response.option_id) {
        // option_id is empty or null, parse the description
        const $ = cheerio.load(response.description || "");
        // Extract data from the description HTML
        // Adjust selectors based on your actual HTML structure
        let extractedData1 = $("p").eq(0).text().trim();
        let extractedData2 = $("p").eq(1).text().trim();

        // Add row with extracted data
        const row = worksheet.addRow([
          `${questionText}`,
          "",
          description,
          extractedData1,
          extractedData2,
        ]);
      } else {
        // option_id exists, show the option_text
        const row = worksheet.addRow([
          `${questionText}`,
          optionText,
          description,
          "",
          "",
        ]);
      }
    } else {
      // For other scales, keep existing behavior
      const row = worksheet.addRow([
        `${questionText}`,
        optionText,
        description,
      ]);
    }

    // Style the row
    const lastRow = worksheet.lastRow;
    lastRow.eachCell((cell) => {
      cell.style = dataStyle;
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Apply alternating row color
    if (index % 2 === 0) {
      lastRow.fill = alternatingRowFill;
    }
  });

  // If totalScore is provided, add it to the Excel
  if (scaleId !== 29 && totalScore !== null) {
    // Add a blank row before the total score
    worksheet.addRow([]);

    // Add Total Score Row
    const totalScoreRow = worksheet.addRow(["Total Score", totalScore]);
    totalScoreRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.alignment = { horizontal: "left" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "double" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      if (cell.col === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFCCCCCC" }, // Light gray background
        };
      }
    });
  }

  // Adjust column widths
  if (scaleId === 18 || scaleId === 19) {
    worksheet.columns = [
      { key: "A", width: 50 }, // Question
      { key: "B", width: 30 }, // Answer
      { key: "C", width: 30 }, // Description
      { key: "D", width: 30 }, // Extracted Data 1
      { key: "E", width: 30 }, // Extracted Data 2
    ];
  } else {
    worksheet.columns = [
      { key: "A", width: 50 }, // Question
      { key: "B", width: 30 }, // Answer
      { key: "C", width: 30 }, // Description
    ];
  }

  // Always add WHOQOL Scores section
  if (whoqolScore) {
    worksheet.addRow([]);
    const scoreHeaderRow = worksheet.addRow(["Automated Scores Calculation:"]);
    scoreHeaderRow.font = { bold: true, size: 12 };
    scoreHeaderRow.alignment = { horizontal: "left" };

    const scores = [
      ["27. Domain 1 Score", whoqolScore.domain1],
      ["28. Domain 2 Score", whoqolScore.domain2],
      ["29. Domain 3 Score", whoqolScore.domain3],
      ["30. Domain 4 Score", whoqolScore.domain4],
      ["Total Score", whoqolScore.totalScore],
    ];

    scores.forEach((score, index) => {
      const row = worksheet.addRow(score);
      row.eachCell((cell) => {
        cell.style = dataStyle;
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Apply alternating row color
      if (index % 2 === 0) {
        row.fill = alternatingRowFill;
      }
    });
  }
  // ... (rest of your code remains the same)

  // Save file
  const randomNum = Math.floor(Math.random() * 1000000); // Generate random number
  const userDir = path.join(
    __dirname,
    "../../public/excel_docs",
    String(userId)
  );

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  const fileName = `${randomNum}_survey_responses.xlsx`;
  const filePath = path.join(userDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  // Return relative path from the public directory
  const relativeFilePath = path.join("excel_docs", String(userId), fileName);
  return relativeFilePath; // Return the relative path to be stored in the database
};

module.exports = {
  calculateWHOQOLScore,
  generateSurveyPDF,
  sendPDFToAPI,
  generateSurveyExcel,
};
