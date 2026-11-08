from fastapi.testclient import TestClient

from app.main import app
import pytest


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


def test_reverse_edge_is_not_invented():
    request = route_request()
    request['warehouse']['edges'] = [
        {'from': 'A', 'to': 'ENTRY', 'distance': 2},
        {'from': 'A', 'to': 'B', 'distance': 2},
        {'from': 'B', 'to': 'EXIT', 'distance': 3},
    ]
    assert TestClient(app).post('/internal/v1/routes/calculate', json=request).status_code == 422


def test_conventional_order_uses_same_directed_graph():
    request = route_request()
    request['warehouse']['edges'].append({'from': 'B', 'to': 'A', 'distance': 2})
    request['strategy'] = 'input_order'
    result = TestClient(app).post('/internal/v1/routes/calculate', json=request).json()
    assert result['pathNodeIds'] == ['ENTRY', 'A', 'B', 'A', 'B', 'EXIT']
    assert result['totalDistance'] == 11
    assert result['algorithm']['visitOrder'] == 'input_order'


@pytest.mark.parametrize('mutation', ['duplicate_edge', 'zero_weight', 'empty_stops', 'unknown_stop', 'missing_exit'])
def test_invalid_requests_do_not_produce_routes(mutation):
    request = route_request()
    if mutation == 'duplicate_edge': request['warehouse']['edges'].append(request['warehouse']['edges'][0])
    if mutation == 'zero_weight': request['warehouse']['edges'][0]['distance'] = 0
    if mutation == 'empty_stops': request['stops'] = []
    if mutation == 'unknown_stop': request['stops'][0]['id'] = 'UNKNOWN'
    if mutation == 'missing_exit': request['endNodeId'] = 'UNKNOWN'
    assert TestClient(app).post('/internal/v1/routes/calculate', json=request).status_code == 422
