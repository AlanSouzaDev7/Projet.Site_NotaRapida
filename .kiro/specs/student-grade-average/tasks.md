# Implementation Plan: NotaRápida (student-grade-average)

## Overview

Plano reconstruído a partir do que já foi implementado e testado (110/110 testes passando com `node --test "tests/**/*.test.js"`). O site fica em `site/` (HTML, CSS e JavaScript puro em scripts clássicos, sem dependências em tempo de execução). A lógica pura está em `site/js/notas.js` (notas em centésimos inteiros, média de aprovação configurável, resultado parcial e máquina de estados `reduzir`) e a interface em `site/js/app.js` (estado só na memória da aba, renderização por `textContent`). Os testes usam `node:test` com `fast-check` 4.10.2 fixo. O workflow `.github/workflows/pages.yml` testa e publica somente `site/` no GitHub Pages.

Depois da primeira versão (tarefas 1 a 12), o projeto passou por um redesenho visual com identidade "site não oficial" (tarefa 15), histórico de 20 alunos somente leitura (16), melhorias de fluidez e de uso no celular (17), servidor local para 30 ou mais professores simultâneos (18) e uma revisão de segurança (19), documentadas na tarefa 20. Ficam pendentes apenas o envio ao repositório remoto, a ativação do GitHub Pages com a confirmação do primeiro deploy e as verificações manuais opcionais.

## Tasks

- [x] 1. Estruturar o projeto e o ambiente de testes
  - [x] 1.1 Criar a estrutura de pastas e o ícone
    - Pastas `site/`, `site/css/`, `site/js/`, `site/img/` e `tests/`; `site/img/icone.svg` sem referências externas
    - Arquivos de teste, `package.json` e `node_modules/` fora de `site/`
    - _Requirements: 16.3, 16.4, 18.6, 22.4_

  - [x] 1.2 Criar `package.json` e `package-lock.json`
    - Script `"test": "node --test \"tests/**/*.test.js\""`; `devDependencies` com `fast-check` na versão fixa `4.10.2`, sem `^` nem `~`
    - _Requirements: 16.4, 22.3_

