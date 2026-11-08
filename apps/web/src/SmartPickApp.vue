<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, type Product, type Order, type Warehouse } from "./services/api";
import WarehouseMap from "./components/WarehouseMap.vue";
import AppDialog from "./components/AppDialog.vue";
const tabs = [
  ["dashboard", "Painel operacional"],
  ["products", "Catálogo de produtos"],
  ["orders", "Pedidos de coleta"],
  ["route", "Roteirização"],
  ["active", "Execução de coleta"],
  ["map", "Planta do armazém"],
  ["history", "Histórico de coletas"],
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
const history = computed(() =>
  orders.value.filter((o) => ["COMPLETED", "CANCELLED"].includes(o.status)),
);
const filteredProducts = computed(() =>
  products.value.filter((p) =>
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
const productForm = ref(false),
  editingId = ref("");
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
const orderForm = ref(false),
  orderCode = ref(""),
  quantities = ref<Record<string, number>>({});
const confirmation = ref(false),
  dark = ref(false);
function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.dataset.theme = dark.value ? "dark" : "light";
}
async function refresh() {
  const [p, o, w] = await Promise.all([
    api.products(),
    api.orders(),
    api.warehouse(),
  ]);
  products.value = p;
  orders.value = o;
  warehouse.value = w;
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
  productForm.value = true;
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
    productForm.value = false;
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
    orderForm.value = false;
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
onMounted(() => perform(refresh));
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="page = 'dashboard'"
        ><span class="brand-mark">S</span
        ><span>SmartPick<small>TELECONTROL</small></span></a
      >
      <div class="nav-label">GESTÃO DE COLETAS</div>
      <nav aria-label="Navegação principal">
        <button
          v-for="(t, i) in tabs"
          :key="t[0]"
          :class="['nav-button', { selected: page === t[0] }]"
          :aria-current="page === t[0] ? 'page' : undefined"
          @click="
            page = t[0];
            confirmation = false;
          "
        >
          <span class="nav-number">{{ String(i + 1).padStart(2, "0") }}</span
          >{{ t[1] }}
        </button>
      </nav>
      <div class="sidebar-bottom">
        ● Ambiente local<small>Otimização de rotas de coleta</small>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <span
          >Operação <span class="muted">/ {{ title }}</span></span
        ><button class="btn" @click="toggleTheme">
          {{ dark ? "Tema claro" : "Tema escuro" }}
        </button>
      </header>
      <main :aria-busy="busy">
        <div class="page-heading">
          <div>
            <p class="eyebrow">SMARTPICK · ARMAZÉM</p>
            <h1>{{ title }}</h1>
            <p class="muted">
              Acompanhe pedidos, rotas e o progresso das coletas.
            </p>
          </div>
          <button class="btn" :disabled="busy" @click="perform(refresh)">
            Atualizar dados
          </button>
        </div>
        <div v-if="busy" class="notice" role="status">
          Processando… Aguarde a confirmação.
        </div>
        <div v-if="error" class="notice error" role="alert">{{ error }}</div>
        <div v-if="notice" class="notice success" role="status">
          {{ notice }}
        </div>
        <template v-if="page === 'dashboard'"
          ><div class="kpi-grid">
            <button
              class="kpi"
              @click="
                page = 'orders';
                statusFilter = '';
              "
            >
              <span>Pedidos aguardando</span
              ><strong>{{ pending.length }}</strong
              ><small>Prontos para planejar a coleta</small></button
            ><button class="kpi" @click="page = 'active'">
              <span>Coletas em andamento</span
              ><strong>{{ active.length }}</strong
              ><small>Execução confirmada no servidor</small></button
            ><button class="kpi" @click="page = 'history'">
              <span>Pedidos concluídos</span
              ><strong>{{
                orders.filter((o) => o.status === "COMPLETED").length
              }}</strong
              ><small>Histórico da operação</small></button
            ><button class="kpi" @click="page = 'products'">
              <span>Produtos ativos</span
              ><strong>{{ products.filter((p) => p.isActive).length }}</strong
              ><small>Catálogo do armazém</small>
            </button>
          </div>
          <section class="panel">
            <div class="panel-heading">
              <h2>Fila de pedidos</h2>
              <button
                class="btn primary"
                @click="
                  page = 'orders';
                  orderForm = true;
                "
              >
                Novo pedido
              </button>
            </div>
            <p v-if="!pending.length" class="empty">
              Nenhum pedido aguardando coleta.
            </p>
            <div v-for="o in pending" :key="o.id" class="list-row">
              <div>
                <strong>{{ o.code }}</strong>
                <p class="muted">
                  {{ o.items.length }} produtos · {{ date(o.createdAt) }}
                </p>
              </div>
              <span :class="['badge', o.status]">{{ labels[o.status] }}</span
              ><button class="btn" :disabled="busy" @click="openOrder(o)">
                Planejar coleta →
              </button>
            </div>
          </section></template
        >
        <template v-if="page === 'products'"
          ><section class="panel">
            <div class="panel-heading">
              <label class="search"
                >Buscar produto<input
                  v-model="search"
                  placeholder="SKU, nome ou posição"
                  type="search" /></label
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
                    <td>{{ p.warehouseNode.code }}</td>
                    <td>{{ p.stockQuantity }}</td>
                    <td>{{ number(p.weightKg) }} kg</td>
                    <td>{{ p.isActive ? "Ativo" : "Inativo" }}</td>
                    <td>
                      <button
                        class="btn"
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
          </section></template
        >
        <template v-if="page === 'orders'"
          ><section class="panel">
            <div class="panel-heading">
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
                @click="orderForm = true"
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
                        class="btn"
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
          </section></template
        >
        <template v-if="['route', 'active', 'map'].includes(page)"
          ><section class="panel selector">
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
                class="btn"
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
                class="btn"
                :disabled="busy"
                @click="confirmation = false"
              >
                Voltar
              </button>
            </div>
          </div>
          <div class="workspace-grid">
            <section class="panel">
              <div class="panel-heading">
                <h2>Planta 2D do armazém</h2>
                <span class="badge">{{ warehouse.nodes.length }} pontos</span>
              </div>
              <WarehouseMap :warehouse="warehouse" :route="route" />
            </section>
            <section v-if="selected" class="panel">
              <div class="panel-heading">
                <h2>
                  {{
                    collection ? "Coleta em andamento" : "Sequência de coleta"
                  }}
                </h2>
              </div>
              <div class="panel-body">
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
                      class="btn"
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
            <section v-else class="panel empty">
              Selecione ou crie um pedido para planejar a coleta.
            </section>
          </div></template
        >
        <template v-if="page === 'history'"
          ><section class="panel">
            <div class="panel-heading">
              <h2>Pedidos encerrados</h2>
              <span class="muted">{{ history.length }} registros</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Situação</th>
                    <th>Distância</th>
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
                        o.collections[0]?.completedAt
                          ? date(o.collections[0].completedAt)
                          : "—"
                      }}
                    </td>
                    <td>
                      <button class="btn" @click="openOrder(o)">
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
    <AppDialog
      v-if="productForm"
      labelledby="product-title"
      :busy="busy"
      @close="productForm = false"
    >
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
              ><input v-model="productDraft.isActive" type="checkbox" /> Produto
              ativo</label
            >
          </div>
          <p class="muted">
            Alterações invalidam rotas pendentes que utilizam este produto.
          </p>
          <p v-if="error" role="alert" class="error">{{ error }}</p>
          <div class="actions">
            <button type="button" class="btn" @click="productForm = false">
              Voltar</button
            ><button class="btn primary">Salvar produto</button>
          </div>
        </fieldset>
      </form>
    </AppDialog>
    <AppDialog
      v-if="orderForm"
      labelledby="order-title"
      :busy="busy"
      @close="orderForm = false"
    >
      <h2 id="order-title">Novo pedido de coleta</h2>
      <form @submit.prevent="createOrder">
        <fieldset :disabled="busy">
          <label
            >Código do pedido<input
              v-model="orderCode"
              required
              maxlength="50"
              placeholder="Ex.: PED-001"
          /></label>
          <p class="muted">Informe as quantidades dos produtos desejados.</p>
          <div class="order-draft">
            <label
              v-for="p in products.filter((p) => p.isActive)"
              :key="p.id"
              class="draft-row"
              ><span
                >{{ p.name
                }}<small
                  >{{ p.sku }} · {{ p.stockQuantity }} em estoque</small
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
            <button type="button" class="btn" @click="orderForm = false">
              Voltar</button
            ><button class="btn primary">Criar pedido</button>
          </div>
        </fieldset>
      </form>
    </AppDialog>
  </div>
</template>
