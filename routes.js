// routes.js
const { body, validationResult } = require("express-validator");
const { sendEmailReceipt } = require("./email");
const {
  setDoc,
  getDocs,
  where,
  collection,
  query,
} = require("firebase/firestore");
const db = require("./firebaseConfig");
require("dotenv").config();

const defineRoutes = (app) => {
  // Promotion route
  app.post(
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
      body("receipts")
        .optional()
        .isBoolean()
        .withMessage("Receipts must be a boolean value"),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullname, email, phone, receipts } = req.body;

      try {
        const colRef = collection(db, "promotion");

        const emailQuery = query(colRef, where("email", "==", email));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
          return res.status(400).json({ message: "Email is already in use." });
        }

        const phoneQuery = query(colRef, where("phone", "==", phone));
        const phoneSnapshot = await getDocs(phoneQuery);

        if (!phoneSnapshot.empty) {
          return res
            .status(400)
            .json({ message: "Phone number is already in use." });
        }

        const docRef = doc(colRef);
        await setDoc(docRef, { fullname, email, phone, createdAt: new Date() });

        if (receipts) {
          await sendEmailReceipt(email, fullname, phone);
        }

        res.status(200).json({ message: "Promotion data saved successfully." });
      } catch (error) {
        console.error("Error saving promotion data:", error);
        res.status(500).json({ message: "Error saving data to Firestore." });
      }
    }
  );

  // Cron job route to keep server alive
  app.get("/cron-job-route", (req, res) => {
    const serverUrl = process.env.SERVER_URL;
    retryFetch(serverUrl)
      .then(() => res.sendStatus(200))
      .catch((error) =>
        res.status(500).json({ message: "Error pinging server", error })
      );
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
        to: process.env.EMAIL_RECIPIENT,
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
        console.log(error);
        res.status(500).json({ message: "Error sending email" });
      }
    }
  );

};

module.exports = defineRoutes;
