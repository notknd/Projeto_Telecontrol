<script setup lang="ts">
import { computed, ref, useId, watch, onMounted, onUnmounted } from "vue";
import { api, type Warehouse, type Route, type Product } from "../services/api";
const props = withDefaults(
  defineProps<{
    warehouse: Warehouse;
    route?: Route;
    products?: Product[];
    mini?: boolean;
    basic?: boolean;
    overview?: boolean;
    warehouseName?: string;
    focusNode?: string;
    nextNode?: string;
    doneNodes?: string[];
  }>(),
  { products: () => [], doneNodes: () => [] },
);
const emit = defineEmits<{ select: [id: string] }>();
const storageNodes = computed(() => props.warehouse.nodes.filter(n => n.type === 'STORAGE'));
const fit = ref(true);
const bounds = computed(() => {
  const nodes = props.warehouse.nodes;
  const minX = Math.min(0, ...nodes.map(n => n.x)), minY = Math.min(0, ...nodes.map(n => n.y));
  return { minX, minY, width: Math.max(860, (Math.max(minX, ...nodes.map(n => n.x)) - minX) * 44 + 200), height: Math.max(490, (Math.max(minY, ...nodes.map(n => n.y)) - minY) * 44 + 240) };
});
const productsAt = (id: string) => props.products.filter(p => p.warehouseNodeId === id);
const uid = useId().replace(/:/g, "");
const labels = ref(true),
  smart = ref(true),
  conventional = ref(false),
  perspective = ref(false),
  zoom = ref(1),
  simulating = ref(false);
const origin = ref(""),
  destination = ref(""),
  query = ref<{ pathNodeIds: string[]; distanceMeters: number } | null>(null),
  queryError = ref(""),
  loading = ref(false);
