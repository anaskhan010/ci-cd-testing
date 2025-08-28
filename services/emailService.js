const { sendEmail } = require("../utils/emailUtil");
const userAccessModel = require("../models/userAccess/userAccess.model");
const { getFormattedUTCTimestamp } = require("../utils/dateTimeUtils");
const {
  getOrganizationName,
} = require("../models/TLFB_Management/TLFB_Management_Model");
const { decryptUser } = require("../utils/decrypt.util");

const generateSubjectCreationEmailContentForSiteManager = (
  user,
  ecrf_id,
  siteName,
  createdAtUTC
) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>
      <p>
        A new subject with <strong>eCRF ID: ${ecrf_id}</strong> from site <strong>${siteName}</strong> 
        was created on <strong>${createdAtUTC} (UTC)</strong>.
        The subject’s account status is currently <strong>Pending</strong>.
      </p>
      <p>Please click the button below to review and accept this subject account::</p>
      <p style="text-align:left; margin: 20px 0;">
        <a href="https://myresearchhero.net/#/registration-management?tab=Pending" 
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
              Review Pending Accounts
        </a>
      </p>
  `;

const generateAccountUnlockedEmailToUser = (user, unlockDateTimeUTC) => `
    <h2>Dear ${user.first_name} ${user.last_name},</h2>

<p>We are pleased to inform you that your ResearchHero account has been successfully unlocked on <strong>${unlockDateTimeUTC}</strong> (UTC).</p>

<p>You may now log in to your account and continue using our services without any interruption.</p>

<p>If you did not request this action or notice any unusual activity, please contact our support team immediately.</p>

  `;

const sendSubjectCreationEmailToSiteManager = async (subject) => {
  const createdAtUTC = getFormattedUTCTimestamp();

  if (!subject || !subject.ecrf_id || !subject.organization_detail_id) {
    console.error("Invalid subject object provided.");
    return;
  }
  const emailSubject = `Subject Account Created – ${subject.ecrf_id}`;
  const siteId = subject.organization_detail_id;
  const siteName = await getOrganizationName(siteId);
  if (!siteName) {
    console.error(
      "Organization not found for the provided organization_detail_id."
    );
    return;
  }
  const siteManagers = await userAccessModel.getUsersByRoleSiteAndEmailType(
    22,
    siteId,
    16
  ); // role_id 22 = Site Manager, 16 mean email type for Creating user and sending email to site manager

  // Send to Site Manager
  for (const siteManager of siteManagers) {
    const decrypted = decryptUser(siteManager);
    const html = generateSubjectCreationEmailContentForSiteManager(
      decrypted,
      subject.ecrf_id,
      siteName,
      createdAtUTC
    );
    console.log("Sending email to Site manager");
    await sendEmail(decrypted.email, emailSubject, html);
  }
};

const sendAccountUnlockedEmailToUser = async (User) => {
  const unlockedAtUTC = getFormattedUTCTimestamp();
  if (!User || !User.first_name || !User.last_name || !User.email) {
    console.error("Invalid User object provided.");
    return;
  }
  const emailSubject = `Account Unlocked`;
  const html = generateAccountUnlockedEmailToUser(
    User,
    unlockedAtUTC
  );
  console.log("Sending email to Unlocked User");
  await sendEmail(User.email, emailSubject, html);
};


module.exports = { sendSubjectCreationEmailToSiteManager, sendAccountUnlockedEmailToUser };
