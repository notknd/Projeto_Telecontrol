# PRD.md — SmartPick

> **Projeto:** Telecontrol / SmartPick  
> **Objetivo deste documento:** orientar uma IA de programação a desenvolver o projeto de forma incremental, consistente, testável e alinhada à arquitetura definida.  
> **Idioma:** documentação e comunicação em português brasileiro; nomes de código, APIs e identificadores em inglês, salvo convenção existente no repositório.

---

## 1. Instrução principal

Você é um engenheiro de software responsável por desenvolver o **SmartPick**, uma aplicação para otimizar rotas de coleta de produtos em armazéns.

Antes de modificar o código:

1. Inspecione o repositório, a estrutura de pastas, o código existente, o README e os issues relevantes.
2. Identifique o que já foi implementado e reutilize-o quando adequado.
3. Não substitua arquivos, tecnologias ou decisões existentes sem verificar seu propósito.
4. Compare o trabalho planejado com os requisitos deste documento e os issues do GitHub.
5. Se houver conflito entre este documento e uma decisão explícita mais recente da equipe, sinalize o conflito e siga a decisão mais recente.
6. Não afirme que um recurso está concluído sem implementá-lo e executar as verificações pertinentes.

**Não implemente todo o sistema de uma só vez.** Trabalhe em pequenas etapas que possam ser revisadas e testadas independentemente.

## 2. Visão do produto

O SmartPick recebe um pedido de coleta, identifica as posições dos produtos no armazém, calcula uma sequência de visitação eficiente e apresenta a rota em um mapa 2D. Durante a execução, o trabalhador pode marcar produtos como coletados e concluir o pedido. O sistema registra o resultado e permite comparar a rota gerada com uma rota convencional.

O fluxo principal é:

1. Consultar ou criar um pedido.
2. Obter os produtos e as quantidades solicitadas.
3. Resolver as posições dos produtos no armazém.
4. Calcular os caminhos e a ordem de visitação.
5. Apresentar a rota no mapa.
6. Iniciar a coleta.
7. Registrar os itens coletados.
8. Concluir a coleta quando as regras forem atendidas.
9. Salvar os resultados e disponibilizar o histórico.
10. Comparar a rota SmartPick com a rota convencional de referência.

## 3. Stack tecnológica definida

Use esta stack como padrão, a menos que o repositório ou uma decisão explícita da equipe determine outra coisa.

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | Vue.js 3 | Interface do usuário |
| Linguagem frontend | TypeScript | Tipagem e manutenção |
| Build frontend | Vite | Desenvolvimento e compilação |
| Backend principal | Node.js | Regras de negócio e coordenação |
| Framework backend | Fastify | API principal |
| Linguagem backend | TypeScript | Tipagem e organização |
| Motor de cálculos | Python | Grafos, caminhos e otimização |
| API do motor | FastAPI | API interna de cálculos |
| Validação Python | Pydantic | Validar entradas e saídas |
| Banco de dados | PostgreSQL | Persistência principal |
| ORM | Prisma | Acesso ao banco pelo Node.js |
| Comunicação | REST + JSON | Vue ↔ Node e Node ↔ Python |
| Ambiente integrado | Docker Compose | Execução local conjunta |
| Acesso externo futuro | Cloudflare | Publicação e proteção de acesso |

Não introduza novas tecnologias, bibliotecas ou serviços sem uma justificativa concreta. Prefira dependências pequenas e consolidadas.

## 4. Arquitetura e limites de responsabilidade

### 4.1 Vue.js — frontend

Responsável por:

- dashboard;
- telas de produtos e pedidos;
- início e acompanhamento de coletas;
- mapa 2D e desenho da rota;
- progresso da coleta;
- histórico e comparação de resultados.

O frontend **não** deve calcular a rota oficial nem acessar diretamente o banco de dados. Ele chama a API do Node.js e exibe os resultados retornados.

### 4.2 Node.js + Fastify — backend principal

