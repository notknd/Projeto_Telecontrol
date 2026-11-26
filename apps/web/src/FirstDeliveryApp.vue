<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { api, type Order, type Product, type Warehouse, type WarehouseOption } from './services/api';
import WarehouseMap from './components/WarehouseMap.vue';
import WmsIcon from './components/WmsIcon.vue';

const tabs = [
  ['dashboard', 'Painel Operacional', 'dashboard'],
  ['orders', 'Pedidos de Coleta', 'orders'],
  ['route', 'Roteirização', 'new'],
  ['map', 'Planta do Armazém', 'map'],
];
const page = ref('dashboard');
const orders = ref<Order[]>([]);
const products = ref<Product[]>([]);
const warehouse = ref<Warehouse>({ nodes: [], edges: [] });
const warehouses = ref<WarehouseOption[]>([]);
const warehouseId = ref('');
const warehouseName = computed(() => warehouses.value.find(w => w.id === warehouseId.value)?.name ?? 'Armazém');
function changeWarehouse() {
  selectedId.value = ''; focusNode.value = ''; search.value = ''; statusFilter.value = '';
  products.value = []; orders.value = []; warehouse.value = { nodes: [], edges: [] }; loaded.value = false;
  perform(refresh);
}
const selectedId = ref('');
const focusNode = ref('');
const search = ref('');
const statusFilter = ref('');
const busy = ref(false);
const loaded = ref(false);
const error = ref('');
const notice = ref('');
const dark = ref(false);
const collapsed = ref(false);
const profiles = [
  { id: 'supervisor', title: 'Supervisor de Operações', short: 'Supervisão', icon: 'dashboard', description: 'Visão geral dos pedidos e da operação.' },
  { id: 'operator', title: 'Operador de Coleta', short: 'Operação', icon: 'new', description: 'Consulta de pedidos e percursos de separação.' },
  { id: 'warehouse', title: 'Responsável pelo Estoque', short: 'Estoque', icon: 'products', description: 'Exploração das posições e produtos do armazém.' },
  { id: 'manager', title: 'Gestor de Logística', short: 'Gestão', icon: 'orders', description: 'Acompanhamento da carteira de pedidos.' },
];
const operatorName = ref('Leonardo');
const profileId = ref('supervisor');
const entered = ref(false);
const profile = computed(() => profiles.find(p => p.id === profileId.value) ?? profiles[0]);
function saveProfile() {
  try { sessionStorage.setItem('smartpick-profile', JSON.stringify({ name: operatorName.value.trim(), role: profileId.value })); } catch {}
}
function enter() {
  operatorName.value = operatorName.value.trim() || 'Visitante';
  entered.value = true;
  saveProfile();
  perform(refresh);
}
function leave() {
  entered.value = false;
  page.value = 'dashboard';
  collapsed.value = false;
  document.body.classList.remove('sidebar-collapsed');
  try { sessionStorage.removeItem('smartpick-profile'); } catch {}
}
const labels: Record<string, string> = {
  PENDING: 'Pendente', ROUTED: 'Rota pronta', COLLECTING: 'Em coleta',
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
};
const title = computed(() => tabs.find(t => t[0] === page.value)?.[1]);
const selected = computed(() => orders.value.find(o => o.id === selectedId.value));
const route = computed(() => selected.value?.routes.find(r =>
  ['CALCULATED', 'IN_USE', 'COMPLETED'].includes(r.status)));
