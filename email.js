const nodemailer = require("nodemailer");
const { getRandomInt, wait } = require("./utils");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendEmailReceipt = async (referrerName, to, name, phone) => {
  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/favicon.ico?alt=media&token=ec16f0f4-6447-4d51-8f75-884db512dd75";

  const instagramLink = "https://www.instagram.com/supernova.dental";
  const facebookLink = "https://www.facebook.com/profile.php?id=61567279201971";

  const instagramLogoUrl =
    "https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/instaLogo.png?alt=media&token=6de73b4a-5305-4607-be13-24f5195387e6";
  const facebookLogoUrl =
    "https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/fbLogo.png?alt=media&token=989e5762-b8d6-4894-aeae-fc54fac74c58";

  const htmlContent = `
    <html>
    <head>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          overflow-x: hidden;
        }
        .container {
          width: 100%;
          max-width: 600px;
          margin: 20px auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background-color: #f9f9f9;
          text-align: center;
          box-sizing: border-box;
        }
        h1 {
          color: #a4693d;
          font-size: 24px;
          margin-top: 0;
          text-align: center;
        }
        .footer {
          margin-top: 20px;
          margin-bottom: 20px;
          font-size: 0.9em;
          color: #777;
          text-align: center;
        }
        .logo {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo img {
          max-width: 120px;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        img {
          max-width: 100%;
          height: auto;
          display: block;
        }
        .social-links {
          text-align: center;
          margin-top: 40px;
          margin-bottom: 40px;
        }
        .social-links a {
          display: inline-block;
          margin-right: 20px;
        }
        .social-links img {
          width: 40px;
          height: 40px;
          transition: transform 0.3s;
        }
        .text-content {
          text-align: left;
          padding: 10px 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="${logoUrl}" alt="Supernova Dental Logo" />
        </div>
        <h1>Thank You for Signing Up!</h1>
        <div class="text-content">
          <p>Dear ${name},</p>
          <p>Thank you for your enquiry; we’re excited to help you achieve your Supernova smile!</p>
          <p>We have received the following details and will reach out to you soon to get you booked in:</p>
          ${
            referrerName !== "NoFriendReferral"
              ? `<p><strong>Referrer Name:</strong> ${referrerName}</p>`
              : ""
          }
          <p><strong>Full Name:</strong> ${name}</p>
          <p><strong>Phone Number:</strong> ${phone}</p>
          <br/>
          <p>Best regards, <br> Supernova Dental Team</p>
          </div>
        <br/>
        <p style="margin-bottom: 10px; font-size: 16px;">Prefer to book yourself in? Use our patient portal by pressing the button below:</p>
        <div style="text-align: center; margin-bottom: 30px; max-width: 100%; overflow-x: hidden;">
          <a 
            href="https://supernova.portal.dental" 
            target="_blank" 
            style="display: inline-block; background-color: #a4693d; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 16px; border-radius: 6px; font-weight: 500;"
          >
            Book Now!
          </a>
        </div>
          <div class="social-links">
          <p>Stay connected with us on social media!</p>
          <a href="${instagramLink}" target="_blank">
            <img src="${instagramLogoUrl}" alt="Instagram" />
          </a>
          <a href="${facebookLink}" target="_blank">
            <img src="${facebookLogoUrl}" alt="Facebook" />
          </a>
        </div>
        <div class="footer">
          <p>If you have any questions, feel free to contact us at enquiries@supernovadental.co.uk</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Supernova Dental Signup Confirmation",
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Receipt email sent successfully.");
  } catch (error) {
    console.error("Error sending email receipt:", error);
  }
};

// Recursive function to attempt to send 5 times
const sendEmail = async (mailOptions, email, retries = 0) => {
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent");
  } catch (error) {
    console.log("*** ERROR ***", error?.message);
    if (retries < 5) {
      const fiveSecondsToTwentySecondsInMilliSeconds = getRandomInt(
        5000,
        20000
      );
      // Wait for the delay
      await wait(fiveSecondsToTwentySecondsInMilliSeconds);
      // make recursive call to sendEmail
      return sendEmail(mailOptions, email, retries + 1);
    } else {
      console.log("Failed to send email after 5 attempts");

      // // Send SMS notification
      // const smsMessage = `Hey Adam, someone just failed sending an email to you after 5 attempts. Email: ${email}. Check your database to see more information.`;
      // sendSMS(smsMessage);
      // // Store email in the database
      // saveEmailToDatabase(mailOptions);

      // send error
      throw error;
    }
  }
};

/**
 * Sends an email with optional attachments.
 * @param {Object} mailOptions - Nodemailer mail options including attachments array.
 * @param {string} email - Recipient email for logging/retry purposes.
 * @param {number} retries - Internal retry counter.
 */
const sendEmailWithAttachments = async (mailOptions, email, retries = 0) => {
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email with attachments sent");
  } catch (error) {
    console.error(
      "*** ERROR sending email with attachments ***",
      error?.message
    );
    if (retries < 5) {
      const delayMs = getRandomInt(5000, 20000);
      await wait(delayMs);
      return sendEmailWithAttachments(mailOptions, email, retries + 1);
    } else {
      console.error("Failed to send email after 5 attempts");
      throw error;
    }
  }
};

module.exports = { sendEmailReceipt, sendEmail, sendEmailWithAttachments };
