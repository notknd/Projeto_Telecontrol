# Ambiente de desenvolvimento

Este guia define a mesma forma de executar o SmartPick para toda a equipe.
Use **um** dos fluxos abaixo por vez: Docker Compose (recomendado) ou execução nativa. O Docker Compose inicia todos os componentes juntos e evita diferenças entre computadores.

## Pré-requisitos

| Ferramenta | Uso | Versão recomendada |
| --- | --- | --- |
| Git | Obter e atualizar o repositório | versão atual |
| Docker Desktop | Fluxo recomendado; inclui Docker Compose | versão atual, em execução |
| Node.js | Execução nativa de API e web | 22 LTS |
| Python | Execução nativa do motor | 3.13 |

No Windows, após instalar o Docker Desktop, abra-o e espere o status indicar que o mecanismo está em execução. No PowerShell, confirme:

```powershell
git --version
docker --version
docker compose version
node --version
python --version
```

## Primeiro acesso

```powershell
git clone https://github.com/notknd/Projeto_Telecontrol.git
cd Projeto_Telecontrol
Copy-Item .env.example .env
```

Edite somente o arquivo `.env` local para trocar `POSTGRES_PASSWORD`. O arquivo contém configuração local e nunca deve ser enviado ao Git.

## Fluxo recomendado: Docker Compose

Na raiz do repositório:

```powershell
docker compose up --build
```

Na primeira execução, o download das imagens e a instalação das dependências podem levar alguns minutos. Deixe esse terminal aberto enquanto desenvolve.

| Serviço | Endereço/uso |
| --- | --- |
| Frontend Vue | http://localhost:5173 |
| API Fastify | http://localhost:3000/health |
| Motor FastAPI | acessível somente pela rede interna do Compose |
| PostgreSQL | acessível somente pela rede interna do Compose |

Verificações de saúde:

```powershell
Invoke-RestMethod http://localhost:3000/health
docker compose ps
docker compose logs -f api
```

Para parar os serviços, use:

```powershell
docker compose down
```

Não use `docker compose down -v` no trabalho normal: esse comando remove o volume `postgres_data` e apaga os dados locais do PostgreSQL.

## Execução nativa (alternativa sem Docker)

Este fluxo executa API, motor e frontend em três terminais, a partir da raiz do repositório.

### Terminal 1 — API Fastify

```powershell
Set-Location services/api
npm install
npm run dev
```

### Terminal 2 — Motor FastAPI

```powershell
Set-Location services/engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Se o PowerShell bloquear a ativação, use apenas naquele terminal:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### Terminal 3 — Frontend Vue

```powershell
Set-Location apps/web
npm install
npm run dev
```

> O PostgreSQL ainda precisa estar disponível para as próximas etapas que usarem Prisma. Até lá, a fundação atual não consulta o banco durante a execução nativa.

## Verificações antes de abrir um pull request

Execute somente os comandos relativos aos serviços modificados:

```powershell
# API
Set-Location services/api
npm run typecheck
npm test
npm run build

# Motor
Set-Location services/engine
.\.venv\Scripts\Activate.ps1
pytest

# Frontend
Set-Location apps/web
npm run typecheck
npm run build
```

Registre no pull request os comandos executados e qualquer verificação que não foi possível executar.

## Trabalho pelo app ChatGPT para PC

1. Atualize sua branch local antes de iniciar: `git pull origin main`.
2. Crie uma conversa/tarefa para a issue que lhe foi atribuída e informe o número da issue, por exemplo: `Implementar a issue #15 do SmartPick`.
3. Peça para o app inspecionar os arquivos relacionados e implementar somente o escopo da issue.
4. Trabalhe em uma branch própria, como `feature/issue-15-dijkstra`.
5. Antes do PR, execute as verificações desta página e peça uma revisão do diff.
6. No PR, inclua `Closes #NUMERO_DA_ISSUE` na descrição para o GitHub encerrar a issue após o merge.

Não coloque senhas, tokens ou o conteúdo do `.env` em mensagens, commits ou pull requests.

## Problemas comuns

| Sintoma | Ação |
| --- | --- |
| A porta 3000 ou 5173 já está em uso | Altere `API_PORT` ou `WEB_PORT` no `.env` e reinicie o Compose. |
| `docker` não é reconhecido | Instale/inicie o Docker Desktop e abra um novo PowerShell. |
| A API não sobe no Compose | Execute `docker compose logs api`; confirme que `engine` e `db` estão saudáveis com `docker compose ps`. |
| Dependências Node estão inconsistentes | Apague apenas o `node_modules` do serviço afetado e execute `npm install` novamente. |
| O ambiente Python não ativa | Execute `Set-ExecutionPolicy -Scope Process Bypass` e tente de novo no mesmo terminal. |
