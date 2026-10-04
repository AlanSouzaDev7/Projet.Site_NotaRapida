# NotaRápida

Site de uma página para calcular a média trimestral de alunos: o professor informa o nome, lança o nome do aluno e as notas T1, T2 e T3 e vê a média final, a situação (aprovado ou reprovado), a posição em relação à média e a lista dos **20 últimos alunos consultados**. Com trimestres em branco, mostra quanto falta para a aprovação e para ficar acima da média.

Tudo roda no navegador, em HTML, CSS e JavaScript puro. Não há servidor de aplicação, conta, senha, cookies nem armazenamento: os dados ficam só na memória da aba e somem ao trocar de professor, recarregar ou fechar a página. A entrada pelo nome do professor **não é autenticação**, apenas personalização.

Evolução do script `AulaPython-TRABALHOCONCLUIDO.py` (três trimestres em vez de quatro bimestres, com as faixas de classificação corrigidas).

> **Site independente e não oficial.** O visual se inspira nas cores do Estado do Rio de Janeiro (azul e branco, com um toque de dourado), mas o NotaRápida não tem vínculo com o Governo do Estado nem com qualquer órgão público e não usa brasão, logomarca ou outro símbolo oficial. O aviso aparece em todas as telas: faixa no topo, cartão de entrada e rodapé. Não substitui diário de classe, boletim ou sistema oficial de notas.

## O que o professor vê

- **Tela de entrada:** nome do professor e escolha de tratamento (Professora, Professor ou Prefiro não informar). Cada escolha muda o tema da tela do professor: ameixa e lilás, azul-petróleo ou azul clássico. O tratamento nunca é deduzido do nome.
- **Cabeçalho:** saudação por período do dia, data por extenso e um recado do dia (Paulo Freire, Rubem Alves, Cora Coralina e dois textos próprios). No dia 15 de outubro, aparece uma homenagem pelo Dia do Professor.
- **1. Lançar notas:** média para aprovação (6,00 por padrão, de 1 a 10), com as faixas de classificação mostradas na hora; nome do aluno; T1, T2 e T3 (vírgula ou ponto; vazio vale como trimestre ainda sem nota).
- **2. Resultado:** média final, situação, posição em relação à média, régua com as faixas, carimbo e mensagem. Com trimestres em branco: média parcial e a nota necessária em cada trimestre que falta.
- **3. Últimos 20 alunos consultados:** do mais recente para o mais antigo, com resumo (aprovados, reprovados, em andamento e média do grupo). É **somente leitura**: não há campo editável, os registros ficam congelados na memória e, para corrigir uma nota, basta calcular de novo. "Limpar histórico" é o único botão da lista.

Em telas estreitas (celulares) a tabela vira uma lista de fichas, uma por aluno.

## Abrir localmente

Há três formas, da mais recomendada para a mais simples:

**1. Servidor do projeto (recomendado)**

```
npm run servir
```

Abra http://localhost:8080/. Sem dependências além do Node.js. Opções: `npm run servir -- --porta=3000` e `npm run servir -- --lan` (veja [Uso por muitos professores](#uso-por-muitos-professores)).

**2. Clique duplo em `site/index.html`.** Não precisa instalar nada.

**3. Servidor simples de terceiros** (`npx http-server site` ou `python -m http.server -d site`): funciona para uso individual, mas não é indicado para uma sala de professores. O `python -m http.server` aguentou 10 professores abrindo o site ao mesmo tempo e recusou cerca de 40% das visitas a partir de 15.

## Uso por muitos professores

O NotaRápida em si não tem limite de professores: cada aba é uma sessão independente e o cálculo roda no navegador de quem usa. O limite está em **quem entrega os arquivos**. Medido num teste de campo (um único computador gerando a carga, com navegadores reais):

| Professores abrindo o site ao mesmo tempo | `python -m http.server` | `npm run servir` |
|---|---|---|
| Até 10 | sem falhas | sem falhas |
| 15 a 30 | cerca de 40% das visitas recusadas | sem falhas |
| 100 | visitas recusadas e lentas | 100 de 100 atendidos, resultados corretos, sem dado de um aparecendo no outro |
| 300 (1.800 conexões) | não testado | sem falhas |

O servidor do Python falha por ter fila de conexões de 5 e entregar o site sem compressão (cerca de 131 KB por visita). O `scripts/servir.js` usa fila de 1.024, mantém todos os arquivos já comprimidos na memória (brotli ou gzip, cerca de 29 KB por visita, 4,5 vezes menos) e responde com ETag/304 para quem já tem o arquivo. Numa rede de 100 Mbps, isso dá cerca de 430 visitas completas por segundo com o `scripts/servir.js`, contra cerca de 95 com o servidor do Python.

