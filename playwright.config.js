const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests",
  timeout: 120000,
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "handy", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
