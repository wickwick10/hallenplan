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

test("Skizze: Schritte vor und zurück, Abspielen, kein seitliches Scrollen", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  await page.click('.tab[data-tab="uebungen"]');
  await page.click('.ex-card[data-ex="dreieckpass"]');
  const sk = page.locator("#ex-dialog .sk");
  await expect(sk.locator(".sk-live")).toBeVisible();
  await expect(sk.locator(".sk-text")).toContainText("1/4");
  await expect(sk.locator('[data-sk-act="prev"]')).toBeDisabled();
  await sk.locator('[data-sk-act="next"]').click();
  await expect(sk.locator(".sk-text")).toContainText("2/4");
  await expect(sk.locator(".sk-live .sk-layer .sk-pass")).toHaveCount(1);
  await sk.locator('[data-sk-act="prev"]').click();
  await expect(sk.locator(".sk-text")).toContainText("1/4");
  await sk.locator('[data-sk-act="play"]').click();
  await expect(sk.locator('[data-sk-act="play"]')).toContainText("Pause");
  await expect(sk.locator(".sk-text")).toContainText("2/4", { timeout: 4000 });
  await sk.locator('[data-sk-act="play"]').click();
  await sk.locator('[data-sk-act="next"]').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const box = await sk.boundingBox(), dlg = await page.locator("#ex-dialog").boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(dlg.x + dlg.width + 1);
  await page.waitForTimeout(1000);
  await page.locator("#ex-dialog").screenshot({ path: `test-results/screens/${test.info().project.name}-skizze.png` });
  expect(errors).toEqual([]);
});
