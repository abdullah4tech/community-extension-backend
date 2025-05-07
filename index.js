import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

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

    // Extract bounty tags, titles, and dates
    const bountiesData = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('a.framer-19zlxqr.framer-lux5qc'), // Main bounty link container
        (bountyContainer) => {
          const tagElement = bountyContainer.querySelector('div.framer-11yqaqs p.framer-text'); // Selector for tag
          const titleElement = bountyContainer.querySelector('div.framer-atuki1 p.framer-text'); 
          const dateElement = bountyContainer.querySelector('div.framer-q33siq div.framer-g2p6vw p.framer-text');

          return {
            tag: tagElement ? tagElement.textContent.trim() : null,
            title: titleElement ? titleElement.textContent.trim() : null,
            dateString: dateElement ? (dateElement.getAttribute('datetime') || dateElement.textContent.trim()) : null,
          };
        }
      ).filter(bounty => bounty.tag && bounty.title && bounty.dateString) // Ensure tag, title, and date are found
    );

    await page.close();
    console.log('Extracted Bounty Data (with tags):', bountiesData);

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const allScrapedBountiesWithDetails = bountiesData.map(bounty => {
      let isExpired = false;
      if (bounty.dateString) {
        const parsedDate = new Date(bounty.dateString);
        if (!isNaN(parsedDate.getTime())) {
          const bountyDateNormalized = new Date(parsedDate);
          bountyDateNormalized.setHours(0, 0, 0, 0);
          if (bountyDateNormalized < today) {
            isExpired = true;
          }
        } else {
          console.warn(`Could not parse date: "${bounty.dateString}" for "${bounty.title}"`);
          isExpired = true; 
        }
      } else {
        console.warn(`No date string for bounty: "${bounty.title}"`);
        isExpired = true; 
      }
      return {
        tag: bounty.tag,
        title: bounty.title,
        dateString: bounty.dateString,
        isExpired: isExpired,
      };
    });

    // Group bounties by tag for the main response body
    const bountiesByTag = allScrapedBountiesWithDetails.reduce((acc, bounty) => {
      const { tag } = bounty;
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(bounty);
      return acc;
    }, {});

    // 'currentBounties' (server-side) stores full bounty objects {tag, title, dateString, isExpired} 
    // to determine if a scraped bounty title has been seen before.
    const newBountyObjects = allScrapedBountiesWithDetails.filter(
      (scrapedBounty) => !currentBounties.some((cb) => cb.title === scrapedBounty.title)
    );

    if (newBountyObjects.length > 0) {
      currentBounties = [...currentBounties, ...newBountyObjects];
      return res.json({
        message: 'Bounties updated. New bounties found.',
        bountiesByTag: bountiesByTag, // All bounties from current scrape, grouped by tag
        newlyAddedBounties: newBountyObjects, // Flat list of bounties considered "new"
      });
    }

    return res.json({
      message: 'Bounties checked. No new bounties found.',
      bountiesByTag: bountiesByTag, // All bounties from current scrape, grouped by tag
      newlyAddedBounties: [],
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
