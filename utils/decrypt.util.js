const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from("KY73owoqZwuKwBy7ndP5hMnm01TNcl0/PTNZoLnkYtk=", 'base64'); // Best practice: use env var
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error(`Decryption failed for value: ${text}`);
    return null;
  }
}

// Helper
const decryptUser = (user) => ({
  ...user,
  first_name: decrypt(user.first_name),
  last_name: decrypt(user.last_name),
  email: user.email,
});

module.exports = { decrypt, decryptUser };
