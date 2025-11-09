const express = require("express");
const router = express.Router();
const { sendEmail } = require("./email");
require("dotenv").config();

/**
 * Truck placement route (from before)
 */
router.post("/place-truck", async (req, res) => {
  try {
    const {
      fullname,
      companyname,
      email,
      phone,
      location,
      availableFrom,
      availableUntil,
      message,
      optOutEmails,
      region,
    } = req.body;

    if (!fullname || !email || !location || !availableFrom) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "traffic@logic-freight.co.uk",
      subject: `New Truck Placement – ${fullname} (${region || "UK"})`,
      html: `
        <h2>New Truck Placement Submission</h2>
        <p><strong>Full Name:</strong> ${fullname}</p>
        <p><strong>Company:</strong> ${companyname || "N/A"}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Truck Location:</strong> ${location}</p>
        <p><strong>Available From:</strong> ${availableFrom}</p>
        <p><strong>Available Until:</strong> ${availableUntil || "N/A"}</p>
        <p><strong>Additional Info:</strong> ${message || "N/A"}</p>
        <p><strong>Region:</strong> ${region || "N/A"}</p>
        <p><strong>Opted Out of Marketing:</strong> ${
          optOutEmails ? "Yes" : "No"
        }</p>
        <hr />
        <p><em>Submitted at ${new Date().toLocaleString()}</em></p>
      `,
    };

    await sendEmail(mailOptions, email);

    if (!optOutEmails) {
      const confirmationMail = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Thank you for your truck placement – Logic Freight",
        html: `
          <h2>Thank you, ${fullname}!</h2>
          <p>We’ve received your truck placement details for ${
            region || "the UK"
          }.</p>
          <p>Our traffic team will review and contact you shortly.</p>
          <br/>
          <p style="font-size: 0.9em; color: #666;">
            You can opt out of future updates at any time.
          </p>
        `,
      };
      await sendEmail(confirmationMail, email);
    }

    return res
      .status(200)
      .json({ message: "Truck placement submitted successfully." });
  } catch (error) {
    console.error("Error submitting truck placement:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Partner join route (for PartnerJoinForm)
 */
router.post("/partner-join", async (req, res) => {
  try {
    const { fullname, email, phoneNumber, optOut, region } = req.body;

    if (!fullname || !email || !phoneNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- Internal notification to Logic Freight team ---
    const internalMail = {
      from: process.env.EMAIL_USER,
      to: "partners@logic-freight.co.uk",
      subject: `New Partner Signup – ${fullname} (${region || "UK"})`,
      html: `
        <h2>New Partner Join Submission</h2>
        <p><strong>Full Name:</strong> ${fullname}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone Number:</strong> ${phoneNumber}</p>
        <p><strong>Region:</strong> ${region || "N/A"}</p>
        <p><strong>Opted Out of Marketing:</strong> ${optOut ? "Yes" : "No"}</p>
        <hr />
        <p><em>Submitted at ${new Date().toLocaleString()}</em></p>
      `,
    };

    await sendEmail(internalMail, email);

    // --- Optional confirmation email to partner ---
    if (!optOut) {
      const confirmationMail = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to the Logic Freight Partner Network",
        html: `
          <div style="font-family: Arial, sans-serif; color: #222;">
            <h2 style="color: #1a1a1a;">Welcome aboard, ${fullname}!</h2>
            <p>Thank you for joining the <strong>Logic Freight Partner Network</strong>.</p>
            <p>We’ll be in touch shortly to discuss how we can collaborate and keep your trucks moving efficiently across ${
              region || "the UK"
            }.</p>
            <p>If you have any immediate questions, feel free to contact us at 
            <a href="mailto:partners@logic-freight.co.uk">partners@logic-freight.co.uk</a>.</p>
            <hr />
            <p style="font-size: 0.9em; color: #666;">
              You can opt out of partner communications at any time.
            </p>
          </div>
        `,
      };

      await sendEmail(confirmationMail, email);
    }

    return res.status(200).json({ message: "Partner joined successfully." });
  } catch (error) {
    console.error("Error submitting partner join form:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
