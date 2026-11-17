# Integração do HTML SmartPick com Telecontrol

Data: 08/11/2026. Base: `main` em `f2128bb`. Branch de trabalho: `integration/smartpick-html`.

## Critério de integração

As decisões consolidadas em `docs/DATA_MODEL.md` e `docs/WAREHOUSE_MODEL.md`, a implementação existente e os requisitos do PRD prevalecem sobre o protótipo HTML. A documentação antiga de progresso dizia que Dijkstra ainda não estava integrado; a árvore atual já o continha, por isso ele foi reutilizado. A branch `issue-22-route-calculation` (`c0862d7`) também foi inspecionada: cliente HTTP, contratos, erros e testes foram reaproveitados seletivamente, sem sobrescrever a base ou trazer um segundo Dijkstra.

O HTML fornecido não foi incorporado como uma segunda aplicação ou iframe. Seu visual e fluxos compatíveis foram portados para Vue/TypeScript, com camada HTTP separada e componentes para mapa e ícones, com formulários laterais. O arquivo original em Downloads não foi alterado.

## Aproveitado, adaptado e removido

| Parte do HTML | Destino na integração |
| --- | --- |
| Paleta, sidebar, cartões, tabelas, temas claro/escuro e organização operacional | Adaptados a Vue e CSS local, sem dependência de CDN/fontes externas. |
| Dashboard | Indicadores derivados dos pedidos e produtos retornados pela API. |
| Cadastro/consulta de produtos | Prisma/PostgreSQL; SKU único, estoque, peso, categoria e STORAGE válido. Desativação conserva histórico. |
| Pedidos e roteirização | Pedidos persistidos; navegador envia apenas `orderId` ao cálculo. |
| Mapa 2D | SVG dos nós/conexões reais da seed, com percurso retornado pelo motor. |
| Acompanhamento e conclusão da coleta | Confirmação pelo servidor; estoque e quantidades atualizados na mesma transação. |
| Histórico e comparação | Rotas e coletas persistidas, métricas reais sobre o mesmo grafo; nenhuma economia percentual inventada. |
| Login de teste, senhas/perfis locais e permissões via JavaScript | Removidos da interface integrada: não são autenticação do backend e não fazem parte do modelo do MVP. |
| `localStorage` de produtos, pedidos, coletas e usuários; reset de demonstração no navegador | Removidos. A seed do repositório é a única massa de demonstração. |
| Grafo fixo A–E do HTML; Dijkstra/A*/otimizações no navegador | Removidos. Grafo do banco e Dijkstra existente no Python são usados. A* permanece evolução futura conforme o PRD. |
| Perspectiva, simulação e exportação | Perspectiva SVG do grafo real, simulação visual sem movimentar estoque e exportação CSV do histórico restauradas. Three.js não é necessário para essa projeção. |
| Laboratório A*/2-opt e perfis fictícios | Não há algoritmos paralelos nem autorização simulada no navegador. São extensões distintas do MVP. |
| Pausa/retomada fictícia da coleta | Não portada: o enum oficial não possui PAUSED. |

O cadastro JSON temporário do motor foi **preservado**, por já existir no repositório, mas não é usado pela nova interface. Não há importação automática de localStorage/JSON para o banco oficial.

## Revisão visual solicitada pelo usuário

O CSS, a tipografia Inter/JetBrains Mono e os ícones do HTML original foram recuperados. Fontes são distribuídas localmente. A navegação, os cartões compactos, a carteira de pedidos, os formulários laterais e a prévia da planta seguem a composição do anexo. O arquivo original permanece intacto.

Recursos recuperados: filtros por endereço e situação, localização de produtos, consulta de todos os produtos de uma posição, comparação em barras, camadas de rota otimizada/convencional, zoom, centralização, perspectiva, simulação, próxima parada, tempo decorrido, confirmação por Espaço, busca e exportação CSV do histórico. A exportação neutraliza prefixos de fórmulas nas células.

A planta desenha os corredores e as posições realmente cadastrados: a seed oficial tem sete pontos e três posições de estoque, em vez dos cinquenta endereços fictícios do HTML. Setas indicam sentidos permitidos; números indicam paradas. A perspectiva é uma projeção visual, não um modelo físico 3D. Não foram reinseridos login de teste, permissões locais, reset do banco, pausa sem estado oficial ou estorno fictício.

A consulta entre endereços usa `POST /api/v1/warehouse/distance`, coordenada pelo Node e calculada pelo motor Python existente, sem criar pedidos, rotas ou coletas. A migração incremental `20261108010000_conventional_path` guarda o percurso convencional em `Route.conventionalPathNodeIds`; rotas antigas continuam válidas, com campo nulo. Para pedidos ainda pendentes, recalcular disponibiliza essa camada. Histórico antigo não é reconstruído com dados atuais.

Esta revisão é exclusivamente local: não foram criados novos commits nem enviados arquivos ao GitHub.

## Ajustes necessários na base

