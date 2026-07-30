# Vegas Vigilância · Solicitação de Preferência de Férias

Sistema com formulário público + painel do RH. Backend Google Apps Script, base em Google Sheets.

## Arquivos

| Arquivo | Papel |
|---|---|
| `Code.gs` | Backend: roteamento, planilha, autenticação, CRUD |
| `appsscript.json` | Manifesto (fuso, Web App anônimo) |
| `index.html` | Estrutura das 4 telas |
| `style.html` | CSS (partial — o Apps Script não serve `.css`) |
| `script.html` | JS (partial — o Apps Script não serve `.js`) |
| `preview.html` | Demonstração local com 20 registros fictícios (só abrir no navegador) |
| `assets/logovegas.png` | Logo para hospedar |

> **Por que `style.html` e não `style.css`:** o Web App do Apps Script serve apenas arquivos `.gs` e `.html`. CSS e JS entram como partials via `include()`. Se você preferir hospedar o frontend no GitHub Pages, veja a seção "Modo 2".

## Modo 1 — Web App do Apps Script (recomendado)

1. Crie uma planilha no Google Drive: **Férias Vegas 2027**.
2. Na planilha: **Extensões → Apps Script**.
3. Crie os arquivos com estes nomes exatos e cole o conteúdo:
   - `Code.gs`
   - `index.html`, `style.html`, `script.html` (novo → HTML)
   - `appsscript.json` (ative em ⚙️ Configurações → "Mostrar arquivo de manifesto")
4. Hospede a logo e ajuste `CFG.LOGO_URL` no `Code.gs`. Opções:
   - GitHub: `https://raw.githubusercontent.com/USUARIO/REPO/main/assets/logovegas.png`
   - Google Drive (arquivo público): `https://drive.google.com/thumbnail?id=ID_DO_ARQUIVO&sz=w600`
5. Rode a função **`instalar`** uma vez. Ela cria a aba `Solicitacoes`, o segredo de sessão e a senha.
6. **Implantar → Nova implantação → Aplicativo da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
7. Distribua a URL `/exec` para os colaboradores.

## Modo 2 — Frontend no GitHub Pages + Apps Script como API

1. No repositório, use `index.html` sem os `<?!= include(...) ?>`; extraia `style.html` → `style.css` e `script.html` → `script.js` (remova as tags `<style>`/`<script>`) e referencie com `<link>` e `<script src>`.
2. No `index.html`, troque `window.BOOT = <?!= BOOT ?>` por um objeto fixo, ou chame `call('boot')` na carga.
3. Em `script.js`, preencha `API_URL` com a URL `/exec`.
4. `doPost` já responde em JSON e a requisição usa `Content-Type: text/plain` para evitar preflight CORS.
5. Nome do arquivo em minúsculas: `index.html`. O GitHub Pages diferencia maiúsculas.

## Configuração (`CFG` no `Code.gs`)

| Chave | Efeito |
|---|---|
| `ANO_REFERENCIA` | Ano do ciclo; entra no protocolo `VF-2027-0001` |
| `BLOQUEAR_CPF_DUPLICADO` | `true` impede segundo envio pelo mesmo CPF |
| `SESSION_MIN` | Validade do token do RH (padrão 90 min) |
| `EMAIL_NOTIFICACAO` | E-mail que recebe aviso a cada solicitação (vazio = desliga) |
| `LOGO_URL` | URL pública da logo |

## Senha do RH

A senha inicial é `Vegas4747@`, gravada em **Propriedades do Script** na primeira execução.
Para trocar sem editar código: **Projeto → Configurações → Propriedades do script → `ADMIN_PASSWORD`**.

A validação é 100% no servidor. A senha nunca vai para o navegador. O acesso ao painel usa
token HMAC assinado com `TOKEN_SECRET` (gerado automaticamente) e expira sozinho.

## Estrutura da planilha

`Protocolo · Data/Hora · Nome · CPF · Cargo · Cidade · 1ª Opção · 2ª Opção · 3ª Opção · Observações · Assinatura · Status · Atualizado em · ISO`

- `Data/Hora` é gravada como **texto** no fuso de São Paulo — evita a reserialização de hora do Sheets.
- `ISO` é a coluna usada pelos filtros de período.
- `Assinatura` fica oculta (PNG base64). A listagem do painel **não** carrega assinaturas: elas são buscadas sob demanda ao abrir os detalhes.

## Limites que valem conhecer

| Item | Limite | O que fazer se estourar |
|---|---|---|
| Célula do Sheets | 50.000 caracteres | Assinatura já é limitada a 45.000; o servidor rejeita acima disso |
| `google.script.run` | ~50 MB por resposta | A listagem é leve (sem assinatura). Acima de ~5.000 registros, pagine no backend |
| Execução Apps Script | 6 min | `listar_` faz uma leitura em bloco; suficiente para milhares de linhas |
| Concorrência | — | `LockService` serializa os envios, evitando protocolo duplicado |

## Exportações

- **PDF**: na aba *Solicitações* gera tabela paginada (jsPDF + AutoTable) respeitando busca e filtros. Nas abas *Visão geral* e *Gráficos*, captura o painel (html2canvas).
- **Excel**: CSV `;` com BOM UTF-8 — abre direto no Excel pt-BR com acentuação correta.
- **Imprimir**: folha de estilo de impressão dedicada (fundo branco, sem menus nem colunas de ação).
- **PDF individual**: dentro dos detalhes de cada solicitação, com a assinatura.

## Pontos de atenção operacional

1. **Não use "Executar como: usuário que acessa"** — o colaborador precisaria de permissão na planilha.
2. **Ao reimplantar**, use *Gerenciar implantações → editar → Nova versão*, senão a URL antiga continua servindo o código velho.
3. **Backup**: agende uma cópia da planilha antes do fechamento do ciclo. A exclusão no painel é definitiva.
4. **LGPD**: CPF e assinatura são dados pessoais. Restrinja o compartilhamento da planilha ao RH e defina prazo de descarte do ciclo anterior.
5. **`BLOQUEAR_CPF_DUPLICADO`** faz uma leitura da coluna de CPF a cada envio. Acima de ~20 mil linhas, troque por um índice em `CacheService`.
