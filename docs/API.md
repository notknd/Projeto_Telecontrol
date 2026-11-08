# Contratos de API

Contratos implementados na integração SmartPick. IDs de negócio nas URLs são UUID; códigos visíveis ficam em `code`/`sku`. Quantidades são inteiros; distâncias, coordenadas e pesos são números JSON (metros e kg). Datas são ISO 8601. PostgreSQL é a fonte oficial.

## API pública Fastify

O navegador usa `/api/v1` na mesma origem do frontend; Vite encaminha as chamadas ao Node. Não há chamadas do navegador ao FastAPI.

| Método e caminho | Corpo / comportamento |
| --- | --- |
| `GET /health` | `{ "status": "ok", "service": "api" }` |
| `GET /api/v1/warehouse` | `{nodes, edges}` ativos; coordenadas, códigos, tipos e conexões dirigidas persistidas. |
| `GET /api/v1/products` | Lista produtos, incluindo inativos, e `warehouseNode`. |
| `POST /api/v1/products` | Cria produto; resposta 201. |
| `PUT /api/v1/products/:id` | Atualiza os campos do produto; invalida rotas pendentes afetadas; bloqueado durante coleta que usa o produto. |
| `GET /api/v1/orders` | Lista pedidos com itens, rotas/passos/paradas e coletas/itens. |
| `GET /api/v1/orders/:id` | Consulta um pedido completo. |
| `POST /api/v1/orders` | Cria pedido; resposta 201; produtos repetidos são somados. |
| `POST /api/v1/routes/calculate` | `{ "orderId": "UUID" }`; responde `{orderId, route}` persistida. |
| `POST /api/v1/orders/:id/collections` | Sem corpo; inicia coleta da rota vigente; resposta 201. |
| `PATCH /api/v1/collections/:id/items/:itemId` | `{ "collectedQuantity": 2 }`; valor absoluto confirmado, nunca decremento nem valor acima do solicitado. `itemId` é o ID do CollectionItem. |
| `POST /api/v1/collections/:id/complete` | Sem corpo; conclui somente quando todas as quantidades estiverem atendidas. |
| `POST /api/v1/orders/:id/cancel` | Sem corpo; cancela pedido/coleta preservando estoque já baixado e histórico. |

Produto (POST/PUT):

```json
{"sku":"CX-01","name":"Caixa organizadora","stockQuantity":12,"warehouseNodeId":"UUID_STORAGE_ATIVO","weightKg":1.5,"category":"Organização","isActive":true}
```

`category` e `isActive` são opcionais; demais campos são obrigatórios. A localização deve ser um nó STORAGE ativo, não um texto livre ou uma coordenada enviada pelo navegador. A desativação usa `isActive: false`; não há exclusão física.

Pedido:

```json
{"code":"PED-001","items":[{"productId":"UUID_PRODUTO","requestedQuantity":2}]}
```

O código deve ser único. Há no mínimo um item; produtos precisam estar ativos e ter estoque e posição válidos. Não há reserva antecipada: o estoque é revalidado ao iniciar e ao confirmar a coleta. Cada confirmação atualiza estoque, OrderItem e CollectionItem em uma transação serializável. Repetir a mesma quantidade não baixa estoque novamente. Conflitos concorrentes retornam 409 para atualização e nova tentativa.

A rota persistida contém `id`, `status`, `algorithm`, `totalDistanceMeters`, `conventionalDistanceMeters`, `distanceUnit`, `inputVersion`, `calculatedAt`, `steps` e `stops`. `steps` contém o percurso completo em sequência; `stops` associa posições e itens de pedido. A comparação convencional usa o mesmo grafo com ordem estável dos itens; uma ordem convencional impossível produz `conventionalDistanceMeters: null`. Um recálculo preserva a rota anterior como SUPERSEDED. Mudanças nos dados invalidam a rota antes do início.

## Contrato interno FastAPI

`GET /health` responde `{ "status": "ok", "service": "engine" }`.

`POST /internal/v1/routes/calculate` recebe:

```json
{
  "warehouse": {
    "nodes": [{"id":"ENTRY","x":0,"y":0},{"id":"A","x":2,"y":0},{"id":"EXIT","x":4,"y":0}],
    "edges": [{"from":"ENTRY","to":"A","distance":2},{"from":"A","to":"EXIT","distance":2}]
  },
  "startNodeId":"ENTRY",
  "endNodeId":"EXIT",
  "stops":[{"id":"A","productIds":["P1"]}],
  "strategy":"nearest_neighbor"
}
```

Resposta:

```json
{
  "status":"success",
  "pathNodeIds":["ENTRY","A","EXIT"],
  "stops":[{"nodeId":"A","sequence":1,"productIds":["P1"]}],
  "totalDistance":4,
  "distanceUnit":"m",
  "algorithm":{"shortestPath":"dijkstra","visitOrder":"nearest_neighbor"}
}
```

`strategy` aceita `nearest_neighbor` ou `input_order` (referência convencional). O contrato interno admite omitir `endNodeId`, mas a API pública sempre fornece a única EXIT ativa. Nós e paradas são únicos; arestas dirigidas devem ter extremos existentes, peso finito positivo e pares únicos. A API valida novamente origem/destino, arestas, distância somada, cobertura dos produtos e ordem das paradas antes de salvar.

O cálculo reutiliza `WarehouseGraph` e `dijkstra` do repositório. Não acrescenta arestas reversas. Vizinho Mais Próximo é uma heurística: pode ser pior que a referência ou alcançar um beco sem saída em grafo dirigido. Não é uma busca exaustiva nem uma garantia de ótimo global.

## Erros

Formato público: `{ "error": { "code": "CODIGO", "message": "Mensagem compreensível" } }`.

| HTTP | Condição |
| --- | --- |
| 400 | Corpo, tipos ou UUID inválidos. Campos desconhecidos não são aceitos. |
| 404 | Registro inexistente. |
| 409 | Código duplicado, estado incompatível, rota desatualizada ou conflito concorrente. |
| 422 | Posição/estoque/grafo inválido, quantidade inválida ou caminho não encontrado. |
| 502 | Resposta inválida do motor. |
| 503 | Motor/banco indisponível. |
| 504 | Tempo limite do motor excedido. |

No motor, payload inválido retorna 422/`INVALID_ROUTE_REQUEST`; caminho não encontrado retorna 422/`NO_ROUTE_FOUND`. O cliente Node usa `ENGINE_URL` e `ENGINE_TIMEOUT_MS` (5000 ms por padrão). Não devolve rastros internos ao navegador.

## Compatibilidade

O antigo `POST /api/v1/products` do FastAPI e seu armazenamento JSON foram preservados, pois já faziam parte do repositório. São transitórios, não são consumidos pela interface e não sincronizam com PostgreSQL. O cadastro oficial desta integração está no Fastify. Não migrar dados JSON ou localStorage automaticamente, pois seus identificadores e posições não obedecem necessariamente ao modelo vigente.
