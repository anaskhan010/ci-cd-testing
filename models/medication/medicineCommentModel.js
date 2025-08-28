const db = require("../../config/DBConnection3");
const crypto = require("crypto");

const ENCRYPTION_KEY = Buffer.from(
  "KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=",
  "base64"
);
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const medicineCommentModel = async (
  medicine_id,
  record_id,
  user_id,
  investigator_id,
  medicine_date,
  comment
) => {
  const query = `INSERT INTO medicine_comments (medicine_id,record_id,user_id,investigator_id,medicine_date,comments) VALUES(?,?,?,?,?,?)`;
  const [result] = await db.execute(query, [
    medicine_id,
    record_id,
    user_id,
    investigator_id,
    medicine_date,
    comment,
  ]);

  return result;
};

const getMedicineCommentsModel = async (record_id) => {
  const query = `SELECT mc.*,o.first_name,o.last_name FROM medicine_comments AS mc
JOIN organization AS o ON mc.investigator_id = o.user_id
WHERE record_id = ?`;
  const [result] = await db.execute(query, [record_id]);

  const decryptedData = result.map((item) => {
    return {
      ...item,
      first_name: decrypt(item.first_name),
      last_name: decrypt(item.last_name),
    };
  });

  return decryptedData;
};

module.exports = {
  medicineCommentModel,
  getMedicineCommentsModel,
};