- [x] 2. Implementar a lógica pura em `site/js/notas.js`
  - [x] 2.1 Criar o módulo UMD, as constantes e os utilitários de texto
    - Exportação como `window.NotaRapida` (navegador) e `module.exports` (Node), sem módulos ES; `'use strict'` e `Object.freeze` na API, nas constantes e nas mensagens
    - Mensagens com o texto exato dos requisitos; `truncarCampo` (corte em 1000 caracteres, mesmo limite do `maxlength`), `aparar` e `contarCaracteres` (pontos de código após NFC)
    - _Requirements: 1.5, 1.12, 4.8, 20.4, 22.5_

  - [x] 2.2 Implementar o Leitor_de_Nota (`lerNota`)
    - Expressão `/^(-?)([0-9]+)(?:[.,]([0-9]+))?$/` sobre o texto aparado; devolve `vazio`, `erro` ou `numero` (também fora de 0 a 10 ou com mais de 2 casas)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7, 8.8, 8.9_

  - [x] 2.3 Implementar o Formatador_de_Nota em centésimos
    - `formatarCentesimos` com vírgula e exatamente 2 casas; `formatarMedia(soma)` trunca `soma / 3` sem arredondar (1799 → "5,99")
    - _Requirements: 6.13, 8.5_

  - [x] 2.4 Implementar o Validador
    - `validarNomeProfessor` e `validarNomeAluno` (1 a 100 caracteres após o trim, espaços internos preservados)
    - `validarNota` na ordem vazio → conversão → intervalo 0 a 10 → casas decimais, com intervalo decidido nas strings, sem ponto flutuante
    - `validarMediaAprovacao` (intervalo de 1 a 10) e `validarNotaOpcional` (nota vazia vira Nota_Faltante)
    - `validarFormulario` avalia os cinco campos, uma mensagem por campo, `primeiroInvalido` na ordem média → aluno → T1 → T2 → T3 e "Informe ao menos uma nota." só no T1 com as três notas vazias
    - _Requirements: 1.4, 1.5, 1.11, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 12.5, 13.2, 13.3, 20.11_

  - [x] 2.5 Implementar o cálculo em centésimos com a média de aprovação
    - `limitesDaMedia(M)` com A = floor((M + 1000) / 2) e E = floor((M + 3000) / 4); média padrão 600
    - `classificarSoma` e `posicionarSoma` comparando a soma S com 3M, 3A e 3E, sem divisão; `calcular` devolve soma, média como fração `{ numerador: S, denominador: 3 }`, média truncada, limites, Classificação e Posição
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.10, 6.11, 12.6, 12.7, 12.8, 12.9_

  - [x] 2.6 Implementar o Resultado_Parcial
    - `calcularParcial` com 1 ou 2 Notas_Faltantes: soma conhecida, média parcial floor(Sk / (3 − k)) e as metas de aprovação e acima da média (`garantida`, `impossivel` ou n = ceil(R / k) só com inteiros)
    - `listarTrimestres`, `montarMeta`, `montarResumoMetas`, `montarMensagemParcial` e `montarAnuncioParcial` com os textos exatos do Req. 13
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 7.9_

  - [x] 2.7 Implementar Tratamento, saudação e mensagens de resultado
    - `normalizarTratamento` (valor fora da lista vira `neutro`, sem deduzir pelo nome) e `montarSaudacao` ("Olá, Prof.ª " ou "Olá, Prof. ")
    - `rotuloSituacao` e `montarMensagem` com os quatro modelos de mensagem, nome inserido literalmente
    - _Requirements: 2.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.3, 11.4, 11.5, 11.6_

  - [x] 2.8 Implementar o Histórico_Recente e a máquina de estados `reduzir`
    - `adicionarAoHistorico` (mais recente primeiro, no máximo 20, sem mutar a lista e devolvendo lista congelada; Lançamentos congelados por `congelarProfundo`), `estadoInicial` e `reduzir` com `ENTRAR`, `CALCULAR`, `LIMPAR_HISTORICO` e `TROCAR_PROFESSOR`; eventos `NOME_INVALIDO`, `SESSAO_INICIADA`, `FORMULARIO_INVALIDO`, `CALCULO_CONCLUIDO`, `HISTORICO_LIMPO { haviaItens }`, `SESSAO_ENCERRADA` e `IGNORADO`
    - Lançamentos completos e parciais com a média de aprovação usada; ações malformadas ignoradas
    - _Requirements: 1.6, 1.7, 2.4, 2.9, 3.1, 3.3, 3.4, 4.4, 4.7, 9.1, 9.2, 9.3, 9.6, 9.7, 9.9, 12.10, 18.8_

  - [x] 2.9 Escrever os testes unitários em `tests/leitor-validador.test.js`
    - Texto exato das mensagens e congelamento da API; formatos aceitos e rejeitados do Leitor_de_Nota; limites 0 e 10; ordem das regras; média de aprovação de 1 a 10; nomes com 100/101 caracteres, NFC/NFD e textos literais; `validarFormulario` com faltantes; exemplos das faixas e regressão do script Python; `truncarCampo`
    - _Requirements: 1.5, 1.11, 5.3, 5.5, 5.6, 5.10, 6.2, 6.3, 6.4, 6.5, 7.4, 7.5, 8.4, 12.5, 13.3_

