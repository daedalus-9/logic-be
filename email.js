// email.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendEmailReceipt = async (to, name, phone) => {
  const htmlContent = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; padding: 0; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
        h1 { color: #DAA520; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Thank You for Signing Up!</h1>
        <p>Dear ${name},</p>
        <p>Thank you for signing up for our promotion! We have received the following details:</p>
        <p><strong>Full Name:</strong> ${name}</p>
        <p><strong>Phone Number:</strong> ${phone}</p>
        <p>We look forward to seeing you soon.</p>
        <p>Best regards, <br> Your Team</p>
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

