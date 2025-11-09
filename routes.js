const express = require("express");
const router = express.Router();
const { sendEmail, sendEmailReceipt } = require("./email");
const { db } = require("./firebaseConfig");
require("dotenv").config();

const { doc, setDoc, collection, Timestamp } = require("firebase/firestore");

// Timeout wrapper (prevents hanging if email server delays)
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email send timeout")), ms)
    ),
  ]);
};

const defineRoutes = (app) => {
  /**
   * Truck placement route
   */
  app.post("/place-truck", async (req, res) => {
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

      // --- Save to Firestore ---
      const truckDocRef = doc(collection(db, "truckPlacements"));
      await setDoc(truckDocRef, {
        fullname,
        companyname: companyname || null,
        email,
        phone: phone || null,
        location,
        availableFrom,
        availableUntil: availableUntil || null,
        message: message || null,
        region: region || null,
        optOutEmails: !!optOutEmails,
        submittedAt: Timestamp.now(),
      });

      // --- Internal email to Logic Freight team ---
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: "traffic@logic-freight.co.uk",
        subject: `New Truck Placement – ${fullname} (${region || "UK"})`,
        text: `
New Truck Placement Submission
------------------------------

Full Name: ${fullname}
Company: ${companyname || "N/A"}
Email: ${email}
Phone: ${phone || "N/A"}
Truck Location: ${location}
Available From: ${availableFrom}
Available Until: ${availableUntil || "N/A"}
Additional Info: ${message || "N/A"}
Region: ${region || "N/A"}
Opted Out of Marketing: ${optOutEmails ? "Yes" : "No"}

Submitted at: ${new Date().toLocaleString()}
        `,
      };

      try {
        await withTimeout(sendEmail(mailOptions), 5000);
      } catch (err) {
        console.error("*** ERROR SENDING INTERNAL EMAIL ***", err.message);
      }

      // --- Confirmation receipt to user (if opted in) ---
      if (!optOutEmails) {
        const receiptMail = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Thank you for your truck placement – Logic Freight",
          text: `
Thank you, ${fullname}!

We’ve received your truck placement details for ${region || "the UK"}.
Our traffic team will review and contact you shortly.

You can opt out of future updates at any time.

— Logic Freight Team
          `,
        };

        try {
          await withTimeout(sendEmailReceipt(receiptMail), 5000);
        } catch (err) {
          console.error("*** ERROR SENDING RECEIPT EMAIL ***", err.message);
        }
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
   * Partner join route
   */
  app.post("/partner-join", async (req, res) => {
    try {
      const { fullname, email, phoneNumber, optOut, region } = req.body;

      if (!fullname || !email || !phoneNumber) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // --- Save to Firestore ---
      const partnerDocRef = doc(collection(db, "partnerJoins"));
      await setDoc(partnerDocRef, {
        fullname,
        email,
        phoneNumber,
        region: region || null,
        optOut: !!optOut,
        submittedAt: Timestamp.now(),
      });

      // --- Internal email to Logic Freight team ---
      const internalMail = {
        from: process.env.EMAIL_USER,
        to: "partners@logic-freight.co.uk",
        subject: `New Partner Signup – ${fullname} (${region || "UK"})`,
        text: `
New Partner Join Submission
---------------------------

Full Name: ${fullname}
Email: ${email}
Phone Number: ${phoneNumber}
Region: ${region || "N/A"}
Opted Out of Marketing: ${optOut ? "Yes" : "No"}

Submitted at: ${new Date().toLocaleString()}
        `,
      };

      try {
        await withTimeout(sendEmail(internalMail), 5000);
      } catch (err) {
        console.error("*** ERROR SENDING INTERNAL EMAIL ***", err.message);
      }

      // --- Confirmation receipt to partner ---
      if (!optOut) {
        const confirmationMail = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to the Logic Freight Partner Network",
          text: `
Welcome aboard, ${fullname}!

Thank you for joining the Logic Freight Partner Network.
We’ll be in touch shortly to discuss how we can collaborate and keep your trucks moving efficiently across ${
            region || "the UK"
          }.

If you have any immediate questions, contact us at partners@logic-freight.co.uk.

You can opt out of partner communications at any time.

— Logic Freight Team
          `,
        };

        try {
          await withTimeout(sendEmailReceipt(confirmationMail), 5000);
        } catch (err) {
          console.error("*** ERROR SENDING RECEIPT EMAIL ***", err.message);
        }
      }

      return res.status(200).json({ message: "Partner joined successfully." });
    } catch (error) {
      console.error("Error submitting partner join form:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};

module.exports = { defineRoutes };
