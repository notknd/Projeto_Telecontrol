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

Requisição. O corpo deve ser um objeto com `orderId` obrigatório, do tipo string UUID:

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

| Situação | HTTP | Código |
| --- | --- | --- |
| Corpo ausente, não objeto, sem `orderId` ou UUID inválido | 400 | `INVALID_ROUTE_REQUEST` |
| Pedido inexistente | 404 | `ORDER_NOT_FOUND` |
| Pedido sem itens coletáveis | 422 | `ORDER_NOT_ROUTABLE` |
| Armazém ou coordenadas inválidos | 422 | `WAREHOUSE_CONFIGURATION_INVALID` |
| Nenhum caminho completo encontrado | 422 | `NO_ROUTE_FOUND` |
| Motor indisponível ou resposta 5xx do motor | 503 | `ENGINE_UNAVAILABLE` |
| Timeout na chamada ou na leitura da resposta do motor | 504 | `ENGINE_TIMEOUT` |
| Resposta HTTP ou JSON incompatível com o contrato | 502 | `ENGINE_INVALID_RESPONSE` |

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

Uma resposta `200` contém, obrigatoriamente, `status` (`"success"`), `pathNodeIds` (lista de strings não vazia), `stops` (lista de paradas), `totalDistance` (número finito não negativo), `distanceUnit` (`"m"`) e `algorithm` (`shortestPath: "dijkstra"`, `visitOrder: "nearest_neighbor"`). O caminho começa em `startNodeId`, termina em `endNodeId` quando informado, usa somente arestas recebidas e tem distância igual à soma dessas arestas. Cada parada solicitada aparece exatamente uma vez, sem duplicação, com sequência inteira iniciada em 1 e a lista de `productIds` exatamente igual à enviada para aquela posição.

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

A API traduz falhas de comunicação, respostas 5xx e timeouts de leitura para `ENGINE_UNAVAILABLE` (503) e `ENGINE_TIMEOUT` (504). JSON malformado, envelope de erro desconhecido, campos ausentes, paradas duplicadas ou produtos divergentes resultam em `ENGINE_INVALID_RESPONSE` (502). Nenhuma rota inválida é persistida ou devolvida como sucesso.

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