const traveled = ref(0);
const previewVisible = ref(false);
const reducedMotion = ref(false);
let frame = 0;
let lastTime = 0;
let motionPreference: MediaQueryList | undefined;
const routePoints = computed(() => (props.route?.steps ?? []).map(step => points.value.get(step.warehouseNodeId)));
const segments = computed(() => {
  const result: { start: number; length: number; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  let start = 0;
  for (let i = 1; i < routePoints.value.length; i++) {
    const from = routePoints.value[i - 1], to = routePoints.value[i];
    if (!from || !to) return [];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    result.push({ start, length, from, to });
    start += length;
  }
  return result;
});
const totalLength = computed(() => segments.value.reduce((sum, segment) => sum + segment.length, 0));
const previewPercent = computed(() => totalLength.value ? Math.round(traveled.value / totalLength.value * 100) : 0);
function pauseSimulation() {
  cancelAnimationFrame(frame);
  simulating.value = false;
  lastTime = 0;
}
function stopSimulation() {
  pauseSimulation();
  traveled.value = 0;
  previewVisible.value = false;
}
function animate(time: number) {
  if (!simulating.value) return;
  if (lastTime) traveled.value = Math.min(totalLength.value, traveled.value + Math.min(time - lastTime, 80) * 0.09);
  lastTime = time;
  if (traveled.value >= totalLength.value) { pauseSimulation(); return; }
  frame = requestAnimationFrame(animate);
}
function simulate() {
  if (simulating.value) { pauseSimulation(); return; }
  if (!totalLength.value) return;
  if (reducedMotion.value) { nextPoint(); return; }
  if (traveled.value >= totalLength.value) traveled.value = 0;
  smart.value = true;
  previewVisible.value = true;
  simulating.value = true;
  frame = requestAnimationFrame(animate);
}
function seek(value: number) {
  pauseSimulation(); smart.value = true; previewVisible.value = true;
  traveled.value = Math.max(0, Math.min(totalLength.value, value));
}
function nextPoint() {
  const next = segments.value.find(s => s.start + s.length > traveled.value + 0.1);
  seek(next ? next.start + next.length : 0);
}
const currentNodeId = computed(() => {
  const index = segments.value.findIndex(s => traveled.value < s.start + s.length - 0.1);
  return props.route?.steps[index < 0 ? (props.route?.steps.length ?? 1) - 1 : index]?.warehouseNodeId;
});
const currentNode = computed(() => props.warehouse.nodes.find(n => n.id === currentNodeId.value));
const itinerary = computed(() => (props.route?.steps ?? []).flatMap((step, index) => {
  const node = props.warehouse.nodes.find(n => n.id === step.warehouseNodeId);
  const routeStop = props.route?.stops.find(stop => stop.warehouseNodeId === step.warehouseNodeId);
  if (!node || (!routeStop && node.type !== 'ENTRY' && node.type !== 'EXIT')) return [];
  return [{ id: step.warehouseNodeId, index, number: routeStop?.sequence, distance: index ? (segments.value[index - 1]?.start ?? 0) + (segments.value[index - 1]?.length ?? 0) : 0 }];
}));
const nodeName = (id: string) => {
  const n = props.warehouse.nodes.find(n => n.id === id);
  return n?.type === 'ENTRY' ? 'Entrada' : n?.type === 'EXIT' ? 'Saída' : n?.code.replace('STORAGE-', '').replace('AISLE-', '').replace('CROSS-', 'Cruz. ') ?? id;
};
function updateMotionPreference() {
  reducedMotion.value = motionPreference?.matches ?? false;
  if (reducedMotion.value) pauseSimulation();
}
watch(() => [props.route, props.warehouse], stopSimulation);
watch(smart, value => { if (!value) pauseSimulation(); });
watch(() => props.overview, value => { smart.value = !value; stopSimulation(); }, { immediate: true });
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotionPreference();
  motionPreference.addEventListener('change', updateMotionPreference);
});
onUnmounted(() => { stopSimulation(); motionPreference?.removeEventListener('change', updateMotionPreference); });
watch([origin, destination], () => {
  query.value = null;
  queryError.value = "";
});
async function measure() {
  if (loading.value) return;
  loading.value = true;
  queryError.value = "";
  query.value = null;
  const from = origin.value,
    to = destination.value;
  try {
    const result = await api.distance(from, to);
    if (from === origin.value && to === destination.value) query.value = result;
  } catch (e) {
    queryError.value =
      e instanceof Error ? e.message : "Falha ao consultar distância.";
  } finally {
    loading.value = false;
  }
}
const points = computed(() => {
  const ns = props.warehouse.nodes;
  if (!ns.length) return new Map<string, { x: number; y: number }>();
  return new Map(
    ns.map((n) => [
      n.id,
      { x: 100 + (n.x - bounds.value.minX) * 44, y: 150 + (n.y - bounds.value.minY) * 44 },
    ]),
  );
});
const edges = computed(() =>
  props.warehouse.edges.filter(
    (e, i, es) =>
      points.value.has(e.fromNodeId) &&
      points.value.has(e.toNodeId) &&
      es.findIndex(
        (x) =>
          [x.fromNodeId, x.toNodeId].sort().join("|") ===
          [e.fromNodeId, e.toNodeId].sort().join("|"),
      ) === i,
  ),
);
const reverse = (e: Warehouse["edges"][number]) =>
  props.warehouse.edges.find(
    (r) => r.fromNodeId === e.toNodeId && r.toNodeId === e.fromNodeId,
  );
const path = (ids: string[]) =>
  ids
    .map((id) => points.value.get(id))
    .filter(Boolean)
    .map((p) => `${p!.x},${p!.y}`)
    .join(" ");
const stop = (id: string) =>
  props.overview && !smart.value ? undefined : props.route?.stops.find((s) => s.warehouseNodeId === id)?.sequence;
const color = (id: string, type: string) =>
  props.nextNode === id
    ? "#d97706"
    : props.doneNodes.includes(id)
      ? "#64748b"
      : stop(id)
        ? "#15803d"
        : type === "ENTRY"
          ? "#15803d"
          : type === "EXIT"
            ? "#1d4ed8"
            : "#64748b";
