# PRD — SmartPick

**Projeto:** Telecontrol  
**Versão:** 1.1  
**Status:** Em desenvolvimento  
**Objetivo:** Sistema de otimização de rotas para coleta de produtos em armazéns.

## 1\. Visão geral

O SmartPick é uma aplicação destinada a otimizar o processo de coleta de produtos em armazéns, calculando rotas eficientes a partir dos pedidos recebidos e da representação digital do ambiente.

O sistema permitirá cadastrar e consultar produtos, gerenciar pedidos, calcular rotas de coleta, visualizar o percurso em um mapa 2D e acompanhar a execução das coletas.

A aplicação será desenvolvida utilizando uma arquitetura composta por três componentes principais:

- **Frontend:** Vue.js, responsável pela interface e interação com o usuário.  
- **Backend principal:** Node.js, responsável pelas regras de negócio, gerenciamento dos dados e comunicação entre os componentes.  
- **Motor de cálculos:** Python com FastAPI, responsável pelos algoritmos de caminhos mínimos, ordenação dos pontos de coleta e otimização das rotas.

Inicialmente, todos os componentes serão executados localmente. A arquitetura deverá permitir sua posterior execução em contêineres Docker e sua disponibilização pela infraestrutura da Cloudflare, sem exigir a reescrita das funcionalidades principais.

---

# 2\. Problema

A coleta de produtos em armazéns pode gerar deslocamentos desnecessários quando a ordem de visitação dos produtos não considera adequadamente as distâncias e a estrutura dos corredores.

Esse problema pode aumentar o tempo de execução dos pedidos, o esforço físico dos trabalhadores e os custos operacionais.

O SmartPick busca solucionar esse problema por meio de um sistema capaz de calcular e apresentar rotas de coleta eficientes.

### Problema central

Como determinar a melhor sequência de coleta de produtos em um armazém, considerando as posições dos produtos, as conexões entre corredores e a distância percorrida?

---

# 3\. Objetivos do produto

## 3.1 Objetivo principal

Desenvolver um sistema capaz de gerar rotas de coleta eficientes e apresentá-las visualmente aos trabalhadores, reduzindo deslocamentos desnecessários durante a separação de pedidos.

## 3.2 Objetivos específicos

1. Representar digitalmente o layout do armazém.  
2. Cadastrar produtos e suas respectivas posições.  
3. Gerenciar pedidos de coleta.  
4. Calcular caminhos entre pontos do armazém.  
5. Determinar uma ordem eficiente para visitar os produtos.  
6. Apresentar a rota em um mapa 2D.  
7. Acompanhar o progresso das coletas.  
8. Registrar as coletas concluídas.  
9. Comparar os resultados do SmartPick com rotas convencionais.  
10. Permitir a execução local e facilitar uma futura implantação em nuvem.

---

# 4\. Stack tecnológica

A stack proposta será a seguinte:

| Camada | Tecnologia | Responsabilidade |
| :---- | :---- | :---- |
| Frontend | Vue.js 3 | Interface do usuário |
| Linguagem do frontend | TypeScript | Tipagem e manutenção do código |
| Ferramenta de build | Vite | Desenvolvimento e compilação do frontend |
| Backend principal | Node.js | Regras de negócio e coordenação dos serviços |
| Framework do backend | Fastify | Construção da API principal |
| Linguagem do backend | TypeScript | Tipagem e organização do código |
| Motor de cálculos | Python | Algoritmos de rotas e otimização |
| Framework do motor | FastAPI | API de comunicação com o motor |
| Validação Python | Pydantic | Validação dos dados recebidos |
| Banco de dados | PostgreSQL | Persistência de produtos, pedidos e coletas |
| ORM do backend | Prisma | Acesso ao banco pelo Node.js |
| Comunicação frontend/backend | REST API | Troca de dados em JSON |
| Comunicação backend/motor | REST API interna | Solicitação e retorno dos cálculos |
| Contêineres | Docker Compose | Execução integrada dos serviços |
| Proxy e acesso externo futuro | Cloudflare | Publicação e proteção do acesso à aplicação |