- [x] 3. Escrever os testes de propriedade em `tests/propriedades.test.js`
  - [x] 3.1 Escrever teste de propriedade da média entre a menor e a maior nota
    - **Property 7: Média entre a menor e a maior nota**
    - **Validates: Requirements 6.8**

  - [x] 3.2 Escrever teste de propriedade de confluência
    - **Property 8: Confluência das 6 ordens**
    - **Validates: Requirements 6.9**

  - [x] 3.3 Escrever teste de propriedade da média exata
    - **Property 6: Média_Final exata (média × 3 = soma em inteiros)**
    - **Validates: Requirements 6.1, 6.11**

  - [x] 3.4 Escrever teste de propriedade das faixas para qualquer M de 1 a 10
    - **Property 9: Exatamente uma Classificação e uma Posição**, incluindo M ≤ A ≤ E ≤ 1000
    - **Validates: Requirements 6.10, 12.7, 12.8**

  - [x] 3.5 Escrever teste de propriedade de monotonicidade
    - **Property 10: Monotonicidade**
    - **Validates: Requirements 6.12**

  - [x] 3.6 Escrever teste de propriedade "M maior nunca melhora a classificação"
    - **Property (sem número no design): Monotonicidade em relação à Média_de_Aprovação**
    - **Validates: Requirements 12.6, 12.7**

  - [x] 3.7 Escrever teste de propriedade da equivalência com M = 6,00
    - **Property (sem número no design): M = 600 reproduz os limites 1800/2400/2700 e é o padrão**
    - **Validates: Requirements 12.9**

  - [x] 3.8 Escrever teste de propriedade da média exibida
    - **Property 11: Média exibida na mesma faixa da média exata**
    - **Validates: Requirements 6.13**

  - [x] 3.9 Escrever teste de propriedade de ida e volta
    - **Property 4: Ida e volta formatar → ler** (vírgula, ponto e média de aprovação)
    - **Validates: Requirements 8.6**

  - [x] 3.10 Escrever teste de propriedade do modelo do histórico
    - **Property 15: Modelo do Histórico_Recente** (min(N, 20) lançamentos, do mais novo ao mais antigo)
    - **Validates: Requirements 9.2, 9.3, 9.6**

  - [x] 3.11 Escrever teste de propriedade de isolamento entre sessões
    - **Property 17: Isolamento entre sessões** (mesmo nome de professor, Tratamento volta a neutro)
    - **Validates: Requirements 3.1, 3.3, 3.4, 11.10, 18.8**

  - [x] 3.12 Escrever teste de propriedade da meta mínima do resultado parcial
    - **Property (sem número no design): Meta mínima, garantida e impossível**
    - **Validates: Requirements 13.4, 13.9**

  - [x] 3.13 Escrever teste de propriedade da coerência entre as metas
    - **Property (sem número no design): Meta acima da média nunca é mais fácil que a de aprovação**
    - **Validates: Requirements 13.10**

  - [x] 3.14 Escrever teste de propriedade do preenchimento com a meta
    - **Property (sem número no design): Preencher os faltantes com n atinge o alvo no cálculo completo**
    - **Validates: Requirements 13.10**

  - [x] 3.15 Escrever teste de propriedade do Tratamento e da saudação
    - **Property (sem número no design): Prefixo depende só do Tratamento e o nome fica inalterado**
    - **Validates: Requirements 11.4, 11.5, 11.6**

