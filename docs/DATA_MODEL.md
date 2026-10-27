# Modelo de dados do MVP

Este documento define as entidades persistentes e suas regras antes do schema Prisma e da primeira migração. Ele atende à issue #4 e usa o [modelo do armazém](WAREHOUSE_MODEL.md) como dependência.

## Convenções gerais

- Todas as entidades usam `id` UUID, `createdAt` e `updatedAt` quando aplicável.
- Valores de quantidade são inteiros positivos; campos de quantidade acumulada podem ser zero, mas nunca negativos.
- Distâncias usam decimal em metros (`distanceMeters`), não ponto flutuante. Na API, a representação JSON é numérica em metros.
- Exclusão física é proibida para registros que fazem parte de um pedido, rota ou coleta concluída. A desativação preserva o histórico.
- O banco é a fonte oficial. O motor de rotas recebe uma cópia validada do grafo; não acessa PostgreSQL diretamente.

## Entidades e cardinalidades

```text
WarehouseNode 1 ──< WarehouseEdge (fromNode)
WarehouseNode 1 ──< WarehouseEdge (toNode)
WarehouseNode 1 ──< Product

Order 1 ──< OrderItem >── 1 Product
Order 1 ──< Route 1 ──< RouteStep >── 1 WarehouseNode
Route 1 ──< RouteStop 1 ──< RouteStopItem >── 1 OrderItem
Route 1 ── 0..1 Collection 1 ──< CollectionItem >── 1 OrderItem
```

`RouteStep`, `RouteStopItem` e `CollectionItem` são entidades de apoio necessárias para não perder a sequência física, os vários itens em uma mesma posição e o histórico de execução.

## Catálogos de estado

### Pedido (`OrderStatus`)

| Estado | Significado | Próximas transições permitidas |
| --- | --- | --- |
| `PENDING` | Pedido criado, ainda sem rota vigente | `ROUTED`, `CANCELLED` |
| `ROUTED` | Há rota calculada e válida aguardando início | `COLLECTING`, `PENDING`, `CANCELLED` |
| `COLLECTING` | Uma coleta está em execução | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | Todos os itens foram coletados | nenhuma |
| `CANCELLED` | Pedido encerrado sem concluir | nenhuma |

Voltar de `ROUTED` para `PENDING` invalida a rota vigente e conserva-a como histórico. Não é permitido editar itens de um pedido em `COLLECTING`, `COMPLETED` ou `CANCELLED`.

### Rota (`RouteStatus`)

| Estado | Significado |
| --- | --- |
| `CALCULATED` | Resultado validado e disponível para iniciar coleta. |
| `SUPERSEDED` | Resultado preservado, mas substituído por recálculo. |
| `IN_USE` | É a rota da coleta em andamento. |
| `COMPLETED` | A coleta terminou usando esta rota. |
| `INVALIDATED` | Deixou de poder ser iniciada por mudança/cancelamento do pedido. |

### Coleta (`CollectionStatus`)

| Estado | Significado |
| --- | --- |
| `IN_PROGRESS` | Operador iniciou a execução da rota. |
| `COMPLETED` | Todas as quantidades solicitadas foram confirmadas. |
| `CANCELLED` | Execução interrompida; os registros já feitos são preservados. |

## Tabelas do domínio

### `WarehouseNode` e `WarehouseEdge`

São definidos em detalhe no [modelo do armazém](WAREHOUSE_MODEL.md). Os campos essenciais são:

- `WarehouseNode(id, code, type, x, y, label, isActive)`;
- `WarehouseEdge(id, fromNodeId, toNodeId, distanceMeters, isActive)`.

Índices/restrições: `WarehouseNode.code` único; `WarehouseEdge(fromNodeId, toNodeId)` único; `fromNodeId != toNodeId`; `distanceMeters > 0`.

### `Product`

| Campo | Regra |
| --- | --- |
| `id` | UUID. |
| `sku` | Obrigatório e único; identificador de negócio. |
| `name` | Obrigatório. |
| `stockQuantity` | Inteiro maior ou igual a zero. |
| `warehouseNodeId` | Obrigatório para produto disponível à coleta; referencia um `WarehouseNode` do tipo `STORAGE` ativo. |
| `isActive` | Produto desativado não entra em pedidos novos, mas permanece no histórico. |

No MVP, um produto ocupa uma única posição de estoque. Um nó de armazenagem pode conter mais de um produto. A evolução para múltiplas posições por SKU deve criar uma entidade de inventário, em vez de duplicar `Product`.

### `Order` e `OrderItem`

| Entidade | Campos e regras |
| --- | --- |
| `Order` | `id`, `status`, `createdAt`, `completedAt?`, `cancelledAt?`. Um pedido tem ao menos um item antes de poder sair de `PENDING`. |
| `OrderItem` | `id`, `orderId`, `productId`, `requestedQuantity`, `collectedQuantity` (inicia em zero), `productSkuSnapshot`, `productNameSnapshot`. O par `(orderId, productId)` é único; itens repetidos são somados, não duplicados. |

