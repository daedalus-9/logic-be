const keepAlive = () => {
  // Schedule the cron job to run every 10 minutes
  cronjob.schedule("*/10 * * * *", () => {
    // Send a GET request to the cron job route to execute the logic
    const cronJobUrl = process.env.SERVER_URL + "/cron-job-route";

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
};

module.exports = keepAlive;