- [x] 4. Checkpoint – Lógica pura completa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Criar `site/index.html`
  - [x] 5.1 Montar o `<head>` com a CSP e as metas
    - `<meta charset="utf-8">` seguido da CSP em `<meta http-equiv>` com `default-src 'none'`, `'self'` para scripts, estilos e imagens, `connect-src`, `object-src`, `frame-src`, `worker-src`, `base-uri` e `form-action` em `'none'` e Trusted Types (`require-trusted-types-for 'script'; trusted-types 'none'`), antes de qualquer `<link>` ou `<script>`
    - Viewport sem limitação de zoom, `referrer` `no-referrer`, `robots` `noai, noimageai`, título "NotaRápida – Entrar", ícone e `js/notas.js` e `js/app.js` com `defer`, sem `type="module"`
    - _Requirements: 20.2, 20.3, 20.9, 21.11, 21.14, 22.5, 22.6_

  - [x] 5.2 Montar a Tela_Inicial
    - Título "NotaRápida", campo "Nome do professor", grupo "Como prefere ser chamado(a)?" com Professora, Professor e Prefiro não informar (esta marcada), botão "Entrar", aviso de privacidade; `<noscript>` e `#aviso-quadro` oculto
    - Campos de texto com `maxlength="1000"`, `autocomplete="off"`, `spellcheck="false"`; formulários com `novalidate`; `lang="pt-BR"`
    - _Requirements: 1.1, 1.12, 11.1, 11.2, 19.8, 21.2, 21.3, 21.8_

  - [x] 5.3 Montar a Tela_do_Professor
    - `hidden inert`; saudação em `<h1>`; aviso de dados não salvos; campo "Média para aprovação" com a ajuda associada por `aria-describedby`; "Nome do aluno"; T1, T2 e T3 com `inputmode="decimal"`, placeholder e a dica "Deixe em branco os trimestres ainda sem nota."; "Calcular média"
    - Painel de resultado (vazio e conteúdo, selo, posição, média, T1–T3, classificação, metas, média para aprovação, mensagem), histórico com "Limpar histórico" e "Nenhuma nota lançada ainda.", botão "Trocar professor" como último focável e região `aria-live="polite"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 4.1, 4.2, 7.8, 9.5, 9.8, 12.1, 12.2, 13.1, 21.9_

- [x] 6. Criar `site/css/estilo.css`
  - [x] 6.1 Definir o Guia_Visual e os componentes
    - Paleta, tipografia (`system-ui, "Segoe UI", Roboto, Arial, sans-serif`, sem `@font-face` nem `@import`) e espaçamentos em `:root`
    - Campos e botões com 44 px mínimos, fonte de 16 px nos campos, borda de erro, cor de destaque no hover, anel de foco visível, `.visualmente-oculto`, selos "Aprovado"/"Reprovado"/"Em andamento"
    - _Requirements: 7.6, 10.1, 10.2, 10.9, 10.10, 10.13, 10.14, 21.5, 21.7, 21.10, 21.13_

  - [x] 6.2 Implementar os temas por Tratamento
    - `tema--neutro` (#0B4FA6), `tema--feminino` (#9D2A68, degradê ameixa e lilás) e `tema--masculino` (#1B4965, degradê azul-petróleo), aplicados ao `<body>` e à `#tela-professor`; Tela_Inicial sempre neutra; aprovado, reprovado, "Em andamento" e erro iguais nos três temas
    - _Requirements: 11.7, 11.8, 11.9, 11.10_

  - [x] 6.3 Implementar o layout responsivo
    - Tela_Inicial centralizada (`display: grid; place-items: center`); grade lado a lado a partir de 1024 px e coluna única abaixo; ajustes abaixo de 640 px; T1–T3 em 3 colunas a partir de 480 px; `overflow-wrap: anywhere` em nomes; sem rolagem horizontal
    - _Requirements: 2.1, 10.3, 10.4, 10.5, 21.1_

  - [x] 6.4 Implementar animações, Movimento_Reduzido e anti-quadro
    - Keyframes só com `opacity` e `transform` (tela 300 ms; resultado e histórico 200 ms); `@media (prefers-reduced-motion: reduce)` com durações de 0,01 s
    - `html.em-quadro .palco` e `html.em-quadro noscript` ocultos, deixando apenas o aviso
    - _Requirements: 10.6, 10.7, 10.8, 10.11, 17.1, 17.2, 17.7_

