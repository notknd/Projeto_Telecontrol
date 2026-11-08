import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.WEB_TEST_URL ?? "http://127.0.0.1:5173";
const code = `UI-${Date.now()}`;
const output = process.env.TEST_OUTPUT_DIR ?? "test-results";
mkdirSync(output, { recursive: true });
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Atualizar dados" }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "Initial API data must load",
  );
  await page.screenshot({ path: `${output}/dashboard.png`, fullPage: true });
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await page.getByLabel("Código do pedido").fill(code);
  await page
    .getByRole("spinbutton", {
      name: "Quantidade de Caixa organizadora",
      exact: true,
    })
    .fill("2");
  await page
    .getByRole("spinbutton", {
      name: "Quantidade de Caneca térmica",
      exact: true,
    })
    .fill("1");
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await page
    .getByRole("button", { name: "Calcular rota", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar coleta", exact: true })
    .waitFor();
  await page.screenshot({ path: `${output}/route.png`, fullPage: true });
  await page
    .getByRole("button", { name: "Iniciar coleta", exact: true })
    .click();
  console.log("Collection start requested");
  await page
    .getByRole("button", { name: "Concluir coleta", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Concluir coleta", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Confirmar 2", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  await page.reload();
  console.log("Checking persisted collection after reload");
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  await page.getByRole("button", { name: /Execução de coleta/ }).click();
  await page
    .getByLabel("Pedido", { exact: true })
    .selectOption({ label: `${code} · Em coleta` });
  assert.equal(
    await page
      .getByRole("button", { name: "Confirmar 2", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Confirmar 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Concluir coleta", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  const row = page.getByRole("row").filter({ hasText: code });
  assert.match(await row.innerText(), /Concluído/);
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  await page.getByRole("button", { name: /Histórico de coletas/ }).click();
  assert.match(
    await page.getByRole("row").filter({ hasText: code }).innerText(),
    /Concluído/,
  );
  await page.getByRole("button", { name: /Catálogo de produtos/ }).click();
  await page.getByRole("button", { name: "Novo produto", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).fill(code);
  await page.getByLabel("Nome", { exact: true }).fill("Produto UI");
  await page.getByLabel("Estoque", { exact: true }).fill("5");
  await page
    .getByLabel("Posição", { exact: true })
    .selectOption({ label: "STORAGE-B-01" });
  await page
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector('main[aria-busy="true"]'),
  );
  await page.getByLabel("Buscar produto").fill(code);
  assert.equal(
    await page.getByRole("row").filter({ hasText: code }).count(),
    1,
  );
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Painel operacional/ }).click();
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile layout must not overflow",
  );
  await page.getByRole("button", { name: "Tema escuro", exact: true }).click();
  await page.screenshot({ path: `${output}/dark.png`, fullPage: true });
  await page.route("**/api/v1/orders", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Servidor indisponível para teste." },
      }),
    }),
  );
  await page.getByRole("button", { name: "Atualizar dados" }).click();
  await page.getByRole("alert").waitFor();
  assert.match(
    await page.getByRole("alert").innerText(),
    /Servidor indisponível/,
  );
  assert.equal(
    await page.evaluate(() => localStorage.length),
    0,
    "No business state or simulated accounts in localStorage",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real UI order → route → collection → history, reload persistence, products, keyboard, mobile, theme and API failure.",
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.error(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
