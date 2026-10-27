import unittest

from app.algorithms.dijkstra import NoPathError
from app.algorithms.route import generate_route
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class CompleteRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode(node_id) for node_id in ("entrance", "crossing", "a", "b", "c")],
                [
                    WarehouseEdge("entrance", "crossing", 2),
                    WarehouseEdge("crossing", "a", 2),
                    WarehouseEdge("crossing", "b", 4),
                    WarehouseEdge("b", "c", 1),
                ],
            )
        )

    def test_combines_shortest_segments_in_nearest_neighbor_order(self) -> None:
        route = generate_route(self.graph, "entrance", ["c", "b", "a"])

        self.assertEqual(
            [(stop.node_id, stop.sequence) for stop in route.stops],
            [("a", 1), ("b", 2), ("c", 3)],
        )
        self.assertEqual(route.path_node_ids, ("entrance", "crossing", "a", "crossing", "b", "c"))
        self.assertEqual(route.total_distance, 11)
        self.assertEqual(route.distance_unit, "m")

    def test_returns_to_explicit_end_node(self) -> None:
        route = generate_route(self.graph, "entrance", ["a"], end_node_id="entrance")

        self.assertEqual(route.path_node_ids, ("entrance", "crossing", "a", "crossing", "entrance"))
        self.assertEqual(route.total_distance, 8)

    def test_empty_order_can_stay_at_start_or_reach_end(self) -> None:
        no_stops = generate_route(self.graph, "entrance", [])
        with_end = generate_route(self.graph, "entrance", [], end_node_id="a")

        self.assertEqual(no_stops.path_node_ids, ("entrance",))
        self.assertEqual(no_stops.total_distance, 0)
        self.assertEqual(with_end.path_node_ids, ("entrance", "crossing", "a"))
        self.assertEqual(with_end.total_distance, 4)

    def test_reports_route_when_a_required_return_path_is_impossible(self) -> None:
        disconnected = WarehouseGraph(
            WarehouseMap([WarehouseNode("entrance"), WarehouseNode("rack")], [])
        )

        with self.assertRaises(NoPathError):
            generate_route(disconnected, "entrance", ["entrance"], end_node_id="rack")


if __name__ == "__main__":
    unittest.main()
