import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Array to store the current bounties
let currentBounties = [];

// Puppeteer browser instance
let browser;

// Function to initialize the browser
const initializeBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true, // Run in headless mode for performance
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Improve container compatibility
    });
  }
};

// Graceful shutdown
const closeBrowser = async () => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

app.get('/scrape', async (req, res) => {
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');	

  console.log('Processing scrape request...');
  const url = req.query.url;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Ensure the browser is initialized
    await initializeBrowser();

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Set timeout and wait strategy

    // Extract bounty titles
    const bountiesTitles = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('body > div > div > div > a > div > p'),
        el => el.textContent.trim()
      )
    );

    await page.close();
    console.log(bountiesTitles);

    // Check for new bounties
    const newBounties = bountiesTitles.filter(title => !currentBounties.includes(title));

    // If new bounties are found, update the current bounties array
    if (newBounties.length > 0) {
      currentBounties = [...currentBounties, ...newBounties]; // Add new bounties to the array
      return res.json({
        message: 'New bounties found',
        newBounties,
        currentBounties,
      });
    }

    // If no new bounties are found, just return the current bounties
    return res.json({
      message: 'No new bounties found',
      currentBounties,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while scraping');
  }
});

// Close the browser on server shutdown
process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

app.listen(port, () => {
  console.log(`\n\nApp is running on http://localhost:${port}`);
});
