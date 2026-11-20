<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api, type Product, type Order, type Warehouse } from "./services/api";
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
  warehouse = ref<Warehouse>({ nodes: [], edges: [] });
const selectedId = ref(""),
  search = ref(""),
  statusFilter = ref("");
const selected = computed(() =>
  orders.value.find((o) => o.id === selectedId.value),
);
const route = computed(
  () =>
    selected.value?.routes.find((r) =>
      ["CALCULATED", "IN_USE", "COMPLETED"].includes(r.status),
    ) ?? selected.value?.routes[0],
);
const collection = computed(() =>
  selected.value?.collections.find((c) => c.status === "IN_PROGRESS"),
);
const stopForItem = (id: string) =>
  route.value?.stops.find((stop) =>
    stop.items.some((item) => item.orderItemId === id),
  );
const pending = computed(() =>
  orders.value.filter((o) => ["PENDING", "ROUTED"].includes(o.status)),
);
const active = computed(() =>
  orders.value.filter((o) => o.status === "COLLECTING"),
);
const historySearch = ref("");
const history = computed(() =>
  orders.value.filter(
    (o) =>
      ["COMPLETED", "CANCELLED"].includes(o.status) &&
      o.code.toLowerCase().includes(historySearch.value.toLowerCase()),
  ),
);
const filteredProducts = computed(() =>
  products.value.filter(
    (p) =>
      (!positionFilter.value || p.warehouseNodeId === positionFilter.value) &&
      `${p.sku} ${p.name} ${p.warehouseNode.code}`
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
const confirmation = ref(false),
  dark = ref(false);
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.dataset.theme = dark.value ? "dark" : "light";
}
async function refresh() {
  const [p, o] = await Promise.all([
    api.products(),
    api.orders(),
  ]);
  products.value = p;
  orders.value = o;
  if (!selected.value)
    selectedId.value =
      o.find((x) => x.status === "COLLECTING")?.id ?? o[0]?.id ?? "";
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
  confirmation.value = false;
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
    await api.saveProduct(
      {
        ...productDraft.value,
        category: productDraft.value.category.trim() || undefined,
      },
      editingId.value || undefined,
    );
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
    await api.calculate(selectedId.value);
    await refresh();
  }, "Rota calculada e salva.");
const start = () =>
  perform(async () => {
    await api.start(selectedId.value);
    await refresh();
    page.value = "active";
  }, "Coleta iniciada.");
const confirmItem = (id: string) =>
  perform(async () => {
    const c = collection.value!;
    const i = c.items.find((i) => i.orderItemId === id)!;
    await api.collect(c.id, i.id, i.requestedQuantity);
    await refresh();
  }, "Quantidade confirmada.");
const finish = () =>
  perform(async () => {
    await api.complete(collection.value!.id);
    await refresh();
    page.value = "history";
  }, "Coleta concluída e registrada no histórico.");
