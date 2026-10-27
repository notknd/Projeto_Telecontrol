import unittest

from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class WarehouseMapTests(unittest.TestCase):
    def test_accepts_weighted_connections_between_known_nodes(self) -> None:
        warehouse = WarehouseMap(
            [WarehouseNode("entrance", 0, 0), WarehouseNode("aisle-1", 2, 0)],
            [WarehouseEdge("entrance", "aisle-1", 2.5)],
        )

        self.assertEqual([node.id for node in warehouse.nodes], ["entrance", "aisle-1"])
        self.assertEqual(warehouse.edges[0].distance, 2.5)

    def test_rejects_duplicate_node_ids(self) -> None:
        with self.assertRaisesRegex(ValueError, "unique"):
            WarehouseMap([WarehouseNode("entrance"), WarehouseNode("entrance")], [])

    def test_rejects_edges_with_unknown_endpoints(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown node"):
            WarehouseMap([WarehouseNode("entrance")], [WarehouseEdge("entrance", "x", 1)])

    def test_rejects_negative_or_non_finite_distances(self) -> None:
        for distance in (-1, float("inf"), float("nan")):
            with self.subTest(distance=distance), self.assertRaises(ValueError):
                WarehouseEdge("a", "b", distance)

    def test_rejects_empty_ids_and_non_finite_coordinates(self) -> None:
        with self.assertRaisesRegex(ValueError, "id"):
            WarehouseNode(" ")
        with self.assertRaisesRegex(ValueError, "coordinate"):
            WarehouseNode("aisle", float("nan"), 0)


if __name__ == "__main__":
    unittest.main()
