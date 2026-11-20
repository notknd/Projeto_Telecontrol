<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Product = { id: string; sku: string; name: string; stockQuantity: number; isActive: boolean };
type OrderItem = { id: string; productId: string; requestedQuantity: number; collectedQuantity: number; productSkuSnapshot: string; productNameSnapshot: string };
type Order = { id: string; code: string; status: string; createdAt: string; items: OrderItem[] };
type Route = { id: string; status: string; pathNodeIds: string[]; stops: Array<{ nodeId: string; sequence: number; productIds: string[] }>; totalDistanceMeters: number; distanceUnit: string; algorithm: string };
type Collection = { id: string; status: string; items: Array<{ id: string; orderItemId: string; requestedQuantity: number; collectedQuantity: number }> };

const products = ref<Product[]>([]);
const orders = ref<Order[]>([]);
const selectedOrderId = ref('');
const route = ref<Route | null>(null);
const collection = ref<Collection | null>(null);
const history = ref<Array<{ collectionId: string; order: { code: string }; completedAt: string; collectedQuantity: number }>>([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const selectedOrder = computed(() => orders.value.find((order) => order.id === selectedOrderId.value) ?? null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? `Falha na API (${response.status}).`);
  return body as T;
}

async function refresh() {
  loading.value = true; error.value = '';
  try {
    const [productResult, orderResult, historyResult] = await Promise.all([
      api<{ products: Product[] }>('/products'), api<{ orders: Order[] }>('/orders'), api<{ collections: typeof history.value }>('/collections/history'),
    ]);
    products.value = productResult.products;
    orders.value = orderResult.orders;
    history.value = historyResult.collections;
    if (!orders.value.some((order) => order.id === selectedOrderId.value)) selectedOrderId.value = orders.value[0]?.id ?? '';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os dados.'; }
  finally { loading.value = false; }
}

async function startCollection() {
  if (!selectedOrder.value || !route.value) return;
  loading.value = true; error.value = '';
  try {
    const result = await api<{ collection: Collection }>('/collections', { method: 'POST', body: JSON.stringify({ orderId: selectedOrder.value.id, routeId: route.value.id }) });
    collection.value = result.collection;
    notice.value = 'Coleta iniciada.';
    await refresh();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível iniciar a coleta.'; }
  finally { loading.value = false; }
}

async function collectItem(item: Collection['items'][number]) {
  if (!collection.value) return;
  loading.value = true; error.value = '';
  try {
    await api(`/collections/${collection.value.id}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ collectedQuantity: item.requestedQuantity }) });
    const result = await api<{ collection: Collection }>(`/collections/${collection.value.id}`);
    collection.value = result.collection;
    notice.value = result.collection.status === 'COMPLETED' ? 'Coleta concluída e estoque atualizado.' : 'Quantidade registrada.';
    await refresh();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível registrar a coleta.'; }
  finally { loading.value = false; }
}

async function calculateRoute() {
  if (!selectedOrder.value) return;
  loading.value = true; error.value = ''; notice.value = ''; route.value = null;
  try {
    const result = await api<{ orderId: string; route: Route }>('/routes/calculate', {
      method: 'POST', body: JSON.stringify({ orderId: selectedOrder.value.id }),
    });
    route.value = result.route;
    await refresh();
    notice.value = 'Rota calculada pelo motor usando Dijkstra e a estratégia nearest_neighbor.';
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível calcular a rota.'; }
  finally { loading.value = false; }
}

onMounted(refresh);
</script>

<template>
  <main class="page">
    <header><div><p class="eyebrow">SMARTPICK · INTEGRAÇÃO LOCAL</p><h1>Pedidos e roteirização</h1><p>Interface conectada às APIs atualmente integradas em <code>main</code>.</p></div><button @click="refresh" :disabled="loading">{{ loading ? 'Carregando…' : 'Atualizar dados' }}</button></header>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <p v-if="notice" class="message success">{{ notice }}</p>
    <section class="grid">
      <article class="card"><h2>Produtos</h2><p class="muted">{{ products.length }} cadastrados</p><ul><li v-for="product in products" :key="product.id"><span><strong>{{ product.name }}</strong><small>{{ product.sku }}</small></span><span>{{ product.stockQuantity }} un.</span></li></ul></article>
      <article class="card"><h2>Pedidos</h2><p class="muted">{{ orders.length }} cadastrados</p><label>Selecione um pedido<select v-model="selectedOrderId" @change="route = null"><option v-for="order in orders" :key="order.id" :value="order.id">{{ order.code }} · {{ order.status }}</option></select></label>
        <template v-if="selectedOrder"><h3>Itens do pedido</h3><ul><li v-for="item in selectedOrder.items" :key="item.id"><span>{{ item.productNameSnapshot }}<small>{{ item.productSkuSnapshot }}</small></span><span>{{ item.requestedQuantity }} un.</span></li></ul><button class="primary" :disabled="loading || !selectedOrder.items.length" @click="calculateRoute">{{ loading ? 'Calculando…' : 'Calcular rota' }}</button></template>
        <p v-else class="muted">Nenhum pedido disponível. Confira se a API foi iniciada e se a seed foi aplicada.</p>
      </article>
    </section>
    <section v-if="route" class="card result"><h2>Resultado da rota</h2><div class="distance">{{ route.totalDistanceMeters }} {{ route.distanceUnit }}</div><p>Algoritmo: {{ route.algorithm }}</p><h3>Sequência percorrida</h3><ol><li v-for="(nodeId, index) in route.pathNodeIds" :key="`${index}-${nodeId}`">{{ nodeId }} <small v-if="route.stops.some(stop => stop.nodeId === nodeId)">· parada de coleta</small></li></ol><button v-if="selectedOrder?.status === 'ROUTED'" class="primary" :disabled="loading" @click="startCollection">Iniciar coleta</button></section>
    <section v-if="collection" class="card result"><h2>Coleta {{ collection.status === 'COMPLETED' ? 'concluída' : 'em andamento' }}</h2><ul><li v-for="item in collection.items" :key="item.id"><span>Item {{ item.orderItemId.slice(0, 8) }}<small>{{ item.collectedQuantity }}/{{ item.requestedQuantity }} coletados</small></span><button v-if="item.collectedQuantity < item.requestedQuantity" :disabled="loading" @click="collectItem(item)">Registrar quantidade completa</button><span v-else>Coletado</span></li></ul></section>
    <section class="card result"><h2>Histórico de coletas</h2><p v-if="!history.length" class="muted">Ainda não há coletas concluídas.</p><ul><li v-for="entry in history" :key="entry.collectionId"><span>{{ entry.order.code }}</span><span>{{ new Date(entry.completedAt).toLocaleString('pt-BR') }} · {{ entry.collectedQuantity }} un.</span></li></ul></section>
    <footer>Esta tela usa as rotas do backend para produtos, pedidos, cálculo, coleta e histórico. A visualização 2D ainda não é fornecida pela API atual.</footer>
  </main>
</template>

<style>
:root{font-family:Inter,system-ui,sans-serif;color:#17231f;background:#f3f6f4;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.page{max-width:1100px;margin:auto;padding:42px 24px}header{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:28px}h1{font-size:clamp(28px,4vw,42px);margin:8px 0}h2{margin-top:0}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#287c5a}button,select{font:inherit}button{border:1px solid #cbd6d0;border-radius:8px;padding:11px 16px;background:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.primary{background:#18794e;color:white;border:0;margin-top:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{background:white;border:1px solid #e0e8e3;border-radius:12px;padding:24px;box-shadow:0 5px 18px #173a2410}.muted,small{color:#687770}.card ul{list-style:none;padding:0;margin:18px 0}.card li{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #edf1ee}.card li span:first-child{display:grid;gap:4px}label{display:grid;gap:8px;margin-top:16px}select{padding:12px;border:1px solid #cbd6d0;border-radius:8px;background:white}.message{padding:14px;border-radius:8px}.error{background:#fff0ed;color:#9b2c16}.success{background:#e9f7ef;color:#17633f}.result{margin-top:18px}.distance{font-size:36px;font-weight:800;color:#18794e}ol{line-height:1.9}footer{padding:26px 4px;color:#687770;font-size:14px}@media(max-width:720px){.page{padding:24px 16px}header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}
</style>