const cancel = () =>
  perform(async () => {
    await api.cancel(selectedId.value);
    confirmation.value = false;
    await refresh();
  }, "Pedido cancelado. Quantidades já coletadas foram preservadas.");
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
const totals = computed(() =>
  orders.value
    .filter((o) => o.status === "COMPLETED")
    .reduce(
      (v, o) => {
        const c = o.collections.find((c) => c.status === "COMPLETED");
        const r = o.routes.find((r) => r.id === c?.routeId);
        if (r?.conventionalDistanceMeters != null) {
          v.conventional += r.conventionalDistanceMeters;
          v.smart += r.totalDistanceMeters;
        }
        return v;
      },
      { conventional: 0, smart: 0 },
    ),
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
  const rows = history.value.map((o) => {
    const c =
      o.collections.find((c) => c.status === "COMPLETED") ?? o.collections[0];
    const r = o.routes.find((r) => r.id === c?.routeId) ?? o.routes[0];
    return [
      o.code,
      labels[o.status],
      o.items.length,
      r?.totalDistanceMeters,
      r?.conventionalDistanceMeters,
      c?.completedAt,
      c?.completedAt
        ? duration(Date.parse(c.completedAt) - Date.parse(c.startedAt))
        : "",
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
    !confirmation.value &&
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
              @click="
                page = t[0];
                confirmation = false;
              "
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
              ><strong class="kpi-val" :style="{ color: 'var(--green)' }">{{
                totals.conventional
                  ? number(
                      ((totals.conventional - totals.smart) /
                        totals.conventional) *
                        100,
                    ) + "%"
                  : "—"
              }}</strong
              ><span class="kpi-sub"
                >{{ number(totals.conventional - totals.smart) }} m economizados
                nas coletas concluídas</span
              >
            </div>
          </div>
          <div class="split-layout">
            <section class="card">
              <div class="card-head">
                <div>
                  <h2>Carteira de Pedidos de Separação</h2>
                  <p class="muted">
                    Comparativo entre percurso convencional e rota otimizada
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
                          o.routes?.[0]
                            ? number(o.routes[0].totalDistanceMeters) + " m"
                            : "—"
                        }}
                      </td>
                      <td class="mono">
                        {{
                          o.routes?.[0]?.conventionalDistanceMeters != null
                            ? number(o.routes![0].conventionalDistanceMeters!) +
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
                <WarehouseMap
                  :warehouse="warehouse"
                  :route="route"
                  :products="products"
                  mini
                  @select="locate"
                />
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
                          :disabled="busy"
                          @click="editProduct(p)"
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
                          min="0"
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
                        >Posição<select
                          aria-label="Posição"
                          v-model="productDraft.warehouseNodeId"
                          required
                        >
                          <option value="" disabled>Selecione</option>
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
                      ><label class="checkbox"
                        ><input
                          v-model="productDraft.isActive"
                          type="checkbox"
                        />
                        Produto ativo</label
                      >
                    </div>
                    <p class="muted">
                      Alterações invalidam rotas pendentes que utilizam este
                      produto.
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
                @change="confirmation = false"
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
              ><button
                v-if="
                  ['PENDING', 'ROUTED', 'COLLECTING'].includes(selected.status)
                "
                class="btn danger"
                :disabled="busy"
                @click="confirmation = true"
              >
                Cancelar pedido
              </button>
            </div>
          </section>
          <div v-if="confirmation" class="notice error">
            Cancelar {{ selected?.code }}? Os itens já coletados e a baixa de
            estoque serão preservados.
            <div class="actions">
              <button class="btn danger" :disabled="busy" @click="cancel">
                Confirmar cancelamento</button
              ><button
                class="btn light"
                :disabled="busy"
                @click="confirmation = false"
              >
                Voltar
              </button>
            </div>
          </div>
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
              <WarehouseMap
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
                    {{ warehouse.nodes.find((n) => n.id === focusNode)?.code }}
                  </h3>
                  <p>
                    {{ warehouse.nodes.find((n) => n.id === focusNode)?.label }}
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
                    Não existe rota convencional para a ordem dos itens neste
                    grafo dirigido.
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
                  <tr v-for="o in history" :key="o.id">
                    <td>
                      <strong>{{ o.code }}</strong>
                    </td>
                    <td>
                      <span :class="['badge', o.status]">{{
                        labels[o.status]
                      }}</span>
                    </td>
                    <td>
                      {{
                        o.routes[0]
                          ? number(o.routes[0].totalDistanceMeters) + " m"
                          : "—"
                      }}
                    </td>
                    <td>
                      {{
                        o.routes[0]?.conventionalDistanceMeters != null
                          ? number(o.routes[0].conventionalDistanceMeters) +
                            " m"
                          : "—"
                      }}
                    </td>
                    <td>
                      {{
                        o.collections[0]?.completedAt
                          ? duration(
                              Date.parse(o.collections[0].completedAt) -
                                Date.parse(o.collections[0].startedAt),
                            )
                          : "—"
                      }}
                    </td>
                    <td>
                      {{
                        o.collections[0]?.completedAt
                          ? date(o.collections[0].completedAt)
                          : "—"
                      }}
                    </td>
                    <td>
                      <button class="btn light" @click="openOrder(o)">
                        Ver percurso
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!history.length" class="empty">
                As coletas concluídas e os pedidos cancelados aparecerão aqui.
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