&nbsp;

### Por que essas tecnologias?

**Vue.js \+ TypeScript:** permitem construir uma interface organizada, com componentes reutilizáveis e tipagem estática.

**Node.js \+ Fastify:** o Fastify oferece uma estrutura leve para construir a API principal, com validação de dados e suporte a TypeScript.

**Python \+ FastAPI:** Python possui um ecossistema adequado para algoritmos, estruturas de grafos e experimentação com diferentes estratégias de otimização. O FastAPI facilita a exposição desses cálculos por meio de uma API HTTP.

**PostgreSQL:** oferece persistência relacional consistente para produtos, pedidos, posições, rotas e histórico.

**Prisma:** simplifica o acesso ao banco de dados no backend Node.js, incluindo consultas e migrações.

**Docker Compose:** permite iniciar os serviços com uma configuração reproduzível, evitando depender das configurações individuais de cada computador.

Essas escolhas são suficientes para o MVP. Não há necessidade inicial de adicionar Kubernetes, microsserviços adicionais, filas de mensagens ou infraestrutura distribuída.

---

# 5\. Arquitetura do sistema

O projeto utilizará uma arquitetura com um backend principal e um serviço especializado em cálculos.

O Node.js será o ponto central das regras de negócio. O Python não será responsável por gerenciar pedidos ou acessar diretamente o banco de dados principal no fluxo normal da aplicação.

## 5.1 Diagrama arquitetural

```
                  USUÁRIO
                     |
                     v
          +----------------------+
          |   Vue.js + Vite      |
          |      Frontend        |
          +----------------------+
                     |
                 HTTP / JSON
                     |
                     v
          +----------------------+
          |   Node.js + Fastify  |
          |    Backend principal |
          +----------------------+
             |        |        |
             |        |        |
             v        v        v
        Produtos   Pedidos   Coletas
             \        |        /
              \       |       /
               v      v      v
              +----------------+
              |   PostgreSQL   |
              +----------------+
                     ^
                     |
          +----------------------+
          |   Python + FastAPI   |
          |    Motor de rotas    |
          +----------------------+
```

&nbsp;

**Observação:** o diagrama representa as responsabilidades lógicas. Na implementação, o Node.js solicitará os cálculos ao FastAPI; o motor Python devolverá o resultado ao Node.js, que o validará e disponibilizará ao frontend.

## 5.2 Responsabilidades de cada componente

### Vue.js — Frontend

Responsável por:

- apresentar o dashboard;  
- cadastrar e consultar produtos;  
- cadastrar e consultar pedidos;  
- iniciar coletas;  
- exibir o mapa do armazém;  
- desenhar as rotas calculadas;  
- marcar produtos como coletados;  
- apresentar o progresso da coleta;  
- consultar o histórico.

O frontend não deverá implementar os algoritmos de otimização. Ele receberá a rota calculada pelo backend e será responsável por sua representação visual.

### Node.js — Backend principal

Responsável por:

- disponibilizar a API pública da aplicação;  
- validar requisições;  
- gerenciar produtos e pedidos;  
- controlar o estado das coletas;  
- acessar o PostgreSQL;  
- verificar a consistência dos dados;  
- solicitar o cálculo das rotas ao Python;  
- validar os resultados recebidos;  
- registrar as rotas e os resultados das coletas;  
- tratar erros de comunicação entre serviços.

O Node.js será o responsável por coordenar o fluxo de negócio da aplicação.

### Python \+ FastAPI — Motor de cálculos

Responsável por:

- representar o armazém como um grafo;  
- calcular caminhos mínimos;  
- calcular distâncias entre posições;  
- determinar a ordem de visitação dos produtos;  
- montar a rota completa;  
- calcular a distância total;  
- disponibilizar os resultados por meio de uma API interna.

O motor deverá ser desenvolvido de maneira independente do frontend e das regras de negócio do Node.js.

Essa separação permitirá substituir ou aprimorar os algoritmos sem precisar reescrever a interface ou o gerenciamento de pedidos.

