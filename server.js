const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('axe-puppeteer');
const cors = require('cors');
const { isURL } = require('validator');

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});


app.post('/api/audit', async (req, res) => {
  const { url } = req.body;

  if (!url) {
      return res.status(400).json({ error: 'URL is required' });
  }

  try {
      const auditResults = await runAccessibilityAudit(url);
      res.json(auditResults);
  } catch (error) {
      console.error('Error running accessibility audit:', error);
      res.status(500).json({ error: 'Failed to run accessibility audit' });
  }
});


const runAccessibilityAudit = async (url) => {
  const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    });

  const page = await browser.newPage();
  await page.goto(url);

  const results = await new AxePuppeteer(page).analyze();

  await browser.close();

  return {
      url,
      passes: await formatResults(results.passes || [], false,  url),
      violations: await formatResults(results.violations || [], true, url),
      incomplete: await formatResults(results.incomplete || [], false,  url),
      inapplicable: await formatResults(results.inapplicable || [], false, url),
      testsRun: [...results.passes, ...results.violations, ...results.inapplicable, ...results.incomplete].map(test => ({
          id: test.id,
          title: test.help,
          description: test.description || 'No description available',
          tags: test.tags || []
      }))
  };
};

const formatResults = async (items, pageUrl = '') => {
  const results = await Promise.all(items.map(async item => {
  const formattedItem = {
      id: item.id,
      impact: item.impact || 'N/A',
      description: item.description || 'No description available',
      help: item.help,
      helpUrl: item.helpUrl,
      tags: item.tags || [],
      pageUrl: pageUrl || '',
      nodes: item?.nodes.map(node => ({
      html: node?.html || "No HTML available",
      message: Array.isArray(node?.any) && node.any.length > 0
          ? node.any.map(error => error.message).join(', ')
          : "Error message not available",
      target: node?.target || "No target available"
      })) || [],
  };

  return formattedItem;
  }));

  return results;
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});