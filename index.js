import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-core'; // Use puppeteer-core for better compatibility

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Array to store the current bounties
let currentBounties = [];

// Puppeteer browser instance
let browser;

// Function to initialize the browser
const initializeBrowser = async () => {
  if (!browser) {
    try {
      browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote'
        ],
      });
    } catch (error) {
      console.error('Failed to launch Puppeteer:', error);
    }
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
  res.setHeader('Access-Control-Allow-Origin', 'https://earn.christex.foundation');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('Processing scrape request...');
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Ensure the browser is initialized
    await initializeBrowser();
    if (!browser) {
      return res.status(500).json({ error: 'Puppeteer failed to initialize' });
    }

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Extract bounty titles
    const bountiesTitles = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('body > div > div > div > a > div > p'),
        el => el.textContent.trim()
      )
    );

    await page.close();
    console.log('Extracted Titles:', bountiesTitles);

    // Check for new bounties
    const newBounties = bountiesTitles.filter(title => !currentBounties.includes(title));

    if (newBounties.length > 0) {
      currentBounties = [...currentBounties, ...newBounties];
      return res.json({
        message: 'New bounties found',
        newBounties,
        currentBounties,
      });
    }

    return res.json({
      message: 'No new bounties found',
      currentBounties,
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ error: 'An error occurred while scraping' });
  }
});

// Close the browser on server shutdown
process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

app.listen(port, () => {
  console.log(`\n\nApp is running on http://localhost:${port}`);
});