const simulationPoint = computed(() => {
  const segment = segments.value.find(s => traveled.value < s.start + s.length) ?? segments.value[segments.value.length - 1];
  if (!segment) return routePoints.value[0];
  const t = segment.length ? Math.min(1, (traveled.value - segment.start) / segment.length) : 1;
  return { x: segment.from.x + (segment.to.x - segment.from.x) * t, y: segment.from.y + (segment.to.y - segment.from.y) * t };
});
</script>
<template>
  <div class="warehouse-map" :class="{ mini }">
    <div v-if="!mini" class="warehouse-summary"><div><strong>{{ warehouseName || 'CD Principal' }}</strong><small>Planta do armazém · Vista superior</small></div><span>{{ storageNodes.length }} posições</span><span>{{ products.length }} produtos</span><span>{{ products.reduce((sum, p) => sum + p.stockQuantity, 0) }} un. em estoque</span></div>
    <div v-if="!mini" class="map-toolbar">
      <div class="layer-toggles">
        <button
          class="chip"
          :class="{ active: !perspective }"
          @click="perspective = false"
        >
          Planta 2D</button
        ><button
          v-if="!basic"
          class="chip"
          :class="{ active: perspective }"
          @click="perspective = true"
        >
          Perspectiva</button
        ><label class="chip"
          ><input v-model="labels" type="checkbox" /> Endereços</label
        ><label class="chip"
          ><input v-model="smart" type="checkbox" /> Rota otimizada</label
        ><label v-if="!basic && route?.conventionalPathNodeIds" class="chip"
          ><input v-model="conventional" type="checkbox" /> Convencional</label
        >
      </div>
      <div class="actions">
        <button class="btn light sm" @click="fit = !fit; zoom = 1">{{ fit ? 'Detalhar planta' : 'Visão geral' }}</button>
        <button
          class="btn light sm"
          aria-label="Diminuir mapa"
          @click="zoom = Math.max(0.6, zoom - 0.2)"
        >
          −</button
        ><button class="btn light sm" @click="zoom = 1">Centralizar</button
        ><button
          class="btn light sm"
          aria-label="Ampliar mapa"
          @click="zoom = Math.min(2, zoom + 0.2)"
        >
          +</button
        ><button
          class="btn light sm"
          :disabled="!totalLength"
          @click="simulate"
        >
          {{ reducedMotion ? 'Avançar percurso' : simulating ? 'Pausar percurso' : traveled >= totalLength && totalLength ? 'Repetir percurso' : traveled ? 'Continuar percurso' : 'Animar percurso' }}
        </button>
      </div>
    </div>
    <div class="blueprint-viewport" :class="{ fitted: fit || mini }">
      <svg
        v-if="warehouse.nodes.length"
        :viewBox="`0 0 ${bounds.width} ${bounds.height}`"
        role="group"
        aria-label="Planta do armazém: corredores, endereços e sequência de coleta"
      >
        <defs>
          <pattern
            :id="uid + 'grid'"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0H0V20"
              fill="none"
              stroke="var(--line)"
              stroke-width=".7"
            />
          </pattern>
          <marker
            :id="uid + 'direction'"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10Z" fill="#64748b" />
          </marker>
          <marker
            :id="uid + 'arrow'"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10Z" fill="#15803d" />
          </marker>
        </defs>
        <rect :width="bounds.width" :height="bounds.height" :fill="`url(#${uid}grid)`" />
        <rect x="26" y="32" :width="bounds.width - 52" :height="bounds.height - 68" rx="8" fill="none" stroke="var(--line-strong)" stroke-dasharray="5 5" />
        <text x="44" y="57" class="edge-label">ÁREA DE ARMAZENAGEM</text>
        <g
          :transform="`translate(${bounds.width / 2},${bounds.height / 2}) scale(${zoom}) translate(${-bounds.width / 2},${-bounds.height / 2})`"
        >
          <g
            :transform="
              perspective ? 'matrix(.85,-.18,.25,.7,0,120)' : undefined
            "
          >
            <g v-for="n in storageNodes" :key="'zone-' + n.id" :transform="`translate(${points.get(n.id)!.x},${points.get(n.id)!.y})`" pointer-events="none">
              <rect x="-65" y="-114" width="130" height="164" rx="6" fill="var(--primary-soft)" opacity=".6" />
              <text x="0" y="-97" text-anchor="middle" class="zone-label">ESTOQUE {{ n.code.replace('STORAGE-', '') }}</text>
            </g>
            <g v-for="n in warehouse.nodes.filter(n => ['ENTRY', 'EXIT'].includes(n.type))" :key="'dock-' + n.id" :transform="`translate(${points.get(n.id)!.x},${points.get(n.id)!.y})`" pointer-events="none">
              <rect x="-50" y="-74" width="100" height="112" rx="5" fill="var(--surface)" stroke="var(--line-strong)" />
              <path d="M-40 -64H40M-40 -56H40M-40 -48H40" stroke="var(--line-strong)" stroke-width="3" />
              <text y="-29" text-anchor="middle" class="zone-label">{{ n.type === 'ENTRY' ? 'RECEBIMENTO' : 'EXPEDIÇÃO' }}</text>
            </g>
            <g v-for="e in edges" :key="e.id">
              <line
                :x1="points.get(e.fromNodeId)!.x"
                :y1="points.get(e.fromNodeId)!.y"
                :x2="points.get(e.toNodeId)!.x"
                :y2="points.get(e.toNodeId)!.y"
                stroke="var(--line-strong)"
                stroke-width="32"
                stroke-linecap="round"
              />
              <line
                :x1="points.get(e.fromNodeId)!.x"
                :y1="points.get(e.fromNodeId)!.y"
                :x2="points.get(e.toNodeId)!.x"
                :y2="points.get(e.toNodeId)!.y"
                stroke="var(--surface-alt)"
                stroke-width="28"
                stroke-linecap="round"
              />
              <line
                :x1="
                  points.get(e.fromNodeId)!.x * 0.6 +
                  points.get(e.toNodeId)!.x * 0.4
                "
                :y1="
                  points.get(e.fromNodeId)!.y * 0.6 +
                  points.get(e.toNodeId)!.y * 0.4
                "
                :x2="
                  points.get(e.fromNodeId)!.x * 0.4 +
                  points.get(e.toNodeId)!.x * 0.6
                "
                :y2="
                  points.get(e.fromNodeId)!.y * 0.4 +
                  points.get(e.toNodeId)!.y * 0.6
                "
                stroke="#64748b"
                stroke-width="1.2"
                :marker-start="reverse(e) ? `url(#${uid}direction)` : undefined"
                :marker-end="`url(#${uid}direction)`"
              />
              <text
                v-if="labels && !mini"
                :x="
                  (points.get(e.fromNodeId)!.x + points.get(e.toNodeId)!.x) / 2
                "
                :y="
                  (points.get(e.fromNodeId)!.y + points.get(e.toNodeId)!.y) /
                    2 +
                  27
                "
                text-anchor="middle"
                class="edge-label"
              >
                {{ e.distanceMeters
                }}{{
                  reverse(e) && reverse(e)!.distanceMeters !== e.distanceMeters
                    ? " / " + reverse(e)!.distanceMeters
                    : ""
                }}
                m
              </text>
            </g>
            <polyline
              v-if="conventional && route?.conventionalPathNodeIds"
              :points="path(route.conventionalPathNodeIds)"
              fill="none"
              stroke="#d97706"
              stroke-width="9"
              stroke-dasharray="8 7"
              stroke-linejoin="round"
            />
            <polyline
              v-if="smart && route"
              :points="path(route.steps.map((s) => s.warehouseNodeId))"
              fill="none"
              stroke="#15803d"
              stroke-width="4"
              stroke-linejoin="round"
              :marker-mid="`url(#${uid}arrow)`"
              :marker-end="`url(#${uid}arrow)`"
            />
            <polyline
              v-if="query"
              :points="path(query.pathNodeIds)"
              fill="none"
              stroke="#2563eb"
              stroke-width="4"
              stroke-dasharray="4 4"
            />
            <g
              v-for="n in warehouse.nodes"
              :key="n.id"
              :transform="`translate(${points.get(n.id)!.x},${points.get(n.id)!.y})`"
              class="map-position"
              :class="{ 'is-selected': focusNode === n.id }"
              role="button"
              tabindex="0"
              :aria-pressed="focusNode === n.id"
              :aria-label="`${n.code}: ${n.label || n.type}`"
              @click="emit('select', n.id)"
              @keydown.enter.prevent="emit('select', n.id)"
              @keydown.space.prevent="emit('select', n.id)"
            >
              <title>
                {{ n.code }} · {{ n.label }} ·
                {{
                  products.filter((p) => p.warehouseNodeId === n.id).length
                }}
                produtos
              </title>
              <circle
                v-if="focusNode === n.id"
                r="30"
                fill="none"
                stroke="#2563eb"
                stroke-width="3"
                stroke-dasharray="4 3"
              />
              <template v-if="n.type === 'STORAGE'">
                <line
                  y1="-8"
                  y2="-34"
                  :stroke="color(n.id, n.type)"
                  stroke-width="2"
                />
                <rect
                  x="-53"
                  y="-81"
                  width="106"
                  height="48"
                  rx="3"
                  :fill="stop(n.id) ? color(n.id, n.type) : 'var(--surface)'"
                  :stroke="color(n.id, n.type)"
                  stroke-width="2"
                />
                <path
                  d="M-49 -58H49M-18 -77V-61M18 -77V-61"
                  :stroke="stop(n.id) ? '#ffffff88' : 'var(--line-strong)'"
                />
                <g v-for="(box, index) in (productsAt(n.id).some(p => p.stockQuantity > 0) ? [0, 1, 2] : [])" :key="box">
                  <rect :x="-45 + index * 32" y="-76" width="25" height="15" rx="1" fill="#d4aa72" stroke="#a87c46" stroke-width=".7" />
                  <path :d="`M${-33 + index * 32} -76v15`" stroke="#f1d7ad" stroke-width="3" />
                </g>
                <text
                  x="0"
                  y="-42"
                  text-anchor="middle"
                  :fill="stop(n.id) ? 'white' : 'var(--ink)'"
                  font-size="14"
                  font-weight="600"
                >
                  {{ n.code.replace("STORAGE-", "") }}
                </text>
                <circle
                  r="12"
                  :fill="color(n.id, n.type)"
                  stroke="white"
                  stroke-width="2"
                />
                <text
                  v-if="stop(n.id)"
                  y="4"
                  text-anchor="middle"
                  fill="white"
                  font-size="13"
                  font-weight="700"
                >
                  {{ stop(n.id) }}
                </text>
              </template>
              <template v-else-if="['ENTRY', 'EXIT'].includes(n.type)">
                <rect
                  x="-44"
                  y="-15"
                  width="88"
                  height="30"
                  rx="3"
                  :fill="color(n.id, n.type)"
                />
                <text
                  text-anchor="middle"
                  y="4"
                  fill="white"
                  font-size="11"
                  font-weight="700"
                >
                  {{ n.type === "ENTRY" ? "ENTRADA" : "SAÍDA" }}
                </text>
              </template>
              <template v-else>
                <circle r="5" fill="var(--line-strong)" />
                <text
                  v-if="labels"
                  text-anchor="middle"
                  y="-25"
                  class="edge-label"
                >
                  {{ n.label || n.code }}
                </text>
              </template>
              <text
                v-if="labels && n.type === 'STORAGE' && !mini"
                y="30"
                text-anchor="middle"
                class="edge-label"
              >
                {{
                  products.filter((p) => p.warehouseNodeId === n.id).length
                }}
                {{ products.filter(p => p.warehouseNodeId === n.id).length === 1 ? 'produto' : 'produtos' }}
              </text>
              <text v-if="n.type === 'STORAGE' && !mini" y="44" text-anchor="middle" class="stock-label">{{ productsAt(n.id).reduce((sum, p) => sum + p.stockQuantity, 0) }} un. disponíveis</text>
            </g>
            <g v-if="previewVisible && smart && simulationPoint" class="route-traveler" :transform="`translate(${simulationPoint.x},${simulationPoint.y})`" aria-label="Posição da animação">
              <circle r="20" fill="#2563eb" opacity=".16" />
              <circle r="12" fill="#2563eb" stroke="white" stroke-width="3" />
              <path d="M-5 -3H4L6 3H-3ZM-4 5H-3M4 5H5" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" />
            </g>
          </g>
        </g>
        <text x="24" :y="bounds.height - 25" class="edge-label">
          {{
            mini
              ? "ENTRADA → POSIÇÕES DE COLETA → SAÍDA"
              : "Selecione uma posição para ver os produtos · Traçado esquemático"
          }}
        </text>
      </svg>
      <p v-else class="empty">Nenhum layout disponível.</p>
    </div>
    <div v-if="!mini && (!overview || smart)" class="route-player">
      <template v-if="totalLength">
        <div class="player-heading"><div><strong>{{ simulating ? 'Percorrendo a rota' : previewPercent === 100 ? 'Percurso finalizado' : 'Prévia do percurso' }}</strong><span>{{ currentNode ? nodeName(currentNode.id) : 'Entrada' }} · {{ previewPercent }}%</span></div>
          <div class="actions"><button class="btn light sm" @click="seek(0)">Reiniciar</button><button class="btn light sm" @click="nextPoint">Próximo ponto</button></div></div>
        <input class="route-scrubber" type="range" min="0" :max="totalLength" step="1" :value="traveled" aria-label="Progresso da animação" @input="seek(Number(($event.target as HTMLInputElement).value))" />
        <div class="route-itinerary" aria-label="Pontos do percurso">
          <button v-for="step in itinerary" :key="`${step.index}-${step.id}`" :class="{ active: previewVisible && Math.abs(traveled - step.distance) < 1 }" @click="seek(step.distance); emit('select', step.id)"><span>{{ step.number ?? (step.index === 0 ? '→' : '✓') }}</span>{{ nodeName(step.id) }}</button>
        </div>
        <small>Prévia visual. Nenhuma coleta é confirmada durante a animação.</small>
      </template>
      <p v-else class="muted">Selecione um pedido e calcule a rota para acompanhar o percurso. Você já pode clicar nos endereços para explorar a planta.</p>
    </div>
    <div v-if="!mini" class="legend map-key">
      <span><i style="background: #15803d"></i> Rota / parada numerada</span
      ><span v-if="!basic"
        ><i style="background: #d97706"></i> Próxima parada / convencional
        tracejada</span
      ><span v-if="!basic"><i style="background: #64748b"></i> Coletado</span
      ><span><i style="background: #2563eb"></i> Consulta / seleção</span>
    </div>
    <div v-if="!mini && !basic" class="pad distance-form">
      <p class="muted">
        Setas cinzas indicam os sentidos permitidos. Distâncias seguem as
        conexões cadastradas, não a escala do desenho. A simulação apenas
        ilustra a visita; não confirma itens.
      </p>
      <form @submit.prevent="measure">
        <h3>Consultar distância entre endereços</h3>
        <div class="form-row">
          <label
            >Origem<select aria-label="Origem" v-model="origin" required>
              <option value="" disabled>Selecione</option>
              <option v-for="n in warehouse.nodes" :key="n.id" :value="n.id">
                {{ n.code }}
              </option>
            </select></label
          ><label
            >Destino<select aria-label="Destino" v-model="destination" required>
              <option value="" disabled>Selecione</option>
              <option v-for="n in warehouse.nodes" :key="n.id" :value="n.id">
                {{ n.code }}
              </option>
            </select></label
          ><button class="btn light" :disabled="loading">
            {{ loading ? "Consultando…" : "Consultar distância" }}
          </button>
        </div>
        <p v-if="query" role="status" class="distance-result">
          Menor percurso:
          <strong>{{ query.distanceMeters.toLocaleString("pt-BR") }} m</strong>
          · destacado em azul
        </p>
        <p v-if="queryError" role="alert" class="error">{{ queryError }}</p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.blueprint-viewport { background: var(--surface-alt); max-height: 600px; overflow: auto; }
