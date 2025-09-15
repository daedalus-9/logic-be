// routes.js
const { body, validationResult } = require("express-validator");
const {
  sendEmailReceipt,
  sendEmail,
  sendEmailWithAttachments,
} = require("./email");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const path = require("path");

const {
  doc,
  setDoc,
  getDocs,
  where,
  collection,
  query,
  Timestamp,
} = require("firebase/firestore");
const { db } = require("./firebaseConfig");
const { retryFetch } = require("./utils");
require("dotenv").config();

const defineRoutes = (appExpress) => {
  appExpress.post("/submit-referral", async (req, res) => {
    console.log("Received referral form submission:", req.body); // Log the request body for debugging

    const formData = req.body; // Capture all form data

    // Construct the email subject and body
    const emailSubject = `Referral Form Submission from ${
      formData.name || "No name provided"
    }`;

    // Dynamically construct the email body, iterating over all form fields
    let emailText = `Form submission details:\n\n`;

    // Loop over the keys of the form data to add them to the email text
    for (const [key, value] of Object.entries(formData)) {
      if (value) {
        emailText += `${
          key.charAt(0).toUpperCase() + key.slice(1)
        }: ${value}\n`; // Capitalize the first letter of the key
      }
    }

    console.log("Email text:", emailText); // Log the email text for debugging

    // Prepare the mail options
    const mailOptions = {
      from: formData.practiceEmail,
      to: "enquiries@supernovadental.co.uk",
      subject: emailSubject,
      text: emailText,
    };

    try {
      // Send the email
      await sendEmail(mailOptions, "enquiries@supernovadental.co.uk");
      res.status(200).json({ message: "Form submitted successfully" });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Promotion route
  appExpress.post(
    "/promotion",
    [
      body("fullname")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .escape(),
      body("email")
        .trim()
        .isEmail()
        .withMessage("Invalid email address")
        .escape(),
      body("phone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .escape(),
      body("optOutEmails")
        .optional()
        .isBoolean()
        .withMessage("Consent must be a boolean value"),
      body("source").optional().trim().escape(),
    ],
    async (req, res) => {
      const { fullname, email, phone, optOutEmails, source } = req.body;

      try {
        const promoWithEmailsRef = collection(db, "promotion-with-emails");
        const promoWithoutEmailsRef = collection(
          db,
          "promotion-without-emails"
        );

        const decodedSource = source
          ? decodeURIComponent(source).replace(/^\/+/, "")
          : source;

        // Check for duplicates
        const [
          emailSnapshotWithEmails,
          emailSnapshotWithoutEmails,
          phoneSnapshotWithEmails,
          phoneSnapshotWithoutEmails,
        ] = await Promise.all([
          getDocs(query(promoWithEmailsRef, where("email", "==", email))),
          getDocs(query(promoWithoutEmailsRef, where("email", "==", email))),
          getDocs(query(promoWithEmailsRef, where("phone", "==", phone))),
          getDocs(query(promoWithoutEmailsRef, where("phone", "==", phone))),
        ]);

        const alreadyExists =
          !emailSnapshotWithEmails.empty ||
          !emailSnapshotWithoutEmails.empty ||
          !phoneSnapshotWithEmails.empty ||
          !phoneSnapshotWithoutEmails.empty;

        // Save data only if new user
        if (!alreadyExists) {
          const targetCollection = optOutEmails
            ? promoWithoutEmailsRef
            : promoWithEmailsRef;

          const docRef = doc(targetCollection);
          await setDoc(docRef, {
            fullname,
            email,
            phone,
            createdAt: new Date(),
            optOutEmails,
            source: decodedSource,
          });
        }

        // Send email regardless of duplicate status
        try {
          await sendEmailReceipt(email, fullname, phone);

          const internalMailOptions = {
            from: process.env.EMAIL_USER,
            to: "enquiries@supernovadental.co.uk",
            subject: `Website Signup ${
              decodedSource ? `from ${decodedSource}` : ""
            }`,
            text: `Full Name: ${fullname}\nEmail: ${email}\nPhone: ${phone}\nOpt-Out of Emails: ${optOutEmails}\nSource: ${
              decodedSource || "N/A"
            }`,
          };
          await sendEmail(internalMailOptions, process.env.EMAIL_USER);
        } catch (emailError) {
          console.error("Error sending email:", emailError);

          const failureCollection = collection(db, "failure-emails");
          const failureDocRef = doc(failureCollection);
          await setDoc(failureDocRef, {
            fullname,
            email,
            phone,
            optOutEmails,
            error: emailError.message,
            createdAt: new Date(),
          });
        }

        // Respond to frontend with alreadyExists flag
        res.status(200).json({
          message: "Promotion processed successfully.",
          alreadyExists,
        });
      } catch (error) {
        console.error("Error processing promotion data:", error);
        return res
          .status(500)
          .json({ message: "Error processing promotion data." });
      }
    }
  );

  appExpress.post("/dengro", async (req, res) => {
    const { fullname, email, phone, optOutEmails, source } = req.body;

    // Split fullname into firstName and lastName
    let firstName = "";
    let lastName = "";
    let consentGiven = false;

    if (fullname) {
      const nameParts = fullname.trim().split(/\s+/);
      firstName = nameParts.shift() || ""; // First word
      lastName = nameParts.join(" "); // Rest of the name
    }
    if (optOutEmails === false) {
      consentGiven = true;
    }

    const treatmentSlugMap = {
      "cosmetic-dentistry/dental-implants": "implants",
      "cosmetic-dentistry/invisalign": "invisalign",
      Homepage: "general-dentistry",
      practice: "patient-plan-assessment",
      "general-dentistry/emergency-dentistry": "emergency-appointments",
      "general-dentistry/dental-therapist": "preventative-dentistry",
      "general-dentistry/dental-hygiene": "hygienist-services",
      "general-dentistry/sports-mouthguards": "sports-mouthguards",
    };

    const selectedTreatmentFromForm = source; // e.g., "cosmetic-dentistry/invisalign"
    const treatmentSlug = treatmentSlugMap[selectedTreatmentFromForm];

    if (!treatmentSlug) {
      console.warn(
        "Treatment not mapped for DenGro:",
        selectedTreatmentFromForm
      );
    }

    const dengroBody = {
      firstName,
      lastName,
      email,
      phone,
      consentGiven,
      treatment: treatmentSlug,
    };

    try {
      // Forward the body to Dengro
      const response = await fetch(
        "https://hooks.dengro.com/capture/8451367e-936d-49ed-8e04-79aed784fb72",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dengroBody),
        }
      );

      if (!response.ok) {
        console.error("Dengro hook returned error:", response.statusText);
        return res.status(500).json({ message: "Failed to send to Dengro." });
      }

      res.status(200).json({ message: "Sent to Dengro successfully." });
    } catch (error) {
      console.error("Error sending to Dengro:", error);
      res.status(500).json({ message: "Error sending to Dengro." });
    }
  });

  // Refer A Friend route
  appExpress.post(
    "/refer-a-friend",
    [
      body("referrerName")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .escape(),
      body("fullname")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .escape(),
      body("email")
        .trim()
        .isEmail()
        .withMessage("Invalid email address")
        .escape(),
      body("phone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .escape(),
    ],
    async (req, res) => {
      const { referrerName, fullname, email, phone, optOutEmails, source } =
        req.body;

      try {
        const promoWithEmailsRef = collection(db, "refer-a-friend-with-emails");
        const promoWithoutEmailsRef = collection(
          db,
          "refer-a-friend-without-emails"
        );

        console.log("Checking if email and phone number are unique...");

        // Decode the source if provided
        const decodedSource = source
          ? decodeURIComponent(source).replace(/^\/+/, "")
          : source;

        // Use Promise.all to check both collections for duplicate email and phone
        const [
          emailSnapshotWithEmails,
          emailSnapshotWithoutEmails,
          phoneSnapshotWithEmails,
          phoneSnapshotWithoutEmails,
        ] = await Promise.all([
          getDocs(query(promoWithEmailsRef, where("email", "==", email))),
          getDocs(query(promoWithoutEmailsRef, where("email", "==", email))),
          getDocs(query(promoWithEmailsRef, where("phone", "==", phone))),
          getDocs(query(promoWithoutEmailsRef, where("phone", "==", phone))),
        ]);

        // Check if either email or phone number already exists in either collection
        if (
          !emailSnapshotWithEmails.empty ||
          !emailSnapshotWithoutEmails.empty
        ) {
          console.log("Email is already in use.");
          return res.status(400).json({ message: "Email is already in use." });
        }

        if (
          !phoneSnapshotWithEmails.empty ||
          !phoneSnapshotWithoutEmails.empty
        ) {
          return res
            .status(400)
            .json({ message: "Phone number is already in use." });
        }

        // Choose collection based on optOutEmails
        const targetCollection = optOutEmails
          ? promoWithoutEmailsRef
          : promoWithEmailsRef;

        // Save data to the appropriate collection
        const docRef = doc(targetCollection);
        await setDoc(docRef, {
          referrerName,
          fullname,
          email,
          phone,
          createdAt: new Date(),
          optOutEmails,
          source: decodedSource, // Save the decoded source if provided
        });

        // Respond to the user immediately
        res.status(200).json({ message: "Promotion data saved successfully." });

        // Send emails asynchronously and handle failures
        try {
          await sendEmailReceipt(referrerName, email, fullname, phone);

          const internalMailOptions = {
            from: process.env.EMAIL_USER,
            to: "enquiries@supernovadental.co.uk",
            subject: `New Website Signup ${
              decodedSource ? `from ${decodedSource}` : ""
            }`, // Include decoded source if available
            text: `Referrer Name: ${referrerName}\n Full Name: ${fullname}\nEmail: ${email}\nPhone: ${phone}\nOpt-Out of Emails: ${optOutEmails}\nSource: ${
              decodedSource || "N/A"
            }`, // Include decoded source if available, or 'N/A' if not
          };
          await sendEmail(internalMailOptions, process.env.EMAIL_USER);
        } catch (emailError) {
          console.error("Error sending email:", emailError);

          // Save failure details to Firestore
          const failureCollection = collection(db, "failure-emails");
          const failureDocRef = doc(failureCollection);
          await setDoc(failureDocRef, {
            referrerName,
            fullname,
            email,
            phone,
            optOutEmails,
            error: emailError.message,
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error("Error saving promotion data:", error);
        return res
          .status(500)
          .json({ message: "Error saving data to Firestore." });
      }
    }
  );

  appExpress.post(
    "/referral",
    upload.array("attachments"),
    async (req, res) => {
      const { body, files } = req;
      console.log("Received referral form submission:", body); // Log the request body for debugging
      // Format dateOfBirth to dd/mm/yyyy if present
      if (body.dateOfBirth) {
        const dob = new Date(body.dateOfBirth);
        if (!isNaN(dob)) {
          const day = String(dob.getDate()).padStart(2, "0");
          const month = String(dob.getMonth() + 1).padStart(2, "0");
          const year = dob.getFullYear();
          body.dateOfBirth = `${day}/${month}/${year}`;
        }
      }

      // Filter files to accept only .jpg and .pdf
      const allowedExtensions = [".jpg", ".jpeg", ".pdf"];
      const filteredFiles = (files || []).filter((file) => {
        const ext = path.extname(file.originalname).toLowerCase();
        return allowedExtensions.includes(ext);
      });

      // Build attachments array for nodemailer
      const attachments = filteredFiles.map((file) => ({
        filename: file.originalname,
        path: file.path,
      }));

      // Build email body text from form fields
      const emailText = Object.entries(body)
        .map(([key, val]) => `${key}: ${val}`)
        .join("\n");

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: "enquiries@supernovadental.co.uk",
        subject: `New ${body.referralType || "General"} Referral`,
        text: emailText,
        attachments,
      };

      try {
        await sendEmailWithAttachments(mailOptions, mailOptions.to);

        // Clean up uploaded files after sending email
        attachments.forEach((att) => {
          fs.unlink(att.path, (err) => {
            if (err) console.error("Error deleting file:", att.path, err);
          });
        });

        res.status(200).json({ message: "Referral received and email sent." });
      } catch (error) {
        console.error("Error sending referral email:", error);
        res.status(500).json({ error: "Failed to process referral." });
      }
    }
  );

  appExpress.post("/careers", upload.array("attachments"), async (req, res) => {
    const { body, files } = req;
    console.log("Received referral form submission:", body); // Log the request body for debugging

    // Filter files to accept only .jpg and .pdf
    const allowedExtensions = [".jpg", ".jpeg", ".pdf"];
    const filteredFiles = (files || []).filter((file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      return allowedExtensions.includes(ext);
    });

    // Build attachments array for nodemailer
    const attachments = filteredFiles.map((file) => ({
      filename: file.originalname,
      path: file.path,
    }));

    // Build email body text from form fields
    const emailText = Object.entries(body)
      .map(([key, val]) => `${key}: ${val}`)
      .join("\n");

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "enquiries@supernovadental.co.uk",
      subject: `New ${body.referralType || "General"} Referral`,
      text: emailText,
      attachments,
    };

    try {
      await sendEmailWithAttachments(mailOptions, mailOptions.to);

      // Clean up uploaded files after sending email
      attachments.forEach((att) => {
        fs.unlink(att.path, (err) => {
          if (err) console.error("Error deleting file:", att.path, err);
        });
      });

      res.status(200).json({ message: "Referral received and email sent." });
    } catch (error) {
      console.error("Error sending referral email:", error);
      res.status(500).json({ error: "Failed to process referral." });
    }
  });

  // // Health check route (simple response, no retryFetch)
  // appExpress.get("/health", (req, res) => {
  //   res.sendStatus(200);
  // });

  // // Cron job route
  // appExpress.get("/cron-job-route", (req, res) => {
  //   const serverUrl = process.env.SERVER_URL + "/health"; // Ping /health

  //   console.log(`Pinging server at: ${serverUrl}`);

  //   retryFetch(serverUrl)
  //     .then(() => {
  //       console.log("Successfully pinged the server.");
  //       res.sendStatus(200);
  //     })
  //     .catch((error) => {
  //       console.error("Error fetching data:", error.message);
  //       console.error(`Failed to ping server at ${serverUrl}`);
  //       res
  //         .status(500)
  //         .json({ message: "Error pinging server", error: error.message });
  //     });
  // });

  appExpress.post(
    "/",
    [
      body("name").trim().notEmpty().withMessage("Name is required").escape(),
      body("email")
        .trim()
        .isEmail()
        .withMessage("Invalid email address")
        .escape(),
      body("message")
        .trim()
        .notEmpty()
        .withMessage("Message is required")
        .escape(),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, category, email, phone, message } = req.body;

      // Compose the email message
      const mailOptions = {
        from: email,
        to: "enquiries@supernovadental.co.uk",
        subject: `${category.toUpperCase()} Enquiry Form Submission`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage: ${message}`,
      };

      // when you have db connection uncomment the below line
      // res.sendStatus(200);

      try {
        // Send the email asynchronously
        await sendEmail(mailOptions, email);
        res.status(200).json({ message: "Email sent successfully" });
      } catch (error) {
        console.error("Error sending email:", error);

        try {
          const colRef = collection(db, "failure-enquiries");
          const docRef = doc(colRef); // Automatically generates a new document ID
          await setDoc(docRef, {
            name,
            category,
            email,
            phone,
            message,
            createdAt: new Date(),
            error: error.message,
          });
        } catch (firestoreError) {
          console.log(`"Document that failed to send email saved to Firestore",
            Name: ${name},
            Category: ${category},
            Email: ${email},
            Phone: ${phone},
            Message: ${message},
            createdAt: ${new Date()},`);
          console.error("Error saving to Firestore:", firestoreError);
        }
      }
    }
  );
};

const getAllPromotionData = async () => {
  const promoWithEmailsRef = collection(db, "promotion-with-emails");

  // Convert "Mon, May 5, 4:33 PM" to a Firestore Timestamp
  const startDate = Timestamp.fromDate(new Date("2025-06-26T14:13:00Z")); // UTC time

  // Create query with date filter
  const q = query(promoWithEmailsRef, where("createdAt", ">=", startDate));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

module.exports = { defineRoutes, getAllPromotionData };
