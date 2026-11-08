import unittest

from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class WarehouseGraphTests(unittest.TestCase):
    def test_builds_directed_weighted_adjacency_and_keeps_isolated_nodes(self) -> None:
        graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode("entrance"), WarehouseNode("aisle"), WarehouseNode("rack")],
                [WarehouseEdge("entrance", "aisle", 4)],
            )
        )

        self.assertEqual(graph.node_ids, ("entrance", "aisle", "rack"))
        self.assertEqual(dict(graph.neighbors("entrance")), {"aisle": 4})
        self.assertEqual(dict(graph.neighbors("aisle")), {})
        self.assertEqual(dict(graph.neighbors("rack")), {})

    def test_preserves_different_weights_for_opposite_directions(self) -> None:
        graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode("a"), WarehouseNode("b")],
                [WarehouseEdge("a", "b", 8), WarehouseEdge("b", "a", 3)],
            )
        )

        self.assertEqual(graph.distance("a", "b"), 8)
        self.assertEqual(graph.distance("b", "a"), 3)

    def test_unknown_node_is_reported(self) -> None:
        graph = WarehouseGraph(WarehouseMap([WarehouseNode("a")], []))

        with self.assertRaisesRegex(KeyError, "desconhecido"):
            graph.neighbors("missing")

    def test_neighbors_cannot_mutate_the_graph(self) -> None:
        graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode("a"), WarehouseNode("b")],
                [WarehouseEdge("a", "b", 1)],
            )
        )

        with self.assertRaises(TypeError):
            graph.neighbors("a")["c"] = 2  # type: ignore[index]


if __name__ == "__main__":
    unittest.main()
