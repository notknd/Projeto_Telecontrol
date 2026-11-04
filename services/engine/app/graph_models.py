"""Estruturas de dados para o grafo do mapa do armazém."""

from dataclasses import dataclass
from math import isfinite
from typing import Iterable


@dataclass(frozen=True, slots=True)
class WarehouseNode:
    """Um local de armazém fixo, opcionalmente posicionado em um mapa 2D."""

    id: str
    x: float | None = None
    y: float | None = None

    def __post_init__(self) -> None:
        if not self.id or not self.id.strip():
            raise ValueError("Node id must not be empty")
        for name, value in (("x", self.x), ("y", self.y)):
            if value is not None and not isfinite(value):
                raise ValueError(f"A coordenada do nó {name} deve ser finita")


@dataclass(frozen=True, slots=True)
class WarehouseEdge:
    """Uma conexão percorrível a pé entre dois nós, medida em metros."""

    from_node: str
    to_node: str
    distance: float

    def __post_init__(self) -> None:
        if not self.from_node or not self.from_node.strip():
            raise ValueError("Edge from_node must not be empty")
        if not self.to_node or not self.to_node.strip():
            raise ValueError("Edge to_node must not be empty")
        if not isfinite(self.distance) or self.distance < 0:
            raise ValueError("A distância até a borda deve ser um número finito não negativo.")


@dataclass(frozen=True, slots=True)
class WarehouseMap:
    """Nós validados e conexões ponderadas para um armazém."""

    nodes: tuple[WarehouseNode, ...]
    edges: tuple[WarehouseEdge, ...]

    def __init__(
        self,
        nodes: Iterable[WarehouseNode],
        edges: Iterable[WarehouseEdge],
    ) -> None:
        node_list = tuple(nodes)
        edge_list = tuple(edges)
        node_ids = [node.id for node in node_list]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Os IDs dos nós de armazém devem ser exclusivos.")

        known_nodes = set(node_ids)
        for edge in edge_list:
            missing = {edge.from_node, edge.to_node} - known_nodes
            if missing:
                raise ValueError(
                    "A aresta faz referência a nó(s) desconhecido(s): " + ", ".join(sorted(missing))
                )

        object.__setattr__(self, "nodes", node_list)
        object.__setattr__(self, "edges", edge_list)
