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

/**
 * Send a confirmation email to a partner or truck placement contact
 */
const sendEmailReceipt = async (to, name, phone, purpose = "partner") => {
  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/logic-freight.appspot.com/o/logicfreight-logo.png?alt=media"; // replace with your hosted logo

  const linkedinLink = "https://www.linkedin.com/company/logicfreight";
  const facebookLink = "https://www.facebook.com/LogicFreight";

  const linkedinLogoUrl =
    "https://firebasestorage.googleapis.com/v0/b/logic-freight.appspot.com/o/linkedin.png?alt=media";
  const facebookLogoUrl =
    "https://firebasestorage.googleapis.com/v0/b/logic-freight.appspot.com/o/facebook.png?alt=media";

  const subjectLine =
    purpose === "partner"
      ? "Welcome to the Logic Freight Partner Network"
      : "Thank you for your Truck Placement";

  const mainMessage =
    purpose === "partner"
      ? `<p>Dear ${name},</p>
         <p>Thank you for joining the <strong>Logic Freight Partner Network</strong>.</p>
         <p>We’re thrilled to collaborate and help you move efficiently across the UK and Europe.</p>
         <p>Our team will review your details and reach out shortly.</p>`
      : `<p>Dear ${name},</p>
         <p>Thank you for submitting your truck availability with <strong>Logic Freight</strong>.</p>
         <p>Our traffic team has received your details and will contact you soon to coordinate routes.</p>`;

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
          color: #222;
          background-color: #f7f7f7;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          padding: 30px;
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #ddd;
          text-align: center;
        }
        .logo img {
          max-width: 160px;
          height: auto;
          margin-bottom: 20px;
        }
        h1 {
          color: #1a1a1a;
          font-size: 24px;
          margin-bottom: 20px;
        }
        p {
          line-height: 1.6;
          text-align: left;
          font-size: 16px;
        }
        .cta {
          margin-top: 30px;
          display: inline-block;
          background-color: #0a0a0a;
          color: #fff;
          text-decoration: none;
          padding: 14px 28px;
          font-size: 16px;
          border-radius: 6px;
          font-weight: 500;
        }
        .social-links {
          margin-top: 40px;
        }
        .social-links a {
          display: inline-block;
          margin-right: 16px;
        }
        .social-links img {
          width: 36px;
          height: 36px;
          transition: transform 0.3s;
        }
        .footer {
          margin-top: 40px;
          font-size: 14px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="${logoUrl}" alt="Logic Freight Logo" />
        </div>
        <h1>${subjectLine}</h1>
        ${mainMessage}
        <p><strong>Phone Number:</strong> ${phone}</p>
        <br/>
        <p>Best regards, <br/> The Logic Freight Team</p>
        <div class="social-links">
          <p>Follow us for updates:</p>
          <a href="${linkedinLink}" target="_blank">
            <img src="${linkedinLogoUrl}" alt="LinkedIn" />
          </a>
          <a href="${facebookLink}" target="_blank">
            <img src="${facebookLogoUrl}" alt="Facebook" />
          </a>
        </div>
        <div class="footer">
          <p>If you have any questions, contact us at <a href="mailto:partners@logic-freight.co.uk">partners@logic-freight.co.uk</a></p>
          <p>You can opt out of partner communications at any time.</p>
        </div>
      </div>
    </body>
  </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: subjectLine,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Receipt email sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending Logic Freight receipt email:", error);
  }
};

// Retryable generic email sender
const sendEmail = async (mailOptions, email, retries = 0) => {
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully.");
  } catch (error) {
    console.error("*** ERROR SENDING EMAIL ***", error?.message);
    if (retries < 5) {
      const delayMs = getRandomInt(5000, 20000);
      await wait(delayMs);
      return sendEmail(mailOptions, email, retries + 1);
    } else {
      console.error("Failed to send email after 5 attempts");
      throw error;
    }
  }
};

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
