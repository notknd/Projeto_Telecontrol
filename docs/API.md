# Contratos de API

## Saúde da API principal

`GET /health`

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"api"}
```

## Saúde do motor interno

`GET /health`

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"engine"}
```

O contrato público de negócio, sob `/api/v1`, será adicionado antes do CRUD e permanecerá separado do contrato interno de cálculo.

## Cálculo interno de rotas

`POST /internal/v1/routes/calculate` (API Fastify → motor FastAPI, somente na rede interna)

O contrato abaixo é a versão inicial compartilhada para a integração. A API prepara o grafo e os pontos de coleta a partir dos dados de negócio; o navegador não deve enviar este payload diretamente nem definir a rota oficial.

Requisição:

```json
{
  "warehouse": {
    "nodes": [{ "id": "ENTRADA", "x": 0, "y": 0 }, { "id": "P12", "x": 3, "y": 2 }],
    "edges": [{ "from": "ENTRADA", "to": "P12", "distance": 5.0 }]
  },
  "startNodeId": "ENTRADA",
  "stops": [{ "id": "P12", "productIds": ["PROD-A"] }],
  "endNodeId": "ENTRADA",
  "strategy": "nearest_neighbor"
}
```

`endNodeId` pode ser omitido quando não houver destino final definido. Distâncias são expressas em metros e as arestas possuem pesos não negativos.

Resposta de sucesso (`200`):

```json
{
  "status": "success",
  "pathNodeIds": ["ENTRADA", "P12", "ENTRADA"],
  "stops": [{ "nodeId": "P12", "sequence": 1, "productIds": ["PROD-A"] }],
  "totalDistance": 10.0,
  "distanceUnit": "m",
  "algorithm": { "shortestPath": "dijkstra", "visitOrder": "nearest_neighbor" }
}
```

Antes de ser repassada ou persistida, a API verifica o status, caminho, pontos de parada, sequência, produtos, distância, unidade e metadados do algoritmo.

### Falhas da chamada ao motor

A API usa `ENGINE_URL` (padrão `http://engine:8000`) e `ENGINE_TIMEOUT_MS` (padrão `5000`). O caminho de cálculo é acrescentado à URL base. Os erros enviados ao cliente possuem formato estável e não incluem detalhes da exceção upstream:

| Situação | HTTP | Código | Mensagem |
| --- | --- | --- | --- |
| Motor indisponível ou erro 5xx | 503 | `ENGINE_UNAVAILABLE` | O motor de rotas está indisponível. |
| Timeout | 504 | `ENGINE_TIMEOUT` | O motor de rotas excedeu o tempo limite. |
| Resposta inválida ou erro 4xx do motor | 502 | `ENGINE_INVALID_RESPONSE` | O motor de rotas retornou uma resposta inválida. |

Todas as respostas de erro seguem o formato `{"error":{"code":"...","message":"..."}}`. Detalhes técnicos permanecem somente nos logs do backend.