const pending = computed(() => orders.value.filter(o => ['PENDING', 'ROUTED'].includes(o.status)));
const active = computed(() => orders.value.filter(o => o.status === 'COLLECTING'));
const completed = computed(() => orders.value.filter(o => o.status === 'COMPLETED'));
function orderLabel(order: Order) {
  const aliases: Record<string, string> = { 'DEMO-SHORT': 'PED-001', 'DEMO-MULTI-STOP': 'PED-002', 'DEMO-CONVENTIONAL': 'PED-003' };
  const alias = aliases[order.code] ?? order.code.replace(/^DEMO[-_]?/i, 'PED-');
  return alias !== order.code && orders.value.some(o => o.id !== order.id && o.code === alias) ? `${alias} · ${order.id.slice(0, 6)}` : alias;
}
const orderRoute = (order: Order) => order.routes.find(r => ['CALCULATED', 'IN_USE', 'COMPLETED'].includes(r.status));
const focusedPosition = computed(() => warehouse.value.nodes.find(n => n.id === focusNode.value));
const filtered = computed(() => orders.value.filter(o =>
  (!statusFilter.value || o.status === statusFilter.value) &&
  `${o.code} ${orderLabel(o)}`.toLocaleLowerCase('pt-BR').includes(search.value.trim().toLocaleLowerCase('pt-BR'))));
const focusedProducts = computed(() => products.value.filter(p => p.warehouseNodeId === focusNode.value));
const number = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
function openOrder(order: Order) { selectedId.value = order.id; focusNode.value = ''; page.value = 'route'; }
function locate(id: string) { focusNode.value = id; page.value = 'map'; }
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light';
}
function toggleSidebar() {
  collapsed.value = !collapsed.value;
  document.body.classList.toggle('sidebar-collapsed', collapsed.value);
}
async function refresh() {
  if (!warehouses.value.length) warehouses.value = await api.warehouses();
  if (!warehouseId.value) warehouseId.value = warehouses.value[0]?.id ?? '';
  if (!warehouseId.value) throw new Error('Nenhum galpão disponível.');
  const [p, o, w] = await Promise.all([api.products(warehouseId.value), api.orders(warehouseId.value), api.warehouse(warehouseId.value)]);
  products.value = p; orders.value = o; warehouse.value = w;
  if (!selected.value) selectedId.value = pending.value[0]?.id ?? o[0]?.id ?? '';
  loaded.value = true;
}
async function perform(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try { await action(); }
  catch (e) { error.value = e instanceof Error ? e.message : 'Não foi possível carregar os dados.'; }
  finally { busy.value = false; }
}
function calculate() {
  const order = selected.value;
  if (!order || !['PENDING', 'ROUTED'].includes(order.status)) return;
  return perform(async () => {
    await api.calculate(order.id);
    orders.value = orders.value.map(o => o.id === order.id ? { ...o, routes: [] } : o);
    notice.value = 'Rota calculada. Atualizando os dados do pedido…';
    await refresh();
    notice.value = 'Rota recebida. Confira o percurso e os produtos do pedido.';
  });
}
onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem('smartpick-profile') ?? 'null');
    if (saved && typeof saved.name === 'string' && profiles.some(p => p.id === saved.role)) {
      operatorName.value = saved.name.slice(0, 60); profileId.value = saved.role; entered.value = true;
    }
  } catch {}
  if (entered.value) perform(refresh);
});
onUnmounted(() => {
  document.body.classList.remove('sidebar-collapsed');
  delete document.documentElement.dataset.theme;
});
</script>

