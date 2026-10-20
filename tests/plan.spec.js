const { test, expect } = require("@playwright/test");
const path = require("path");
const url = "file://" + path.join(__dirname, "..", "index.html");

const options = (page, sel) => page.$$eval(`${sel} option`, o => o.map(x => x.value));

test("jede Kombination aus Stufe, Niveau, Abwehr und Angriff ergibt einen Plan", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  for (const stage of await options(page, "#f-stage")) {
    await page.selectOption("#f-stage", stage);
    for (const level of await options(page, "#f-level")) {
      await page.selectOption("#f-level", level);
      for (const def of await options(page, "#f-def")) {
        await page.selectOption("#f-def", def);
        for (const att of await options(page, "#f-att")) {
          await page.selectOption("#f-att", att);
          const units = page.locator("#plan-units");
          await expect(units, `Plan leer: ${stage}/${level}/${def}/${att}`).not.toBeEmpty();
          expect(await units.innerText()).not.toMatch(/undefined|NaN/);
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test("kein horizontales Scrollen und alle Tabs erreichbar", async ({ page }) => {
  await page.goto(url);
  for (const tab of await page.$$eval(".tab", t => t.map(x => x.dataset.tab))) {
    await page.click(`.tab[data-tab="${tab}"]`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `Tab ${tab} scrollt seitlich`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-${tab}.png`, fullPage: true });
  }
});
