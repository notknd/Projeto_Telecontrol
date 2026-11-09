# Contratos de API

## Governança do contrato interno

O contrato entre a API Fastify e o motor FastAPI é a versão `v1` do endpoint interno. Esta documentação é a fonte de verdade junto dos tipos TypeScript em `services/api/src/engine/contracts.ts` e dos modelos Pydantic em `services/engine/app/main.py`. Alterações incompatíveis devem criar uma nova versão do caminho; mudanças compatíveis devem atualizar documentação e testes no mesmo pull request.

O contrato foi conferido contra o cliente HTTP, o endpoint FastAPI e os testes atuais. A aprovação formal do responsável pelo motor deve ser registrada na revisão do pull request da task #49 antes do fechamento da issue.

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

### Entrada do motor e invariantes

```json
{
  "warehouse": {
    "nodes": [
      {"id":"UUID_ENTRADA","x":0,"y":0},
      {"id":"UUID_POSICAO","x":3,"y":2},
      {"id":"UUID_SAIDA","x":6,"y":0}
    ],
    "edges": [
      {"from":"UUID_ENTRADA","to":"UUID_POSICAO","distance":5.0},
      {"from":"UUID_POSICAO","to":"UUID_SAIDA","distance":4.0}
    ]
  },
  "startNodeId":"UUID_ENTRADA",
  "stops":[{"id":"UUID_POSICAO","productIds":["UUID_PRODUTO"]}],
  "endNodeId":"UUID_SAIDA",
  "strategy":"nearest_neighbor"
}
```

| Campo | Regra |
| --- | --- |
| `warehouse.nodes` | Ao menos um nó; `id` não vazio e único; `x` e `y` finitos. |
| `warehouse.edges` | Arestas dirigidas; extremos existentes; extremos diferentes; distância finita e maior que zero, em metros. |
| `startNodeId` | Obrigatório e presente no grafo. |
| `stops` | Ao menos uma parada; cada nó aparece uma vez e pertence ao grafo. Produtos da mesma posição são agrupados. |
| `stops[].productIds` | Ao menos um ID não vazio e sem repetição dentro da parada. |
| `endNodeId` | Opcional; quando enviado, deve existir no grafo e ser o último nó da resposta. |
| `strategy` | Na v1, somente `nearest_neighbor`; cada trecho usa Dijkstra. |

As arestas são dirigidas: o sentido inverso precisa ser representado por outra aresta. Coordenadas não criam conexões. O motor não consulta pedidos, produtos ou PostgreSQL.

### Resposta do motor e erros

Uma resposta `200` contém `status: "success"`, `pathNodeIds`, `stops`, `totalDistance`, `distanceUnit: "m"` e os algoritmos utilizados. O caminho começa em `startNodeId`, termina em `endNodeId` quando informado, usa somente arestas recebidas e tem distância igual à soma dessas arestas. Cada parada solicitada aparece exatamente uma vez, com sequência iniciada em 1 e os mesmos `productIds`.

Todos os erros usam o envelope `{"error":{"code":"...","message":"..."}}` e não expõem stack trace, credenciais ou detalhes internos:

| Situação | HTTP | Código |
| --- | --- | --- |
| Payload, grafo, nó ou estratégia inválidos | 422 | `INVALID_ROUTE_REQUEST` |
| Não existe caminho para cobrir as paradas ou alcançar o destino | 422 | `NO_ROUTE_FOUND` |
| Falha inesperada no motor | 500 | `ENGINE_INTERNAL_ERROR` |

Exemplos:

```json
{"error":{"code":"INVALID_ROUTE_REQUEST","message":"A requisição de cálculo é inválida."}}
```

```json
{"error":{"code":"NO_ROUTE_FOUND","message":"Não existe caminho válido entre os pontos solicitados."}}
```

A API traduz falhas de comunicação para `ENGINE_UNAVAILABLE` (503), `ENGINE_TIMEOUT` (504) e `ENGINE_INVALID_RESPONSE` (502). Nenhuma rota inválida é persistida ou devolvida como sucesso.

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
