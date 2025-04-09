const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const { defineRoutes, getAllPromotionData } = require("./routes");
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

getAllPromotionData()
  .then((data) => {
    console.log("Retrieved all promotion data:", JSON.stringify(data, null, 2));
  })
  .catch((err) => {
    console.error("Error fetching promotion data:", err);
  });

  const writeDataToCSV = async () => {
    try {
      // Fetch the promotion data
      const data = await getAllPromotionData();
  
      // Check if data is available
      if (data.length === 0) {
        console.log("No data available to write to CSV.");
        return;
      }
  
      // Format the data according to Mailchimp's requirements
      const formattedData = data.map((item) => {
        return {
          "Email Address": item.email, // Email must be in this field
          "First Name": item.fullname.split(" ")[0], // Assuming the first part of the fullname is the first name
          "Last Name": item.fullname.split(" ")[1] || "", // Last name is the second part of fullname (if exists)
          "Phone": formatPhoneNumber(item.phone), // Ensure the phone is in international format
          "SMS Phone Number": "", // Empty SMS field (you can modify this later based on your country or need)
          "Address": "", // Empty Address (you can fill this in later if applicable)
        };
      });
  
      // Define the headers for the CSV file (Mailchimp-required fields)
      const headers = [
        { id: "Email Address", title: "Email Address" },
        { id: "First Name", title: "First Name" },
        { id: "Last Name", title: "Last Name" },
        { id: "Phone", title: "Phone" },
        { id: "SMS Phone Number", title: "SMS Phone Number" },
        { id: "Address", title: "Address" }
      ];
  
      // Create a CSV writer instance
      const csvWriter = createCsvWriter({
        path: 'promotion_data.csv', // The file path to write the CSV to
        header: headers,            // The header of the CSV (column names)
      });
  
      // Write the data to the CSV file
      await csvWriter.writeRecords(formattedData);
  
      console.log("CSV file created successfully: promotion_data.csv");
    } catch (error) {
      console.error("Error writing data to CSV:", error);
    }
  };
  
  // Function to format phone number to international format (for example: +44 7123 456789 for UK)
  const formatPhoneNumber = (phone) => {
    // Assuming the phone number is in the UK format, let's add a simple function to format this
    // Adjust this logic to match the country you need (this example is for UK formatting)
    if (phone.startsWith("0")) {
      return `+44 ${phone.substring(1)}`;
    }
    return phone; // Return as is if it's already in international format
  };
  
  // Call the function to write the data to a CSV file
  writeDataToCSV();

// Start the server
const port = process.env.PORT || 3001;
appExpress.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
