const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");
const mysql = require("mysql");
const cronjob = require("node-cron");
const fetch = require("node-fetch");
const captchaRoute = require("./captcha.js");
const { app, db } = require("./firebaseConfig.js");
const { doc, collection, setDoc } = require("firebase/firestore");

require("dotenv").config();

const appExpress = express();
// const db = admin.firestore();

appExpress.use(express.json({ limit: "100mb" }));
appExpress.use(express.urlencoded({ limit: "100mb", extended: true }));
appExpress.use(cors()); // Enable CORS for cross-domain requests
appExpress.use(express.json());
appExpress.use("/captcha", captchaRoute);

appExpress.set("trust proxy", 4);

// Create a rate limiter
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  max: 6, // Maximum number of requests per windowMs
  keyGenerator: (req) => req.ip,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 24 hours.",
});

// appExpressly the rate limiter to all routes except the cron job route
appExpress.use((req, res, next) => {
  if (req.path === "/cron-job-route" || req.path === "/captcha/verify") {
    next();
  } else {
    limiter(req, res, next);
  }
});

// Define the promotion route
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
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, phone } = req.body;

    try {
      // Reference to the Firestore collection
      const colRef = collection(db, "promotion");
      const docRef = doc(colRef); // Create a new document reference

      // Save the data
      await setDoc(docRef, {
        fullname,
        email,
        phone,
        createdAt: new Date(), // Use JavaScript Date object
      });

      res.status(200).json({ message: "Promotion data saved successfully" });
    } catch (error) {
      console.error("Error saving promotion data:", error);
      res.status(500).json({ message: "Error saving data to Firestore" });
    }
  }
);

// // Define a route for the cron job
appExpress.get("/cron-job-route", (req, res) => {
  const serverUrl = "https://supernova-enquiry-be.onrender.com";

  console.log(`Server ${serverUrl} is alive.`);

  res.sendStatus(200);
});

// Schedule the cron job to run every 12 minutes
cronjob.schedule("*/12 * * * *", () => {
  // Send a GET request to the cron job route to execute the logic
  const cronJobUrl = "https://supernova-enquiry-be.onrender.com/cron-job-route";

  fetch(cronJobUrl)
    .then((response) => {
      if (response.ok) {
        console.log("Cron job executed successfully.");
      } else {
        throw new Error("Request failed with status code " + response.status);
      }
    })
    .catch((error) => {
      console.log("Error executing cron job:", error.message);
    });
});

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
  // Configure your email provider details here
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// // Create a Twilio client
// const twilioClient = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// Create a MySQL connection pool
// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

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

const sendSMS = async (message) => {
  try {
    await twilioClient.messages.create({
      body: message,
      to: process.env.OWN_MOBILE_NUMBER,
      from: process.env.TWILIO_MOBILE_NUMBER,
    });
    console.log("SMS sent");
  } catch (error) {
    console.log("sendSMS Error", error.message);
    throw error;
  }
};

const saveEmailToDatabase = (mailOptions) => {
  const { from, text } = mailOptions;

  const email = {
    sender_email: from,
    message: text,
  };

  pool.query("INSERT INTO emails SET ?", email, (error) => {
    if (error) {
      console.log("Failed to save email to database:", error);
    } else {
      console.log("Email saved to database");
    }
  });
};

// Define a route to handle the email sending
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

// Start the server
const port = process.env.PORT || 3001;
appExpress.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