Ao criar ou alterar um item em `PENDING`, a API valida que o produto está ativo, possui posição válida e que `requestedQuantity` não excede o estoque disponível. A atualização de coleta que aumenta `collectedQuantity` diminui `Product.stockQuantity` na **mesma transação**. Isso impede que o histórico e o estoque fiquem divergentes se uma operação falhar.

Os campos de snapshot registram como o produto era chamado e identificado quando o pedido foi feito. Assim, renomear um produto depois não altera relatórios e coletas antigas.

### `Route`, `RouteStep`, `RouteStop` e `RouteStopItem`

| Entidade | Campos e regras |
| --- | --- |
| `Route` | `id`, `orderId`, `status`, `algorithm`, `totalDistanceMeters`, `distanceUnit = "m"`, `calculatedAt`, `inputVersion`. Uma rota pertence a um pedido; várias rotas históricas podem pertencer ao mesmo pedido, mas só uma pode estar em `CALCULATED` ou `IN_USE`. |
| `RouteStep` | `id`, `routeId`, `warehouseNodeId`, `sequence`. Registra cada nó percorrido, inclusive entrada, cruzamentos, corredores e saída. `(routeId, sequence)` é único. |
| `RouteStop` | `id`, `routeId`, `warehouseNodeId`, `sequence`. É apenas uma parada lógica de coleta em `STORAGE`; começa em 1 e segue a ordem de coleta. `(routeId, sequence)` e `(routeId, warehouseNodeId)` são únicos. |
| `RouteStopItem` | `routeStopId`, `orderItemId`. Uma parada pode atender vários itens na mesma posição; cada item do pedido aparece uma vez na rota. |

`RouteStep` resolve um problema que somente `RouteStop` não cobre: o mapa precisa exibir todo o percurso válido, inclusive os nós de passagem. `totalDistanceMeters` é a soma dos pesos das arestas entre passos consecutivos e é validada pela API antes de persistir a resposta do motor.

### `Collection` e `CollectionItem`

| Entidade | Campos e regras |
| --- | --- |
| `Collection` | `id`, `orderId`, `routeId`, `status`, `startedAt`, `completedAt?`, `cancelledAt?`. Só pode ser criada para uma rota `CALCULATED` do mesmo pedido. Há no máximo uma coleta em andamento por pedido. |
| `CollectionItem` | `id`, `collectionId`, `orderItemId`, `requestedQuantity`, `collectedQuantity`, `collectedAt?`. Há um por item do pedido na coleta. |

Uma coleta só passa a `COMPLETED` quando todos os seus `CollectionItem.collectedQuantity` são iguais a `requestedQuantity`. No mesmo ato, o pedido passa a `COMPLETED`, a rota a `COMPLETED` e são preenchidos os horários de conclusão. Essa transição é transacional.

## Invariantes de integridade

1. Um produto associado a posição só pode apontar para `WarehouseNode.type = STORAGE` ativo.
2. Um item de pedido deve ter `requestedQuantity > 0` e `0 <= collectedQuantity <= requestedQuantity`.
3. Uma rota só pode referenciar nós ativos e pertencentes ao layout ativo no instante do cálculo.
4. A primeira `RouteStep` é a `ENTRY` e a última é a `EXIT`; passos consecutivos devem corresponder a uma `WarehouseEdge` dirigida.
5. Todo `RouteStop` aponta para `STORAGE` e todo `RouteStopItem` pertence ao pedido da rota.
6. Nenhuma rota pode ser iniciada se o pedido, seus produtos ou suas posições foram alterados após `inputVersion`; nesse caso ela passa a `INVALIDATED` e deve ser recalculada.
7. Histórico não é apagado: produto, nó, rota e coleta usados em registros antigos são desativados, não removidos.

## Índices que a primeira migração deve criar

- `Product(sku)` único e `Product(warehouseNodeId)`;
- `Order(status, createdAt)` e `OrderItem(orderId, productId)` único;
- `WarehouseNode(code)` único e `WarehouseEdge(fromNodeId, toNodeId)` único;
- `Route(orderId, status, calculatedAt)`;
- `RouteStep(routeId, sequence)` único;
- `RouteStop(routeId, sequence)` único e `RouteStopItem(orderItemId)`;
- `Collection(orderId, status)` e `CollectionItem(collectionId, orderItemId)` único.

## Limites desta decisão

Este é o modelo do MVP, não uma tentativa de cobrir WMS completo. Lotes, validade, reservas concorrentes, múltiplos armazéns, reabastecimento, operadores e auditoria por usuário ficam fora deste schema inicial. Quando necessários, devem ser adicionados sem desfazer os registros históricos definidos aqui.
