# Banco de dados do MVP

As issues #6 e #7 entregaram o primeiro schema PostgreSQL do SmartPick, sua migração versionada e dados de demonstração repetíveis; ambas foram integradas em `main` pela PR #55. A implementação está em `services/api/prisma`, porque o Node/Fastify é o único serviço que acessará o banco no fluxo normal do produto.

## Preparação e comandos

1. Na raiz, crie `.env` a partir de `.env.example` e crie localmente o usuário e banco PostgreSQL documentados em [DEVELOPMENT.md](DEVELOPMENT.md).
2. Entre em `services/api` e execute `npm install`.
3. Gere o cliente com `npm run db:generate`.
4. Para desenvolvimento, execute `npm run db:migrate`. Ele aplica a migração versionada em um banco vazio e cria novas migrações quando o schema for alterado.
5. Para um ambiente que só aplica o histórico já versionado, use `npm run db:deploy`.
6. Execute `npm run db:seed` para inserir a demonstração.

Todos esses scripts leem `DATABASE_URL` do `.env` da raiz, sem copiar credenciais para `services/api`. `npm run db:validate` valida o schema sem tocar no banco.

Para a execução recomendada com Docker, não é necessário rodar esses comandos manualmente: `docker compose up --build -d` aplica a migração e a seed, e `./scripts/test-compose.ps1` verifica a saúde do conjunto e executa a seed outra vez para confirmar a idempotência.

## Conteúdo do seed

O seed usa `upsert` pelas chaves estáveis (`WarehouseNode.code`, par de nós da aresta, `Product.sku`, `Order.code` e par pedido/produto). Portanto, rodá-lo de novo atualiza os mesmos registros e não duplica dados.

| Dado | Quantidade | Finalidade |
| --- | ---: | --- |
| Nós | 7 | Uma entrada, uma saída, corredor, cruzamento e três posições de armazenamento. |
| Arestas dirigidas | 12 | Seis conexões bidirecionais explícitas, em metros. |
| Produtos | 3 | Um produto por posição de armazenamento. |
| Pedidos | 3 | `DEMO-SHORT`, `DEMO-MULTI-STOP` e `DEMO-CONVENTIONAL`. |

`DEMO-SHORT` tem uma única parada, `DEMO-MULTI-STOP` cobre as três posições e `DEMO-CONVENTIONAL` fornece a mesma seleção em uma ordem convencional para comparação futura pelo motor. A seed não pré-calcula rotas: essa é responsabilidade das próximas issues do motor e integração.

## Integridade preservada no banco

Além das chaves estrangeiras e índices descritos em [DATA_MODEL.md](DATA_MODEL.md), a migração impede autoarestas, distâncias não positivas, estoque ou peso negativos, quantidades inválidas, sequências inválidas e unidades de distância diferentes de metros. Também há índices parciais que garantem uma única `ENTRY` ativa e uma única `EXIT` ativa no layout do MVP.

As regras que precisam comparar tabelas — por exemplo, confirmar que um produto aponta para um nó `STORAGE` ativo e que uma rota pertence ao mesmo pedido que sua coleta — continuam responsabilidade da API transacional. Elas não foram codificadas como gatilhos para manter o banco explícito e o domínio centralizado no Node.js.
