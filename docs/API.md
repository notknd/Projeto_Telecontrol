# Contratos de API

## Saúde da API principal

`GET /health`

Durante o desenvolvimento local: `http://127.0.0.1:3000/health`.

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"api"}
```

## Cálculo público de rota

`POST /api/v1/routes/calculate`

Recebe somente a identificação persistida do pedido. A API consulta os itens, as posições ativas e o grafo do armazém; então envia ao motor apenas os dados necessários para o cálculo.

Requisição:

```json
{"orderId":"UUID_DO_PEDIDO"}
```

Resposta de sucesso (`200`):

```json
{
  "orderId":"UUID_DO_PEDIDO",
  "route":{
    "status":"success",
    "pathNodeIds":["UUID_ENTRADA","UUID_POSICAO","UUID_SAIDA"],
    "stops":[{"nodeId":"UUID_POSICAO","sequence":1,"productIds":["UUID_PRODUTO"]}],
    "totalDistance":9,
    "distanceUnit":"m",
    "algorithm":{"shortestPath":"dijkstra","visitOrder":"nearest_neighbor"}
  }
}
```

Erros: `400 INVALID_ROUTE_REQUEST` para corpo inválido; `404 ORDER_NOT_FOUND` para pedido inexistente; `422 ORDER_NOT_ROUTABLE`, `WAREHOUSE_CONFIGURATION_INVALID` ou `NO_ROUTE_FOUND` quando não for possível calcular uma rota completa; `503 ENGINE_UNAVAILABLE`, `504 ENGINE_TIMEOUT` e `502 ENGINE_INVALID_RESPONSE` para falhas na integração.

O endpoint não altera o status do pedido nem persiste a rota. Essas transições serão tratadas pelo fluxo de coleta e persistência.

## Cálculo interno de rota

`POST /internal/v1/routes/calculate`

Disponível apenas à API na rede interna. Recebe `warehouse.nodes`, arestas dirigidas com distância em metros, origem, paradas agrupadas por posição, destino e `strategy: "nearest_neighbor"`. O motor usa Dijkstra para cada trecho e Vizinho Mais Próximo para ordenar as paradas. A resposta sempre usa metros, inclui todos os nós do percurso e informa `NO_ROUTE_FOUND` quando algum trecho não é alcançável.

`ENGINE_URL` define a URL do motor, com padrão `http://engine:8000`; `ENGINE_TIMEOUT_MS` define o limite da chamada, com padrão de 5000 ms. A API valida a estrutura, as arestas e a distância retornada antes de devolver a rota.

## Saúde do motor interno

`GET /health`

Durante o desenvolvimento local: `http://127.0.0.1:8000/health`.

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"engine"}
```

Os demais contratos públicos de negócio, sob `/api/v1`, permanecem separados do contrato interno de cálculo.

## Produtos

`POST /api/v1/products`

Cria um produto persistido via Prisma e o associa a uma posição ativa do armazém.

Exemplo de requisição:

```json
{
  "sku": "CX-01",
  "name": "Caixa organizadora",
  "stockQuantity": 12,
  "warehouseNodeId": "UUID_DA_POSICAO",
  "weightKg": 1.5,
  "category": "Organização",
  "isActive": true
}
```

O SKU é convertido para maiúsculas e não pode ser repetido. `GET /api/v1/products`
lista os produtos ordenados por SKU, e `GET /api/v1/products/:productId` consulta
um produto específico.

Erros:

- `400 INVALID_PRODUCT_REQUEST`: campos inválidos, incluindo quantidade negativa;
- `404 WAREHOUSE_NODE_NOT_FOUND` ou `PRODUCT_NOT_FOUND`;
- `409 PRODUCT_SKU_ALREADY_EXISTS`;
- `422 WAREHOUSE_NODE_INACTIVE`.
