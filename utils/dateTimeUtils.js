function getFormattedUTCTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

module.exports = {
  getFormattedUTCTimestamp,
};