---

# 6\. Comunicação entre os serviços

A comunicação entre o Node.js e o Python será realizada por meio de uma API REST interna, com dados em JSON.

## 6.1 Fluxo de cálculo

1. O usuário seleciona um pedido no frontend.  
2. O Vue.js envia uma requisição ao Node.js.  
3. O Node.js consulta o banco de dados.  
4. O backend identifica os produtos, suas posições e o ponto inicial.  
5. O Node.js envia os dados necessários ao FastAPI.  
6. O Python calcula a rota.  
7. O FastAPI devolve a sequência de posições e as métricas.  
8. O Node.js verifica o resultado.  
9. O backend retorna os dados ao frontend.  
10. O Vue.js apresenta a rota no mapa.

## 6.2 Endpoint público do Node.js

```http
POST /api/v1/routes/calculate
```

&nbsp;

Exemplo de requisição:

```json
{
  "orderId": "pedido-1024"
}
```

&nbsp;

O Node.js deverá obter os dados do pedido no banco. Dessa forma, o cliente não poderá enviar posições arbitrárias para substituir as informações cadastradas no sistema.

Exemplo de resposta:

```json
{
  "routeId": "rota-1024",
  "orderId": "pedido-1024",
  "status": "calculated",
  "stops": [
    {
      "positionId": "P12",
      "productId": "PROD-A",
      "sequence": 1
    },
    {
      "positionId": "P04",
      "productId": "PROD-B",
      "sequence": 2
    },
    {
      "positionId": "P19",
      "productId": "PROD-C",
      "sequence": 3
    }
  ],
  "totalDistance": 42.5,
  "distanceUnit": "m"
}
```

&nbsp;

Os valores são ilustrativos. As posições, a distância e a estrutura definitiva dependerão dos dados reais do armazém e do contrato de API implementado.

## 6.3 Endpoint interno do Python

```http
POST /internal/v1/routes/calculate
```

&nbsp;

O Node.js enviará ao motor de cálculos os dados necessários para a otimização, incluindo:

- grafo do armazém;  
- ponto inicial;  
- pontos de coleta;  
- destino final, quando aplicável;  
- parâmetros de otimização.

O Python não deverá receber somente o ID do pedido, pois o gerenciamento dos pedidos pertence ao backend principal.

### Exemplo de resposta do Python

```json
{
  "status": "success",
  "path": [
    "ENTRADA",
    "CORREDOR_A",
    "P12",
    "CRUZAMENTO_2",
    "P04",
    "P19",
    "SAIDA"
  ],
  "totalDistance": 42.5,
  "algorithm": "nearest_neighbor+dijkstra"
}
```

&nbsp;

O formato é ilustrativo. O contrato definitivo deverá ser compartilhado entre as equipes de backend e algoritmo.

### Regras de comunicação

- O Node.js será o único responsável por expor a API pública de negócio.  
- O FastAPI ficará acessível somente pela rede interna no ambiente Docker.  
- Os dados enviados entre os serviços deverão possuir um contrato documentado.  
- As respostas deverão conter informações suficientes para identificar erros.  
- O Node.js deverá tratar indisponibilidade e timeout do motor.  
- O motor deverá validar os dados de entrada antes de iniciar os cálculos.

---

# 7\. Banco de dados

O PostgreSQL será a fonte oficial dos dados persistentes do sistema.

O acesso será realizado pelo Node.js utilizando Prisma.

O motor Python receberá os dados necessários para calcular as rotas por meio do Node.js, evitando manter duas implementações de acesso ao banco e reduzindo o acoplamento entre os serviços.

## 7.1 Entidades principais

### Produto

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| nome | Nome do produto |
| quantidade | Quantidade disponível |
| positionId | Posição no armazém |
| createdAt | Data de criação |
| updatedAt | Data de atualização |

&nbsp;

### Pedido

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| status | Estado atual do pedido |
| createdAt | Data de criação |
| completedAt | Data de conclusão |

&nbsp;