<template>
  <main v-if="!entered" class="access-page">
    <section class="access-card">
      <div class="access-brand"><span class="logo-mark">SP</span><div><strong>SmartPick WMS</strong><small>Gestão Logística · CD Principal</small></div></div>
      <div class="access-heading"><span class="pill blue">Área de trabalho</span><h1>Bem-vindo ao SmartPick</h1><p>Escolha como deseja acompanhar a operação.</p></div>
      <form @submit.prevent="enter">
        <label class="access-name">Seu nome<input v-model="operatorName" maxlength="60" autocomplete="given-name" placeholder="Como podemos chamar você?" /></label>
        <fieldset class="profile-options"><legend>Perfil de acesso</legend>
          <label v-for="option in profiles" :key="option.id" :class="['profile-option', { selected: profileId === option.id }]">
            <input type="radio" name="profile" v-model="profileId" :value="option.id" /><WmsIcon :name="option.icon" />
            <span><strong>{{ option.title }}</strong><small>{{ option.description }}</small></span>
          </label>
        </fieldset>
        <button class="btn primary full access-submit" type="submit">Entrar no SmartPick →</button>
        <p class="access-note">Acesso local, sem senha. O perfil personaliza a identificação na tela; as funções disponíveis são as mesmas.</p>
      </form>
    </section>
  </main>
  <div v-else class="app-shell">
    <aside id="sidebar">
      <div class="brand-wrap">
        <a class="brand" href="#" @click.prevent="page = 'dashboard'">
          <span class="logo-mark">SP</span><div class="brand-text">
            <span class="brand-title">SmartPick WMS</span><span class="brand-sub">Gestão Logística</span>
          </div>
        </a>
        <button class="collapse-btn" aria-label="Recolher menu" @click="toggleSidebar">‹</button>
      </div>
      <div class="nav-wrap"><nav id="nav" aria-label="Navegação principal">
        <div class="nav-section-label">Operação</div>
        <template v-for="tab in tabs" :key="tab[0]">
        <div v-if="tab[0] === 'map'" class="nav-section-label">Estoque &amp; Planta</div>
        <button :title="tab[1]"
          :class="{ active: page === tab[0] }" :aria-current="page === tab[0] ? 'page' : undefined"
          @click="page = tab[0]">
          <span class="nav-ico"><WmsIcon :name="tab[2]" /></span><span class="nav-text">{{ tab[1] }}</span>
          <span v-if="tab[0] === 'orders' && loaded" class="nav-badge">{{ pending.length }}</span>
        </button></template>
      </nav></div>
      <div class="aside-foot"><div class="aside-foot-details">
        <strong>{{ warehouseName }}</strong><span>{{ profile.short }} · {{ operatorName }}</span>
      </div></div>
    </aside>
    <div id="main-layout">
      <header class="top-bar">
        <div class="header-left"><button class="btn light sm" aria-label="Alternar menu" @click="toggleSidebar">☰</button>
          <span class="muted">WMS /</span><strong>{{ title }}</strong></div>
        <div class="header-right">
          <label class="profile-switcher">Galpão<select aria-label="Galpão ativo" v-model="warehouseId" :disabled="busy" @change="changeWarehouse"><option v-for="building in warehouses" :key="building.id" :value="building.id">{{ building.name }}</option></select></label>
          <label class="profile-switcher">Perfil<select v-model="profileId" aria-label="Perfil ativo" @change="saveProfile"><option v-for="option in profiles" :key="option.id" :value="option.id">{{ option.title }}</option></select></label>
          <button class="btn light sm" @click="toggleTheme">{{ dark ? 'Tema claro' : 'Tema escuro' }}</button>
          <button class="btn light sm" :disabled="busy" @click="perform(refresh)">Atualizar dados</button>
          <div class="user-pill"><span class="avatar">{{ operatorName.slice(0, 2).toUpperCase() }}</span><strong>{{ operatorName }}</strong><button class="link" @click="leave">Sair</button></div>
        </div>
      </header>
      <main class="content" :aria-busy="busy">
        <div class="title"><div><h1>{{ page === 'dashboard' ? 'Painel de Controle Operacional' : title }}</h1>
          <p>Visão geral das ordens de separação, rotas de coleta e posições do armazém.</p></div>
          <div class="title-actions"><button class="btn light" @click="page = 'orders'">Selecionar pedido</button>
            <button class="btn light" @click="page = 'route'"><WmsIcon name="new" /> Roteirizar pedidos</button></div>
        </div>
        <div v-if="busy" class="notice" role="status">Carregando… Aguarde a confirmação.</div>
        <div v-if="error" class="notice error" role="alert">{{ error }}
          <span v-if="loaded"> Os dados exibidos podem estar desatualizados.</span>
          <button class="btn light sm" :disabled="busy" @click="perform(refresh)">Tentar novamente</button>
        </div>
        <div v-if="notice" class="notice" role="status">{{ notice }}</div>
        <template v-if="loaded">
          <template v-if="page === 'dashboard'">
            <div class="kpi-strip">
              <div class="kpi-cell"><span class="kpi-head">Pedidos na fila</span><strong class="kpi-val">{{ pending.length }}</strong><span class="kpi-sub">Pendentes e com rota pronta</span></div>
              <div class="kpi-cell"><span class="kpi-head">Coletas em andamento</span><strong class="kpi-val">{{ active.length }}</strong><span class="kpi-sub">Situação informada pelo sistema</span></div>
              <div class="kpi-cell"><span class="kpi-head">Pedidos concluídos</span><strong class="kpi-val">{{ completed.length }}</strong><span class="kpi-sub">Ordens finalizadas</span></div>
              <div class="kpi-cell"><span class="kpi-head">Posições de estoque</span><strong class="kpi-val">{{ warehouse.nodes.filter(n => n.type === 'STORAGE').length }}</strong><span class="kpi-sub">Endereços cadastrados</span></div>
            </div>
            <div class="split-layout">
              <section class="card order-portfolio"><div class="card-head"><div><h2>Carteira de Pedidos de Separação</h2><div class="sub">Produtos, volumes e percursos das ordens de coleta</div></div><span class="pill mono">{{ orders.length }} {{ orders.length === 1 ? 'PEDIDO' : 'PEDIDOS' }}</span></div>
                <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Produtos</th><th>Volume</th><th>Rota otimizada</th><th>Situação</th><th>Ação</th></tr></thead>
                  <tbody><tr v-for="order in orders" :key="order.id"><td class="mono"><strong>{{ orderLabel(order) }}</strong></td>
                    <td><strong>{{ order.items[0]?.productNameSnapshot || 'Sem produtos' }}</strong><small v-if="order.items.length > 1">+ {{ order.items.length - 1 }} {{ order.items.length === 2 ? 'produto' : 'produtos' }}</small></td>
                    <td class="mono">{{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'itens' }}<small>{{ order.items.reduce((sum, item) => sum + item.requestedQuantity, 0) }} un.</small></td>
                    <td class="mono"><strong>{{ orderRoute(order) ? number(orderRoute(order)!.totalDistanceMeters) + ' m' : '—' }}</strong><small v-if="!orderRoute(order)">A calcular</small></td>
                    <td><span :class="['pill', { green: order.status === 'COMPLETED', blue: order.status === 'ROUTED' }]">{{ labels[order.status] }}</span></td>
                    <td><button class="btn light sm" @click="openOrder(order)">Ver pedido</button></td></tr></tbody></table>
                  <p v-if="!orders.length" class="empty">Nenhum pedido disponível.</p></div>
              </section>
              <div class="side-stack">
                <section class="card"><div class="card-head"><h2>Execução em Campo</h2></div><div class="pad">
                  <div v-for="order in active" :key="order.id" class="list-row"><strong>{{ orderLabel(order) }}</strong><span class="pill">Em coleta</span></div>
                  <p v-if="!active.length" class="muted">Nenhuma coleta em andamento.</p>
                  <button class="btn light full" @click="page = 'orders'">Selecionar pedido para coleta</button>
                </div></section>
                <section class="card"><div class="card-head"><div><h2>Planta do Armazém — Prévia</h2><small>Pedido: {{ selected ? orderLabel(selected) : 'Nenhum' }}</small></div>
                  <button class="btn light sm" @click="page = 'map'">Expandir</button></div>
                  <WarehouseMap :warehouse="warehouse" :route="route" :products="products" :warehouse-name="warehouseName" mini basic @select="locate" />
                  <div class="preview-links"><span class="muted">Vista superior · 2D</span><button class="link" @click="page = 'map'">Consultar planta</button></div>
                </section>
              </div>
            </div>
          </template>
          <section v-if="page === 'orders'" class="card">
            <div class="card-head"><label>Buscar pedido<input v-model="search" type="search" placeholder="Código do pedido" /></label>
              <label>Situação<select v-model="statusFilter"><option value="">Todos os pedidos</option><option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option></select></label></div>
            <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Produtos</th><th>Situação</th><th>Ação</th></tr></thead>
              <tbody><tr v-for="order in filtered" :key="order.id"><td class="mono">{{ orderLabel(order) }}</td>
                <td>{{ order.items.length }}</td><td><span class="pill">{{ labels[order.status] }}</span></td>
                <td><button class="btn light" @click="openOrder(order)">Abrir pedido</button></td></tr></tbody></table>
              <p v-if="!filtered.length" class="empty">Nenhum pedido encontrado.</p></div>
          </section>
          <template v-if="page === 'route' || page === 'map'">
            <section class="card selector"><label>Pedido<select aria-label="Pedido" v-model="selectedId" :disabled="busy" @change="focusNode = ''; notice = ''">
              <option value="" disabled>Selecione um pedido</option><option v-for="order in orders" :key="order.id" :value="order.id">{{ orderLabel(order) }} · {{ labels[order.status] }}</option>
            </select></label><span v-if="selected" class="pill">{{ labels[selected.status] }}</span>
              <button v-if="selected && ['PENDING', 'ROUTED'].includes(selected.status)" class="btn primary" :disabled="busy || !!error" @click="calculate">{{ route ? 'Recalcular rota' : 'Calcular rota' }}</button>
            </section>
            <p v-if="!orders.length" class="notice">Nenhum pedido disponível. O mapa pode ser consultado sem selecionar um pedido.</p>
            <div class="split-layout"><section class="card"><div class="card-head"><h2>Planta 2D do armazém</h2><span class="pill">{{ warehouse.nodes.length }} pontos</span></div>
              <WarehouseMap :key="warehouseId" :warehouse="warehouse" :route="route" :products="products" :warehouse-name="warehouseName" :focus-node="focusNode" :overview="page === 'map'" basic @select="focusNode = $event" />
            </section>
              <section v-if="page === 'route'" class="card"><div class="card-head"><h2>Produtos do pedido</h2></div><div class="pad">
                <template v-if="selected"><strong>{{ orderLabel(selected) }}</strong>
                  <div v-if="route" class="route-distance"><strong>{{ number(route.totalDistanceMeters) }}</strong> metros</div>
                  <p v-else class="muted">Este pedido não possui uma rota vigente disponível.</p>
                  <button v-for="item in selected.items" :key="item.id" class="address-item" :class="{ 'selected-address': focusNode === item.product.warehouseNodeId }" @click="focusNode = item.product.warehouseNodeId"><div><strong>{{ item.productNameSnapshot }}</strong><small>{{ item.productSkuSnapshot }} · {{ item.product.warehouseNode.code.replace('STORAGE-', '') }}</small></div><span>{{ item.requestedQuantity }} un.</span></button>
                  <template v-if="route"><h3>Sequência de paradas</h3><div class="stop-list"><button v-for="stop in route.stops" :key="stop.warehouseNodeId" @click="focusNode = stop.warehouseNodeId" :class="{ active: focusNode === stop.warehouseNodeId }"><span>{{ stop.sequence }}</span><strong>{{ stop.warehouseNode.code.replace('STORAGE-', '') }}</strong><small>Localizar →</small></button></div></template>
                  <p class="muted">Clique em um produto ou parada para destacá-lo na planta.</p>
                </template><p v-else class="empty">Selecione um pedido para visualizar seus produtos.</p>
              </div></section>
              <section v-else class="card"><div class="card-head"><h2>Consulta de Endereços</h2></div><div class="pad">
                <p class="muted">Selecione uma posição no mapa para consultar seus produtos.</p>
                <template v-if="focusNode"><h3>{{ focusedPosition?.code.replace('STORAGE-', '') }}</h3><p class="muted">{{ focusedPosition?.label }}</p>
                  <div v-for="product in focusedProducts" :key="product.id" class="list-row"><div><strong>{{ product.name }}</strong><small>{{ product.sku }} · {{ product.stockQuantity }} un.</small></div></div>
                  <p v-if="!focusedProducts.length" class="muted">Nenhum produto neste ponto.</p></template>
                <div v-else class="address-directory"><button v-for="position in warehouse.nodes.filter(n => n.type === 'STORAGE')" :key="position.id" class="address-item" @click="focusNode = position.id"><strong>{{ position.code.replace('STORAGE-', '') }}</strong><small>{{ products.filter(p => p.warehouseNodeId === position.id).map(p => p.name).join(', ') || 'Sem produtos' }}</small></button></div>
                <button v-if="focusNode" class="link" @click="focusNode = ''">Ver todos os endereços</button>
              </div></section>
            </div>
          </template>
        </template>
        <footer>SmartPick WMS · Sistema de Gestão e Separação de Pedidos<span>{{ warehouseName }}</span></footer>
      </main>
    </div>
  </div>
