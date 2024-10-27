const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const defineRoutes = require("./routes");
const keepAlive = require("./crons");

const appExpress = express();

appExpress.use(express.json({ limit: "100mb" }));
appExpress.use(express.urlencoded({ limit: "100mb", extended: true }));
appExpress.use(cors()); // Enable CORS

// Trust proxy settings
appExpress.set("trust proxy", 4);

// Rate Limiter
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 60000, // Limit each IP to 60000 requests per window
  keyGenerator: (req) => req.ip,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 24 hours.",
});

// appExpress.use((req, res, next) => {
//   if (req.path === "/cron-job-route") {
//     next();
//   } else {
//     limiter(req, res, next);
//   }
// });

// Define the application routes
defineRoutes(appExpress);

// Cronjob to keep the server alive
keepAlive();

// Start the server
const port = process.env.PORT || 3001;
appExpress.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
