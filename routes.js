// routes.js
const { body, validationResult } = require("express-validator");
const { sendEmailReceipt, sendEmail } = require("./email");
const {
  doc,
  setDoc,
  getDocs,
  where,
  collection,
  query,
} = require("firebase/firestore");
const { db } = require("./firebaseConfig");
const { retryFetch } = require("./utils");
require("dotenv").config();

const defineRoutes = (appExpress) => {
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
      body("source")
        .optional() // Make source optional
        .trim()
        .escape(),
    ],
    async (req, res) => {
      const { fullname, email, phone, optOutEmails, source } = req.body;

      try {
        const promoWithEmailsRef = collection(db, "promotion-with-emails");
        const promoWithoutEmailsRef = collection(
          db,
          "promotion-without-emails"
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
          await sendEmailReceipt(email, fullname, phone);

          const internalMailOptions = {
            from: process.env.EMAIL_USER,
            to: "enquiries@supernovadental.co.uk",
            subject: `New Website Signup ${
              decodedSource ? `from ${decodedSource}` : ""
            }`, // Include decoded source if available
            text: `Full Name: ${fullname}\nEmail: ${email}\nPhone: ${phone}\nOpt-Out of Emails: ${optOutEmails}\nSource: ${
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

  // Health check route (simple response, no retryFetch)
  appExpress.get("/health", (req, res) => {
    res.sendStatus(200);
  });

  // Cron job route
  appExpress.get("/cron-job-route", (req, res) => {
    const serverUrl = process.env.SERVER_URL + "/health"; // Ping /health

    console.log(`Pinging server at: ${serverUrl}`);

    retryFetch(serverUrl)
      .then(() => {
        console.log("Successfully pinged the server.");
        res.sendStatus(200);
      })
      .catch((error) => {
        console.error("Error fetching data:", error.message);
        console.error(`Failed to ping server at ${serverUrl}`);
        res
          .status(500)
          .json({ message: "Error pinging server", error: error.message });
      });
  });

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

module.exports = defineRoutes;
