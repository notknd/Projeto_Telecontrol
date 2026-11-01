# Contratos de API

Este documento descreve os endpoints de saúde e o contrato interno versionado usado entre a API Fastify e o motor FastAPI. O navegador chama somente a API pública de negócio; ele não chama o motor nem envia o grafo oficial.

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

## Cálculo público de rota

POST /api/v1/routes/calculate

Este endpoint recebe uma representação mínima do pedido, incluindo as posições já resolvidas para cada item, e retorna a rota calculada. É uma integração provisória para o MVP: enquanto não existir persistência de pedidos e armazéns, a API não pode obter esses dados apenas por orderId. Quando os módulos de pedidos e armazém estiverem disponíveis, o navegador enviará somente o identificador do pedido e a API montará o restante do payload a partir da fonte oficial.

Requisição:

~~~json
{
  "order": {
    "id": "ORDER-001",
    "items": [
      {"productId": "PRODUCT-A", "locationNodeId": "STORAGE-A-01"},
      {"productId": "PRODUCT-B", "locationNodeId": "STORAGE-B-01"}
    ]
  },
  "warehouse": {
    "nodes": [
      {"id": "ENTRY-01", "x": 0, "y": 0},
      {"id": "STORAGE-A-01", "x": 3, "y": 2},
      {"id": "STORAGE-B-01", "x": 6, "y": 2},
      {"id": "EXIT-01", "x": 9, "y": 0}
    ],
    "edges": [
      {"from": "ENTRY-01", "to": "STORAGE-A-01", "distance": 4.0},
      {"from": "STORAGE-A-01", "to": "STORAGE-B-01", "distance": 3.0},
      {"from": "STORAGE-B-01", "to": "EXIT-01", "distance": 4.0}
    ]
  },
  "startNodeId": "ENTRY-01",
  "endNodeId": "EXIT-01",
  "strategy": "nearest_neighbor"
}
~~~

A API exige um pedido com ao menos um item. Cada item possui productId e locationNodeId não vazios; a mesma combinação não pode aparecer duas vezes. Antes de chamar o motor, a API agrupa os itens por posição e rejeita grafo, origem, destino, estratégia ou posições inconsistentes. Os demais invariantes do grafo seguem o contrato interno abaixo.

Resposta de sucesso (200):

~~~json
{
  "orderId": "ORDER-001",
  "route": {
    "status": "success",
    "pathNodeIds": ["ENTRY-01", "STORAGE-A-01", "STORAGE-B-01", "EXIT-01"],
    "stops": [
      {"nodeId": "STORAGE-A-01", "sequence": 1, "productIds": ["PRODUCT-A"]},
      {"nodeId": "STORAGE-B-01", "sequence": 2, "productIds": ["PRODUCT-B"]}
    ],
    "totalDistance": 11.0,
    "distanceUnit": "m",
    "algorithm": {"shortestPath": "dijkstra", "visitOrder": "nearest_neighbor"}
  }
}
~~~

| Situação | HTTP | Código |
| --- | --- | --- |
| Requisição pública inválida | 400 | INVALID_ROUTE_REQUEST |
| Não há caminho para todas as paradas ou destino | 422 | NO_ROUTE_FOUND |
| Motor indisponível | 503 | ENGINE_UNAVAILABLE |
| Timeout no motor | 504 | ENGINE_TIMEOUT |

## Cálculo interno de rotas

`POST /internal/v1/routes/calculate` (API Fastify → motor FastAPI, somente na rede interna)

O endpoint recebe os dados já carregados e validados pela API. O motor não consulta pedidos, produtos ou PostgreSQL. A API monta o grafo com nós e arestas ativos e associa os itens do pedido às posições de coleta.

### Requisição

```json
{
  "warehouse": {
    "nodes": [
      {"id": "ENTRY-01", "x": 0, "y": 0},
      {"id": "STORAGE-A-01", "x": 3, "y": 2},
      {"id": "EXIT-01", "x": 6, "y": 0}
    ],
    "edges": [
      {"from": "ENTRY-01", "to": "STORAGE-A-01", "distance": 5.0},
      {"from": "STORAGE-A-01", "to": "EXIT-01", "distance": 4.0}
    ]
  },
  "startNodeId": "ENTRY-01",
  "stops": [
    {"id": "STORAGE-A-01", "productIds": ["PROD-A"]}
  ],
  "endNodeId": "EXIT-01",
  "strategy": "nearest_neighbor"
}
```

### Campos e invariantes

| Campo | Tipo | Regra |
| --- | --- | --- |
| `warehouse.nodes` | lista de objetos | Deve conter ao menos um nó. Cada `id` é uma string não vazia e única; `x` e `y` são números finitos em metros para posicionamento no mapa. |
| `warehouse.edges` | lista de objetos | Cada aresta dirigida possui `from`, `to` e `distance`. Os extremos devem existir em `nodes`, `from` e `to` devem ser diferentes e `distance` deve ser um número finito maior que zero, em metros. |
| `startNodeId` | string | Obrigatório e deve identificar um nó recebido no grafo. No fluxo de picking, a API envia a entrada ativa do armazém. |
| `stops` | lista de objetos | Deve conter ao menos uma parada. Cada `id` deve identificar um nó do grafo; a lista não deve repetir nós. A API agrupa na mesma parada os produtos que compartilham uma posição. |
| `stops[].productIds` | lista de strings | Deve conter ao menos um identificador de produto por parada; os valores não podem ser vazios nem repetidos dentro da parada. |
| `endNodeId` | string ou ausente | Quando presente, deve identificar um nó do grafo e será o destino final. A API de picking envia a saída ativa do armazém. |
| `strategy` | string | Na versão 1, o único valor aceito é `nearest_neighbor`. A busca de caminho mínimo usa Dijkstra. Não há parâmetros adicionais nesta versão. |