### Item do pedido

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| orderId | Pedido associado |
| productId | Produto solicitado |
| quantity | Quantidade solicitada |
| collectedQuantity | Quantidade coletada |

&nbsp;

### Posição do armazém

| Campo | Descrição |
| :---- | :---- |
| id | Identificador da posição |
| x | Coordenada horizontal |
| y | Coordenada vertical |
| type | Tipo da posição |

&nbsp;

### Conexão do armazém

| Campo | Descrição |
| :---- | :---- |
| id | Identificador da conexão |
| originId | Posição inicial |
| destinationId | Posição final |
| distance | Distância entre posições |

&nbsp;

### Rota

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| orderId | Pedido associado |
| algorithm | Algoritmo utilizado |
| totalDistance | Distância calculada |
| status | Estado da rota |
| createdAt | Data de cálculo |

&nbsp;

### Item da rota

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| routeId | Rota associada |
| positionId | Posição visitada |
| sequence | Ordem de visitação |

&nbsp;

### Coleta

| Campo | Descrição |
| :---- | :---- |
| id | Identificador único |
| orderId | Pedido associado |
| routeId | Rota utilizada |
| startedAt | Início da coleta |
| completedAt | Fim da coleta |
| status | Estado da execução |

&nbsp;

Essa modelagem é inicial e poderá ser ajustada conforme os requisitos dos issues e as decisões de implementação.

---

# 8\. Motor de algoritmos

O motor Python deverá ser organizado para permitir testar algoritmos diferentes e comparar seus resultados.

## 8.1 Representação do armazém

O armazém será representado por um grafo:

- nós representam posições, cruzamentos e pontos de acesso;  
- arestas representam conexões transitáveis;  
- pesos representam as distâncias entre os pontos.

O grafo deverá impedir que o algoritmo gere caminhos por paredes, corredores inexistentes ou conexões proibidas.

## 8.2 Algoritmos propostos

### Dijkstra

Será utilizado para calcular caminhos mínimos em grafos com pesos não negativos.

É uma boa opção para validar a modelagem do armazém e servir como referência para os testes.

### A\*

Poderá ser utilizado para calcular caminhos entre dois pontos com uma heurística adequada às características do mapa.

Em um mapa com coordenadas, uma heurística de distância pode ajudar a reduzir a quantidade de nós explorados, desde que seja admissível e consistente para o modelo adotado.

### Vizinho Mais Próximo

Poderá ser utilizado para determinar uma ordem inicial de visitação dos produtos.

A estratégia seleciona, a cada etapa, o ponto ainda não visitado mais próximo do ponto atual.

É uma heurística simples, útil para o MVP, mas não garante a rota globalmente ótima.

## 8.3 Estratégia recomendada para o MVP

A implementação deverá seguir esta sequência:

1. Modelar o grafo.  
2. Implementar Dijkstra.  
3. Criar testes de caminhos mínimos.  
4. Calcular as distâncias entre os pontos de coleta.  
5. Implementar a estratégia de ordenação.  
6. Combinar os caminhos individuais.  
7. Calcular a distância total.  
8. Comparar a rota gerada com a rota convencional.  
9. Avaliar posteriormente se A\* oferece vantagens relevantes.

**Importante:** encontrar o menor caminho entre dois pontos não é o mesmo que encontrar a melhor rota para visitar vários produtos. O projeto deverá testar essas duas partes separadamente.

---

# 9\. Frontend e experiência do usuário

O frontend será desenvolvido em Vue.js 3, utilizando TypeScript e Vite.

A interface será dividida em componentes reutilizáveis para facilitar a manutenção.

## 9.1 Telas principais

### Dashboard

Apresentará:

- pedidos pendentes;  
- coletas em andamento;  
- pedidos concluídos;  
- atalhos para novas coletas;  
- acesso ao histórico.

### Produtos

Permitirá:

- cadastrar produtos;  
- editar informações;  
- consultar produtos;  
- associar produtos a posições;  
- visualizar disponibilidade.

### Pedidos

Permitirá:

