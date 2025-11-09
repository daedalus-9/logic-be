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
    console.log("Received /place-truck request:", JSON.stringify(req.body));

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
        console.warn("Validation failed. Missing required fields.");
        return res.status(400).json({ error: "Missing required fields" });
      }

      // --- Save to Firestore ---
      const truckDocRef = doc(collection(db, "truckPlacements"));
      console.log("Saving truck placement to Firestore...");
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
      console.log(
        "Truck placement saved to Firestore with ID:",
        truckDocRef.id
      );

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

      console.log("Sending internal email with options:", mailOptions);

      try {
        await withTimeout(
          sendEmail(mailOptions, process.env.EMAIL_USER),
          10000
        );
        console.log("Internal email sent successfully.");
      } catch (err) {
        console.error("*** ERROR SENDING INTERNAL EMAIL ***", err);
        console.error("Email payload was:", mailOptions);
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
    console.log("Received /partner-join request:", JSON.stringify(req.body));

    try {
      const { fullname, email, phoneNumber, optOut, region } = req.body;

      if (!fullname || !email || !phoneNumber) {
        console.warn("Validation failed. Missing required fields.");
        return res.status(400).json({ error: "Missing required fields" });
      }

      // --- Internal email to Logic Freight team ---
      const internalMail = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_RECIPIENT,
        subject: `New Partner Signup – ${fullname} (${region || "UK"})`,
        text: `Partner Join Submission\n-------------------\nFull Name: ${fullname}\nEmail: ${email}\nPhone: ${phoneNumber}\nRegion: ${
          region || "N/A"
        }\nOpt-Out: ${
          optOut ? "Yes" : "No"
        }\nSubmitted at: ${new Date().toLocaleString()}`,
      };

      console.log(
        "Sending partner join internal email with options:",
        internalMail
      );

      try {
        await withTimeout(
          sendEmail(internalMail, process.env.EMAIL_USER),
          10000
        );
        console.log("Partner join internal email sent successfully.");
      } catch (err) {
        console.error("*** ERROR SENDING INTERNAL EMAIL ***", err);
        console.error("Email payload was:", internalMail);
      }

      // --- Save to Firestore ---
      const partnerDocRef = doc(collection(db, "partnerJoins"));
      console.log("Saving partner join to Firestore...");
      await setDoc(partnerDocRef, {
        fullname,
        email,
        phoneNumber,
        region: region || null,
        optOut: !!optOut,
        submittedAt: Timestamp.now(),
      });
      console.log(
        "Partner join data saved to Firestore with ID:",
        partnerDocRef.id
      );

      return res.status(200).json({ message: "Partner joined successfully." });
    } catch (error) {
      console.error("Error submitting partner join form:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};

module.exports = { defineRoutes };
