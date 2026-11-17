/**
 * Loki configuration for visual regression testing with Storybook
 * Run with: npx loki test
 * Update baselines with: npx loki update
 * 
 * Note: DashboardCommandCenter requires a running backend API at http://localhost:5000
 * For local development, start the backend first, or use MSW/mswjs for mocking.
 */
module.exports = {
  // Configuration name matches the storybook setup
  configurations: {
    "chrome.desktop": {
      "target": "chrome.app",
      "width": 1280,
      "height": 720,
      "deviceScaleFactor": 1,
      "mobile": false,
    },
    "chrome.tablet": {
      "target": "chrome.app",
      "width": 768,
      "height": 1024,
      "deviceScaleFactor": 1,
      "mobile": false,
    },
    "chrome.mobile": {
      "target": "chrome.app",
      "width": 375,
      "height": 667,
      "deviceScaleFactor": 1,
      "mobile": true,
    },
  },
  
  // Storybook server URL - use port 6007
  stories: 'http://localhost:6007',
  
  // Output directories
  screenshotsDir: './.loki/screenshots',
  referenceDir: './.loki/reference',
  differenceDir: './.loki/difference',
  
  // Test only the stories we care about for visual regression
  // Note: DashboardCommandCenter requires backend API mocking
  includeStories: [
    'atlashelios-dashboardcommandcenter*',
    'atlashelios-riskheatfield*',
    'atlashelios-propertynode*',
  ],
  
  // Puppeteer launch options
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
  
  // Ignore certain areas (like timestamps, dynamic content)
  ignoreAreas: [],
  
  // Threshold for pixel difference (0-1)
  threshold: 0.01,
  
  // Number of parallel workers
  workers: 2,
  
  // Verbose output
  verbose: true,
};