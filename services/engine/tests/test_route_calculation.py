from fastapi.testclient import TestClient

from app.main import app


def route_request() -> dict[str, object]:
    return {
        'warehouse': {
            'nodes': [
                {'id': 'ENTRY', 'x': 0, 'y': 0},
                {'id': 'A', 'x': 1, 'y': 0},
                {'id': 'B', 'x': 2, 'y': 0},
                {'id': 'EXIT', 'x': 3, 'y': 0},
            ],
            'edges': [
                {'from': 'ENTRY', 'to': 'A', 'distance': 2},
                {'from': 'ENTRY', 'to': 'B', 'distance': 8},
                {'from': 'A', 'to': 'B', 'distance': 2},
                {'from': 'B', 'to': 'EXIT', 'distance': 3},
            ],
        },
        'startNodeId': 'ENTRY',
        'stops': [
            {'id': 'B', 'productIds': ['PRODUCT-B']},
            {'id': 'A', 'productIds': ['PRODUCT-A']},
        ],
        'endNodeId': 'EXIT',
        'strategy': 'nearest_neighbor',
    }


def test_calculate_route_returns_a_complete_deterministic_route() -> None:
    response = TestClient(app).post('/internal/v1/routes/calculate', json=route_request())

    assert response.status_code == 200
    assert response.json() == {
        'status': 'success',
        'pathNodeIds': ['ENTRY', 'A', 'B', 'EXIT'],
        'stops': [
            {'nodeId': 'A', 'sequence': 1, 'productIds': ['PRODUCT-A']},
            {'nodeId': 'B', 'sequence': 2, 'productIds': ['PRODUCT-B']},
        ],
        'totalDistance': 7.0,
        'distanceUnit': 'm',
        'algorithm': {'shortestPath': 'dijkstra', 'visitOrder': 'nearest_neighbor'},
    }


def test_calculate_route_rejects_invalid_graphs_with_a_stable_error() -> None:
    request = route_request()
    request['warehouse'] = {
        'nodes': [{'id': 'ENTRY', 'x': 0, 'y': 0}],
        'edges': [{'from': 'ENTRY', 'to': 'UNKNOWN', 'distance': 1}],
    }

    response = TestClient(app).post('/internal/v1/routes/calculate', json=request)

    assert response.status_code == 422
    assert response.json() == {
        'error': {'code': 'INVALID_ROUTE_REQUEST', 'message': 'A requisição de cálculo é inválida.'}
    }


def test_calculate_route_reports_when_a_stop_cannot_be_reached() -> None:
    request = route_request()
    request['warehouse'] = {
        'nodes': [
            {'id': 'ENTRY', 'x': 0, 'y': 0},
            {'id': 'A', 'x': 1, 'y': 0},
            {'id': 'B', 'x': 2, 'y': 0},
            {'id': 'EXIT', 'x': 3, 'y': 0},
        ],
        'edges': [{'from': 'ENTRY', 'to': 'A', 'distance': 1}],
    }

    response = TestClient(app).post('/internal/v1/routes/calculate', json=request)

    assert response.status_code == 422
    assert response.json() == {
        'error': {'code': 'NO_ROUTE_FOUND', 'message': 'Não existe caminho válido entre os pontos solicitados.'}
    }
