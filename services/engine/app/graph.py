"""Representação em grafo ponderado utilizada por algoritmos de roteamento em armazéns."""

from types import MappingProxyType
from typing import Mapping

from app.graph_models import WarehouseMap


class WarehouseGraph:
    """Lista de adjacência não direcionada construída a partir de um mapa de armazém validado."""

    def __init__(self, warehouse: WarehouseMap) -> None:
        adjacency: dict[str, dict[str, float]] = {
            node.id: {} for node in warehouse.nodes
        }
        for edge in warehouse.edges:
            # Keep the shortest walkable connection if the input lists a pair twice.
            current = adjacency[edge.from_node].get(edge.to_node)
            if current is None or edge.distance < current:
                adjacency[edge.from_node][edge.to_node] = edge.distance
                adjacency[edge.to_node][edge.from_node] = edge.distance
        self._adjacency = adjacency

    @property
    def node_ids(self) -> tuple[str, ...]:
        return tuple(self._adjacency)

    def neighbors(self, node_id: str) -> Mapping[str, float]:
        """Retorna nós vizinhos e distâncias, ou rejeita um nó desconhecido."""
        try:
            return MappingProxyType(self._adjacency[node_id])
        except KeyError as error:
            raise KeyError(f"Nó de armazém desconhecido: {node_id}") from error

    def distance(self, from_node: str, to_node: str) -> float | None:
        """Retorna a distância da aresta direta, ou None quando não existe aresta."""
        return self.neighbors(from_node).get(to_node)

    def has_node(self, node_id: str) -> bool:
        return node_id in self._adjacency