As arestas são dirigidas: uma passagem nos dois sentidos precisa ser representada por duas arestas. Coordenadas não criam conexões e não substituem o peso `distance`; somente arestas explícitas podem ser percorridas. O motor usa os pesos em metros para calcular o custo.

Os identificadores são strings estáveis dentro da requisição e da resposta. Todos os nós referenciados por origem, destino, paradas e arestas precisam estar presentes no grafo. Não envie campos persistidos ou status de negócio para o motor.

### Resposta de sucesso

HTTP `200`:

```json
{
  "status": "success",
  "pathNodeIds": ["ENTRY-01", "STORAGE-A-01", "EXIT-01"],
  "stops": [
    {"nodeId": "STORAGE-A-01", "sequence": 1, "productIds": ["PROD-A"]}
  ],
  "totalDistance": 9.0,
  "distanceUnit": "m",
  "algorithm": {
    "shortestPath": "dijkstra",
    "visitOrder": "nearest_neighbor"
  }
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `status` | string | Sempre `success` numa resposta `200`. |
| `pathNodeIds` | lista de strings | Caminho completo na ordem de percurso, começando em `startNodeId` e terminando em `endNodeId` quando informado. Cada par consecutivo deve corresponder a uma aresta dirigida recebida. |
| `stops` | lista de objetos | Cada parada solicitada aparece exatamente uma vez, na ordem de visita, com sequência inteira iniciando em 1. A lista de `productIds` deve corresponder à requisição. |
| `totalDistance` | número | Distância finita, não negativa, igual à soma dos pesos das arestas do caminho. |
| `distanceUnit` | string | Sempre `m` nesta versão. |
| `algorithm.shortestPath` | string | Sempre `dijkstra` nesta versão. |
| `algorithm.visitOrder` | string | Sempre `nearest_neighbor` nesta versão. |

A API valida a estrutura, a cobertura das paradas, o início/fim, as conexões e a distância antes de devolver ou persistir o resultado. Uma resposta inválida nunca cria uma rota válida.

### Erros do motor

Todas as falhas usam o mesmo corpo JSON e não incluem stack trace, consulta, segredo ou detalhe interno:

```json
{
  "error": {
    "code": "NO_ROUTE_FOUND",
    "message": "Não existe caminho válido entre os pontos solicitados."
  }
}
```

| Situação | HTTP | Código | Significado |
| --- | --- | --- | --- |
| Payload, grafo, identificador ou estratégia inválidos | `422` | `INVALID_ROUTE_REQUEST` | A entrada viola um tipo, campo obrigatório ou invariante do contrato. |
| Grafo válido, mas não há caminho que cubra as paradas e alcance o destino solicitado | `422` | `NO_ROUTE_FOUND` | O cálculo não pode produzir uma rota completa. Não deve haver resposta parcial de sucesso. |
| Erro inesperado dentro do motor | `500` | `ENGINE_INTERNAL_ERROR` | Falha não prevista; detalhes técnicos ficam apenas nos logs internos. |

Exemplo de validação (`422`):

```json
{"error":{"code":"INVALID_ROUTE_REQUEST","message":"A requisição de cálculo é inválida."}}
```

Exemplo de erro interno (`500`):

```json
{"error":{"code":"ENGINE_INTERNAL_ERROR","message":"Não foi possível calcular a rota."}}
```

A API deve tratar `NO_ROUTE_FOUND` como falha de domínio previsível, sem persistir rota, e manter a resposta pública em formato seguro. `INVALID_ROUTE_REQUEST` indica inconsistência na requisição montada pela API e deve ser registrada como erro de integração; a mensagem técnica do motor não é repassada ao navegador. Timeout, indisponibilidade e resposta malformada do motor seguem o tratamento resiliente da API descrito abaixo.

### Configuração e falhas de comunicação

A API usa `ENGINE_URL` (padrão `http://engine:8000`) e `ENGINE_TIMEOUT_MS` (padrão `5000`). O caminho versionado acima é acrescentado à URL base. No Docker Compose, o motor permanece na rede interna e não publica sua porta no host.

Quando a chamada ao motor falha, a API retorna um envelope estável, sem detalhes da exceção upstream:

```json
{"error":{"code":"ENGINE_UNAVAILABLE","message":"O motor de rotas está indisponível."}}
```

| Situação observada pela API | HTTP público | Código | Mensagem |
| --- | --- | --- | --- |
| Motor indisponível ou erro interno `500` | `503` | `ENGINE_UNAVAILABLE` | O motor de rotas está indisponível. |
| Timeout da chamada | `504` | `ENGINE_TIMEOUT` | O motor de rotas excedeu o tempo limite. |
| JSON ou resposta de sucesso incompatível com o contrato | `502` | `ENGINE_INVALID_RESPONSE` | O motor de rotas retornou uma resposta inválida. |
| Grafo válido sem rota possível (`NO_ROUTE_FOUND`) | `422` | `NO_ROUTE_FOUND` | Não existe caminho válido entre os pontos solicitados. |

Todos os erros públicos usam `{"error":{"code":"...","message":"..."}}`. A API pode registrar detalhes técnicos nos logs internos, sem registrar segredos. Nenhuma porta pública deve ser aberta diretamente para o motor.
