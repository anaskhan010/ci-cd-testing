const { sendLockedUserEmail } = require('../middleware/LockedUserEmail');
const userAccessModel = require('../models/userAccess/userAccess.model');
const { decryptUser } = require('../utils/decrypt.util');
const {getFormattedUTCTimestamp} = require('../utils/dateTimeUtils')

async function notifyLockedUsers( ecrfId, lockedUser) {
    const lockedAtUTC = getFormattedUTCTimestamp(); 

  if (!lockedUser || !lockedUser.role_id || !lockedUser.user_id || !lockedUser.email) {
    console.error("Invalid locked user object provided.");
    return;
  }

  const isSubject = lockedUser.role_id === 10;
  const isSuperAdmin = lockedUser.role_id === 9;
  const isSiteManager = lockedUser.role_id === 22;
  const superAdmins = await userAccessModel.getUsersByRole(9); // role_id 9 = Super Admins
  const siteId = lockedUser.organization_detail_id;
  const siteManagers = await userAccessModel.getUsersByRoleSiteAndEmailType(22, siteId, 15); // role_id 22 = Site Manager, 15 mean email type for Locking user and sending email to site manager
  
  const generateEmailToSiteManagerSubject = (user, ecrfId) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
      <p>The subject with <strong>eCRF ID: ${ecrfId}</strong> from site <strong>${lockedUser.organization_name}</strong> 
      was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to <strong>3 consecutive incorrect password attempts</strong>.</p>
      <p>Please click the button below to unlock the user account to restore access:</p>
      <p style="text-align:left; margin: 20px 0;">
        <a href="https://myresearchhero.net/#/registration-management?tab=Locked" 
          style="
            display: inline-block;
            background-color: #17b8a6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            font-size: 14px;
          ">
          Unlock User Account
        </a>
      </p>
      <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
      <p>Best regards,</p>
      <p>The ResearchHero Team</p>
  `;
  
  const generateEmailToSiteManagerUser = (user, email) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
    <p>The user with <strong>Email: ${email}</strong> from site <strong>${lockedUser.organization_name}</strong> 
    was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to <strong>3 consecutive incorrect password attempts</strong>.</p>
    <p>Please click the button below to unlock the user account to restore access:</p>
    <p style="text-align:left; margin: 20px 0;">
      <a href="https://myresearchhero.net/#/registration-management?tab=Locked" 
        style="
          display: inline-block;
          background-color: #17b8a6;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-family: Arial, sans-serif;
          font-size: 14px;
        ">
         Unlock User Account
      </a>
    </p>
    <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
    <p>Best regards,</p>
    <p>The ResearchHero Team</p>
  `;
  const generateEmailToMoneeb = (email) => `
    <h2>Dear Moneeb,</h2>
    <p>The super admin with <strong>Email: ${email}</strong> was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to <strong>3 consecutive incorrect password attempts</strong>.</p>
    <p>Please unlock the user account to restore access.</p>
    <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
    <p>Best regards,</p>
    <p>The ResearchHero Team</p>
  `;
  
  const generateEmailToInternalTeam = (user, identifier) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
    <p>The subject with <strong>eCRF ID: ${identifier}</strong> from site <strong>${lockedUser.organization_name}</strong> 
    was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to <strong>3 consecutive incorrect password attempts</strong>.</p>
    <p>Please contact the site manager to unlock the account.</p>
    <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
    <p>Best regards,</p>
    <p>The ResearchHero Team</p>
  `;
  
  const generateEmailToSubject = (user) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
    <p>Your account was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to 
    <strong>3 consecutive incorrect password attempts</strong>.</p>
    <p>Please contact your clinic staff to unlock your account.</p>
    <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
    <p>Best regards,</p>
    <p>The ResearchHero Team</p>
  `;
  
  const generateEmailToUser = (user) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
    <p>Your account was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to 
    <strong>3 consecutive incorrect password attempts</strong>.</p>
    <p>Please contact your Site Manager to unlock your account.</p>
    <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
    <p>Best regards,</p>
    <p>The ResearchHero Team</p>
  `;

  const generateEmailToLockedSiteManager = (user) => `
  <h2>Dear ${user.first_name} ${user.last_name},</h2>
  <p>Your account was <strong>locked on ${lockedAtUTC} (UTC)</strong> due to 
  <strong>3 consecutive incorrect password attempts</strong>.</p>
  <p>Please contact IT administrator to unlock your account.</p>
  <p>For technical support or any assistance, please contact:</p>
      <p>
        Email: <a href="mailto:support@myresearchhero.net">support@myresearchhero.net</a><br>
        Phone: +1 (888) 8 EDIARY or +1 (888) 833‑4279
      </p>
      <p>
        Phone Support is available 24/7.
      </p>
  <p>Best regards,</p>
  <p>The ResearchHero Team</p>
`;

  // send email if super admin is locked
  if (isSuperAdmin){
    const subject = `User Account Locked – ${lockedUser.email}`;
    const html = generateEmailToMoneeb(lockedUser.email);
    console.log("Sending email to Moneeb")
    await sendLockedUserEmail('moe@sentrixmedia.com', subject, html);
    // Prevent sending emails to other roles
    return null;
  }

  // Send to Site Manager
  for (const siteManager of siteManagers) {
    // if site manager is locked itself then skip
    if (isSiteManager && lockedUser.user_id === siteManager.user_id){
      continue;
    }

    const decrypted = decryptUser(siteManager);
    const subject = isSubject
      ? `Subject Account Locked – ${ecrfId}`
      : `User Account Locked – ${lockedUser.email}`;
    const html = isSubject
      ? generateEmailToSiteManagerSubject(decrypted, ecrfId)
      : generateEmailToSiteManagerUser(decrypted, lockedUser.email);
    console.log("Sending email to Site manager")
    await sendLockedUserEmail(decrypted.email, subject, html);
  }

  // Send to Internal Team, these are all users except subject, super admin, site manager and sponsor
  if(isSubject){
    // these are all users except subject, super admin, site manager and sponsor
    let usersToSendEmail = null;
    try {
      console.log("Getting users for sending email.")
      usersToSendEmail = await userAccessModel.getAccessibleUsers(lockedUser.user_id);
      console.log("Got users to Send Email")

    } catch (error) {
      console.error('Error fetching user access data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }

    // Prepare recipient emails
    const filteredInternalUsers = usersToSendEmail.filter(
      (u) => u.user_id !== lockedUser.user_id
    );

    for (const user of filteredInternalUsers) {
    const decrypted = decryptUser(user);
    const subject = `Subject Account Locked – ${ecrfId}`
      
    const html = generateEmailToInternalTeam(decrypted, ecrfId)
     
      console.log("Sending email to internal team")
    await sendLockedUserEmail(decrypted.email, subject, html);
  }
  }

  // Send to Locked User
  const lockedUserDecrypted = decryptUser(lockedUser);
  const selfSubject = isSubject
    ? `Account Locked – ${ecrfId}`
    : `Account Locked – ${lockedUser.email}`;
  if (!isSiteManager){
    const selfHtml = isSubject
      ? generateEmailToSubject(lockedUserDecrypted)
      : generateEmailToUser(lockedUserDecrypted);
      console.log("Sending email to locked user")
    await sendLockedUserEmail(lockedUserDecrypted.email, selfSubject, selfHtml);
  } else{
    // If site Manager is locked
    const selfHtml = generateEmailToLockedSiteManager(lockedUserDecrypted);
      console.log("Sending email to locked site manager")
    await sendLockedUserEmail(lockedUserDecrypted.email, selfSubject, selfHtml);
  }

  // Send to Super Admins
  for (const admin of superAdmins) {
    const decrypted = decryptUser(admin);
    const subject = isSubject
      ? `Subject Account Locked – ${ecrfId}`
      : `User Account Locked – ${lockedUser.email}`;
    const html = isSubject
      ? generateEmailToSiteManagerSubject(decrypted, ecrfId)
      : generateEmailToSiteManagerUser(decrypted, lockedUser.email);
      console.log("SEnding email to super admins")
    await sendLockedUserEmail(decrypted.email, subject, html);
  }
}

module.exports = { notifyLockedUsers };
