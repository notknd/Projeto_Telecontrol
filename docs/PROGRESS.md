# Acompanhamento do projeto — SmartPick

**Atualizado em:** 26 de outubro de 2026
**Branch de integração:** `localhost`
**Status geral:** fundação técnica concluída; MVP ainda em desenvolvimento e executado localmente como prioridade.

## Visão geral

O SmartPick otimiza rotas de coleta em armazéns. A arquitetura definida utiliza Vue 3 no frontend, Node.js/Fastify na API principal, Python/FastAPI no motor de rotas e PostgreSQL para persistência.

Nesta primeira etapa, foi criada a base executável e documentada do projeto. O objetivo foi preparar os serviços de forma independente, sem antecipar regras de negócio, CRUD ou algoritmos antes de definir o modelo de dados e os contratos necessários.

## Entregue

### Estrutura dos serviços

| Componente | Caminho | Tecnologia | Estado |
| --- | --- | --- | --- |
| Frontend | `apps/web` | Vue 3, TypeScript e Vite | Base criada |
| API principal | `services/api` | Node.js, Fastify e TypeScript | Base criada |
| Motor de rotas | `services/engine` | Python e FastAPI | Base criada |
| Banco de dados | `compose.yaml` | PostgreSQL | Configurado no Compose |

### Infraestrutura e configuração

- A branch `localhost` estabelece o desenvolvimento nativo como fluxo oficial: web, API e motor usam `127.0.0.1`.
- `.env.example` documenta portas, `ENGINE_URL` local e a futura `DATABASE_URL` do PostgreSQL local.
- `scripts/start-local.ps1` abre os três serviços locais e `scripts/test-local.ps1` executa a suíte nativa.
- `compose.yaml` e Dockerfiles foram preservados apenas para a fase posterior de implantação.
- `.gitignore` protege variáveis locais, dependências, artefatos de build e caches Python.
- O motor FastAPI não expõe porta ao host e será acessado internamente pela API através de `http://engine:8000`.

### Saúde dos serviços

| Serviço | Endpoint | Resposta esperada |
| --- | --- | --- |
| API | `GET /health` | `{"status":"ok","service":"api"}` |
| Motor | `GET /health` | `{"status":"ok","service":"engine"}` |

O Compose também possui health checks para PostgreSQL, API e motor.

### Frontend inicial

Foi criada uma página Vue mínima que identifica que a fundação está pronta. Ela não contém, intencionalmente, telas de produtos, pedidos, mapa ou coleta neste estágio.

### Documentação disponível

- `README.md`: objetivo do projeto e instruções de execução.
- `prd.md`: requisitos de produto.
- `AI_DEVELOPMENT_GUIDE.md`: diretrizes de desenvolvimento incremental.
- `docs/ARCHITECTURE.md`: responsabilidades e comunicação entre serviços.
- `docs/API.md`: contratos dos endpoints de saúde.
- `docs/IMPLEMENTATION_PLAN.md`: auditoria inicial e plano de execução.
- `docs/DEVELOPMENT.md`: ambiente padronizado da equipe, execução, verificações e fluxo de trabalho.

## Verificações executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| Compilação sintática Python (`compileall`) | Aprovada | Código do motor e seus testes sem erro sintático. |
| Validação dos `package.json` | Aprovada | Arquivos JSON da API e do frontend válidos. |
| `git diff --check` | Aprovada | Nenhum erro de espaços em branco no patch. |
| Testes FastAPI | Não executados | O ambiente de desenvolvimento não tinha FastAPI nem suporte a `venv`. |
| Build/typecheck Node.js | Não executados | Node.js e npm não estavam instalados no ambiente. |
| Docker Compose | Adiado | Não faz parte da validação do MVP enquanto o fluxo localhost é a referência. |

### Validação do ambiente — 25 de outubro de 2026

| Verificação | Resultado | Observação |
| --- | --- | --- |
| API: `npm run typecheck`, `npm test` e `npm run build` | Aprovada | O endpoint de saúde foi testado. |
| Motor: `pytest` | Aprovada | Um teste de saúde aprovado; há avisos de depreciação das dependências em Python 3.14. |
| Frontend: `npm run typecheck` e `npm run build` | Aprovada | A configuração TypeScript foi corrigida para incluir os tipos do Node e as bibliotecas necessárias ao Vite. |
| Docker Compose | Adiado | Será validado apenas depois de o fluxo local completo do MVP estar aprovado. |

As verificações não executadas não foram consideradas aprovadas. A prioridade atual é validar o fluxo completo nativo em `localhost`; Docker e publicação serão tratados como uma etapa de implantação posterior.

## Pendências do MVP

- Definir as entidades do domínio e o schema Prisma.
- Criar migrações e um seed repetível de demonstração.
- Implementar CRUD mínimo de produtos e pedidos.
- Modelar o grafo do armazém.
- Implementar Dijkstra, testes determinísticos e a heurística de vizinho mais próximo.
- Criar o contrato interno de cálculo de rotas.
- Integrar API Fastify e motor FastAPI com timeout, validação e tratamento de falhas.
- Criar o fluxo de seleção de pedido e cálculo no frontend.
- Renderizar mapa 2D, rota e progresso da coleta.
- Registrar e consultar o histórico de coletas e a comparação com rota convencional.

## Próxima etapa recomendada

Implementar o modelo de dados: definir as entidades `Product`, `Order`, `OrderItem`, `WarehouseNode`, `WarehouseEdge`, `Route` e `RouteStop`; depois criar o schema Prisma, sua primeira migração e um seed de demonstração idempotente. Essa etapa estabelece a fonte oficial de dados necessária antes do CRUD e da integração com o motor de rotas.