- [x] 7. Criar `site/js/app.js`
  - [x] 7.1 Implementar o anti-quadro
    - `window.top !== window.self` (erro de acesso conta como quadro): aplica `em-quadro`, mostra `#aviso-quadro` e não inicia o NotaRápida
    - _Requirements: 20.8_

  - [x] 7.2 Implementar o estado em memória e a leitura dos campos
    - IIFE com `'use strict'`, estado só em variáveis (`N.estadoInicial()`), `refs` por `getElementById`, eventos por `addEventListener`, `preventDefault` nos `submit`
    - Valores dos campos passam por `truncarCampo` (1000 caracteres) antes de `reduzir`
    - _Requirements: 1.3, 4.5, 4.7, 18.1, 18.7, 19.1, 19.2, 19.9, 20.4_

  - [x] 7.3 Implementar erros de campo e a ajuda da média
    - Mensagem com `textContent`, `aria-invalid` e `aria-describedby` (mantendo a ajuda associada); remoção antes de cada nova validação; foco no primeiro inválido
    - Legenda das faixas de classificação (`faixasDaMedia`) atualizada ao digitar uma média válida e mantida com valor inválido; campo começa com "6,00"
    - _Requirements: 1.9, 1.10, 5.8, 5.11, 5.12, 12.2, 12.3, 12.4_

  - [x] 7.4 Implementar a renderização do resultado, do histórico e dos anúncios
    - Somente `textContent`, `createElement` e `replaceChildren`; resultado completo ou parcial (selo "Em andamento", "—" lido como "sem nota", metas); histórico do mais recente ao mais antigo com as mesmas cores do painel e resumo das metas
    - Anúncio `aria-live` esvaziado e escrito no próximo quadro, uma vez por resultado, sem mover o foco
    - _Requirements: 7.1, 7.7, 7.9, 7.11, 9.4, 9.10, 12.10, 13.5, 13.8, 20.1_

  - [x] 7.5 Implementar as transições de tela e o controlador de animações
    - `animar` com `animationend` e timeout de segurança (duração + 100 ms), finalização única e `cancelar`; `inert` na tela que sai desde o início; título do documento por tela
    - Acionamentos repetidos ignorados; "Trocar professor" durante a entrada cancela a transição; foco em "Nome do aluno" ou "Nome do professor" ao final
    - _Requirements: 1.2, 2.5, 2.7, 2.8, 3.2, 15.4, 15.6, 17.3, 17.5, 17.8, 21.11, 21.12_

  - [x] 7.6 Implementar os controladores de entrada, cálculo, limpeza e troca
    - Entrar: valida, aplica saudação e tema, prepara a média e troca de tela; Calcular: conteúdo final antes das animações, esvazia aluno e notas, mantém a média e foca "Nome do aluno"; Limpar: sem animação com histórico vazio
    - Trocar professor: descarta estado, saudação, resultado, histórico, anúncio, campos, erros e tema antes da transição, sem animar resultado nem histórico
    - _Requirements: 1.6, 1.7, 3.1, 3.5, 3.6, 3.7, 4.6, 9.7, 9.9, 10.15, 11.3, 17.4_

  - [x] 7.7 Implementar o ciclo de vida da página
    - `pagehide` volta à Tela_Inicial vazia; `pageshow` com `persisted` (bfcache) limpa e foca o campo; `iniciar()` esvazia campos restaurados por duplicar ou reabrir a aba
    - _Requirements: 11.2, 18.2, 18.9, 19.5, 19.6_

- [x] 8. Escrever os testes estáticos e de injeção
  - [x] 8.1 Escrever `tests/estatico.test.js`
    - CSP em `<meta>` logo após `<meta charset>` com as diretivas exigidas (inclusive Trusted Types) e sem `'unsafe-inline'`, `'unsafe-eval'`, `frame-ancestors`, `report-uri`, `report-to`, `sandbox` ou curingas
    - HTML sem script inline, `on*=`, `style=` ou `<style>`; JS sem sinks de HTML, `eval`, armazenamento, rede, histórico, `console.log` ou módulos; atributos dos campos; `lang` e viewport; nenhuma URL externa; `site/` ≤ 204.800 bytes
    - _Requirements: 16.3, 19.2, 19.8, 20.2, 20.3, 20.5, 20.9, 21.2, 21.14, 22.5_

  - [x] 8.2 Escrever `tests/injecao.test.js`
    - Cargas maliciosas (`<script>`, `onerror`, `\u202E`, `__proto__`, 1000 caracteres) nos nomes viram texto literal; nos campos de nota e de média são rejeitadas sem mudar o estado; ações malformadas ignoradas; propriedade com textos arbitrários truncados em 1000
    - _Requirements: 2.6, 7.11, 9.10, 20.1, 20.4, 20.11_

