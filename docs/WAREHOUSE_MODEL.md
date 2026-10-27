# Modelo do armazém

Este documento é a fonte de verdade da representação do armazém no MVP. Ele conclui a decisão de domínio da issue #2 e deve ser consultado antes de criar o schema Prisma (issue #6), o seed (issue #7), a estrutura executável do motor (issue #8) ou o mapa 2D.

## Decisões do MVP

| Decisão | Definição | Motivo |
| --- | --- | --- |
| Unidade de distância | metro (`m`) | É legível para a operação e permite somar os pesos das arestas sem conversão. |
| Fonte da distância | `WarehouseEdge.distanceMeters` | Uma ligação física pode não ser uma linha reta; a distância declarada representa o trajeto realmente transitável. |
| Coordenadas | `x` e `y` em metros, com a mesma origem para todo o layout | O frontend desenha o mapa e o motor pode usar distância geométrica somente como heurística futura. |
| Identificação técnica | UUID como chave primária | Evita colisão entre ambientes e não altera quando o código visível mudar. |
| Identificação de domínio | `code` imutável e único, por exemplo `ENTRY-01` ou `A-01-03` | É estável, legível em logs, seeds, testes, contrato interno e mapa. |
| Sentido das conexões | Cada aresta é dirigida: `fromNodeId -> toNodeId` | Permite modelar mão única. Uma passagem de ida e volta é representada por duas arestas. |
| Escopo de layout | Um único layout ativo no MVP | Não cria uma entidade `Warehouse` vazia antes de existir necessidade de múltiplos armazéns. A futura evolução deve acrescentar `warehouseId` a nós e arestas, sem alterar esta semântica. |

## Nó do armazém

`WarehouseNode` representa um ponto navegável ou uma posição de estoque. Todos os nós têm coordenadas; paredes, áreas bloqueadas e posições que não existem **não** são nós e, portanto, não podem aparecer em uma rota.

| Campo | Tipo lógico | Regra |
| --- | --- | --- |
| `id` | UUID | Chave primária interna. |
| `code` | texto | Obrigatório, único no layout e imutável depois de publicado. |
| `type` | enum | `ENTRY`, `EXIT`, `AISLE`, `INTERSECTION` ou `STORAGE`. |
| `x`, `y` | decimal em metros | Obrigatórios; referem-se ao centro navegável do ponto no mapa. |
| `label` | texto opcional | Nome amigável para a interface, como `Corredor A`. |
| `isActive` | booleano | `true` por padrão. Um nó inativo não pode receber produto, pedido ou rota nova, mas continua no histórico. |
| `createdAt`, `updatedAt` | data/hora | Auditoria. |

### Tipos de nó

| Tipo | Uso | Pode conter produto? | Pode receber aresta? |
| --- | --- | ---: | ---: |
| `ENTRY` | Ponto onde a coleta começa | Não | Sim |
| `EXIT` | Ponto onde a coleta termina | Não | Sim |
| `AISLE` | Ponto intermediário de corredor | Não | Sim |
| `INTERSECTION` | Encontro ou bifurcação de corredores | Não | Sim |
| `STORAGE` | Posição física de armazenagem e coleta | Sim | Sim |

Há exatamente uma `ENTRY` ativa e uma `EXIT` ativa no layout do MVP. O início de toda rota é a `ENTRY`; o destino final é a `EXIT`. A coleta não pode ser criada se uma delas estiver ausente ou inativa.

## Conexões transitáveis

`WarehouseEdge` representa a possibilidade real de caminhar de um nó a outro.

| Campo | Tipo lógico | Regra |
| --- | --- | --- |
| `id` | UUID | Chave primária. |
| `fromNodeId` | UUID | Nó de origem; deve existir e estar ativo. |
| `toNodeId` | UUID | Nó de destino; deve existir e estar ativo. |
| `distanceMeters` | decimal positivo | Peso do trajeto, sempre maior que zero. |
| `isActive` | booleano | `true` por padrão. Uma conexão inativa não entra em rotas novas, mas é preservada para explicar rotas históricas. |
| `createdAt`, `updatedAt` | data/hora | Auditoria. |

Restrições obrigatórias:

- não há aresta de um nó para ele próprio;
- o par ordenado (`fromNodeId`, `toNodeId`) é único;
- uma aresta nunca atravessa uma parede ou área inacessível: se não for caminhável, ela não existe;
- uma passagem bidirecional possui duas arestas, cada uma com seu próprio peso; em condições normais os pesos são iguais;
- uma passagem de mão única possui somente a aresta autorizada;
- apagar um nó ou aresta que já integra rota/coleta histórica não é permitido; usa-se `isActive = false`.

O motor cria sua lista de adjacência a partir dessas arestas. Assim, o caminho calculado só pode usar conexões persistidas e válidas.

## Exemplo mínimo de layout

```text
ENTRY-01 --4 m--> AISLE-A-01 --3 m--> STORAGE-A-01
                    |                         |
                   5 m                       3 m
                    v                         v
                CROSS-01 --2 m--> STORAGE-B-01 --4 m--> EXIT-01
```

Se os trechos puderem ser percorridos nos dois sentidos, o banco também contém os pares inversos, por exemplo `AISLE-A-01 -> ENTRY-01`. Se houver uma prateleira entre dois pontos sem corredor, não existe aresta entre eles, ainda que suas coordenadas estejam próximas.

## Consumo por cada componente

| Consumidor | O que recebe/consulta | Responsabilidade |
| --- | --- | --- |
| PostgreSQL/Prisma | Nós, arestas e a posição de cada produto | Fonte persistente e íntegra do layout. |
| API Fastify | Layout filtrado para nós e arestas ativos; itens do pedido associados a posições | Montar e validar o pedido do cálculo; não permitir que o navegador invente posições. |
| Motor FastAPI | Grafo dirigido, origem `ENTRY`, posições de coleta e destino `EXIT` | Calcular caminhos apenas pelas arestas fornecidas. |
| Frontend Vue | Nós com `code`, tipo e coordenadas, mais o caminho calculado | Desenhar o mapa e a rota; não inferir conexões a partir da proximidade visual. |

## Validações antes do cálculo

1. Existe uma `ENTRY` e uma `EXIT` ativas.
2. Cada item do pedido tem produto ativo e o produto possui um `STORAGE` ativo associado.
3. Os nós do pedido pertencem ao layout ativo.
4. Todos os pesos são positivos e todos os extremos das arestas estão ativos.
5. Há caminho da entrada para cada ponto de coleta e, depois da última coleta, para a saída. Caso contrário, o cálculo retorna erro de caminho inexistente; ele não produz uma rota parcial como se fosse válida.

## Fora do escopo por enquanto

- múltiplos armazéns ou zonas;
- mudança de sentido baseada em horário;
- mapas em múltiplos andares;
- obstáculos temporários em tempo real;
- cálculo de distância euclidiana como substituto de uma conexão transitável.

Essas extensões são compatíveis com o modelo, mas só devem ser implementadas quando houver requisito real.