</template>

<style scoped>
.access-page { min-height: 100vh; display: grid; place-items: center; padding: 36px 18px; background: radial-gradient(ellipse at top right, var(--primary-soft), transparent 60%), var(--bg); }
.access-card { width: min(100%, 650px); padding: 30px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow-md); }
.access-brand { display: flex; align-items: center; gap: 10px; padding-bottom: 22px; border-bottom: 1px solid var(--line); }
.access-brand small { display: block; color: var(--muted); margin-top: 3px; }
.access-heading { margin: 24px 0; }
.access-heading h1 { margin-top: 12px; font-size: 24px; }
.access-heading p, .access-note { color: var(--muted); }
.access-name { display: grid; gap: 7px; margin-bottom: 20px; font-weight: 600; }
.profile-options { border: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 20px; }
.profile-options legend { padding: 0 0 10px; font-weight: 600; }
.profile-option { position: relative; display: flex; flex-direction: row; gap: 10px; align-items: start; padding: 16px 12px; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
.profile-option.selected { background: var(--primary-soft); border-color: var(--primary); }
.profile-option input[type="radio"] { accent-color: var(--primary); margin: 2px 0 0; width: 16px; height: 16px; padding: 0; flex: 0 0 16px; }
.profile-option svg { width: 18px; min-width: 18px; color: var(--primary); }
.profile-option strong { font-size: 12px; }
.profile-option small { display: block; margin-top: 5px; line-height: 1.5; color: var(--muted); font-size: 11px; }
.access-submit { min-height: 40px; }
.access-note { font-size: 11px; line-height: 1.6; margin-bottom: 0; text-align: center; }
.profile-switcher { display: inline-flex; flex-direction: row; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
.profile-switcher select { max-width: 195px; }
.user-pill strong { font-size: 11px; }
@media (max-width: 760px) { .profile-options { grid-template-columns: 1fr; } .access-card { padding: 20px; } .header-right { gap: 6px; } }
.order-portfolio { align-self: start; }
.address-directory { max-height: 510px; overflow-y: auto; padding-right: 4px; }
.order-portfolio td { padding-top: 16px; padding-bottom: 16px; }
.order-portfolio td:first-child { white-space: nowrap; }
.preview-links { display: flex; justify-content: space-between; padding: 0 14px 14px; gap: 12px; font-size: 11px; }
.title-actions svg { width: 15px; height: 15px; }
.selected-address { border-color: var(--primary); background: var(--primary-soft); }
.stop-list { display: grid; gap: 7px; margin: 12px 0; }
.stop-list button { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface); color: var(--ink); cursor: pointer; }
.stop-list button.active { border-color: var(--primary); background: var(--primary-soft); }
.stop-list button > span { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--green-soft); color: var(--green); font-weight: 700; }
.stop-list small { margin-left: auto; color: var(--muted); }
@media (max-width: 760px) {
  :global(body.sidebar-collapsed) #sidebar { width: 100%; }
  :global(body.sidebar-collapsed) .brand-text { display: block; }
}
</style>