- criar pedidos;  
- adicionar produtos;  
- definir quantidades;  
- consultar status;  
- iniciar uma coleta.

### Nova coleta

Permitirá:

- selecionar um pedido;  
- consultar os produtos;  
- solicitar o cálculo da rota;  
- visualizar a rota antes de iniciar a execução.

### Mapa 2D

Exibirá:

- corredores;  
- posições;  
- entrada e saída;  
- pontos de coleta;  
- caminho calculado;  
- sequência de visitação.

A biblioteca de renderização do mapa poderá ser escolhida durante a implementação. Para o MVP, uma representação 2D em SVG ou Canvas é suficiente.

### Coleta em andamento

Apresentará:

- rota atual;  
- produto a ser coletado;  
- produtos restantes;  
- progresso da coleta;  
- opção para confirmar cada item.

### Histórico

Permitirá consultar coletas anteriores e visualizar as métricas registradas.

---

# 10\. Requisitos funcionais

| ID | Requisito | Responsável principal |
| :---- | :---- | :---- |
| RF01 | Cadastrar produtos | Node.js |
| RF02 | Consultar e atualizar produtos | Node.js |
| RF03 | Cadastrar e consultar pedidos | Node.js |
| RF04 | Gerenciar posições do armazém | Node.js |
| RF05 | Representar o armazém como grafo | Python |
| RF06 | Calcular caminhos mínimos | Python |
| RF07 | Calcular distâncias entre pontos | Python |
| RF08 | Determinar a ordem de coleta | Python |
| RF09 | Gerar a rota completa | Python |
| RF10 | Disponibilizar o cálculo pela API principal | Node.js |
| RF11 | Comunicar-se com o motor Python | Node.js |
| RF12 | Exibir o dashboard | Vue.js |
| RF13 | Iniciar uma nova coleta | Vue.js \+ Node.js |
| RF14 | Exibir o mapa 2D | Vue.js |
| RF15 | Desenhar a rota calculada | Vue.js |
| RF16 | Marcar produtos como coletados | Vue.js \+ Node.js |
| RF17 | Atualizar o status do pedido | Node.js |
| RF18 | Registrar o histórico | Node.js |
| RF19 | Comparar rota convencional e SmartPick | Node.js \+ Python \+ Vue.js |
| RF20 | Executar todos os serviços localmente | Docker Compose |
| RF21 | Preparar a aplicação para implantação futura | Arquitetura \+ DevOps |

&nbsp;

---

# 11\. Requisitos não funcionais

### RNF01 — Execução local

Todos os componentes deverão funcionar localmente sem depender de serviços pagos em nuvem.

### RNF02 — Portabilidade

O projeto deverá poder ser executado em ambientes compatíveis com Docker, reduzindo diferenças entre os computadores da equipe.

### RNF03 — Separação de responsabilidades

A interface, as regras de negócio e os algoritmos deverão permanecer separados.

### RNF04 — Contratos de API

As APIs deverão possuir contratos documentados, com formatos definidos para requisições, respostas e erros.

### RNF05 — Segurança

O motor Python não deverá ser exposto diretamente à internet. O acesso deverá ocorrer por meio do backend principal e da rede interna.

### RNF06 — Manutenibilidade

A estrutura do projeto deverá permitir modificar o algoritmo sem precisar reescrever o frontend ou o gerenciamento de pedidos.

### RNF07 — Confiabilidade

O sistema deverá tratar caminhos inexistentes, posições inválidas, dados inconsistentes e falhas de comunicação entre serviços.

### RNF08 — Observabilidade

Os serviços deverão registrar erros e eventos relevantes para facilitar a identificação de problemas durante o desenvolvimento e a operação.

### RNF09 — Configuração externa

Portas, endereços internos, credenciais e outros parâmetros deverão ser configuráveis por variáveis de ambiente, sem ficarem fixos no código.

### RNF10 — Persistência

Os dados deverão permanecer disponíveis após a reinicialização dos contêineres, utilizando volumes persistentes para o banco de dados.

---

# 12\. Organização do repositório