A meta de referência do projeto é **30 professores simultâneos**, o triplo do limite medido de 10, mantendo a segurança e o desempenho.

Limites da medição:

- O ambiente de teste tem teto de cerca de 1.800 pedidos por segundo, mesmo para um servidor mínimo; acima disso não há número confiável.
- O tempo de resposta num único computador com 100 navegadores abertos cresce porque eles disputam a mesma CPU; isso é limite da máquina de teste, não do site (o JavaScript de cada cálculo leva poucos milissegundos).
- Para abrir o site para a rede da escola, use `npm run servir -- --lan`. Atenção: sem a opção `--lan` só o próprio computador acessa; com ela o site passa a ser servido em **HTTP, sem criptografia**, para qualquer um da rede local. Como nenhum dado sai do navegador, o risco é só o de alguém na rede alterar os arquivos no caminho; para uso fora de uma rede de confiança, publique em um provedor com HTTPS (veja [Publicação](#publicação-github-pages)).
- Os limites por endereço (pedidos, conexões) ficam em `LIMITES`, no topo de `scripts/servir.js`. Escolas costumam sair para a internet por um único IP, por isso os valores padrão são folgados (uma sala inteira atrás do mesmo IP passa sem ser barrada). Em redes menores, reduza-os.

## Testes

Requer Node.js 22 ou mais recente (o `node --test` com glob).

```
npm install
npm test
```

São 110 testes em `tests/` (`node:test` + `fast-check`, versão fixa em `package.json`):

- `leitor-validador.test.js`: formatos de nota aceitos e rejeitados, limites, ordem e texto das mensagens, nomes.
- `propriedades.test.js`: propriedades da média, classificação, histórico (mínimo entre N e 20), isolamento entre professores e resultado parcial.
- `historico-somente-leitura.test.js`: histórico de 20 alunos congelado (alterar nota, nome ou lista lança erro e nada muda), faixas da média sem lacunas, resumo do grupo, carimbo, frase do dia, Dia do Professor, data por extenso e período do dia.
- `injecao.test.js`: textos maliciosos (`<script>`, `onerror`, `‮`, 1000 caracteres) tratados apenas como texto.
- `entradas-adversariais.test.js`: textos feitos para travar o navegador (ReDoS, repetições longas, marcas combinantes, pares substitutos); tempo baixo e crescimento linear.
- `estatico.test.js`: CSP, ausência de código inline e de APIs proibidas (inclusive `postMessage`, workers e `window.open`), atributos dos campos, aviso de site não oficial, ausência de símbolos oficiais, ordem de foco, `:hover` só em dispositivos com mouse, política de foco em telas de toque, nenhum texto abaixo de 14 px, `_headers`, robots.txt, tamanho do site.
- `servidor.test.js`: o servidor local (rotas fechadas, travessia de diretório, cabeçalhos, compressão, ETag, métodos, pedidos malformados, limites por endereço, conexões lentas, ataque distribuído, 30 e 300 professores simultâneos).
- `supply-chain.test.js`: o workflow de publicação (actions presas a commit, permissões mínimas, sem segredos, sem `pull_request_target`) e as dependências.

No Windows, se o PowerShell bloquear `npm` por política de execução, use `npm.cmd`. Se aparecer `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (antivírus ou proxy inspecionando HTTPS), rode com `$env:NODE_OPTIONS='--use-system-ca'`.

## Publicação (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda a cada push em `main` (e manualmente): o job `testar` executa `npm ci --ignore-scripts` e `npm test` e, se passar, o job `publicar` envia **somente a pasta `site/`**.

1. Envie o código para a branch `main` do repositório https://github.com/AlanSouzaDev7/Projet.Site_NotaRapida.
2. Em Settings → Pages → Build and deployment, escolha **GitHub Actions** como fonte.
3. Após o primeiro deploy, o site fica em https://alansouzadev7.github.io/Projet.Site_NotaRapida/.

Como o fluxo foi endurecido:

- Cada action fica presa a um **commit de 40 caracteres** (o comentário ao lado diz a versão), e não a uma tag que poderia ser movida. Para atualizar, troque o commit conferindo a nova versão; os testes de `supply-chain.test.js` falham se alguma action voltar a usar tag.
- `permissions: {}` no topo e só o necessário em cada job: o job de testes tem apenas `contents: read`; só o de publicação recebe `pages: write` e `id-token: write`.
- `timeout-minutes`, `persist-credentials: false` no checkout e instalação sem scripts de dependência (`npm ci --ignore-scripts`).
- Gatilhos só `push` em `main` e manual: nunca `pull_request_target`, então código de forks não roda com permissões do repositório. Nenhum segredo é usado.
- Dependências: só `devDependencies`, versão exata e `package-lock.json` com integridade.

### Configurações do GitHub que o código não consegue fazer

Fazem parte da segurança, mas ficam na conta e no repositório (Settings):

- Ative a **verificação em duas etapas** na conta.
- Proteja a branch `main` (exigir pull request e restringir quem pode fazer push): cada push em `main` publica o site.
- Ative **secret scanning** e **push protection**, e o **Dependabot** para actions e npm (as actions presas a commit não se atualizam sozinhas).
- O e-mail do autor dos commits aparece no histórico se o repositório for público. Para escondê-lo, use o e-mail de privacidade `ID+usuario@users.noreply.github.com` (Settings → Emails) e marque "Keep my email addresses private".

## Segurança

### A página (vale em qualquer hospedagem, inclusive `file://`)

- **CSP em `<meta>`**: `default-src 'none'`, apenas scripts, estilos e imagens do próprio site, nenhuma conexão de rede (`connect-src 'none'`), sem plugins, quadros, workers, `<base>` ou envio de formulário, e **Trusted Types** (`require-trusted-types-for 'script'; trusted-types 'none'`) nos navegadores que suportam.
- **Sem injeção de HTML**: o texto digitado entra na página só por `textContent`/`createElement`; não há `innerHTML`, `eval`, scripts inline nem atributos `on*`/`style` (verificado pelos testes). Os ícones são `<symbol>` SVG com atributos fixos.
- **Sem armazenamento, sem rede e sem conversa entre abas**: nada de cookies, localStorage, sessionStorage, IndexedDB, service worker, `fetch`, XHR, `postMessage`, canais, workers ou `window.open`. Cada professor está isolado no próprio navegador; testado com 100 sessões simultâneas sem vazamento de dados entre elas.
- **Registros somente leitura**: cada lançamento e a lista do histórico são congelados (`Object.freeze` profundo); alterar qualquer um lança erro.
- **Limite de entrada**: `maxlength="1000"` nos campos e corte em 1000 caracteres também no JavaScript, caso o atributo seja removido. As validações não travam com textos adversariais (testes de tempo).
- **Anti-quadro**: se a página for aberta dentro de um `<iframe>` de outro site, o app não inicia e mostra apenas "O NotaRápida não pode ser exibido dentro de outro site.".
- **Puxar para atualizar no celular** (`overscroll-behavior-y: contain`) não recarrega a página por engano e apaga os dados.

### O servidor local (`scripts/servir.js`)

Pensado para tratar vários acessos simultâneos também como uma possível tentativa de invasão:

- **Rotas fechadas:** só os arquivos de `site/` com extensão permitida (`.html`, `.css`, `.js`, `.svg`, `.txt`) são lidos, uma vez, na inicialização. Não existe acesso ao disco por pedido, então `../`, `%2e%2e`, `%2f`, barra invertida, bytes nulos e dupla codificação não têm como funcionar. Arquivos que começam com `.` ou `_` (como `_headers`) nunca são servidos. Só caminhos canônicos respondem (por exemplo, `/index.html/` é recusado).
- **Métodos e protocolo:** só `GET` e `HEAD` (os demais recebem 405; `CONNECT` é derrubado). URL acima de 2.048 caracteres: 414. Cabeçalhos acima de 8 KB ou mais de 100 cabeçalhos: 431. Corpo em `GET` e `Host` inválido: 400.
- **Cabeçalhos de segurança** lidos de `site/_headers` (mesma CSP da página, mais `frame-ancestors 'none'`, `X-Frame-Options`, COOP, COEP, CORP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), inclusive nas respostas de erro. O HSTS fica de fora porque este servidor fala HTTP. Sem `Server` e sem detalhes de erro.
- **Limites por endereço (balde de fichas):** rajada de 1.500 pedidos e reposição de 300 por segundo; excesso recebe 429 com `Retry-After`; depois de 300 recusas seguidas o endereço fica bloqueado por 10 s; no máximo 1.200 conexões abertas por endereço. Um endereço que inunda não atrapalha os demais.
- **Conexões lentas (slowloris):** prazo de 5 s para os cabeçalhos, 10 s por pedido, 5 s de ociosidade e 500 pedidos por conexão. No teto global de 4.096 conexões, as conexões **incompletas** mais antigas são expulsas para dar lugar às novas; se só restarem conexões legítimas em andamento, a nova é recusada (nada legítimo é expulso).
- **Sem registro de pessoas:** apenas contadores (pedidos, 429, bloqueios, expulsões…), mostrados ao encerrar com Ctrl+C.

Resultados da simulação de ataque (um computador, endereços 127.x.x.x para fingir clientes diferentes), sempre com professores legítimos acessando ao mesmo tempo:

| Ataque | Resultado |
|---|---|
| Inundação de um endereço (200 conexões por 8 s) | cerca de 52% do tráfego do atacante barrado; professores 30/30 atendidos |
| Conexões lentas de um endereço (3.000) | todas encerradas em até 8,5 s; professores 30/30 |
| Conexões lentas distribuídas (70 endereços, 7.000 conexões) | encontrou uma falha (o teto global lotava e os professores ficavam 0/30), corrigida com a expulsão das incompletas mais antigas; depois, 30/30 |
| 6.000 pedidos de protocolo hostil | todos recusados (400, 405, 414 ou 431); memória estável (sem vazamento) |
| 80 sessões de navegador hostis (XSS, entradas gigantes) misturadas com professores | nenhum código injetado executado; a CSP bloqueou toda tentativa de enviar dados |

Limite do que isto prova: proteção contra ataque em massa de verdade (DDoS) só existe na borda, no provedor ou num CDN (o GitHub Pages e o Cloudflare já fazem isso). Este servidor é para uso local e em rede de escola.

### Limitações do GitHub Pages

- Não permite cabeçalhos HTTP personalizados. Por isso `frame-ancestors`, `X-Frame-Options`, HSTS com `includeSubDomains`, `Permissions-Policy`, COOP, COEP e CORP **não se aplicam** lá. O arquivo `site/_headers` traz esses cabeçalhos para Netlify ou Cloudflare Pages e é ignorado pelo GitHub Pages (o `scripts/servir.js` também os usa).
- O anti-quadro em JavaScript é mais fraco que `frame-ancestors`: um quadro com `sandbox` sem scripts impede o app de rodar (ele fica inutilizável, mas o HTML estático aparece).
- O GitHub Pages já serve por HTTPS com o certificado do `github.io`.

### Anti-IA (**melhor esforço**, depende da boa vontade de cada robô)

- `site/robots.txt` bloqueia robôs de IA conhecidos (GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot e outros) e libera buscadores comuns.
- `<meta name="robots" content="noai, noimageai">` e `site/ai.txt` negam o uso para treinamento.
- Robôs só leem o `robots.txt` da **raiz do domínio**. Em https://alansouzadev7.github.io/Projet.Site_NotaRapida/ o arquivo fica em `/Projet.Site_NotaRapida/robots.txt` e não é consultado; para valer, use um domínio próprio ou copie as regras para o repositório `AlanSouzaDev7.github.io`.
- Nada disso impede um robô que ignore as convenções; o site é público e qualquer pessoa pode ver o código.

## Acessibilidade e celulares

- Ordem de foco no teclado na tela do professor: aluno, T1, T2, T3, Calcular média, Limpar histórico e, por último, Trocar professor (que aparece no topo do cabeçalho).
- **Em telas de toque** (`pointer: coarse`) o foco não é movido sozinho para "Nome do aluno" depois de entrar ou de calcular: isso abriria o teclado virtual por cima do resultado. Em vez disso, o teclado é fechado e a tela rola até o resultado. Com mouse e teclado, o foco vai para "Nome do aluno" como previsto na especificação.
- `:hover` só em dispositivos com mouse (`@media (hover: hover)`), alvos de toque de pelo menos 44 px, `color-scheme: only light` (o navegador não escurece a página sozinho), `prefers-reduced-motion` e modo de alto contraste (`forced-colors`) respeitados.
- Desempenho medido em um iPhone SE simulado, com CPU e rede 4G lenta limitadas: sem mudança de layout durante o uso, rolagem a 60 quadros por segundo, primeira tela em cerca de 1 s e resposta a toques em cerca de 100 ms.

## Estrutura

```
site/                  o que a página carrega (cerca de 131 KB sem compressão, 29 KB com brotli)
  index.html           CSP em <meta>, telas, ícones em sprite SVG
  css/estilo.css       Guia_Visual (variáveis), temas, layout, animações
  js/notas.js          lógica pura (window.NotaRapida / module.exports)
  js/app.js            estado em memória, DOM, foco, transições
  img/                 icone.svg e ilustracao.svg (próprios, sem símbolos oficiais)
  _headers  robots.txt  ai.txt
scripts/servir.js      servidor local (sem dependências)
tests/                 só Node; a página nunca os carrega
.github/workflows/     testa e publica site/
.kiro/specs/           requisitos, design e tarefas
```
