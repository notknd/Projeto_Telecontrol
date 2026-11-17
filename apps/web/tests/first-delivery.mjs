import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const node = (id, type, x, y = 0) => ({ id, code: id, type, x, y, label: id, isActive: true });
const nodes = [node('ENTRADA', 'ENTRY', 0), node('A-01', 'STORAGE', 7), node('AISLE-A', 'AISLE', 4), node('CROSS-01', 'INTERSECTION', 4, 5), node('B-01', 'STORAGE', 7, 5), node('C-01', 'STORAGE', 11, 5), node('SAIDA', 'EXIT', 15, 5)];
const connections = [[0, 2, 4], [2, 1, 3], [2, 3, 5], [3, 4, 3], [4, 5, 4], [5, 6, 4]];
const warehouse = { nodes, edges: connections.flatMap(([a, b, distanceMeters], i) => [
  { id: `e${i}`, fromNodeId: nodes[a].id, toNodeId: nodes[b].id, distanceMeters },
  { id: `r${i}`, fromNodeId: nodes[b].id, toNodeId: nodes[a].id, distanceMeters },
]) };
const product = { id: 'p1', sku: 'TEST-01', name: 'Caixa organizadora', category: null, weightKg: 1,
  stockQuantity: 10, warehouseNodeId: 'A-01', isActive: true, warehouseNode: nodes[1] };
const item = { id: 'i1', productId: 'p1', productSkuSnapshot: product.sku,
  productNameSnapshot: product.name, requestedQuantity: 2, collectedQuantity: 0, product };
const makeOrder = (id, status) => ({ id, code: id, status, createdAt: '2026-11-10T12:00:00Z', items: [item], routes: [], collections: [] });
let orders = [makeOrder('DEMO-SHORT', 'PENDING'), makeOrder('DEMO-MULTI-STOP', 'COLLECTING'), makeOrder('DEMO-CONVENTIONAL', 'COMPLETED')];
const calculated = { id: 'r1', status: 'CALCULATED', totalDistanceMeters: 26,
  conventionalDistanceMeters: 26, conventionalPathNodeIds: [0, 2, 1, 2, 3, 4, 5, 6].map(i => nodes[i].id),
  calculatedAt: '2026-11-10T12:00:00Z', algorithm: 'DIJKSTRA',
  steps: [0, 2, 1, 2, 3, 4, 5, 6].map((i, sequence) => ({ warehouseNodeId: nodes[i].id, sequence })),
  stops: [{ warehouseNodeId: 'A-01', sequence: 1, warehouseNode: nodes[1], items: [{ orderItemId: 'i1' }] }] };