Para o MVP, recomendo um **monorepositório**, mantendo o frontend, o backend, o motor Python e a configuração de infraestrutura no mesmo repositório Git.

Isso facilita a integração, a revisão de alterações e a execução conjunta dos serviços.

```
Projeto_Telecontrol/
│
├── apps/
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── views/
│       │   ├── services/
│       │   ├── router/
│       │   └── types/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
│
├── services/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── products/
│   │   │   │   ├── orders/
│   │   │   │   ├── routes/
│   │   │   │   └── collections/
│   │   │   ├── plugins/
│   │   │   ├── lib/
│   │   │   └── server.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   └── Dockerfile
│   │
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
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ALGORITHMS.md
│
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

&nbsp;

Essa é uma estrutura sugerida, não uma exigência rígida. Ela poderá ser adaptada aos arquivos que já existem no repositório.

---

# 13\. Docker Compose

A aplicação deverá possuir uma configuração centralizada para iniciar todos os serviços.

## 13.1 Serviços

| Serviço | Função | Porta local sugerida |
| :---- | :---- | :---- |
| `web` | Frontend Vue.js | 5173 durante o desenvolvimento |
| `api` | Backend Node.js | 3000 |
| `engine` | Motor Python/FastAPI | 8000 |
| `db` | PostgreSQL | 5432 |

&nbsp;

As portas são sugestões e poderão ser alteradas conforme a configuração existente.

## 13.2 Exemplo conceitual do Compose

O arquivo a seguir demonstra a organização pretendida. Os caminhos dos Dockerfiles e os comandos deverão corresponder à estrutura final do repositório.

```yaml
services:
  web:
    build:
      context: ./apps/web
    ports:
      - "5173:5173"
    depends_on:
      - api

  api:
    build:
      context: ./services/api
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ENGINE_URL: http://engine:8000
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - db
      - engine

  engine:
    build:
      context: ./services/engine
    expose:
      - "8000"

  db:
    image: postgres:17
    environment:
      POSTGRES_DB: smartpick
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

&nbsp;

Esse exemplo é um ponto de partida, não uma configuração pronta para produção. Os Dockerfiles, a inicialização do banco, as migrações e os comandos de execução ainda precisam ser implementados.

### Regras importantes

- O Node.js acessará o Python pelo endereço `http://engine:8000` dentro da rede Docker.  
- O endereço `localhost` dentro de um contêiner representa o próprio contêiner, não os outros serviços.  
- O frontend deverá usar uma URL de API compatível com o ambiente em que estiver executando.  
- As credenciais reais deverão permanecer fora do repositório.  
- O banco deverá utilizar um volume persistente.  
- As dependências entre serviços deverão ser acompanhadas de verificações de saúde quando necessário.  
- O motor Python não deverá publicar sua porta para a internet.

**Observação sobre o desenvolvimento:** a configuração de produção e a de desenvolvimento podem ser separadas. Por exemplo, o Vite pode utilizar hot reload localmente, enquanto o frontend de produção será compilado em arquivos estáticos servidos por um servidor HTTP.

---

# 14\. Estratégia de implantação futura na Cloudflare

É importante distinguir duas coisas: **usar a Cloudflare para disponibilizar a aplicação e executar todos os contêineres diretamente na infraestrutura da Cloudflare não são a mesma coisa**.

O Docker Compose pode continuar sendo utilizado para desenvolvimento local e em um servidor próprio. Entretanto, os serviços Node.js, Python e PostgreSQL não devem ser considerados automaticamente compatíveis com a execução direta em Workers.

Existem duas estratégias principais.

## Estratégia A — Manter o Docker Compose em um servidor

A aplicação continuará rodando em um servidor compatível com Docker, que pode estar em uma máquina própria ou em uma VM na nuvem.

A Cloudflare será utilizada para fornecer acesso externo e proteção.

Arquitetura:

```
Usuário
   |
   v
Cloudflare
   |
   v
Cloudflare Tunnel
   |
   v
Servidor com Docker Compose
   |
   +--> Vue.js
   +--> Node.js
   +--> Python/FastAPI
   +--> PostgreSQL
```

