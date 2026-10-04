# NotaRápida

Site de uma página para calcular a média trimestral de alunos: o professor informa o nome, lança o nome do aluno e as notas T1, T2 e T3 e vê a média final, a situação (aprovado ou reprovado), a posição em relação à média e os 5 últimos lançamentos. Com trimestres em branco, mostra quanto falta para a aprovação e para ficar acima da média.

Tudo roda no navegador, em HTML, CSS e JavaScript puro. Não há servidor, conta, senha, cookies nem armazenamento: os dados ficam só na memória da aba e somem ao trocar de professor, recarregar ou fechar a página. A entrada pelo nome do professor **não é autenticação**, apenas personalização.

Evolução do script `AulaPython-TRABALHOCONCLUIDO.py` (três trimestres em vez de quatro bimestres, com as faixas de classificação corrigidas).

## Abrir localmente

Dê dois cliques em `site/index.html`. Não precisa instalar nada.

Se preferir um servidor local: `npx http-server site` ou `python -m http.server -d site` e abra o endereço indicado.

## Testes

Requer Node.js 22 ou mais recente (o `node --test` com glob).

```
npm install
npm test
```

Os testes ficam em `tests/` (`node:test` + `fast-check`, versão fixa em `package.json`):

- `leitor-validador.test.js`: formatos de nota aceitos e rejeitados, limites, ordem e texto das mensagens, nomes.
- `propriedades.test.js`: propriedades da média, classificação, histórico, isolamento entre professores e resultado parcial.
- `injecao.test.js`: textos maliciosos (`<script>`, `onerror`, `\u202E`, 1000 caracteres) tratados apenas como texto.
- `estatico.test.js`: CSP, ausência de código inline e de APIs proibidas, atributos dos campos, robots.txt, tamanho do site.

No Windows, se o PowerShell bloquear `npm` por política de execução, use `npm.cmd`. Se aparecer `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (antivírus ou proxy inspecionando HTTPS), rode com `$env:NODE_OPTIONS='--use-system-ca'`.

## Publicação (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda a cada push em `main`: executa `npm ci` e `npm test` e, se passar, publica **somente a pasta `site/`**.

1. Envie o código para a branch `main` do repositório https://github.com/AlanSouzaDev7/Projet.Site_NotaRapida.
2. Em Settings → Pages → Build and deployment, escolha **GitHub Actions** como fonte.
3. Após o primeiro deploy, o site fica em https://alansouzadev7.github.io/Projet.Site_NotaRapida/.

## Segurança

O que a página garante sozinha, em qualquer hospedagem (inclusive `file://`):

- **CSP em `<meta>`**: `default-src 'none'`, apenas scripts, estilos e imagens do próprio site, nenhuma conexão de rede (`connect-src 'none'`), sem plugins, quadros, workers, `<base>` ou envio de formulário, e **Trusted Types** (`require-trusted-types-for 'script'; trusted-types 'none'`) nos navegadores que suportam.
- **Sem injeção de HTML**: o texto digitado entra na página só por `textContent`/`createElement`; não há `innerHTML`, `eval`, scripts inline nem atributos `on*`/`style` (verificado pelos testes).
- **Sem armazenamento e sem rede**: nada de cookies, localStorage, sessionStorage, IndexedDB, service worker, `fetch` ou XHR.
- **Limite de entrada**: `maxlength="1000"` nos campos e corte em 1000 caracteres também no JavaScript, caso o atributo seja removido.
- **Anti-quadro**: se a página for aberta dentro de um `<iframe>` de outro site, o app não inicia e mostra apenas "O NotaRápida não pode ser exibido dentro de outro site.".

Limitações do GitHub Pages:

- Não permite cabeçalhos HTTP personalizados. Por isso `frame-ancestors`, `X-Frame-Options`, HSTS com `includeSubDomains`, `Permissions-Policy`, COOP e CORP **não se aplicam** lá. O arquivo `site/_headers` traz esses cabeçalhos para Netlify ou Cloudflare Pages e é ignorado pelo GitHub Pages.
- O anti-quadro em JavaScript é mais fraco que `frame-ancestors`: um quadro com `sandbox` sem scripts impede o app de rodar (ele fica inutilizável, mas o HTML estático aparece).
- O GitHub Pages já serve por HTTPS com o certificado do `github.io`.

Anti-IA (**melhor esforço**, depende da boa vontade de cada robô):

- `site/robots.txt` bloqueia robôs de IA conhecidos (GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot e outros) e libera buscadores comuns.
- `<meta name="robots" content="noai, noimageai">` e `site/ai.txt` negam o uso para treinamento.
- Robôs só leem o `robots.txt` da **raiz do domínio**. Em https://alansouzadev7.github.io/Projet.Site_NotaRapida/ o arquivo fica em `/Projet.Site_NotaRapida/robots.txt` e não é consultado; para valer, use um domínio próprio ou copie as regras para o repositório `AlanSouzaDev7.github.io`.
- Nada disso impede um robô que ignore as convenções; o site é público e qualquer pessoa pode ver o código.