.warehouse-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.warehouse-summary > div { margin-right: auto; }
.warehouse-summary small { display: block; color: var(--muted); margin-top: 3px; font-size: 10px; }
.warehouse-summary > span { color: var(--muted); font-size: 11px; }
.zone-label { fill: var(--muted); font: 9px 'Inter', sans-serif; letter-spacing: .6px; }
.stock-label { fill: var(--muted); font: 9px 'Inter', sans-serif; }
.blueprint-viewport svg { height: auto; min-height: 0; max-height: none; }
.blueprint-viewport.fitted svg { height: 500px; min-height: 0; }
.mini .blueprint-viewport.fitted svg { height: 250px; }
.map-position > rect, .map-position circle, .map-position path { transition: stroke .15s, stroke-width .15s; }
.map-position:hover > rect, .map-position:hover > circle, .map-position.is-selected > rect { stroke: var(--primary); stroke-width: 3px; }
.route-traveler { pointer-events: none; }
.route-player { margin: 0 14px 14px; padding: 14px; background: var(--surface-alt); border: 1px solid var(--line); border-radius: 5px; }
.player-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.player-heading > div:first-child { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.player-heading strong { font-size: 12px; }
.player-heading span, .route-player small { color: var(--muted); font-size: 11px; }
.route-scrubber { width: 100%; height: 24px; margin: 8px 0; accent-color: var(--primary); cursor: pointer; }
.route-itinerary { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 4px; }
.route-itinerary button { display: flex; align-items: center; gap: 6px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 4px; color: var(--ink-soft); padding: 6px 8px; font-size: 11px; cursor: pointer; }
.route-itinerary button.active { background: var(--primary-soft); border-color: var(--primary-border); color: var(--primary-text); }
.route-itinerary button > span { background: var(--surface-alt); border: 1px solid var(--line); border-radius: 50%; width: 18px; height: 18px; display: grid; place-items: center; font-size: 10px; }
.map-key { padding-bottom: 12px; }
@media (max-width: 760px) {
  .blueprint-viewport { overflow-x: auto; }
  .blueprint-viewport:not(.fitted) svg { min-width: 700px; }
  .blueprint-viewport.fitted svg { min-width: 0; }
  .mini .blueprint-viewport svg { min-width: 0; }
  .route-player { margin: 0 8px 12px; padding: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .map-position > rect, .map-position circle, .map-position path { transition: none; }
}
</style>