&nbsp;

Vantagens:

- poucas alterações na aplicação;  
- mantém a mesma arquitetura do desenvolvimento local;  
- permite preservar o motor Python como serviço independente;  
- facilita a implantação inicial.

O Cloudflare Tunnel permite conectar um servidor à rede da Cloudflare sem precisar expor diretamente uma porta de entrada do servidor à internet.

Documentação oficial: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/?utm_source=chatgpt.com)

**Esta é a opção que recomendo para a primeira implantação**, caso vocês queiram manter o Compose e o FastAPI exatamente como foram projetados.

## Estratégia B — Utilizar serviços de execução gerenciados pela Cloudflare

Outra possibilidade é publicar o frontend como conteúdo estático e avaliar a migração de partes do backend para serviços próprios da plataforma.

Nesse cenário, será necessário avaliar a compatibilidade do Node.js com o ambiente de execução dos Workers e decidir onde o motor Python será executado.

O Python com FastAPI não deve ser tratado como se fosse automaticamente executável em um Worker convencional. O motor poderá continuar hospedado em outro ambiente compatível e ser chamado remotamente.

A arquitetura poderá ficar assim:

```
Usuário
   |
   v
Cloudflare Pages ou Workers
   |
   v
Backend compatível com a plataforma
   |
   +--> Banco de dados compatível
   |
   +--> Serviço Python/FastAPI hospedado separadamente
```

&nbsp;