- `WarehouseGraph` agora respeita arestas dirigidas, conforme a decisão do armazém. O Dijkstra existente foi mantido.
- Cliente HTTP e validações conferem distância somada, arestas, origem, destino, cobertura e ordem das paradas, e tratam timeout/indisponibilidade.
- Migração incremental permite histórico de recálculos sem violar a antiga unicidade global de `RouteStopItem.orderItemId`.
- Rota registra fingerprint dos dados usados e distância convencional. Alterações de produto invalidam rotas pendentes; o início revalida os dados.
- Transações serializáveis e índices parciais protegem estoque, rota vigente e coleta ativa. Conflitos retornam 409 sem gravação parcial.
- A seed passa a inserir apenas registros ausentes: reinicialização não restaura estoque, não reabre pedidos e não apaga progresso.
- Vite encaminha `/api` ao Node. Compose mantém motor/banco internos, publica web/API apenas no localhost e usa arquivos de dependências travadas.

## Cobertura dos requisitos

| Requisitos | Situação nesta integração |
| --- | --- |
| RF01–RF03 | Cadastro, edição/desativação e consulta de produtos; criação/consulta de pedidos. |
| RF04 | Consulta do layout persistido e associação a posições existentes. Edição de nós/arestas por interface ou CRUD público não foi adicionada; layout segue a seed/migrações do repositório. |
| RF05–RF11 | Grafo dirigido, Dijkstra existente, ordenação, percurso completo e integração Node/Python. |
| RF12–RF19 | Dashboard, coleta, mapa, progresso, histórico e comparação conectados ao servidor. |
| RF20 | Execução nativa integrada validada. Compose atualizado, mas execução Docker pendente neste ambiente. |
| RF21 | Arquitetura local preservada; publicação, autenticação real, HTTPS e configuração de produção não fazem parte desta entrega. |

## Evidências executadas

- Motor: 28 testes aprovados; inclui mão única, caminhos impossíveis, grafo inválido e comparação convencional. Há um aviso de descontinuação de dependência do TestClient.
- API: 11 testes aprovados, incluindo cliente, contratos, health check e integração com PostgreSQL real e motor HTTP real. Typecheck e build aprovados.
- Integração: migrações aplicadas; cadastro inválido/duplicado, soma de itens repetidos, pedido sem estoque, início sem rota, recálculo com histórico, invalidação, início duplicado, conclusão incompleta e cancelamento verificados.
- Concorrência: duas confirmações da mesma quantidade não baixaram estoque duas vezes; repetição posterior permaneceu idempotente.
- Seed: segunda execução preservou produtos/estoques, pedidos, itens, coletas e timestamps após operações reais.
- Frontend: typecheck/build e teste Chromium do fluxo pedido → rota → coleta → histórico, com recarga durante/depois da coleta; cadastro/busca de produto, teclado, mobile, tema escuro e erro de API também verificados.

O banco temporário da validação foi PostgreSQL 18.6; o Compose do repositório continua usando PostgreSQL 17. Não havia Docker disponível, portanto não se declara o Compose testado nem equivalência completa entre os ambientes. Os comandos reproduzíveis estão no README; o teste de integração deve usar um banco descartável.

## Limites e revisão restante

- Revisar esta branch antes do merge e executar `scripts/test-compose.ps1` com Docker. Nenhuma issue foi fechada automaticamente por esta integração.
- Não é uma declaração de 100% do PRD implementado. Edição pública do layout, edição de itens após criação, autenticação real, múltiplos armazéns, lotes, reservas e implantação externa continuam fora desta entrega.
- A heurística não garante ótimo global nem que encontre uma ordem viável em todo grafo dirigido. Quando não completa o percurso, nenhuma rota parcial é salva como válida.
- A referência convencional é a ordem dos itens (`sequence`), agrupada por posição, usando os mesmos caminhos mínimos. Registros antigos sem ordem registrada usam desempate estável por data/ID.
- Cancelamento preserva itens já coletados e estoque baixado; não simula devolução. Alteração de produto durante coleta é bloqueada.
- O histórico conserva a sequência de nós e métricas, mas não uma cópia integral das coordenadas antigas do layout. Edição de layout deve considerar essa limitação antes de ser introduzida.
- Listagens sem paginação são adequadas à massa inicial do MVP; escala maior exige paginação e medição de desempenho.
- Dependências de runtime existentes foram preservadas. A instalação reportou alertas de auditoria nas versões herdadas; atualizar e revisar essas dependências antes de disponibilizar o sistema externamente.

## Arquivos principais

- `apps/web/src/SmartPickApp.vue`, `components/`, `services/api.ts`, `styles.css`: interface integrada.
- `services/api/src/business.ts`, `engine/`, `server.ts`: operações e coordenação.
- `services/api/prisma/schema.prisma`, migração adicional e seed: persistência e integridade.
- `services/engine/app/routes.py`, `graph.py`, `main.py`: contrato e cálculo reutilizando Dijkstra.
- `services/api/src/business.integration.test.ts`, `engine/*.test.ts`, `services/engine/tests/`, `apps/web/tests/flow.mjs`: verificação reproduzível.