Responsável por:

- expor a API de negócio;
- validar e autorizar requisições;
- gerenciar produtos, pedidos, posições, rotas e coletas;
- acessar o PostgreSQL por meio do Prisma;
- preparar os dados necessários para o cálculo;
- chamar o motor Python;
- validar a resposta do motor;
- persistir resultados e estados de negócio;
- tratar erros, timeouts e indisponibilidade dos serviços.

O Node.js é a **fonte oficial das regras de negócio e dos dados persistentes**.

### 4.3 Python + FastAPI — motor de cálculos

Responsável por:

- receber os dados do grafo e os pontos necessários;
- validar o formato dos dados recebidos;
- calcular caminhos mínimos;
- calcular distâncias;
- determinar a ordem de visitação;
- compor a rota;
- retornar a sequência de posições e métricas;
- oferecer testes unitários independentes.

O motor Python não deve gerenciar pedidos, autenticação de usuários ou persistência principal. No fluxo normal, ele não acessa diretamente o PostgreSQL. Deve receber do Node.js todos os dados necessários ao cálculo.

### 4.4 PostgreSQL

O PostgreSQL armazena os dados persistentes. O acesso normal deve acontecer pelo Node.js/Prisma. Não duplique a lógica de persistência em Python.

### 4.5 Comunicação entre serviços

- Vue.js → Node.js: API pública de negócio.
- Node.js → Python: API interna de cálculo.
- Node.js → PostgreSQL: acesso por Prisma.
- Python → PostgreSQL: não permitido no fluxo padrão.
- Vue.js → Python: não permitido.

Dentro do Docker Compose, o Node.js deve acessar o motor pelo nome do serviço, por exemplo `http://engine:8000`, e não por `localhost`.

O serviço Python deve permanecer na rede interna e não publicar uma porta externa em configuração de produção.

## 5. Estrutura de repositório sugerida

Primeiro inspecione o repositório. Adapte a estrutura abaixo sem apagar arquivos existentes que tenham finalidade válida.

```text
Projeto_Telecontrol/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── views/
│       │   ├── services/
│       │   ├── router/
│       │   └── types/
│       ├── package.json
│       └── Dockerfile
├── services/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── products/
│   │   │   │   ├── orders/
│   │   │   │   ├── warehouse/
│   │   │   │   ├── routes/
│   │   │   │   └── collections/
│   │   │   ├── plugins/
│   │   │   ├── lib/
│   │   │   └── server.ts
│   │   ├── prisma/
│   │   ├── package.json
│   │   └── Dockerfile
│   └── engine/
│       ├── app/
│       │   ├── api/
│       │   ├── algorithms/
│       │   ├── graph/
│       │   ├── services/
│       │   └── main.py
│       ├── tests/
│       ├── requirements.txt
│       └── Dockerfile
├── docs/
│   ├── PRD.md
│   ├── AI_DEVELOPMENT_GUIDE.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ALGORITHMS.md
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

Não crie diretórios vazios apenas para reproduzir o desenho. Crie-os quando houver código ou documentação real a adicionar.

## 6. Contratos de API

Documente os contratos em `docs/API.md` e, quando possível, exponha documentação OpenAPI para as APIs.

Use prefixo de versão para a API principal, por exemplo `/api/v1`.

### 6.1 API principal — exemplos de recursos

```text
GET    /api/v1/products
GET    /api/v1/products/:id
POST   /api/v1/products
PATCH  /api/v1/products/:id

GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders
PATCH  /api/v1/orders/:id

POST   /api/v1/routes/calculate
GET    /api/v1/routes/:id

POST   /api/v1/collections
GET    /api/v1/collections/:id
PATCH  /api/v1/collections/:id/items/:itemId
POST   /api/v1/collections/:id/complete

