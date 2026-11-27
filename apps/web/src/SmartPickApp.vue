<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api, nodeFallback, type Collection, type HistoryEntry, type Order, type PersistedRoute, type Product, type Route, type Warehouse } from "./services/api";
import WarehouseMap from "./components/WarehouseMap.vue";
import WmsIcon from "./components/WmsIcon.vue";
const tabs = [
  ["dashboard", "Painel Operacional", "dashboard", "Operação"],
  ["orders", "Pedidos de Coleta", "orders", ""],
  ["route", "Roteirização", "new", ""],
  ["active", "Execução de Coleta", "active", ""],
  ["products", "Catálogo de Produtos", "products", "Estoque & Planta"],
  ["map", "Planta do Armazém", "map", ""],
  ["history", "Histórico de Coletas", "history", "Gestão & Governança"],
];
const page = ref("dashboard"),
  busy = ref(false),
  error = ref(""),
  notice = ref("");
const products = ref<Product[]>([]),
  orders = ref<Order[]>([]),
  historyEntries = ref<HistoryEntry[]>([]),
  routesByOrder = ref<Record<string, Route>>({}),
  collectionsByOrder = ref<Record<string, Collection>>({}),
  warehouse = ref<Warehouse>({ nodes: [], edges: [] });
const selectedId = ref(""),
  search = ref(""),
  statusFilter = ref("");
const selected = computed(() =>
  orders.value.find((o) => o.id === selectedId.value),
);
const route = computed(
  () =>
    routesByOrder.value[selectedId.value] ?? selected.value?.routes.find((r) =>
      ["CALCULATED", "IN_USE", "COMPLETED"].includes(r.status),
    ) ?? selected.value?.routes[0],
);
const collection = computed(() =>
  [collectionsByOrder.value[selectedId.value], ...(selected.value?.collections ?? [])].find((c) => c?.status === "IN_PROGRESS"),
);
const stopForItem = (id: string) =>
  route.value?.stops.find((stop) => stop.items.some((item) => {
    const orderItem = selected.value?.items.find((entry) => entry.id === id);
    return item.orderItemId === id || item.orderItemId === orderItem?.productId;
  }));
