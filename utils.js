const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const wait = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const retryFetch = async (url) => {
  try {
    console.log(`Fetching data from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if the response has JSON content
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    } else {
      return response.text(); // For non-JSON responses, return text
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};

module.exports = { getRandomInt, wait, retryFetch };