let fail = false, failCalculation = false, empty = false;
const writes = [], errors = [];
const output = process.env.TEST_OUTPUT_DIR ?? 'test-results/first-delivery';
mkdirSync(output, { recursive: true });
const server = process.env.WEB_TEST_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const base = process.env.WEB_TEST_URL ?? server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/**', async intercepted => {
    const req = intercepted.request(), path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') writes.push({ path, body: req.postDataJSON() });
    const fulfill = (data, status = 200) => intercepted.fulfill({ status, json: data });
    if (fail) return fulfill({ error: { message: 'Servidor de teste indisponível.' } }, 503);
    if (path.endsWith('/warehouses')) return fulfill([
      { id: 'g1', code: 'G1', name: 'Galpão 1', isActive: true },
      { id: 'g2', code: 'G2', name: 'Galpão 2', isActive: true },
      { id: 'g3', code: 'G3', name: 'Galpão 3', isActive: true },
    ]);
    if (new URL(req.url()).searchParams.get('warehouseId') === 'g2') {
      if (path.endsWith('/products') || path.endsWith('/orders')) return fulfill([]);
      if (path.endsWith('/warehouse')) return fulfill({ nodes: [], edges: [] });
    }
    if (path.endsWith('/routes/calculate')) {
      if (failCalculation) return fulfill({ error: { message: 'Motor indisponível. Tente novamente.' } }, 503);
      assert.deepEqual(req.postDataJSON(), { orderId: 'DEMO-SHORT' });
      orders[0] = { ...orders[0], status: 'ROUTED', routes: [calculated] };
      return fulfill(calculated);
    }
    if (path.endsWith('/products')) return fulfill(empty ? [] : [product]);
    if (path.endsWith('/orders')) return fulfill(empty ? [] : orders);
    if (path.endsWith('/warehouse')) return fulfill(empty ? { nodes: [], edges: [] } : warehouse);
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  const idle = () => page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') === 'false');
  await page.goto(base);
  await page.getByRole('heading', { name: 'Bem-vindo ao SmartPick' }).waitFor();
  await page.screenshot({ path: `${output}/access.png`, fullPage: true });
  await page.getByLabel('Seu nome').fill('Leonardo');
  await page.getByRole('button', { name: 'Entrar no SmartPick →' }).click();
  await idle();
  await page.getByLabel('Perfil ativo').selectOption('warehouse');
  await page.reload(); await idle();
  assert.equal(await page.getByLabel('Perfil ativo').inputValue(), 'warehouse');
  await page.getByLabel('Galpão ativo').selectOption('g2'); await idle();
  assert.deepEqual(await page.locator('.kpi-val').allTextContents(), ['0', '0', '0', '0']);
  assert.equal(await page.getByText('PED-001', { exact: true }).count(), 0);
  await page.getByLabel('Galpão ativo').selectOption('g1'); await idle();
  assert.equal(await page.locator('#nav button').count(), 4);
  assert.doesNotMatch(await page.locator('body').innerText(), /DEMO|Demonstração/i);
  assert.deepEqual(await page.locator('.kpi-val').allTextContents(), ['1', '1', '1', '3']);
  await page.screenshot({ path: `${output}/dashboard.png`, fullPage: true });
  await page.getByRole('button', { name: 'Selecionar pedido', exact: true }).click();
  await page.getByLabel('Buscar pedido').fill('inexistente');
  assert.equal(await page.getByText('Nenhum pedido encontrado.').count(), 1);
  await page.getByLabel('Buscar pedido').fill('PED-001');
  await page.getByRole('button', { name: 'Abrir pedido', exact: true }).click();
  assert.equal(await page.getByText('Caixa organizadora', { exact: true }).count(), 1);
  failCalculation = true;
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click(); await idle();
  assert.match(await page.getByRole('alert').innerText(), /Motor indisponível/);
  failCalculation = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click(); await idle();
  await page.getByRole('button', { name: 'Calcular rota', exact: true }).click(); await idle();
  assert.equal(await page.locator('.route-distance strong').innerText(), '26');
  assert.equal(await page.locator('polyline[stroke="#15803d"]').count(), 1);
  for (const name of ['Iniciar coleta', 'Cancelar pedido', 'Confirmar próxima', 'Novo produto', 'Simular percurso', 'Perspectiva', 'Consultar distância']) {
    assert.equal(await page.getByRole('button', { name, exact: false }).count(), 0, `Out of scope: ${name}`);
  }
  await page.keyboard.press('Space');
  assert(writes.every(w => w.path === '/api/v1/routes/calculate'));
  const writesBeforeAnimation = writes.length;
  await page.getByRole('button', { name: 'Animar percurso', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.route-scrubber').value) > 15);
  await page.getByRole('button', { name: 'Pausar percurso', exact: true }).click();
  const paused = await page.locator('.route-traveler').getAttribute('transform');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.route-traveler').getAttribute('transform'), paused);
  await page.getByRole('button', { name: 'Próximo ponto', exact: true }).click();
  assert.notEqual(await page.locator('.route-traveler').getAttribute('transform'), paused);
  await page.getByRole('button', { name: 'A-01: A-01', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'A-01: A-01', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Avançar percurso', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Pausar percurso', exact: true }).count(), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(writes.length, writesBeforeAnimation);
  await page.setViewportSize({ width: 1440, height: 1250 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await page.evaluate(() => document.querySelector('.content').getBoundingClientRect().left >= 236), 'Desktop content must stay beside sidebar');
  await page.screenshot({ path: `${output}/route.png`, fullPage: true });
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.getByRole('button', { name: 'Planta do Armazém', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Rota otimizada' }).isChecked(), false);
  assert.equal(await page.getByText('RECEBIMENTO', { exact: true }).count(), 1);
  assert.equal(await page.getByText('EXPEDIÇÃO', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'A-01: A-01', exact: true }).click();
  assert.equal(await page.getByText('Caixa organizadora', { exact: true }).count(), 1);
  await page.getByLabel('Pedido', { exact: true }).selectOption('DEMO-MULTI-STOP');
  assert.equal(await page.locator('.route-traveler').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Animar percurso', exact: true }).isDisabled(), true);
  await page.getByLabel('Pedido', { exact: true }).selectOption('DEMO-SHORT');
  assert.doesNotMatch(await page.locator('body').innerText(), /DEMO|Demonstração/i);
  await page.screenshot({ path: `${output}/map-dark.png`, fullPage: true });
  fail = true;
  await page.getByRole('button', { name: 'Atualizar dados' }).click(); await idle();
  assert.match(await page.getByRole('alert').innerText(), /desatualizados/);
  await page.reload(); await idle();
  assert.equal(await page.locator('.kpi-val').count(), 0, 'Failure must not display fabricated zero metrics');
  fail = false; empty = true;
  await page.getByRole('button', { name: 'Tentar novamente' }).click(); await idle();
  assert.deepEqual(await page.locator('.kpi-val').allTextContents(), ['0', '0', '0', '0']);
  empty = false;
  await page.getByRole('button', { name: 'Atualizar dados' }).click(); await idle();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Alternar menu' }).click();
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page must not overflow horizontally');
  await page.getByRole('button', { name: 'Planta do Armazém', exact: true }).click();
  await page.screenshot({ path: `${output}/map-mobile.png`, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile map must not overflow the page');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByRole('heading', { name: 'Bem-vindo ao SmartPick' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Bem-vindo ao SmartPick' }).waitFor();
  await page.screenshot({ path: `${output}/access-mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: dashboard, selection, route, scope, errors/retry, empty state, dark theme, mobile; no collection writes.');
} finally { await browser.close(); await server?.close(); }
