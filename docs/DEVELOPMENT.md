# Desenvolvimento local

Esta página define o fluxo oficial do SmartPick enquanto o MVP estiver em construção: tudo roda nativamente em `localhost`, sem Docker, Cloudflare, túnel ou serviço externo. A branch de integração é `main`; toda nova branch de tarefa deve partir dela.

## Pré-requisitos

| Ferramenta | Uso | Versão recomendada |
| --- | --- | --- |
| Git | Obter e compartilhar o código | versão atual |
| Node.js | API e frontend | 22 LTS |
| Python | Motor de rotas | 3.13+ |
| PostgreSQL | Banco local para o MVP | 17 |

Confirme as ferramentas instaladas:

```powershell
git --version
node --version
npm --version
python --version
psql --version
```

> Docker Desktop e Cloudflare **não** são pré-requisitos desta fase.

## Primeiro acesso

```powershell
git clone https://github.com/notknd/Projeto_Telecontrol.git
cd Projeto_Telecontrol
git switch main
Copy-Item .env.example .env
```

O `.env` é exclusivamente local. Não inclua senhas, tokens ou o seu conteúdo em commits, PRs ou conversas.

## Banco de dados local

O schema Prisma, a migração inicial e o seed foram entregues nas issues #6 e #7. Instale PostgreSQL localmente e crie o usuário e banco com os mesmos valores do `.env`:

```powershell
psql -U postgres -c "CREATE ROLE smartpick LOGIN PASSWORD 'change-this-local-password';"
psql -U postgres -c "CREATE DATABASE smartpick OWNER smartpick;"
```

Se já existirem, não repita esses comandos. Em seguida, na raiz do projeto, instale as dependências e aplique os dados de demonstração:

```powershell
Set-Location services/api
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:migrate` é o comando de desenvolvimento e aplica a migração inicial em um banco vazio. Em ambientes que só devem aplicar migrações já versionadas, use `npm run db:deploy`. Execute `npm run db:seed` uma segunda vez para confirmar que a seed não cria duplicações. Veja [DATABASE.md](DATABASE.md) para os cenários carregados e as restrições do schema.

## Iniciar todos os serviços

Na raiz do projeto:

```powershell
.\scripts\start-local.ps1
```

Na primeira vez, o script instala dependências Node, cria o ambiente virtual Python e instala os requisitos do motor. Depois abre três janelas de PowerShell, uma para cada serviço. Para reiniciar sem reinstalar dependências, use:

```powershell
.\scripts\start-local.ps1 -SkipInstall
```

| Serviço | Endereço |
| --- | --- |
| Frontend Vue | http://127.0.0.1:5173 |
| API Fastify | http://127.0.0.1:3000/health |
| Motor FastAPI | http://127.0.0.1:8000/health |
| PostgreSQL | `127.0.0.1:5432` |

Confirme a saúde dos serviços antes de desenvolver:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:8000/health
```

Para parar, pressione `Ctrl+C` em cada uma das três janelas abertas pelo script.

## Execução manual

Se precisar depurar somente um serviço, use terminais separados.

```powershell
# API
Set-Location services/api
npm install
npm run dev

# Motor
Set-Location services/engine
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
Set-Location apps/web
npm install
npm run dev
```

## Testes obrigatórios antes do pull request

Execute na raiz:

```powershell
.\scripts\test-local.ps1
```

O script valida typecheck, testes e build da API; testes do motor; typecheck e build do frontend; e `git diff --check`. Registre no PR qualquer verificação que não foi possível executar.

O teste manual do MVP, quando os módulos existirem, deve cobrir: criar pedido → calcular rota → iniciar coleta → registrar produtos → concluir pedido → consultar histórico.

## Trabalho pelo app ChatGPT para PC

1. Atualize a branch de integração: `git switch main` e `git pull origin main`.
2. Crie sua branch a partir dela, por exemplo `feature/issue-15-dijkstra`.
3. Abra uma conversa/tarefa para a issue e informe seu número e os arquivos envolvidos.
4. Peça alterações restritas ao escopo da issue e revise o diff antes de commitar.
5. Execute `.\scripts\test-local.ps1`, valide também `npm run db:validate` quando alterar o schema, envie sua branch e abra um PR para `main`.
6. Use `Closes #NUMERO` somente quando o trabalho realmente cumprir os critérios de aceite.

## Docker, Cloudflare e implantação

Esses itens são deliberadamente posteriores ao MVP. `compose.yaml` é preservado como referência de implantação, mas não é parte da rotina de desenvolvimento, testes ou demonstração atual. Quando o fluxo local completo estiver aprovado, a equipe definirá uma configuração de produção separada, sem alterar a referência local por acidente.

## Problemas comuns

| Sintoma | Ação |
| --- | --- |
| `psql` não é reconhecido | Instale PostgreSQL e abra um novo PowerShell. |
| Porta 3000, 5173 ou 8000 ocupada | Feche o processo local que a usa antes de iniciar o script. |
| O ambiente Python não inicia | Execute `Set-ExecutionPolicy -Scope Process Bypass` e tente novamente no mesmo terminal. |
| Dependências Node inconsistentes | Apague somente o `node_modules` do serviço afetado e execute `npm install` novamente. |
| O frontend não abre | Confirme que o terminal do Vite está ativo e acesse `http://127.0.0.1:5173`. |