- [x] 9. Criar os arquivos de robôs e de cabeçalhos
  - [x] 9.1 Criar `site/robots.txt` e `site/ai.txt`
    - Bloqueio dos robôs de IA conhecidos (GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot e outros), buscadores comuns liberados; `ai.txt` negando uso para treinamento
    - _Requirements: 18.6_

  - [x] 9.2 Criar `site/_headers` para Netlify e Cloudflare Pages
    - CSP do `<meta>` mais `frame-ancestors 'none'`, HSTS de 1 ano com `includeSubDomains`, `nosniff`, `no-referrer`, `Permissions-Policy`, COOP, CORP, `X-Frame-Options: DENY` e `X-Robots-Tag`
    - _Requirements: 20.7, 20.8_

  - [x] 9.3 Escrever as verificações de robôs, anti-quadro e cabeçalhos em `tests/estatico.test.js`
    - Robôs de IA bloqueados e grupo `*` liberado; `ai.txt`; meta `noai, noimageai`; `#aviso-quadro` oculto e regra `html.em-quadro`; `_headers` com os cabeçalhos e a mesma CSP da meta
    - _Requirements: 20.8_

- [x] 10. Criar o workflow de publicação
  - [x] 10.1 Criar `.github/workflows/pages.yml`
    - Disparo em push na `main` e manual; permissões mínimas; job `testar` com `npm ci` e `npm test`; job `publicar` dependente, enviando somente a pasta `site` com `upload-pages-artifact` e `deploy-pages`
    - _Requirements: 18.6, 20.7_

- [x] 11. Escrever o README
  - [x] 11.1 Criar `README.md`
    - Descrição, aviso de que a entrada não é autenticação, abertura local, testes (incluindo `npm.cmd` no PowerShell), publicação no GitHub Pages, segurança, limitações do GitHub Pages e anti-IA de melhor esforço
    - _Requirements: 22.1, 22.2_

- [x] 12. Checkpoint – Suíte completa
  - Ensure all tests pass, ask the user if questions arise.
  - 43/43 testes passando na primeira versão (hoje 110/110, ver tarefa 20).

- [ ] 13. Publicar no GitHub Pages
  - [ ] 13.1 Enviar o projeto ao repositório remoto
    - Enviar o código para https://github.com/AlanSouzaDev7/Projet.Site_NotaRapida na branch `main`, sem incluir `node_modules/`
    - _Requirements: 18.6_

  - [ ] 13.2 Ativar o GitHub Pages e confirmar o primeiro deploy
    - Em Settings → Pages → Build and deployment, escolher a fonte "GitHub Actions"
    - Confirmar que o workflow passou nos testes e publicou em https://alansouzadev7.github.io/Projet.Site_NotaRapida/ por HTTPS
    - _Requirements: 16.2, 18.6, 20.7_

- [ ] 14. Verificações manuais opcionais
  - [ ]* 14.1 Verificar a acessibilidade com leitor de tela
    - NVDA + Firefox e VoiceOver + Safari: rótulos, erros lidos ao focar o campo, saudação como título, resultado anunciado uma vez e ordem de Tab/Shift+Tab
    - _Requirements: 1.10, 5.12, 7.9, 21.3, 21.4, 21.9_

  - [ ]* 14.2 Conferir no navegador a CSP em `file://`, a responsividade e as animações
    - Console sem violação de CSP em `file://` e no servidor local; larguras de 320 a 1920 px e zoom de 400%; animações e `prefers-reduced-motion`
    - _Requirements: 10.11, 10.12, 20.10, 21.1, 22.1, 22.2_

