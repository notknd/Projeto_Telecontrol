<script setup lang="ts">
import { computed } from "vue";
import type { Warehouse, Route } from "../services/api";
const props = defineProps<{ warehouse: Warehouse; route?: Route }>();
const points = computed(() => {
  const xs = props.warehouse.nodes.map((n) => n.x),
    ys = props.warehouse.nodes.map((n) => n.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const scale = Math.min(
    700 / Math.max(1, Math.max(...xs) - minX),
    300 / Math.max(1, Math.max(...ys) - minY),
  );
  return new Map(
    props.warehouse.nodes.map((n) => [
      n.id,
      { x: 80 + (n.x - minX) * scale, y: 70 + (n.y - minY) * scale },
    ]),
  );
});
const path = computed(
  () =>
    props.route?.steps
      .map((s) => points.value.get(s.warehouseNodeId))
      .filter(Boolean)
      .map((p) => `${p!.x},${p!.y}`)
      .join(" ") ?? "",
);
const stop = (id: string) =>
  props.route?.stops.find((s) => s.warehouseNodeId === id)?.sequence;
</script>
<template>
  <div class="map-panel">
    <svg
      v-if="warehouse.nodes.length"
      viewBox="0 0 860 440"
      role="img"
      aria-label="Mapa do armazém com conexões dirigidas e rota de coleta"
    >
      <defs>
        <marker
          id="edge-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
        <marker
          id="route-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
        </marker>
      </defs>
      <g v-for="e in warehouse.edges" :key="e.id">
        <line
          v-if="points.has(e.fromNodeId) && points.has(e.toNodeId)"
          :x1="points.get(e.fromNodeId)!.x"
          :y1="points.get(e.fromNodeId)!.y"
          :x2="points.get(e.toNodeId)!.x"
          :y2="points.get(e.toNodeId)!.y"
          stroke="#94a3b8"
          stroke-width="3"
        />
        <line
          v-if="points.has(e.fromNodeId) && points.has(e.toNodeId)"
          :x1="points.get(e.fromNodeId)!.x"
          :y1="points.get(e.fromNodeId)!.y"
          :x2="
            points.get(e.fromNodeId)!.x * 0.35 +
            points.get(e.toNodeId)!.x * 0.65
          "
          :y2="
            points.get(e.fromNodeId)!.y * 0.35 +
            points.get(e.toNodeId)!.y * 0.65
          "
          stroke="#94a3b8"
          stroke-width="3"
          marker-end="url(#edge-arrow)"
        />
      </g>
      <polyline
        v-if="path"
        :points="path"
        fill="none"
        stroke="#2563eb"
        stroke-width="5"
        stroke-linejoin="round"
        opacity=".75"
        marker-mid="url(#route-arrow)"
      />
      <g
        v-for="n in warehouse.nodes"
        :key="n.id"
        :transform="`translate(${points.get(n.id)!.x},${points.get(n.id)!.y})`"
      >
        <circle
          r="15"
          :fill="
            stop(n.id)
              ? '#1d4ed8'
              : n.type === 'STORAGE'
                ? '#64748b'
                : ['ENTRY', 'EXIT'].includes(n.type)
                  ? '#15803d'
                  : '#94a3b8'
          "
          stroke="white"
          stroke-width="3"
        />
        <text
          v-if="stop(n.id)"
          text-anchor="middle"
          y="5"
          fill="white"
          font-size="13"
          font-weight="700"
        >
          {{ stop(n.id) }}
        </text>
        <text text-anchor="middle" y="-25" class="map-label">
          {{ n.label || n.code }}
        </text>
        <text text-anchor="middle" y="34" class="map-code">{{ n.code }}</text>
      </g>
    </svg>
    <p v-else class="empty">Nenhum layout disponível.</p>
    <div class="map-legend">
      <span>● Entrada e saída</span><span>● Posições de estoque</span
      ><span class="blue">━━ Rota · sequência numerada</span>
    </div>
    <p class="muted">
      Distâncias em metros, conforme as conexões cadastradas. As setas indicam o
      sentido permitido.
    </p>
  </div>
</template>
