// email.js
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

const sendEmailReceipt = async (to, name, phone) => {
  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/favicon.ico?alt=media&token=ec16f0f4-6447-4d51-8f75-884db512dd75";

  const instagramLink = "https://www.instagram.com/supernova.dental"; 
  const facebookLink = "https://www.facebook.com/profile.php?id=61567279201971"; 

  const htmlContent = `
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; padding: 0; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
      h1 { color: #DAA520; }
      .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
      .logo { display: flex; justify-content: space-between; align-items: center; }
      .social-links { margin-top: 20px; }
      .social-links img { margin-right: 10px; max-width: 40px; } /* Adjust size of social icons */
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">
        <img src="${logoUrl}" alt="Supernova Dental Logo" style="max-width: 100px;"/> <!-- Supernova Dental Logo -->
      </div>
      <h1>Thank You for Signing Up!</h1>
      <p>Dear ${name},</p>
      <p>We cannot wait to help you get your Supernova smile! Thank you for signing up for our promotion! We have received the following details:</p>
      <p><strong>Full Name:</strong> ${name}</p>
      <p><strong>Phone Number:</strong> ${phone}</p>
      <p>Best regards, <br> Your Team</p>
      <p>Keep up to date with us on social media!</p>
      <div class="social-links">
        <a href="${instagramLink}" target="_blank">
          <img src="https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/insta_anim.gif?alt=media&token=fa004e80-29d5-4aa0-be0f-d70edeac9e9d" alt="Instagram" />
        </a>
        <a href="${facebookLink}" target="_blank">
          <img src="https://firebasestorage.googleapis.com/v0/b/supernova-dental.appspot.com/o/facebook_anim.gif?alt=media&token=22df5d65-5ede-4659-8fa6-f2152a5e18a2" alt="Facebook" />
        </a>
      </div>
      <div class="footer">
        <p>If you have any questions, feel free to contact us at support@example.com.</p>
      </div>
    </div>
  </body>
  </html>
`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "Promotion Signup Confirmation",
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

module.exports = { sendEmailReceipt, sendEmail };