GET    /api/v1/collections/history
```

Estes endpoints são uma proposta inicial. Inspecione a API já existente e os issues antes de definir ou alterar rotas. Prefira convenções REST consistentes e evite duplicar funcionalidades.

### 6.2 API interna do motor Python

Exemplo:

```text
GET  /health
POST /internal/v1/routes/calculate
```

O Node.js deve enviar ao motor um payload contendo o grafo, o ponto inicial, os pontos de coleta e o destino final, quando aplicável. O payload não deve depender de o Python consultar o banco pelo ID de um pedido.

Exemplo ilustrativo de entrada:

```json
{
  "warehouse": {
    "nodes": [
      {"id": "ENTRADA", "x": 0, "y": 0},
      {"id": "P12", "x": 3, "y": 2}
    ],
    "edges": [
      {"from": "ENTRADA", "to": "P12", "distance": 5.0}
    ]
  },
  "startNodeId": "ENTRADA",
  "stops": [
    {"id": "P12", "productIds": ["PROD-A"]}
  ],
  "endNodeId": "ENTRADA",
  "strategy": "nearest_neighbor"
}
```

Exemplo ilustrativo de saída:

```json
{
  "status": "success",
  "pathNodeIds": ["ENTRADA", "P12", "ENTRADA"],
  "stops": [
    {"nodeId": "P12", "sequence": 1, "productIds": ["PROD-A"]}
  ],
  "totalDistance": 10.0,
  "distanceUnit": "m",
  "algorithm": {
    "shortestPath": "dijkstra",
    "visitOrder": "nearest_neighbor"
  }
}
```

Os valores acima são apenas exemplos. Não use o grafo incompleto como se fosse um armazém real. Defina e valide os contratos antes de integrar os serviços.

### 6.3 Regras dos contratos

- Validar todos os dados de entrada.
- Definir formato consistente para erros.
- Distinguir dados inválidos, recurso inexistente, rota impossível e falha interna.
- Não retornar stack traces ou segredos ao cliente.
- Definir timeout para chamadas Node.js → Python.
- Verificar a resposta do Python antes de persistir ou devolver uma rota.
- Não confiar em distâncias, posições ou status enviados pelo navegador sem validação.
- Usar IDs estáveis e unidades de distância explícitas.
- Manter o contrato sincronizado com testes e documentação.

## 7. Regras de negócio essenciais

1. Todo produto deve possuir uma identificação única.
2. Toda posição referenciada deve existir no modelo do armazém.
3. Um pedido deve conter pelo menos um item.
4. As quantidades solicitadas devem ser positivas.
5. A quantidade coletada não pode ser negativa nem ultrapassar a quantidade solicitada.
6. A rota deve usar apenas nós e conexões válidos do grafo.
7. O cálculo deve informar quando não existe caminho entre os pontos necessários.
8. A rota deve conter todos os pontos de coleta obrigatórios.
9. A coleta só pode ser concluída quando todos os itens obrigatórios estiverem atendidos, salvo se uma regra explícita de negócio definir outra coisa.
10. O backend valida as transições de estado; o frontend apenas solicita a ação.
11. Uma falha de cálculo não deve criar uma rota válida falsa.
12. As distâncias devem usar uma unidade consistente, preferencialmente metros no MVP.
13. Os estados de pedido, rota e coleta devem ser definidos em enums ou constantes compartilhadas dentro de cada serviço.
14. Não misture status de pedido com status de coleta: são entidades com ciclos de vida diferentes.

Antes de fixar detalhes não definidos, procure os issues e a documentação do projeto. Registre ambiguidades em vez de inventar regras silenciosamente.

## 8. Algoritmos de rota

### 8.1 Separar dois problemas

O sistema deve distinguir:

1. **Caminho mínimo entre dois nós:** encontrar a menor distância em um grafo.
2. **Ordem de visitação de vários pontos:** definir em que sequência os produtos serão visitados.

Resolver o primeiro problema não garante uma rota globalmente ótima para o segundo.

### 8.2 Implementação inicial

- Comece com Dijkstra para caminho mínimo em grafos com pesos não negativos.
- Implemente a ordenação de visitação com Vizinho Mais Próximo como heurística inicial.
- Combine os caminhos entre pontos para construir a rota completa.
- Considere o ponto final e a volta à entrada conforme as regras do armazém.
- Registre a distância total e os algoritmos utilizados.
- Implemente A* somente quando houver uma heurística válida para a geometria e o modelo de custos.

### 8.3 Testes obrigatórios do motor

- Grafo simples com caminho conhecido.
- Caminho alternativo mais curto.
- Pesos iguais.
- Grafo desconectado.
- Ponto inicial igual ao destino.
- Um único ponto de coleta.
- Vários pontos de coleta.
- Destino final definido e não definido, se ambos forem suportados.
- IDs inexistentes e arestas inválidas.
- Grafo vazio ou payload malformado.
- Verificação de que a distância retornada é a soma das arestas do caminho.
- Verificação de que nenhum trecho usa uma conexão inexistente.

Use testes determinísticos com resultados esperados conhecidos. Não valide um algoritmo apenas comparando sua saída com outra execução do próprio algoritmo.

## 9. Interface e experiência do usuário

Construa componentes Vue reutilizáveis e mantenha chamadas HTTP em uma camada de serviços separada dos componentes visuais.

Telas do MVP:

1. Dashboard.
2. Produtos.
3. Pedidos.
4. Nova coleta.
5. Mapa 2D com rota.
6. Coleta em andamento.
7. Histórico e comparação de rotas.

Requisitos de interface:

- Exibir carregamento durante requisições.
- Mostrar mensagens compreensíveis em caso de erro.
- Evitar submissões duplicadas.
- Exibir a sequência dos pontos e a distância total.
- Diferenciar visualmente itens pendentes e coletados.
- Não marcar um item como coletado antes da confirmação do backend.
- Atualizar o progresso a partir dos dados confirmados pelo servidor.
- Garantir uso básico por teclado e contraste legível.
- Usar dados de demonstração claramente identificados, sem confundi-los com dados reais.

A biblioteca para mapa 2D pode ser escolhida durante a implementação. SVG é uma opção adequada para mapas simples e interativos; não adicione uma biblioteca pesada sem necessidade demonstrada.

## 10. Banco de dados e persistência

- PostgreSQL é a fonte principal de persistência.
- Use Prisma no backend Node.js.
- Versione o schema e as migrações no Git.
- Não edite o banco manualmente como procedimento normal de desenvolvimento.
- Forneça dados de demonstração por meio de um seed repetível.
- Evite seed que duplique registros a cada execução.
- Use transações quando uma operação alterar várias entidades que precisam permanecer consistentes.
- Defina chaves estrangeiras e restrições relevantes.
- Não apague dados existentes automaticamente ao iniciar a aplicação.
- Mantenha credenciais fora do código e do controle de versão.

Entidades candidatas: Product, Order, OrderItem, WarehouseNode, WarehouseEdge, Route, RouteStop, Collection e CollectionItem. Ajuste os nomes e o modelo à implementação e aos requisitos confirmados.

## 11. Execução local e Docker Compose

A aplicação deve poder ser executada localmente e, posteriormente, em contêineres.

Serviços esperados:

- `web`: Vue.js;
- `api`: Node.js/Fastify;
- `engine`: Python/FastAPI;
- `db`: PostgreSQL.

Requisitos:

- Criar Dockerfile para cada aplicação.
- Criar `compose.yaml` para desenvolvimento integrado.
- Usar variáveis de ambiente e fornecer `.env.example`.
- Persistir o PostgreSQL em volume nomeado.
- Configurar health checks onde apropriado.
- Não depender apenas de `depends_on` para garantir que um serviço esteja pronto.
- Fazer a API tratar indisponibilidade temporária do banco ou do motor.
- Manter o FastAPI acessível somente pela rede interna em produção.
- Não armazenar segredos no repositório.
- Documentar os comandos de build, inicialização, migração, seed, testes e encerramento.

Comandos documentados esperados (adapte-os ao projeto):

```bash
docker compose up --build
docker compose down
docker compose logs -f
```

Não adicione `docker compose down -v` ao fluxo padrão de limpeza: isso pode apagar o volume persistente do banco.

No desenvolvimento sem Docker, documente como instalar as dependências e executar cada serviço separadamente.

## 12. Preparação para Cloudflare

A meta futura é disponibilizar o produto externamente sem acoplar a aplicação a uma plataforma específica.

Para a primeira publicação, considere manter os contêineres em um servidor compatível com Docker e utilizar Cloudflare Tunnel como acesso externo. O Tunnel não substitui o servidor que executa Node.js, Python e PostgreSQL.

Não presuma que Docker Compose ou um servidor FastAPI pode ser executado diretamente em Cloudflare Workers. Se a equipe escolher serviços gerenciados da Cloudflare no futuro, avalie separadamente a compatibilidade do backend e a hospedagem do motor Python.

Para preservar a portabilidade:

- mantenha configurações em variáveis de ambiente;
- não dependa de caminhos locais absolutos;
- não dependa de `localhost` para comunicação entre contêineres;
- separe configuração de desenvolvimento e produção;
- não exponha o banco nem o motor Python publicamente;
- documente portas e origens permitidas;
- mantenha os serviços independentes de funcionalidades exclusivas de um provedor quando não forem necessárias.

A implantação cloud não é pré-requisito para o MVP local.

## 13. Qualidade de código

- Siga os padrões já existentes no repositório.
- Use TypeScript com verificações estritas quando viável.
- Use tipagem explícita nas fronteiras entre módulos.
- Em Python, use type hints e modelos Pydantic para entradas e saídas da API.
- Prefira funções pequenas com responsabilidades claras.
- Evite duplicação de regras de negócio.
- Evite abstrações complexas sem necessidade concreta.
- Não crie arquivos, classes ou camadas apenas para aparentar arquitetura.
- Não engula exceções silenciosamente.
- Não deixe código morto, imports não utilizados ou dependências sem uso.
- Não acrescente comentários que apenas repetem o código; documente decisões e comportamentos não óbvios.
- Não altere formatação de arquivos não relacionados à tarefa.

## 14. Segurança

- Validar os dados em todas as fronteiras.
- Restringir o motor Python à rede interna.
- Manter segredos em variáveis de ambiente.
- Incluir `.env` e arquivos de credenciais no `.gitignore`.
- Não registrar senhas, tokens ou dados sensíveis nos logs.
- Limitar o tamanho dos payloads.
- Definir timeouts para chamadas entre serviços.
- Não retornar detalhes internos de exceções aos clientes.
- Aplicar CORS somente às origens necessárias.
- Se houver autenticação, verificar permissões no backend; ocultar botões no frontend não é controle de acesso.
- Não publicar a aplicação externamente sem revisar configurações de produção.

## 15. Testes e critérios de conclusão

Cada funcionalidade deve incluir testes proporcionais ao risco.

### Backend Node.js

- testes unitários das regras de negócio;
- testes de validação;
- testes de endpoints;
- testes de persistência e transações;
- testes de timeout e erro do motor Python.

### Motor Python

- testes unitários de grafos e algoritmos;
- testes de validação de payload;
- testes de casos extremos;
- testes de integração da API FastAPI.

### Frontend Vue.js

- testes de componentes e estados relevantes;
- testes de tratamento de erro e carregamento;
- testes do fluxo principal de coleta, quando possível.

### Integração

- iniciar os serviços;
- verificar a comunicação Node.js → Python;
- verificar a persistência no PostgreSQL;
- realizar um pedido de ponta a ponta;
- confirmar que o histórico reflete o resultado.

Uma tarefa só está concluída quando:

1. O código está implementado.
2. Os testes relevantes foram executados.
3. Lint, typecheck ou verificações equivalentes passaram, quando configurados.
4. A documentação afetada foi atualizada.
5. Os critérios de aceitação foram verificados.
6. As limitações restantes foram declaradas.

Se não for possível executar algum teste, informe explicitamente o motivo. Não declare que os testes passaram sem executá-los.

## 16. Fluxo de trabalho obrigatório da IA

Para cada issue ou tarefa:

### Etapa A — Entender

- Leia a descrição completa do issue e seus critérios de aceitação.
- Inspecione os arquivos relacionados.
- Identifique dependências e funcionalidades afetadas.
- Resuma o comportamento esperado em poucas frases.

### Etapa B — Planejar

- Proponha uma implementação pequena.
- Identifique arquivos que serão criados ou alterados.
- Identifique testes necessários.
- Aponte ambiguidades que possam mudar a solução.
- Não faça perguntas sobre detalhes que podem ser resolvidos com segurança a partir dos padrões existentes; declare a suposição e prossiga quando apropriado.

### Etapa C — Implementar

- Faça apenas as mudanças necessárias para a tarefa.
- Preserve compatibilidade com funcionalidades existentes.
- Não implemente funcionalidades não solicitadas só porque parecem úteis.
- Não substitua tecnologias sem autorização.
- Mantenha os contratos entre frontend, backend e motor sincronizados.

### Etapa D — Verificar

- Execute os testes pertinentes.
- Execute lint, typecheck e build, quando disponíveis.
- Corrija regressões causadas pelas alterações.
- Revise tratamento de erros, validação e segurança.
- Verifique se o README ou a documentação precisa de atualização.

### Etapa E — Reportar

Ao terminar, responda com:

1. **O que foi feito.**
2. **Arquivos criados ou alterados.**
3. **Decisões técnicas importantes.**
4. **Testes e comandos executados, com resultados reais.**
5. **O que não foi testado ou permanece pendente.**
6. **Próxima tarefa recomendada**, se houver dependências claras.

Não diga que fez commit, push, abriu PR ou alterou issues a menos que tenha realmente executado essa ação.

## 17. Ordem recomendada de implementação

Não comece pela interface completa. Primeiro estabeleça contratos e um fluxo funcional mínimo.

### Fase 0 — Auditoria do repositório

- Inspecionar issues, README e código existente.
- Identificar stack e funcionalidades já implementadas.
- Listar discrepâncias entre o código e este guia.
- Produzir um plano de execução priorizado.
- Não reescrever o projeto durante a auditoria.

### Fase 1 — Fundação

- Organizar a estrutura do monorepositório.
- Criar ou revisar `.gitignore` e `.env.example`.
- Preparar os serviços básicos.
- Criar `compose.yaml` e health checks.
- Documentar a execução local.

**Saída esperada:** todos os serviços iniciam, e os endpoints de saúde funcionam.

### Fase 2 — Modelo de dados

- Definir entidades e relações.
- Criar schema Prisma e migrações.
- Criar seed repetível de demonstração.
- Implementar CRUD mínimo de produtos e pedidos.

**Saída esperada:** produtos e pedidos podem ser persistidos e consultados pela API.

### Fase 3 — Motor de cálculos isolado

- Definir modelos de entrada e saída.
- Modelar o grafo.
- Implementar Dijkstra.
- Criar testes determinísticos.
- Implementar ordenação inicial dos pontos.
- Gerar a rota completa e a distância total.

**Saída esperada:** o motor calcula rotas corretas sem depender do frontend ou do banco.

### Fase 4 — Integração Node.js/Python

- Implementar o cliente HTTP no Node.js.
- Configurar a URL interna por variável de ambiente.
- Implementar timeout e tratamento de erros.
- Validar a resposta do motor.
- Criar testes de integração.

**Saída esperada:** a API principal solicita uma rota ao motor e devolve um resultado validado.

### Fase 5 — Frontend mínimo

- Criar dashboard básico.
- Consultar produtos e pedidos.
- Criar fluxo de seleção de pedido e cálculo de rota.
- Exibir carregamento e mensagens de erro.

**Saída esperada:** usuário consegue solicitar o cálculo pela interface.

### Fase 6 — Mapa e coleta

- Renderizar o armazém em 2D.
- Desenhar a rota.
- Implementar início e progresso da coleta.
- Registrar itens coletados.
- Impedir conclusão inválida.
- Salvar histórico.

**Saída esperada:** fluxo completo de coleta funcional.

### Fase 7 — Comparação e validação

- Definir uma rota convencional de referência.
- Comparar distâncias usando os mesmos dados de armazém e pedido.
- Registrar métricas e resultados.
- Testar casos extremos.
- Documentar limitações da heurística.

**Saída esperada:** comparação reproduzível entre a referência e o SmartPick.

### Fase 8 — Preparação de implantação

- Revisar Dockerfiles e configuração de produção.
- Garantir persistência e health checks.
- Separar configuração de desenvolvimento e produção.
- Revisar segredos, CORS e exposição de portas.
- Documentar a implantação inicial e a alternativa Cloudflare.

**Saída esperada:** implantação reproduzível em um ambiente compatível com Docker.

A ordem pode ser ajustada conforme dependências e issues existentes, mas mantenha sempre um fluxo mínimo funcional e testável.

## 18. Tratamento de ambiguidades

Se o PRD, um issue e o código atual discordarem:

1. Não faça uma alteração destrutiva por suposição.
2. Identifique a divergência.
3. Verifique se existe uma decisão mais recente documentada.
4. Proponha a opção mais simples e coerente.
5. Peça confirmação apenas quando a escolha afetar comportamento de negócio, compatibilidade, dados persistidos ou arquitetura de forma significativa.
6. Se for possível avançar sem bloquear o trabalho, implemente partes independentes e registre a pendência.

Não invente requisitos, metas de desempenho, dimensões do armazém ou ganhos percentuais de eficiência. Marque dados fictícios como exemplos.

## 19. Definition of Done do projeto

O MVP estará pronto para demonstração quando:

- [ ] A aplicação inicia localmente seguindo a documentação.
- [ ] O Docker Compose inicia todos os serviços necessários.
- [ ] O PostgreSQL persiste dados entre reinicializações.
- [ ] Produtos e pedidos podem ser gerenciados pela API.
- [ ] O armazém é representado por um grafo válido.
- [ ] O motor calcula caminhos mínimos corretamente.
- [ ] A estratégia de ordenação gera uma rota completa válida.
- [ ] O Node.js integra-se ao FastAPI com tratamento de erros.
- [ ] O frontend exibe a rota em um mapa 2D.
- [ ] O trabalhador consegue acompanhar e concluir uma coleta.
- [ ] O histórico registra os resultados.
- [ ] A comparação com a rota convencional é reproduzível.
- [ ] Os testes principais passam.
- [ ] README, PRD, arquitetura e contratos de API estão atualizados.
- [ ] Não há credenciais reais versionadas.
- [ ] As limitações conhecidas estão documentadas.

## 20. Instrução final para a IA

Priorize **correção, simplicidade, integração e verificabilidade**. Construa o SmartPick em etapas pequenas, mantendo o sistema executável ao longo do desenvolvimento.

Não tente maximizar a sofisticação do algoritmo antes de validar o grafo e os casos de teste. Não construa uma interface completa antes de ter contratos de API estáveis. Não adicione infraestrutura de produção antes de o fluxo local funcionar.

Sempre trate o código existente e os issues do projeto como contexto que precisa ser inspecionado. Este guia orienta o desenvolvimento, mas não substitui a leitura dos requisitos reais nem autoriza apagar ou reescrever trabalho já realizado.