- [x] 15. Redesenhar a interface (identidade, temas e acolhimento)
  - [x] 15.1 Criar a identidade visual e o aviso permanente de site não oficial
    - Faixa no topo, aviso no cartão de entrada e no rodapé; bandeirola geométrica própria, `icone.svg` e `ilustracao.svg` sem nenhum símbolo oficial; descrição da página com o aviso
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x] 15.2 Refazer os temas com degradês, profundidade e amostras
    - `tema--neutro` (`#0B4FA6`), `tema--feminino` (`#9D2A68`, ameixa e lilás) e `tema--masculino` (`#1B4965`, azul-petróleo) no `<body>` e na `#tela-professor`; degradês, sombras em camadas e acento por tema; amostra e nome do tema nas três opções da Tela_Inicial
    - _Requirements: 11.7, 11.8, 11.9, 11.11, 23.6_

  - [x] 15.3 Acrescentar os elementos de acolhimento ao professor
    - Período do dia e data por extenso (sem `Intl`), Recado do dia, homenagem de 15 de outubro, régua com as faixas da média, carimbo, legenda das faixas no campo "Média para aprovação"
    - _Requirements: 7.12, 7.13, 12.1, 12.2, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

  - [x] 15.4 Reorganizar os dados em painéis numerados (1 Lançar notas, 2 Resultado, 3 Últimos 20 alunos)
    - Tabela do histórico a partir de 900 px e fichas abaixo disso; resumo do grupo; layout de duas colunas a partir de 1024 px
    - _Requirements: 9.4, 9.13, 10.3, 10.4, 10.5_

- [x] 16. Histórico dos 20 últimos alunos consultados, somente leitura
  - [x] 16.1 Ampliar e proteger o histórico em `notas.js`
    - `TAMANHO_HISTORICO = 20`, `congelarProfundo` nos Lançamentos, lista e `HISTORICO_VAZIO` congelados, `resumirHistorico` e `faixasDaMedia`
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.11, 9.12, 9.13, 20.14_

  - [x] 16.2 Escrever `tests/historico-somente-leitura.test.js`
    - **Property 23: Faixas da média sem lacunas nem sobreposição; Property 24: Resumo consistente; Property 25: Imutabilidade; Property 26: Recado e data do dia**
    - **Validates: Requirements 9.11, 9.12, 9.13, 12.1, 20.14, 24.1, 24.2, 24.3, 24.5**

  - [x] 16.3 Interface somente leitura e verificações estáticas
    - Etiqueta "Somente leitura", "Limpar histórico" como único botão, nenhum campo editável, texto da interface coerente com os 20 da lógica (`estatico.test.js`)
    - _Requirements: 9.8, 9.11, 2.2_

- [x] 17. Fluidez e uso no celular
  - [x] 17.1 Ajustes de toque e de navegador
    - `:hover` só em `@media (hover: hover)`, `overscroll-behavior-y: contain`, `color-scheme: only light`, imagem decorativa com `loading="lazy"`, `100dvh`, alvos de 44 px
    - _Requirements: 21.10, 21.15, 21.16, 16.6_

  - [x] 17.2 Política de foco em telas de toque
    - `ehTelaDeToque()`: sem foco automático em "Nome do aluno", teclado fechado após calcular e `revelarResultado()`; decisão registrada como Suposição 6 (reversível em uma condição)
    - _Requirements: 2.5, 4.6_

  - [x] 17.3 Desempenho do primeiro layout
    - Aquecimento invisível da Tela_do_Professor em ociosidade; data por extenso sem `Intl`; deslocamento de layout 0
    - _Requirements: 16.7, 24.5_

  - [x] 17.4 Ordem de foco e marcos
    - "Trocar professor" por último na ordem do DOM e no topo pelo CSS; link "Ir para o conteúdo" de 44 px; um banner, um `<main>` e um rodapé; único `tabindex` é o `-1` do `<main>`
    - _Requirements: 21.8, 21.9, 21.17_

  - [x] 17.5 Corrigir fontes abaixo de 14 px
    - `--tam-micro` de 13 px para 14 px; teste de `estatico.test.js` confere todas as declarações de `font-size` (exceto o carimbo decorativo); layout reconferido em 9 larguras (0 problemas), contraste (0 falhas) e axe (0 violações)
    - _Requirements: 21.13_

