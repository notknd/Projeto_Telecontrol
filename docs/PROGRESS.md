# Acompanhamento do projeto — SmartPick

**Atualizado em:** 3 de novembro de 2026
**Branch de integração efetiva:** `main`
**Status geral:** fundação, modelagem e persistência inicial entregues; o MVP ainda precisa conectar os casos de uso, o motor e a interface.

## Fonte de verdade e alinhamento

O repositório remoto declara `main` como branch padrão e ela contém as entregas já mescladas. Referências antigas a `localhost` em documentação e Notion foram substituídas por `main`; `localhost` permanece apenas como branch histórica, no commit `2448406`.

| Item | Estado confirmado | Evidência |
| --- | --- | --- |
| Fundação do repositório (#1) | Concluída | Issue fechada em 05/10/2026. |
| Modelo do armazém (#2, Kendy) | Concluída e mesclada | PR #53; commits `524456e` e `a212fe2`; `docs/WAREHOUSE_MODEL.md`. |
| Modelo de dados (#4, Kendy) | Concluída e mesclada | PR #53; `docs/DATA_MODEL.md`. |
| Grafo do armazém (#3, Nascimento-tech) | Concluída e mesclada | PR #54; commit `c9011e6`. Não é uma entrega atribuída a Kendy. |
| Cadastro temporário de produtos | Existe no motor FastAPI | Está fora do fluxo alvo do PRD; a persistência de negócio deve migrar para a API Node/Prisma em etapa própria. |

## Semana 01 — entregas de Kendy

As issues #2 e #4 definiram a base comum para persistência, algoritmo e mapa: tipos de nó, entrada e saída únicas, arestas dirigidas em metros, entidades de pedidos/rotas/coletas, estados, cardinalidades, índices e preservação de histórico. Ambas estão fechadas no GitHub e concluídas no Notion.

## Semana 02 — banco e dados de demonstração

O trabalho está na branch `feature/issue-6-7-prisma-seed`, baseada em `main` no commit `79e57a8`.

| Issue | Entrega | Estado | Evidência |
| --- | --- | --- | --- |
| #6 — schema e migração | `schema.prisma`, migração inicial PostgreSQL, cliente Prisma e scripts de banco | Em andamento: implementação pronta, aguardando aplicação em PostgreSQL local vazio | `services/api/prisma/` e `docs/DATABASE.md`. |
| #7 — seed idempotente | Layout, arestas, produtos e três pedidos de demonstração via `upsert` | Em andamento: implementação pronta, aguardando execução dupla contra PostgreSQL local | `services/api/prisma/seed.ts`. |

### Verificações executadas nesta branch

| Verificação | Resultado |
| --- | --- |
| `prisma validate` | Aprovada. |
| `prisma generate` | Aprovada. |
| Typecheck da API e dos arquivos Prisma | Aprovada. |
| Build e teste de saúde da API | Aprovados. |
| `git diff --check` | Aprovado durante a implementação. |
| Aplicar migração e executar seed duas vezes | Pendente: `psql` e Docker não estão instalados nesta máquina. |

## Próximos passos técnicos

1. Instalar/iniciar PostgreSQL local, aplicar `npm run db:migrate` e rodar `npm run db:seed` duas vezes para concluir os critérios verificáveis de #6 e #7.
2. Conectar o cadastro de produtos à API Node/Fastify e ao Prisma, substituindo o armazenamento temporário do motor Python.
3. Implementar pedidos e validações transacionais de estoque na API.
4. Evoluir o motor de rotas com Dijkstra, ordenação das paradas, rota completa e testes determinísticos usando os cenários do seed.
5. Integrar API e motor por contrato interno; somente depois construir o fluxo de pedidos, mapa, coleta, histórico e comparação no frontend.

## Limites e riscos atuais

- Sem PostgreSQL local não é possível atestar a aplicação física da migração nem a idempotência contra uma base real; isso não é tratado como aprovado.
- O modelo exige que a API valide invariantes entre tabelas e transições de estado em transações. O banco já protege chaves, referências e limites numéricos, mas não substitui essas regras de negócio.
- O frontend, a integração Node → motor e o fluxo de coleta ainda não existem; portanto o MVP não está pronto para demonstração ponta a ponta.