const pending = computed(() =>
  orders.value.filter((o) => ["PENDING", "ROUTED"].includes(o.status)),
);
const active = computed(() =>
  orders.value.filter((o) => o.status === "COLLECTING"),
);
const historySearch = ref("");
const history = computed(() => historyEntries.value.filter((entry) => entry.order.code.toLowerCase().includes(historySearch.value.toLowerCase())));
const nodeFor = (id: string) => warehouse.value.nodes.find((node) => node.id === id) ?? products.value.find((product) => product.warehouseNodeId === id)?.warehouseNode ?? nodeFallback(id);
const filteredProducts = computed(() =>
  products.value.filter(
    (p) =>
      (!positionFilter.value || p.warehouseNodeId === positionFilter.value) &&
      `${p.sku} ${p.name} ${p.warehouseNode?.code ?? p.warehouseNodeId}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const filteredOrders = computed(() =>
  orders.value.filter(
    (o) => !statusFilter.value || o.status === statusFilter.value,
  ),
);
const selectedItems = computed(() =>
  route.value
    ? route.value.stops
        .flatMap((s) =>
          s.items.map((link) =>
            selected.value!.items.find((i) => i.id === link.orderItemId)!,
          ),
        )
        .filter(Boolean)
    : (selected.value?.items ?? []),
);
const collected = computed(
  () =>
    collection.value?.items.reduce((sum, i) => sum + i.collectedQuantity, 0) ??
    0,
);
const required = computed(
  () =>
    collection.value?.items.reduce((sum, i) => sum + i.requestedQuantity, 0) ??
    0,
);
const progress = computed(() =>
  required.value ? Math.round((collected.value / required.value) * 100) : 0,
);
const labels: Record<string, string> = {
  PENDING: "Pendente",
  ROUTED: "Rota pronta",
  COLLECTING: "Em coleta",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const title = computed(() => tabs.find((t) => t[0] === page.value)?.[1]);
const number = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const date = (v: string) => new Date(v).toLocaleString("pt-BR");
const editingId = ref("");
const blankProduct = () => ({
  sku: "",
  name: "",
  category: "",
  weightKg: 0,
  stockQuantity: 0,
  warehouseNodeId: "",
  isActive: true,
});
const productDraft = ref(blankProduct());
const orderCodeInput = ref<HTMLInputElement | null>(null);
const orderCode = ref(""),
  quantities = ref<Record<string, number>>({});
const dark = ref(false);
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.dataset.theme = dark.value ? "dark" : "light";
}
async function refresh() {
  const [p, o, h] = await Promise.all([api.products(), api.orders(), api.history()]);
  products.value = p;
  orders.value = o.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      product: p.find((product) => product.id === item.productId) ?? item.product ?? ({
        id: item.productId,
        sku: item.productSkuSnapshot,
        name: item.productNameSnapshot,
        category: null,
        weightKg: 0,
        stockQuantity: 0,
        warehouseNodeId: "",
        isActive: true,
        warehouseNode: { id: "", code: "—", type: "STORAGE", x: 0, y: 0, label: null, isActive: true },
      } as Product),
    })),
  }));
  historyEntries.value = h;
  const session = readSession();
  const ordersById = new Map(orders.value.map((order) => [order.id, order]));
  const loadedRoutes: Record<string, Route> = {};
  const loadedCollections: Record<string, Collection> = {};
  await Promise.all(orders.value.map(async (order) => {
    const routeId = session.routes[order.id];
    const collectionId = session.collections[order.id];
    if (routeId) try { loadedRoutes[order.id] = normalizeRoute(await api.route(routeId), order); } catch { /* rota ainda indisponível */ }
    if (collectionId) try { loadedCollections[order.id] = await api.collection(collectionId); } catch { /* coleta ainda indisponível */ }
  }));
  await Promise.all(h.map(async (entry) => {
    if (loadedRoutes[entry.order.id]) return;
    const order = ordersById.get(entry.order.id);
    if (order) try { loadedRoutes[order.id] = normalizeRoute(await api.route(entry.routeId), order); } catch { /* rota histórica indisponível */ }
  }));
  routesByOrder.value = loadedRoutes;
  collectionsByOrder.value = loadedCollections;
  if (!selected.value)
    selectedId.value = orders.value.find((x) => x.status === "COLLECTING")?.id ?? orders.value[0]?.id ?? "";
}
type SessionCache = { routes: Record<string, string>; collections: Record<string, string> };
function readSession(): SessionCache {
  try {
    const value = JSON.parse(localStorage.getItem("smartpick-session") ?? "{}");
    return { routes: value.routes ?? {}, collections: value.collections ?? {} };
  } catch { return { routes: {}, collections: {} }; }
}
function persistSession() {
  try {
    const session = readSession();
    for (const [orderId, value] of Object.entries(routesByOrder.value)) session.routes[orderId] = value.id;
    for (const [orderId, value] of Object.entries(collectionsByOrder.value)) session.collections[orderId] = value.id;
    localStorage.setItem("smartpick-session", JSON.stringify(session));
  } catch {
    // The API remains the source of truth if browser storage is unavailable.
  }
}
function normalizeRoute(raw: PersistedRoute, order: Order): Route {
  return {
    ...raw,
    conventionalDistanceMeters: null,
    conventionalPathNodeIds: null,
    steps: raw.pathNodeIds.map((warehouseNodeId, index) => ({ warehouseNodeId, sequence: index + 1 })),
    stops: raw.stops.map((stop) => ({
      ...stop,
      warehouseNodeId: stop.nodeId,
      warehouseNode: nodeFor(stop.nodeId),
      items: stop.productIds.map((productId) => ({ orderItemId: order.items.find((item) => item.productId === productId)?.id ?? productId })),
    })),
  };
}
async function perform(action: () => Promise<unknown>, message = "") {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await action();
    notice.value = message;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Não foi possível concluir a operação.";
  } finally {
    busy.value = false;
  }
}
function openOrder(o: Order, target = "route") {
  selectedId.value = o.id;
  page.value = target;
}
function openHistoryEntry(entry: HistoryEntry) {
  const order = orders.value.find((candidate) => candidate.id === entry.order.id);
  if (!order) {
    error.value = "O pedido deste registro não está disponível na lista da API.";
    return;
  }
  openOrder(order, "route");
}
function editProduct(p?: Product) {
  editingId.value = p?.id ?? "";
  productDraft.value = p
    ? {
        sku: p.sku,
        name: p.name,
        category: p.category ?? "",
        weightKg: p.weightKg,
        stockQuantity: p.stockQuantity,
        warehouseNodeId: p.warehouseNodeId,
        isActive: p.isActive,
      }
    : blankProduct();
}
const saveProduct = () =>
  perform(async () => {
    if (editingId.value) throw new Error("A API atual não oferece edição de produtos.");
    await api.createProduct({ ...productDraft.value, category: productDraft.value.category.trim() || undefined });
    productDraft.value = blankProduct();
    editingId.value = "";
    await refresh();
  }, "Produto salvo.");
async function createOrder() {
  const items = Object.entries(quantities.value)
    .filter(([, q]) => q > 0)
    .map(([productId, requestedQuantity]) => ({
      productId,
      requestedQuantity,
    }));
  if (!items.length) {
    error.value = "Informe a quantidade de pelo menos um produto.";
    return;
  }
  await perform(async () => {
    const o = await api.createOrder({ code: orderCode.value, items });
    selectedId.value = o.id;
    quantities.value = {};
    orderCode.value = "";
    await refresh();
    page.value = "route";
  }, "Pedido criado.");
}
const calculate = () =>
  perform(async () => {
    const result = await api.calculate(selectedId.value);
    const current = orders.value.find((order) => order.id === selectedId.value);
    if (current) {
      const normalized = normalizeRoute(result.route, current);
      routesByOrder.value[current.id] = normalized;
      current.routes = [normalized, ...current.routes.filter((route) => route.id !== normalized.id)];
      current.status = "ROUTED";
      persistSession();
    }
  }, "Rota calculada e salva.");
const start = () =>
  perform(async () => {
    const routeId = route.value?.id;
    if (!routeId) throw new Error("Calcule a rota antes de iniciar a coleta.");
    const result = await api.start(selectedId.value, routeId);
    const current = orders.value.find((order) => order.id === selectedId.value);
    collectionsByOrder.value[selectedId.value] = result;
    persistSession();
    if (current) {
      current.collections = [result, ...current.collections.filter((collection) => collection.id !== result.id)];
      current.status = "COLLECTING";
      const currentRoute = current.routes.find((candidate) => candidate.id === routeId);
      if (currentRoute) currentRoute.status = "IN_USE";
    }
    page.value = "active";
  }, "Coleta iniciada.");
const confirmItem = (id: string) =>
  perform(async () => {
    const c = collection.value;
    if (!c) throw new Error("Não há coleta ativa para este pedido.");
    const i = c.items.find((item) => item.orderItemId === id || selected.value?.items.find((orderItem) => orderItem.id === id)?.id === item.orderItemId);
    if (!i) throw new Error("Item não encontrado na coleta.");
    const result = await api.collect(c.id, i.id, i.requestedQuantity);
    i.collectedQuantity = result.item.collectedQuantity;
    if (result.item.collectedAt) i.collectedAt = result.item.collectedAt;
    const current = orders.value.find((order) => order.id === selectedId.value);
    if (current) {
      current.status = result.orderStatus;
      const orderItem = current.items.find((item) => item.id === i.orderItemId);
      if (orderItem) orderItem.collectedQuantity = result.item.collectedQuantity;
    }
    products.value = await api.products();
    current?.items.forEach((item) => {
      const product = products.value.find((candidate) => candidate.id === item.productId);
      if (product) item.product = product;
    });
    const cachedCollection = collectionsByOrder.value[selectedId.value];
    if (cachedCollection) cachedCollection.status = result.collectionStatus;
    if (result.collectionStatus === "COMPLETED") {
      c.status = "COMPLETED";
      const currentRoute = routesByOrder.value[selectedId.value];
      if (currentRoute) currentRoute.status = "COMPLETED";
      historyEntries.value = await api.history();
      page.value = "history";
    }
  }, "Quantidade confirmada.");
const finish = () =>
  perform(async () => {
    if (!collection.value) throw new Error("Não há coleta ativa para concluir.");
    const result = await api.complete(collection.value.id);
    const current = orders.value.find((order) => order.id === selectedId.value);
    if (current) {
      current.status = "COMPLETED";
      const activeCollection = collectionsByOrder.value[selectedId.value];
      if (activeCollection) { activeCollection.status = "COMPLETED"; activeCollection.completedAt = result.completedAt; }
      const currentRoute = routesByOrder.value[selectedId.value] ?? current.routes.find((item) => item.id === activeCollection?.routeId);
      if (currentRoute) currentRoute.status = "COMPLETED";
    }
    historyEntries.value = await api.history();
    page.value = "history";
  }, "Coleta concluída e registrada no histórico.");
const collapsed = ref(false),
  positionFilter = ref(""),
  focusNode = ref("");
const clock = ref(Date.now());
let ticker: ReturnType<typeof setInterval>;
const elapsed = computed(() =>
  collection.value
    ? duration(clock.value - Date.parse(collection.value.startedAt))
    : "00:00",
);
function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
const nextItem = computed(() =>
  selectedItems.value.find((i) => i.collectedQuantity < i.requestedQuantity),
);
const finishedNodes = computed(
  () =>
    route.value?.stops
      .filter((s) =>
        s.items.every((link) => {
          const i = selected.value?.items.find(
            (i) => i.id === link.orderItemId,
          );
          return i && i.collectedQuantity >= i.requestedQuantity;
        }),
      )
      .map((s) => s.warehouseNodeId) ?? [],
);
const focusedProducts = computed(() =>
  products.value.filter((p) => p.warehouseNodeId === focusNode.value),
);
function locate(id: string) {
  focusNode.value = id;
  page.value = "map";
}
function toggleSidebar() {
  collapsed.value = !collapsed.value;
  document.body.classList.toggle("sidebar-collapsed", collapsed.value);
}
function exportHistory() {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const rows = history.value.map((entry) => {
    const r = routesByOrder.value[entry.order.id];
    return [
      entry.order.code,
      labels.COMPLETED,
      entry.itemCount,
      r?.totalDistanceMeters,
      r?.conventionalDistanceMeters,
      entry.completedAt,
      duration(Date.parse(entry.completedAt) - Date.parse(entry.startedAt)),
    ];
  });
  const blob = new Blob(
    [
      "\ufeff" +
        [
          [
            "Pedido",
            "Situação",
            "Produtos",
            "Rota (m)",
            "Convencional (m)",
            "Conclusão",
            "Duração",
          ],
          ...rows,
        ]
          .map((row) => row.map(cell).join(";"))
          .join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "smartpick-historico.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function shortcut(e: KeyboardEvent) {
  if (
    e.code === "Space" &&
    page.value === "active" &&
    collection.value &&
    nextItem.value &&
    !busy.value &&
    !(e.target as HTMLElement).closest(
      "input,select,textarea,button,a,[contenteditable]",
    )
  ) {
    e.preventDefault();
    confirmItem(nextItem.value.id);
  }
}
onMounted(() => {
  perform(refresh);
  ticker = setInterval(() => (clock.value = Date.now()), 1000);
  window.addEventListener("keydown", shortcut);
});
onUnmounted(() => {
  clearInterval(ticker);
  window.removeEventListener("keydown", shortcut);
  document.body.classList.remove("sidebar-collapsed");
});
</script>
<template>
  <div class="app-shell">
    <aside id="sidebar">
      <div class="brand-wrap">
        <a class="brand" href="#" @click.prevent="page = 'dashboard'"
          ><span class="logo-mark">SP</span>
          <div class="brand-text">
            <span class="brand-title">SmartPick WMS</span
            ><span class="brand-sub">Gestão Logística</span>
          </div></a
        ><button
          class="collapse-btn"
          aria-label="Recolher menu"
          @click="toggleSidebar"
        >
          ‹
        </button>
      </div>
      <div class="nav-wrap">
        <nav id="nav" aria-label="Navegação principal">
          <template v-for="t in tabs" :key="t[0]"
            ><div v-if="t[3]" class="nav-section-label">{{ t[3] }}</div>
            <button
              :class="{ active: page === t[0] }"
              :title="t[1]"
              :aria-current="page === t[0] ? 'page' : undefined"
              @click="page = t[0]"
            >
              <span class="nav-ico"><WmsIcon :name="t[2]" /></span
              ><span class="nav-text">{{ t[1] }}</span
              ><span
                v-if="t[0] === 'orders' || t[0] === 'products'"
                class="nav-badge"
                >{{
                  t[0] === "orders" ? pending.length : products.length
                }}</span
              >
            </button></template
          >
        </nav>
      </div>
      <div class="aside-foot">
        <span class="status-dot"></span>
        <div class="aside-foot-details">
          <strong>CD Principal</strong><span>Operação local · Telecontrol</span>
        </div>
      </div>
    </aside>
    <div id="main-layout">
      <header class="top-bar">
        <div class="header-left">
          <button
            class="btn light sm"
            aria-label="Alternar menu"
            @click="toggleSidebar"
          >
            ☰</button
          ><span class="muted">WMS /</span><strong>{{ title }}</strong>
        </div>
        <div class="header-right">
          <button class="btn light sm" @click="toggleTheme">
            {{ dark ? "Tema claro" : "Tema escuro" }}</button
          ><button
            class="btn light sm"
            :disabled="busy"
            @click="perform(refresh)"
          >
            Atualizar dados</button
          ><span class="pill">Ambiente local</span>
        </div>
      </header>
      <main class="content" :aria-busy="busy">
        <div class="title">
          <div>
            <h1>
              {{
                page === "dashboard" ? "Painel de Controle Operacional" : title
              }}
            </h1>
            <p>Gestão de pedidos, estoque e deslocamento · CD Principal</p>
          </div>
          <div class="title-actions">
            <button class="btn light" @click="page = 'orders'">
              Emitir Pedido</button
            ><button class="btn light" @click="page = 'route'">
              Roteirizar Pedidos
            </button>
          </div>
        </div>
        <div v-if="busy" class="notice" role="status">
          Processando… Aguarde a confirmação.
        </div>
        <div v-if="error" class="notice error" role="alert">{{ error }}</div>
        <div v-if="notice" class="notice success" role="status">
          {{ notice }}
        </div>
        <template v-if="page === 'dashboard'">
          <div class="kpi-strip">
            <div class="kpi-cell">
              <span class="kpi-head">Pedidos na fila</span
              ><strong class="kpi-val">{{ pending.length }}</strong
              ><span class="kpi-sub">Aguardando liberação para coleta</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-head">Coleta em andamento</span
              ><strong class="kpi-val">{{ active.length || "Inativa" }}</strong
              ><span class="kpi-sub">{{
                active[0]?.code || "Nenhuma coleta em execução"
              }}</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-head">Pedidos expedidos</span
              ><strong class="kpi-val">{{
                orders.filter((o) => o.status === "COMPLETED").length
              }}</strong
              ><span class="kpi-sub">Ordens finalizadas</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-head">Redução de deslocamento</span
              ><strong class="kpi-val">—</strong
              ><span class="kpi-sub">A API atual informa apenas a distância otimizada.</span>
            </div>
          </div>
          <div class="split-layout">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>Carteira de Pedidos de Separação</h2>
                  <p class="muted">
                    Percurso otimizado calculado pela API
                  </p>
                </div>
                <span class="pill">{{ pending.length }} pedidos</span>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Volume</th>
                      <th>Rota otimizada</th>
                      <th>Convencional</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="o in pending" :key="o.id">
                      <td class="mono">{{ o.code }}</td>
                      <td>
                        {{ o.items.length }} itens ({{
                          o.items.reduce((n, i) => n + i.requestedQuantity, 0)
                        }}
                        un.)
                      </td>
                      <td class="mono">
                        {{
                          routesByOrder[o.id]
                            ? number(routesByOrder[o.id].totalDistanceMeters) + " m"
                            : "—"
                        }}
                      </td>
                      <td class="mono">
                        {{
                          routesByOrder[o.id]?.conventionalDistanceMeters != null
                            ? number(routesByOrder[o.id].conventionalDistanceMeters!) +
                              " m"
                            : "—"
                        }}
                      </td>
                      <td>
                        <span class="pill">{{ labels[o.status] }}</span>
                      </td>
                      <td>
                        <button class="btn light sm" @click="openOrder(o)">
                          Roteirizar
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="!pending.length" class="empty">
                  Nenhum pedido aguardando coleta.
                </p>
              </div>
            </section>
            <div class="side-stack">
              <section class="card">
                <div class="card-head">
                  <h2>Execução em Campo</h2>
                  <span class="status-dot"></span>
                </div>
                <div class="pad">
                  <template v-if="active.length"
                    ><div v-for="o in active" :key="o.id" class="list-row">
                      <strong>{{ o.code }}</strong
                      ><button
                        class="btn light"
                        @click="openOrder(o, 'active')"
                      >
                        Continuar coleta
                      </button>
                    </div></template
                  ><template v-else
                    ><p class="muted">
                      Nenhuma ordem de separação ativa no momento.
                    </p>
                    <button class="btn light full" @click="page = 'route'">
                      Selecionar Pedido para Coleta
                    </button></template
                  >
                </div>
              </section>
              <section class="card">
                <div class="card-head">
                  <div>
                    <h2>Planta do Armazém — Prévia</h2>
                    <small>Pedido: {{ selected?.code || "Nenhum" }}</small>
                  </div>
                  <button class="btn light sm" @click="page = 'map'">
                    Expandir
                  </button>
                </div>
                <WarehouseMap v-if="warehouse.nodes.length"
                  :warehouse="warehouse"
                  :route="route"
                  :products="products"
                  mini
                  @select="locate"
                />
                <p v-else class="pad muted">Layout visual preservado. O backend ainda não fornece os nós e conexões necessários para desenhar o mapa.</p>
                <div class="pad">
                  <button class="btn light full" @click="page = 'map'">
                    Consultar Endereços
                  </button>
                </div>
              </section>
            </div>
          </div>
        </template>
        <template v-if="page === 'products'"
          ><div class="split-layout">
            <section class="card">
              <div class="card-head">
                <label class="search"
                  >Buscar produto<input
                    v-model="search"
                    placeholder="SKU, nome ou posição"
                    type="search" /></label
                ><label
                  >Endereço<select v-model="positionFilter">
                    <option value="">Todos</option>
                    <option
                      v-for="n in warehouse.nodes.filter(
                        (n) => n.type === 'STORAGE',
                      )"
                      :key="n.id"
                      :value="n.id"
                    >
                      {{ n.code }}
                    </option>
                  </select></label
                ><button
                  class="btn primary"
                  :disabled="busy"
                  @click="editProduct()"
                >
                  Novo produto
                </button>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto / SKU</th>
                      <th>Posição</th>
                      <th>Estoque</th>
                      <th>Peso</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in filteredProducts" :key="p.id">
                      <td>
                        <strong>{{ p.name }}</strong
                        ><small>{{ p.sku }}</small>
                      </td>
                      <td>
                        <button
                          class="address-link"
                          @click="locate(p.warehouseNodeId)"
                        >
                          {{ p.warehouseNode.code }}
                        </button>
                      </td>
                      <td>{{ p.stockQuantity }}</td>
                      <td>{{ number(p.weightKg) }} kg</td>
                      <td>{{ p.isActive ? "Ativo" : "Inativo" }}</td>
                      <td>
                        <button
                          class="btn light"
                          disabled
                          title="A API atual não oferece atualização de produto"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="!filteredProducts.length" class="empty">
                  Nenhum produto encontrado.
                </p>
              </div>
            </section>
            <aside class="card form-panel">
              <div class="pad">
                <h2 id="product-title">
                  {{ editingId ? "Editar produto" : "Novo produto" }}
                </h2>
                <form @submit.prevent="saveProduct">
                  <fieldset :disabled="busy">
                    <div class="form-grid">
                      <label
                        >SKU<input
                          v-model="productDraft.sku"
                          required
                          maxlength="50" /></label
                      ><label
                        >Nome<input
                          v-model="productDraft.name"
                          required
                          maxlength="120" /></label
                      ><label
                        >Categoria<input
                          v-model="productDraft.category"
                          maxlength="80" /></label
                      ><label
                        >Peso (kg)<input
                          v-model.number="productDraft.weightKg"
                          type="number"
                          min="0.001"
                          step="0.001"
                          required /></label
                      ><label
                        >Estoque<input
                          v-model.number="productDraft.stockQuantity"
                          type="number"
                          min="0"
                          step="1"
                          required /></label
                      ><label
                        >ID da posição<input
                          aria-label="Posição"
                          v-model="productDraft.warehouseNodeId"
                          list="warehouse-node-ids"
                          required
                          placeholder="UUID da posição"
                        /><datalist id="warehouse-node-ids"><option v-for="p in products" :key="p.id" :value="p.warehouseNodeId">{{ p.warehouseNode.code }}</option></datalist></label
                      ><label class="checkbox"
                        ><input
                          v-model="productDraft.isActive"
                          type="checkbox"
                        />
                        Produto ativo</label
                      >
                    </div>
                    <p class="muted">
                      Use o ID de uma posição de armazenamento já cadastrada.
                    </p>
                    <p v-if="error" role="alert" class="error">{{ error }}</p>
                    <div class="actions">
                      <button
                        type="button"
                        class="btn light"
                        @click="editProduct()"
                      >
                        Limpar</button
                      ><button class="btn primary">Salvar produto</button>
                    </div>
                  </fieldset>
                </form>
              </div>
            </aside>
          </div></template
        >
        <template v-if="page === 'orders'"
          ><div class="split-layout">
            <section class="card">
              <div class="card-head">
                <label
                  >Situação<select v-model="statusFilter">
                    <option value="">Todos os pedidos</option>
                    <option
                      v-for="(label, value) in labels"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </select></label
                ><button
                  class="btn primary"
                  :disabled="busy"
                  @click="orderCodeInput?.focus()"
                >
                  Novo pedido
                </button>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Criado em</th>
                      <th>Produtos</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="o in filteredOrders" :key="o.id">
                      <td>
                        <strong>{{ o.code }}</strong
                        ><small v-if="o.code.startsWith('DEMO-')"
                          >Demonstração</small
                        >
                      </td>
                      <td>{{ date(o.createdAt) }}</td>
                      <td>{{ o.items.length }}</td>
                      <td>
                        <span :class="['badge', o.status]">{{
                          labels[o.status]
                        }}</span>
                      </td>
                      <td>
                        <button
                          class="btn light"
                          @click="
                            openOrder(
                              o,
                              o.status === 'COLLECTING' ? 'active' : 'route',
                            )
                          "
                        >
                          Abrir pedido →
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="!filteredOrders.length" class="empty">
                  Nenhum pedido nesta situação.
                </p>
              </div>
            </section>
            <aside class="card form-panel">
              <div class="pad">
                <h2 id="order-title">Novo pedido de coleta</h2>
                <form @submit.prevent="createOrder">
                  <fieldset :disabled="busy">
                    <label
                      >Código do pedido<input
                        ref="orderCodeInput"
                        v-model="orderCode"
                        required
                        maxlength="50"
                        placeholder="Ex.: PED-001"
                    /></label>
                    <p class="muted">
                      Informe as quantidades dos produtos desejados.
                    </p>
                    <div class="order-draft">
                      <label
                        v-for="p in products.filter((p) => p.isActive)"
                        :key="p.id"
                        class="draft-row"
                        ><span
                          >{{ p.name
                          }}<small
                            >{{ p.sku }} · {{ p.stockQuantity }} em
                            estoque</small
                          ></span
                        ><input
                          v-model.number="quantities[p.id]"
                          :aria-label="`Quantidade de ${p.name}`"
                          type="number"
                          min="0"
                          :max="p.stockQuantity"
                          step="1"
                          placeholder="0"
                      /></label>
                    </div>
                    <p v-if="error" role="alert" class="error">{{ error }}</p>
                    <div class="actions">
                      <button
                        type="button"
                        class="btn light"
                        @click="
                          quantities = {};
                          orderCode = '';
                        "
                      >
                        Limpar</button
                      ><button class="btn primary">Criar pedido</button>
                    </div>
                  </fieldset>
                </form>
              </div>
            </aside>
          </div></template
        >
        <template v-if="['route', 'active', 'map'].includes(page)"
          ><section class="card selector">
            <label
              >Pedido<select
                aria-label="Pedido"
                v-model="selectedId"
                :disabled="busy"
              >
                <option value="" disabled>Selecione um pedido</option>
                <option v-for="o in orders" :key="o.id" :value="o.id">
                  {{ o.code }} · {{ labels[o.status] }}
                </option>
              </select></label
            ><span v-if="selected" :class="['badge', selected.status]">{{
              labels[selected.status]
            }}</span>
            <div v-if="selected && page !== 'map'" class="actions">
              <button
                v-if="['PENDING', 'ROUTED'].includes(selected.status)"
                class="btn light"
                :disabled="busy"
                @click="calculate"
              >
                {{ route ? "Recalcular rota" : "Calcular rota" }}</button
              ><button
                v-if="selected.status === 'ROUTED'"
                class="btn primary"
                :disabled="busy"
                @click="start"
              >
                Iniciar coleta</button
              ><button v-if="['PENDING', 'ROUTED', 'COLLECTING'].includes(selected.status)" class="btn danger" disabled title="A API atual não oferece cancelamento de pedidos">Cancelar pedido</button>
            </div>
          </section>
          <div v-if="page === 'active' && collection" class="banner">
            <div>
              <small>PRÓXIMO ITEM · TEMPO DECORRIDO {{ elapsed }}</small>
              <h2>
                {{
                  nextItem?.productNameSnapshot || "Todos os itens confirmados"
                }}
              </h2>
              <p v-if="nextItem">
                {{ stopForItem(nextItem.id)?.warehouseNode.code }} ·
                {{ nextItem.requestedQuantity - nextItem.collectedQuantity }}
                unidades pendentes
              </p>
            </div>
            <div class="actions" v-if="nextItem">
              <button
                class="btn light"
                @click="
                  focusNode = stopForItem(nextItem.id)?.warehouseNodeId || ''
                "
              >
                Localizar no mapa</button
              ><button
                class="btn"
                :disabled="busy"
                @click="confirmItem(nextItem.id)"
              >
                Confirmar próxima · Espaço
              </button>
            </div>
          </div>
          <div class="split-layout">
            <section class="card">
              <div class="card-head">
                <h2>Planta 2D do armazém</h2>
                <span class="badge">{{ warehouse.nodes.length }} pontos</span>
              </div>
              <WarehouseMap v-if="warehouse.nodes.length"
                :warehouse="warehouse"
                :route="route"
                :products="products"
                :focus-node="focusNode"
                :next-node="
                  collection && nextItem
                    ? stopForItem(nextItem.id)?.warehouseNodeId
                    : undefined
                "
                :done-nodes="finishedNodes"
                @select="focusNode = $event"
              />
              <p v-else class="pad muted">O mapa e a animação aguardam os dados reais do grafo do armazém na API.</p>
              <div v-if="route" class="easy-compare pad">
                <h3>Comparação de percursos</h3>
                <div class="bar-row">
                  <span class="bar-label">Otimizada</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill smart"
                      :style="{
                        width:
                          (route.totalDistanceMeters /
                            Math.max(
                              1,
                              route.totalDistanceMeters,
                              route.conventionalDistanceMeters ?? 0,
                            )) *
                            100 +
                          '%',
                      }"
                    ></div>
                  </div>
                  <strong>{{ number(route.totalDistanceMeters) }} m</strong>
                </div>
                <div
                  v-if="route.conventionalDistanceMeters !== null"
                  class="bar-row"
                >
                  <span class="bar-label">Convencional</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill conv"
                      :style="{
                        width:
                          (route.conventionalDistanceMeters /
                            Math.max(
                              1,
                              route.totalDistanceMeters,
                              route.conventionalDistanceMeters,
                            )) *
                            100 +
                          '%',
                      }"
                    ></div>
                  </div>
                  <strong
                    >{{ number(route.conventionalDistanceMeters) }} m</strong
                  >
                </div>
                <small
                  >Mesmo grafo; referência convencional segue a ordem dos itens
                  do pedido.</small
                >
              </div>
            </section>
            <section v-if="page === 'map'" class="card">
              <div class="card-head"><h2>Consulta de Endereços</h2></div>
              <div class="pad">
                <p class="muted">
                  Clique em uma posição da planta ou escolha um produto.
                </p>
                <template v-if="focusNode"
                  ><h3>
                    {{ nodeFor(focusNode).code }}
                  </h3>
                  <p>
                    {{ nodeFor(focusNode).label }}
                  </p>
                  <div
                    v-for="p in focusedProducts"
                    :key="p.id"
                    class="list-row"
                  >
                    <div>
                      <strong>{{ p.name }}</strong
                      ><small
                        >{{ p.sku }} · {{ p.stockQuantity }} un. ·
                        {{ p.isActive ? "Ativo" : "Inativo" }}</small
                      >
                    </div>
                  </div>
                  <p v-if="!focusedProducts.length" class="muted">
                    Nenhum produto neste ponto.
                  </p></template
                >
                <h3>Produtos endereçados</h3>
                <button
                  v-for="p in products"
                  :key="p.id"
                  class="address-item"
                  @click="focusNode = p.warehouseNodeId"
                >
                  <strong>{{ p.name }}</strong
                  ><small
                    >{{ p.warehouseNode.code }} ·
                    {{ p.stockQuantity }} un.</small
                  >
                </button>
              </div>
            </section>
            <section v-else-if="selected" class="card">
              <div class="card-head">
                <h2>
                  {{
                    collection ? "Coleta em andamento" : "Sequência de coleta"
                  }}
                </h2>
              </div>
              <div class="pad">
                <p v-if="selected.code.startsWith('DEMO-')" class="notice">
                  Pedido de demonstração da base Telecontrol.
                </p>
                <template v-if="route"
                  ><p
                    v-if="['INVALIDATED', 'SUPERSEDED'].includes(route.status)"
                    class="notice error"
                  >
                    Rota histórica sem validade para iniciar coleta. Calcule
                    novamente.
                  </p>
                  <div class="route-distance">
                    <strong>{{ number(route.totalDistanceMeters) }}</strong>
                    metros
                  </div>
                  <p class="muted">Dijkstra + Vizinho Mais Próximo</p>
                  <div
                    v-if="route.conventionalDistanceMeters !== null"
                    class="comparison"
                  >
                    <span
                      >Rota convencional:
                      <strong
                        >{{
                          number(route.conventionalDistanceMeters)
                        }}
                        m</strong
                      ></span
                    ><span
                      >Diferença:
                      <strong
                        >{{
                          number(
                            route.conventionalDistanceMeters -
                              route.totalDistanceMeters,
                          )
                        }}
                        m</strong
                      ></span
                    ><small
                      >Referência: ordem dos itens do pedido no mesmo grafo. A
                      heurística não garante ganho em todos os pedidos.</small
                    >
                  </div>
                  <p v-else class="muted">
                    A API não disponibiliza a métrica de percurso convencional.
                  </p></template
                >
                <p v-else class="empty">
                  Calcule a rota para visualizar a sequência.
                </p>
                <template v-if="collection"
                  ><label
                    >Progresso · {{ progress }}%<progress
                      :value="collected"
                      :max="required || 1"
                    ></progress
                  ></label>
                  <p>
                    {{ collected }} de {{ required }} unidades confirmadas
                  </p></template
                >
                <ol class="stop-list">
                  <li
                    v-for="item in selectedItems"
                    :key="item.id"
                    :data-sequence="stopForItem(item.id)?.sequence ?? '•'"
                    :class="{
                      done: item.collectedQuantity === item.requestedQuantity,
                    }"
                  >
                    <div>
                      <strong>{{ item.productNameSnapshot }}</strong
                      ><small
                        >{{ item.productSkuSnapshot }} ·
                        {{
                          stopForItem(item.id)?.warehouseNode.code ??
                          item.product.warehouseNode.code
                        }}</small
                      >
                      <p>
                        {{ item.collectedQuantity }} /
                        {{ item.requestedQuantity }} unidades
                      </p>
                    </div>
                    <button
                      v-if="
                        collection &&
                        item.collectedQuantity < item.requestedQuantity
                      "
                      class="btn light"
                      :disabled="busy"
                      @click="confirmItem(item.id)"
                    >
                      Confirmar
                      {{
                        item.requestedQuantity - item.collectedQuantity
                      }}</button
                    ><span
                      v-else-if="
                        item.collectedQuantity === item.requestedQuantity
                      "
                      class="badge COMPLETED"
                      >Coletado</span
                    >
                  </li>
                </ol>
                <button
                  v-if="collection"
                  class="btn primary full"
                  :disabled="busy || collected !== required || !required"
                  @click="finish"
                >
                  Concluir coleta
                </button>
              </div>
            </section>
            <section v-else class="card empty">
              Selecione ou crie um pedido para planejar a coleta.
            </section>
          </div></template
        >
        <template v-if="page === 'history'"
          ><section class="card">
            <div class="card-head">
              <h2>Pedidos encerrados</h2>
              <label
                >Buscar no histórico<input
                  v-model="historySearch"
                  type="search"
                  placeholder="Código do pedido"
              /></label>
              <span class="muted">{{ history.length }} registros</span
              ><button
                class="btn light"
                :disabled="!history.length"
                @click="exportHistory"
              >
                Exportar CSV
              </button>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Situação</th>
                    <th>Distância</th>
                    <th>Convencional</th>
                    <th>Duração</th>
                    <th>Coleta concluída em</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in history" :key="o.collectionId">
                    <td>
                      <strong>{{ o.order.code }}</strong>
                    </td>
                    <td>
                      <span class="badge COMPLETED">{{
                        labels.COMPLETED
                      }}</span>
                    </td>
                    <td>
                      {{
                        routesByOrder[o.order.id]
                          ? number(routesByOrder[o.order.id].totalDistanceMeters) + " m"
                          : "—"
                      }}
                    </td>
                    <td>
                      {{
                        routesByOrder[o.order.id]?.conventionalDistanceMeters != null
                          ? number(routesByOrder[o.order.id].conventionalDistanceMeters!) +
                            " m"
                          : "—"
                      }}
                    </td>
                    <td>
                      {{ duration(Date.parse(o.completedAt) - Date.parse(o.startedAt)) }}
                    </td>
                    <td>
                      {{ date(o.completedAt) }}
                    </td>
                    <td>
                      <button class="btn light" @click="openHistoryEntry(o)">
                        Ver percurso
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!history.length" class="empty">
                As coletas concluídas aparecerão aqui.
              </p>
            </div>
          </section></template
        >
        <footer>
          SmartPick · Telecontrol
          <span>Pedidos, estoque e coletas persistidos no servidor</span>
        </footer>
      </main>
    </div>
  </div>
</template>