- [x] 18. Servidor local do projeto e capacidade para 30 professores
  - [x] 18.1 Criar `scripts/servir.js` e o script `npm run servir`
    - Sem dependências; arquivos lidos e comprimidos (brotli e gzip) uma vez; rotas fechadas e canônicas; só GET e HEAD; cabeçalhos de `site/_headers`; ETag e 304; balde de fichas por endereço, bloqueio temporário, limites de conexões e de tempo, expulsão das conexões incompletas mais antigas no teto global; só contadores; `--porta` e `--lan`
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.10, 25.11, 22.8_

  - [x] 18.2 Escrever `tests/servidor.test.js`
    - 22 testes: rotas, travessia de diretório (inclusive propriedade), cabeçalhos, compressão, ETag, métodos, malformados, limites por endereço, slowloris, ataque distribuído e 30 e 300 professores simultâneos
    - _Requirements: 25.1 a 25.9_

  - [x] 18.3 Teste de campo com vários professores
    - Limite de 10 medido no `python -m http.server` (fila de 5, sem compressão); `servir.js` com 300 simultâneos (1.800 conexões) e 100 navegadores reais, sem falhas e sem vazamento entre sessões; 29 KB por visita
    - _Requirements: 18.5, 25.1, 25.2_

- [x] 19. Revisão de segurança (múltiplos acessos tratados como possível invasão)
  - [x] 19.1 Endurecer o workflow e cobrir com `tests/supply-chain.test.js`
    - Actions presas a commit, `permissions: {}` e o mínimo por job, `timeout-minutes`, `persist-credentials: false`, `npm ci --ignore-scripts`, sem `pull_request_target` e sem segredos
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [x] 19.2 Fechar superfícies da página
    - `Cross-Origin-Embedder-Policy` em `_headers`; teste que proíbe `postMessage`, canais, workers e `window.open`; `tests/entradas-adversariais.test.js` (ReDoS e crescimento linear)
    - _Requirements: 20.8, 20.12, 20.13_

  - [x] 19.3 Varreduras
    - Segredos na árvore e no histórico (nenhum achado), `npm audit` (0 vulnerabilidades), nenhuma URL `http://` no site; recomendações da conta do GitHub registradas no README
    - _Requirements: 26.5, 26.6, 26.7_

- [x] 20. Documentação e entrega
  - [x] 20.1 Atualizar o README e os specs (`requirements.md`, `design.md`, `tasks.md`)
    - Servidor do projeto, capacidade, segurança do servidor e do workflow, testes, política de toque, histórico de 20, aviso de site não oficial, Requisitos 23 a 26
    - _Requirements: 22.1, 22.2_

  - [x] 20.2 Commitar o trabalho
    - Ficam pendentes só o envio à `main`, a ativação do Pages (tarefa 13) e as verificações manuais (tarefa 14)

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas.
- Os testes de propriedade usam `fast-check` 4.10.2 com `numRuns: 300`; os números de Property seguem o `design.md` e as propriedades sem número cobrem critérios acrescentados depois (média de aprovação, resultado parcial e Tratamento).
- No PowerShell desta máquina, use `npm.cmd test` ou `node --test "tests/**/*.test.js"` (Node 22 ou mais recente). Para abrir o site com o servidor do projeto: `npm run servir` (veja o README).
- O GitHub Pages não aceita cabeçalhos personalizados: lá valem a CSP em `<meta>` e o anti-quadro em `app.js`; `site/_headers` vale só para Netlify ou Cloudflare Pages.
- Tempos dos Requisitos 14 a 17 e a compatibilidade entre navegadores são atendidos pela arquitetura (cálculo síncrono, sem rede, animações só com `opacity`/`transform`) e conferidos manualmente.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["13.1", "14.1", "14.2"] },
    { "id": 1, "tasks": ["13.2"] }
  ]
}
```
