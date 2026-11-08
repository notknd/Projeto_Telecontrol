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

## Cadastro temporário de produtos no motor

`POST /api/v1/products`

Este endpoint está implementado temporariamente no processo FastAPI do motor e
persiste os produtos em um arquivo JSON local. A variável `PRODUCTS_FILE_PATH`
permite escolher outro caminho; o padrão é `data/products.json`. Ele não é o
contrato final: a próxima etapa deve movê-lo para a API Node/Fastify e persistir
via Prisma, conforme o PRD.

Exemplo de requisição:

```json
{
  "sku": "CX-01",
  "name": "Caixa organizadora",
  "stock_quantity": 12,
  "location": "A-01-02",
  "weight_kg": 1.5,
  "category": "Organização"
}
```

Resposta de sucesso (`201`): inclui os dados enviados, `id`, `is_active` e
`created_at`. O SKU é convertido para maiúsculas e não pode ser repetido.

Erros:

- `422`: campo ausente, vazio, ou quantidade/peso negativo;
- `409`: SKU já cadastrado.