Documentação oficial: [Cloudflare Workers](https://developers.cloudflare.com/workers/?utm_source=chatgpt.com)

Essa alternativa pode ser útil caso vocês queiram adotar uma arquitetura mais gerenciada futuramente, mas exige decisões adicionais sobre hospedagem, banco de dados e comunicação entre serviços.

### Decisão para o PRD

A aplicação deverá ser desenvolvida de modo que a implantação inicial em um servidor Docker e uma eventual migração para serviços gerenciados não exijam reescrever as regras de negócio ou os algoritmos.

Não é necessário decidir agora entre essas duas estratégias para começar o desenvolvimento.

---

# 15\. Requisitos de segurança e configuração

A aplicação deverá seguir estas regras desde o MVP:

1. As credenciais do PostgreSQL deverão ser fornecidas por variáveis de ambiente.  
2. O arquivo `.env` real deverá estar no `.gitignore`.  
3. O repositório deverá conter um `.env.example` sem credenciais reais.  
4. O FastAPI deverá ficar acessível somente pela rede interna no Compose.  
5. O backend deverá validar os dados antes de encaminhá-los ao motor.  
6. Os serviços deverão tratar erros e tempos limite.  
7. A aplicação não deverá confiar em dados de rota calculados diretamente pelo navegador.  
8. A publicação externa deverá ocorrer por meio de um ponto de entrada controlado.  
9. A configuração de produção deverá utilizar HTTPS.  
10. O sistema deverá evitar registrar credenciais e outros dados sensíveis nos logs.

---

# 16\. Critérios de aceitação do MVP

O MVP será considerado funcional quando o fluxo abaixo puder ser executado:

1. Cadastrar produtos.  
2. Associar os produtos a posições válidas.  
3. Criar um pedido.  
4. Selecionar o pedido na interface.  
5. Solicitar o cálculo da rota.  
6. Processar o cálculo no motor Python.  
7. Receber o resultado no backend Node.js.  
8. Apresentar a rota no mapa 2D.  
9. Iniciar a coleta.  
10. Marcar produtos como coletados.  
11. Concluir o pedido.  
12. Registrar a coleta no histórico.  
13. Comparar a rota gerada com uma rota convencional.  
14. Executar os serviços integrados localmente.  
15. Subir a aplicação por meio do Docker Compose.

Além disso, os testes deverão comprovar que o sistema trata adequadamente posições inválidas, pedidos inexistentes, caminhos impossíveis e falhas de comunicação com o motor Python.

---

# 17\. Plano de desenvolvimento

Recomendo organizar a implementação em etapas, para que o projeto seja testável desde o início.

| Fase | Entregas | Resultado esperado |
| :---- | :---- | :---- |
| 1\. Fundação | Repositório, estrutura de pastas, configuração local e Compose | Serviços iniciam corretamente |
| 2\. Modelagem | Banco de dados, produtos, posições e pedidos | Dados persistidos |
| 3\. Motor de rotas | Grafo, Dijkstra e testes unitários | Caminhos mínimos funcionando |
| 4\. Integração | FastAPI, cliente HTTP no Node.js e contratos | Backend calcula rotas pelo Python |
| 5\. Frontend | Dashboard, produtos, pedidos e nova coleta | Interface integrada à API |
| 6\. Visualização | Mapa 2D e desenho da rota | Rota visível ao trabalhador |
| 7\. Execução | Progresso, produtos coletados e conclusão | Fluxo de coleta completo |
| 8\. Validação | Testes de integração e comparação de rotas | Resultados mensuráveis |
| 9\. Documentação | README, arquitetura e API | Projeto reproduzível pela equipe |
| 10\. Implantação | Configuração de produção e Cloudflare | Aplicação acessível externamente |

&nbsp;

---

# 18\. Indicadores de sucesso

O sucesso do SmartPick será avaliado por métricas que possam ser verificadas nos testes.

### KPI 01 — Redução da distância

\[ \\text{Redução (%)} \= \\frac{D\_c-D\_s}{D\_c}\\times100 \]

Onde:

- ${D}_{c}$: distância da rota convencional;  
- ${D}_{s}$: distância da rota SmartPick.

### KPI 02 — Validade das rotas

Meta: 100% das rotas geradas para os cenários válidos de teste devem respeitar as conexões e posições do grafo.

### KPI 03 — Conclusão das coletas

Percentual de pedidos que percorrem o fluxo completo sem erros.

### KPI 04 — Tempo de cálculo

Tempo necessário para calcular a rota em diferentes quantidades de produtos.

A meta numérica deverá ser definida após a criação de um conjunto representativo de testes.

### KPI 05 — Reprodutibilidade

Outro integrante da equipe deverá conseguir clonar o repositório, configurar o ambiente e iniciar a aplicação seguindo o README.

---

# 19\. Decisões arquiteturais consolidadas

| Decisão | Definição |
| :---- | :---- |
| Interface | Vue.js 3 \+ TypeScript |
| Backend principal | Node.js \+ TypeScript \+ Fastify |
| Motor de cálculos | Python \+ FastAPI |
| Banco de dados | PostgreSQL |
| ORM | Prisma |
| Comunicação entre serviços | REST \+ JSON |
| Execução inicial | Local |
| Orquestração local | Docker Compose |
| Acesso externo futuro | Cloudflare |
| Acesso ao banco | Exclusivamente pelo backend Node.js no fluxo normal |
| Responsável pelas regras de negócio | Node.js |
| Responsável pelos algoritmos | Python |
| Responsável pela visualização | Vue.js |

&nbsp;

---

# 20\. Conclusão

O SmartPick será desenvolvido como uma aplicação modular, com responsabilidades bem definidas e preparada para execução local e implantação futura.

A escolha de Vue.js, Node.js e Python permite que a equipe trabalhe separadamente na interface, nas regras de negócio e nos algoritmos, mantendo uma integração relativamente simples por meio de APIs REST.

O Docker Compose permitirá executar os componentes em conjunto desde o desenvolvimento, enquanto a separação entre serviços facilitará a futura implantação.

**A recomendação final é começar com um monorepositório, PostgreSQL, Node.js com Fastify e Python com FastAPI, mantendo o motor de cálculos como serviço interno.** Para a primeira publicação externa, a alternativa mais direta será manter os contêineres em um servidor compatível com Docker e utilizar a Cloudflare para disponibilizar o acesso.

Essa arquitetura atende ao objetivo imediato do projeto sem introduzir complexidade desnecessária e deixa espaço para evoluções futuras.