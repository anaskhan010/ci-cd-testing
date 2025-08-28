// scheduled_tasks/checkExpiredStudies.js
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get the base URL from environment variables
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

/**
 * Function to check for expired studies and update their status
 */
async function checkExpiredStudies() {
  try {
    console.log('Running scheduled task: Checking for expired studies...');
    
    // Call the API endpoint to check and update expired studies
    const response = await axios.get(`${BASE_URL}/study/check-expired-studies`);
    
    // Log the result
    if (response.data.count > 0) {
      console.log(`Successfully cancelled ${response.data.count} expired studies: ${JSON.stringify(response.data.studyIds)}`);
    } else {
      console.log('No expired studies found that need to be cancelled');
    }
  } catch (error) {
    console.error('Error checking expired studies:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Schedule the task to run daily at midnight
 * Cron format: minute hour day-of-month month day-of-week
 * '0 0 * * *' = Run at 00:00 (midnight) every day
 */
function scheduleTask() {
  console.log('Scheduling daily check for expired studies at midnight...');
  cron.schedule('0 0 * * *', checkExpiredStudies);
  
  // Also run immediately on startup
  checkExpiredStudies();
}

// Export the functions for use in the main application
module.exports = {
  checkExpiredStudies,
  scheduleTask
};
