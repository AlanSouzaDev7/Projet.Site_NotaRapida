'use strict';

// Verificações estáticas: os arquivos do site são lidos como texto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
// Quebras de linha normalizadas: no Windows o Git entrega os arquivos com CRLF, e as
// verificações por janela de caracteres não podem depender disso.
const ler = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8').replace(/\r\n/g, '\n');

const htmlBruto = ler('index.html');
const html = htmlBruto.replace(/<!--[\s\S]*?-->/g, ''); // sem comentários
const css = ler('css/estilo.css');
const scripts = { 'js/notas.js': ler('js/notas.js'), 'js/pdf.js': ler('js/pdf.js'), 'js/app.js': ler('js/app.js') };

function tags(nome) {
  return html.match(new RegExp('<' + nome + '\\b[^>]*>', 'gi')) || [];
}

function atributo(tag, nome) {
  const m = new RegExp('\\s' + nome + '\\s*=\\s*"([^"]*)"', 'i').exec(tag);
  return m ? m[1] : null;
}

function cspDaMeta() {
  const meta = tags('meta').find((t) => /http-equiv\s*=\s*"Content-Security-Policy"/i.test(t));
  assert.ok(meta, 'meta CSP presente');
  return { tag: meta, politica: atributo(meta, 'content') };
}

function diretivas(politica) {
  const mapa = {};
  for (const parte of politica.split(';')) {
    const [nome, ...valores] = parte.trim().split(/\s+/);
    if (nome) {
      mapa[nome] = valores.join(' ');
    }
  }
  return mapa;
}

test('CSP em <meta> antes de qualquer <link> e <script>', () => {
  const { tag } = cspDaMeta();
  const posCsp = html.indexOf(tag);
  const primeiroLink = html.search(/<link\b/i);
  const primeiroScript = html.search(/<script\b/i);
  assert.ok(posCsp > 0);
  assert.ok(primeiroLink === -1 || posCsp < primeiroLink);
  assert.ok(primeiroScript === -1 || posCsp < primeiroScript);
  // depois apenas do <meta charset>
  const antes = html.slice(0, posCsp);
  assert.deepEqual(antes.match(/<meta\b[^>]*>/gi), ['<meta charset="utf-8">']);
});

test('CSP com as diretivas exigidas, incluindo Trusted Types', () => {
  const d = diretivas(cspDaMeta().politica);
  const exigidas = {
    'default-src': "'none'",
    'script-src': "'self'",
    'connect-src': "'none'",
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'",
    'require-trusted-types-for': "'script'",
    'trusted-types': "'none'"
  };
  for (const [nome, valor] of Object.entries(exigidas)) {
    assert.equal(d[nome], valor, nome);
  }
  const texto = cspDaMeta().politica;
  for (const proibido of ["'unsafe-inline'", "'unsafe-eval'", 'frame-ancestors', 'report-uri', 'report-to', 'sandbox', 'http:', 'https:', '*']) {
    assert.ok(!texto.includes(proibido), proibido);
  }
});

test('HTML sem script inline, on*=, style= nem <style>', () => {
  for (const s of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) {
    assert.match(s, /^<script\b[^>]*\ssrc="[^"]+"[^>]*><\/script>$/i, 'script deve ter src e corpo vazio');
    assert.doesNotMatch(s, /type\s*=\s*"module"/i);
  }
  assert.deepEqual(tags('script').map((t) => atributo(t, 'src')), ['js/notas.js', 'js/pdf.js', 'js/app.js']);
  assert.doesNotMatch(html, /<[^>]*\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /<[^>]*\sstyle\s*=/i);
  assert.doesNotMatch(html, /<style\b/i);
});

test('JS sem sinks de HTML, eval, armazenamento, rede, histórico, console ou módulos', () => {
  const proibidos = [
    /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\b/,
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /document\.cookie/, /\bserviceWorker\b/, /\bcaches\./,
    /\bfetch\s*\(/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /pushState/, /replaceState/,
    /\bconsole\.log\b/, /^\s*import\b/m, /\bimport\s*\(/, /^\s*export\b/m, /setAttribute\(\s*['"]style/,
    /\bsetTimeout\s*\(\s*['"]/, /\bsetInterval\s*\(\s*['"]/
  ];
  for (const [nome, codigo] of Object.entries(scripts)) {
    for (const re of proibidos) {
      assert.doesNotMatch(codigo, re, nome + ': ' + re);
    }
    assert.match(codigo, /'use strict';/, nome + ' usa strict');
  }
  assert.match(scripts['js/notas.js'], /return Object\.freeze\(\{/);
});

test('campos de texto com autocomplete="off" e maxlength="1000"; rádios sem autocompletar', () => {
  const inputs = tags('input');
  const texto = inputs.filter((t) => atributo(t, 'type') === 'text');
  assert.equal(texto.length, 9); // professor, média, aluno, T1, T2, T3 e T1, T2, T3 da edição do histórico
  for (const t of texto) {
    assert.equal(atributo(t, 'autocomplete'), 'off', t);
    assert.equal(atributo(t, 'maxlength'), '1000', t);
  }
  for (const t of inputs) {
    assert.equal(atributo(t, 'autocomplete'), 'off', t);
  }
});

test('lang="pt-BR" e viewport sem bloqueio de zoom', () => {
  assert.match(html, /<html\b[^>]*\slang="pt-BR"/);
  const viewport = tags('meta').find((t) => atributo(t, 'name') === 'viewport');
  assert.ok(viewport);
  const conteudo = atributo(viewport, 'content');
  assert.doesNotMatch(conteudo, /user-scalable\s*=\s*(no|0)/i);
  assert.doesNotMatch(conteudo, /maximum-scale/i);
});

test('nenhuma URL externa carregada', () => {
  const externa = /^\s*(https?:|\/\/|\/)/i;
  for (const nome of ['src', 'href']) {
    for (const m of html.matchAll(new RegExp('\\s' + nome + '\\s*=\\s*"([^"]*)"', 'gi'))) {
      assert.doesNotMatch(m[1], externa, m[0]);
    }
  }
  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(css, /@font-face/i);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
    assert.doesNotMatch(m[1], externa, m[0]);
  }
  const svg = ler('img/icone.svg');
  assert.doesNotMatch(svg, /\s(href|xlink:href|src)\s*=/i);
  for (const [nome, codigo] of Object.entries(scripts)) {
    assert.doesNotMatch(codigo, /['"`]\s*(https?:)?\/\/[a-z0-9]/i, nome);
  }
});

function tamanhoDiretorio(dir) {
  let total = 0;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    total += item.isDirectory() ? tamanhoDiretorio(p) : fs.statSync(p).size;
  }
  return total;
}

test('site/ com no máximo 204800 bytes', () => {
  const total = tamanhoDiretorio(SITE);
  assert.ok(total <= 204800, total + ' bytes');
});

// ---------- Anti-IA e anti-quadro ----------

const ROBOS_IA = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'CCBot',
  'Google-Extended', 'Applebot-Extended', 'PerplexityBot', 'Bytespider', 'Amazonbot', 'meta-externalagent',
  'cohere-ai', 'Diffbot', 'ImagesiftBot', 'Omgilibot', 'FacebookBot'];

function gruposRobots(texto) {
  // Cada grupo: user-agents consecutivos seguidos das regras.
  const grupos = [];
  let atual = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    if (!linha) {
      continue;
    }
    const [campo, ...resto] = linha.split(':');
    const chave = campo.trim().toLowerCase();
    const valor = resto.join(':').trim();
    if (chave === 'user-agent') {
      if (!atual || atual.regras.length) {
        atual = { agentes: [], regras: [] };
        grupos.push(atual);
      }
      atual.agentes.push(valor);
    } else if (atual) {
      atual.regras.push(chave + ':' + valor);
    }
  }
  return grupos;
}

test('robots.txt bloqueia os robôs de IA e libera os buscadores comuns', () => {
  const grupos = gruposRobots(ler('robots.txt'));
  for (const robo of ROBOS_IA) {
    const g = grupos.find((x) => x.agentes.includes(robo));
    assert.ok(g, robo + ' listado');
    assert.ok(g.regras.includes('disallow:/'), robo + ' bloqueado');
  }
  const todos = grupos.find((x) => x.agentes.includes('*'));
  assert.ok(todos, 'grupo *');
  assert.ok(!todos.regras.includes('disallow:/'), 'buscadores comuns não bloqueados');
  for (const g of grupos) {
    assert.ok(!g.agentes.some((a) => /^(Googlebot|Bingbot)$/i.test(a)), 'Googlebot/Bingbot não bloqueados');
  }
});

test('ai.txt nega uso para treinamento', () => {
  const ai = ler('ai.txt');
  assert.match(ai, /User-Agent:\s*\*/i);
  assert.match(ai, /Disallow:\s*\//i);
});

test('meta robots noai, noimageai', () => {
  const meta = tags('meta').find((t) => atributo(t, 'name') === 'robots');
  assert.ok(meta);
  assert.equal(atributo(meta, 'content'), 'noai, noimageai');
});

test('mensagem anti-quadro presente no HTML, oculta e sem estilo inline', () => {
  const p = (html.match(/<p\b[^>]*id="aviso-quadro"[^>]*>[^<]*<\/p>/) || [])[0];
  assert.ok(p, 'parágrafo #aviso-quadro');
  assert.match(p, /\shidden[\s>]/);
  assert.match(p, />O NotaRápida não pode ser exibido dentro de outro site\.<\/p>$/);
  assert.match(css, /html\.em-quadro \.palco/);
  const app = scripts['js/app.js'];
  assert.match(app, /window\.top !== window\.self/);
  assert.match(app, /classList\.add\('em-quadro'\)/);
});

test('_headers documenta os cabeçalhos para provedores que os aceitam', () => {
  const h = ler('_headers');
  assert.match(h, /frame-ancestors 'none'/);
  assert.match(h, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(h, /X-Content-Type-Options: nosniff/);
  assert.match(h, /Referrer-Policy: no-referrer/);
  assert.match(h, /Permissions-Policy: /);
  assert.match(h, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(h, /Cross-Origin-Resource-Policy: same-origin/);
  assert.match(h, /X-Frame-Options: DENY/);
  // a CSP do cabeçalho contém a mesma política da meta
  assert.ok(h.includes(cspDaMeta().politica));
});

// ---------- Identidade visual, aviso de site não oficial e histórico somente leitura ----------

test('o aviso "site não oficial" aparece na faixa do topo, na tela de entrada e no rodapé', () => {
  const faixa = (html.match(/<header class="faixa-gov"[\s\S]*?<\/header>/) || [])[0];
  assert.ok(faixa, 'faixa do topo');
  assert.match(faixa, /Site não oficial/);
  assert.match(faixa, /Sem vínculo com o Governo do Estado/);
  const entrada = (html.match(/<p class="nota-oficial">[\s\S]*?<\/p>/) || [])[0];
  assert.ok(entrada, 'aviso na tela de entrada');
  assert.match(entrada, /não oficial/);
  const rodape = (html.match(/<footer class="rodape">[\s\S]*?<\/footer>/) || [])[0];
  assert.ok(rodape, 'rodapé');
  assert.match(rodape, /Site não oficial/);
  assert.match(rodape, /sem vínculo com o Governo do Estado do Rio de Janeiro/);
  // fora das telas: a faixa e o rodapé ficam depois/antes do palco, sempre visíveis
  assert.ok(html.indexOf('class="faixa-gov"') < html.indexOf('class="palco"'));
  assert.ok(html.indexOf('class="palco"') < html.indexOf('class="rodape"'));
  assert.match(css, /html\.em-quadro \.faixa-gov/);
});

test('nenhum símbolo oficial: sem brasão, sem logomarca do governo, só imagens próprias', () => {
  const imagens = [...html.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map((m) => m[1]);
  assert.ok(imagens.length >= 1);
  for (const src of imagens) {
    assert.match(src, /^img\/(icone|ilustracao)\.svg$/, src);
  }
  assert.doesNotMatch(html + css, /bras[aã]o\.(svg|png|jpe?g|webp)/i);
  const titulo = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  assert.doesNotMatch(titulo, /governo|rio de janeiro|\.gov/i);
});

test('histórico dos 35 últimos alunos: as notas só mudam pelo formulário de edição (T1, T2 e T3), nunca no próprio registro', () => {
  const secao = (html.match(/<section class="cartao painel-historico"[\s\S]*?<\/section>/) || [])[0];
  assert.ok(secao, 'seção do histórico');
  assert.match(secao, /Últimos 35 alunos consultados/);
  assert.doesNotMatch(secao, /Somente leitura/i);
  assert.doesNotMatch(secao, /não podem ser editados/i);
  assert.doesNotMatch(secao, /<(textarea|select)\b/i);
  assert.doesNotMatch(secao, /contenteditable/i);
  // os únicos campos são T1, T2 e T3, dentro do formulário de edição (o nome do aluno não é editável)
  const formulario = (secao.match(/<form id="form-edicao"[\s\S]*?<\/form>/) || [])[0];
  assert.ok(formulario, 'formulário de edição');
  assert.deepEqual((secao.match(/<input\b[^>]*>/gi) || []).map((i) => atributo(i, 'id')), ['campo-edicao-t1', 'campo-edicao-t2', 'campo-edicao-t3']);
  assert.deepEqual((formulario.match(/<input\b[^>]*>/gi) || []).length, 3);
  assert.match(formulario, /\shidden(\s|>)/, 'o editor começa fechado');
  // ações fixas: baixar o PDF, limpar tudo, salvar e cancelar a edição
  const botoes = secao.match(/<button\b[^>]*>/gi) || [];
  assert.deepEqual(botoes.map((b) => atributo(b, 'id')), ['botao-pdf', 'botao-limpar', 'botao-salvar-edicao', 'botao-cancelar-edicao']);
  assert.match(botoes[0], /\sdisabled(\s|>|=)/, 'o botão de PDF começa desabilitado (não há alunos consultados)');
  const app = scripts['js/app.js'];
  assert.doesNotMatch(app, /createElement\(\s*['"](input|textarea|select)['"]/);
  assert.doesNotMatch(app, /contenteditable|isContentEditable|designMode/i);
  assert.match(app, /data-editar/, 'cada linha da tabela tem o botão Editar');
  assert.doesNotMatch(css, /user-modify/);
});

test('todo ícone <use href="#…"> aponta para um símbolo do sprite', () => {
  const simbolos = new Set([...html.matchAll(/<symbol\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
  const usos = [...html.matchAll(/<use\b[^>]*\shref="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(simbolos.size >= 8 && usos.length > 0);
  for (const id of usos) {
    assert.ok(simbolos.has(id), 'símbolo ausente: ' + id);
  }
});

test('o texto da interface cita os mesmos 35 alunos que a lógica guarda', () => {
  const N = require('../site/js/notas.js');
  const total = String(N.constantes.TAMANHO_HISTORICO);
  assert.match(html, new RegExp('Últimos ' + total + ' alunos consultados'));
  assert.match(html, new RegExp('Apenas os ' + total + ' últimos alunos consultados'));
  assert.match(html, new RegExp('de ' + total + '</span>'));
});

// ---------- Superfícies de ataque entre janelas e abas ----------

test('o código não conversa com outras janelas, abas ou processos: sem postMessage, canais, workers nem window.open', () => {
  const proibidos = [/postMessage/, /addEventListener\(\s*['"]message['"]/, /onmessage/, /\bBroadcastChannel\b/, /\bSharedWorker\b/, /\bnew\s+Worker\b/,
    /\bwindow\.open\b/, /\bopener\b/, /\bEventSource\b/, /\bimportScripts\b/, /\bnavigator\.(serviceWorker|sendBeacon|clipboard)\b/, /\blocation\s*(\.\s*(href|assign|replace)\s*)?=[^=]/,
    /addEventListener\(\s*['"](storage|beforeunload|unload)['"]/, /\bdocument\.domain\b/, /\bwindow\.name\b/];
  for (const [nome, codigo] of Object.entries(scripts)) {
    for (const re of proibidos) {
      assert.doesNotMatch(codigo, re, nome + ': ' + re);
    }
  }
  assert.doesNotMatch(html, /target\s*=\s*"_blank"/i, 'nenhum link abre outra janela');
  assert.doesNotMatch(html, /<(iframe|frame|object|embed|form\b[^>]*\saction)/i);
});

test('_headers traz também o isolamento de origem cruzada (COOP, COEP e CORP)', () => {
  const h = ler('_headers');
  assert.match(h, /Cross-Origin-Embedder-Policy: require-corp/);
  assert.match(h, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(h, /Cross-Origin-Resource-Policy: same-origin/);
});

// ---------- Celular: hover só com mouse, alvos de toque e foco ----------

// Para cada regra de estilo, devolve o seletor e a pilha de @-regras que a envolvem.
function regrasComContexto(texto) {
  const regras = [];
  const pilha = [];
  let inicio = 0;
  const limpo = texto.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (c === '{') {
      const prelude = limpo.slice(inicio, i).trim();
      pilha.push(prelude);
      if (!prelude.startsWith('@')) {
        regras.push({ seletor: prelude, contexto: pilha.slice(0, -1) });
      }
      inicio = i + 1;
    } else if (c === '}') {
      pilha.pop();
      inicio = i + 1;
    } else if (c === ';') {
      inicio = i + 1;
    }
  }
  return regras;
}

test('todo :hover fica dentro de @media (hover: hover): em telas de toque o hover não gruda', () => {
  const comHover = regrasComContexto(css).filter((r) => /:hover/.test(r.seletor));
  assert.ok(comHover.length >= 5, 'regras de hover encontradas');
  for (const r of comHover) {
    const protegida = r.contexto.some((c) => /^@media[^{]*\(hover:\s*hover\)/.test(c)) ||
      r.contexto.some((c) => /prefers-reduced-motion/.test(c)); // só desliga o movimento
    assert.ok(protegida, 'hover sem proteção: ' + r.seletor + ' em ' + JSON.stringify(r.contexto));
  }
});

test('nenhum texto da interface com fonte abaixo de 14px (Req. 21.13), salvo o carimbo decorativo', () => {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = {};
  for (const m of limpo.matchAll(/(--tam-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim();
  }
  // Valor mínimo que a declaração pode ter: clamp(min, ...) vale o primeiro argumento.
  const minimo = (valor) => {
    const v = valor.trim().replace(/var\((--[a-z0-9-]+)\)/g, (todo, nome) => tokens[nome]);
    const clamp = /^clamp\(\s*([\d.]+)px/.exec(v);
    const px = clamp || /^([\d.]+)px$/.exec(v);
    assert.ok(px, 'tamanho de fonte não reconhecido: ' + valor);
    return Number(px[1]);
  };
  // Só o texto do carimbo (ilustração oculta para tecnologias assistivas, que repete o selo).
  const isentos = ['.carimbo__texto'];
  let conferidos = 0;
  for (const m of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletor = m[1].trim().split('\n').pop().trim();
    for (const d of m[2].matchAll(/(?:^|;|\s)font-size\s*:\s*([^;]+)/g)) {
      if (isentos.includes(seletor) || /::after$/.test(seletor)) {
        continue; // ::after é um desenho (content vazio), não texto
      }
      conferidos += 1;
      assert.ok(minimo(d[1]) >= 14, seletor + ' usa font-size ' + d[1].trim() + ' (< 14px)');
    }
  }
  assert.ok(conferidos >= 20, 'declarações de font-size conferidas: ' + conferidos);
});

test('imagem decorativa que fica oculta no celular carrega só quando aparece (loading="lazy")', () => {
  const ilustracao = tags('img').find((t) => /ilustracao\.svg/.test(t));
  assert.ok(ilustracao);
  assert.equal(atributo(ilustracao, 'loading'), 'lazy');
  assert.equal(atributo(ilustracao, 'alt'), '');
});

test('puxar para atualizar no celular não apaga os dados: overscroll-behavior no html', () => {
  const regra = regrasComContexto(css).find((r) => r.seletor === 'html' && /overscroll-behavior-y:\s*contain/.test(css));
  assert.ok(regra, 'regra html com overscroll-behavior-y: contain');
  assert.match(css, /html\s*\{[^}]*overscroll-behavior-y:\s*contain/);
});

test('o navegador não escurece a página sozinho (color-scheme: only light) e o viewport permite zoom', () => {
  const meta = tags('meta').find((t) => atributo(t, 'name') === 'color-scheme');
  assert.ok(meta);
  assert.equal(atributo(meta, 'content'), 'only light');
});

test('o foco não é movido sozinho para campos em telas de toque (teclado virtual)', () => {
  const app = scripts['js/app.js'];
  assert.match(app, /matchMedia\('\(pointer: coarse\)'\)/);
  // todo focus() automático em "Nome do aluno" fica atrás da verificação de toque
  for (const m of app.matchAll(/refs\.campos\.nomeAluno\.focus\(/g)) {
    const antes = app.slice(Math.max(0, m.index - 220), m.index);
    assert.match(antes, /ehTelaDeToque\(\)/, 'focus() sem checar tela de toque');
  }
});

// ---------- Ordem de foco e marcos de navegação ----------

test('ordem de foco da Tela_do_Professor: aluno, T1, T2, T3, Calcular, PDF, Limpar, editor de notas e, por último, Trocar professor', () => {
  const tela = html.slice(html.indexOf('id="tela-professor"'), html.indexOf('</main>'));
  const foco = [...tela.matchAll(/<(button|input|select|textarea|a)\b[^>]*>/gi)].map((m) => {
    const id = atributo(m[0], 'id');
    return id || (atributo(m[0], 'type') === 'submit' ? 'submit-calcular' : m[1]);
  });
  assert.deepEqual(foco, ['campo-media', 'campo-aluno', 'campo-t1', 'campo-t2', 'campo-t3', 'submit-calcular', 'botao-pdf', 'botao-limpar',
    'campo-edicao-t1', 'campo-edicao-t2', 'campo-edicao-t3', 'botao-salvar-edicao', 'botao-cancelar-edicao', 'botao-trocar']);
});

test('nenhuma parada de foco extra: só o <main> aceita tabindex, e apenas -1', () => {
  const tabindex = [...html.matchAll(/\stabindex\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(tabindex, ['-1']);
  assert.match(html, /<main\b[^>]*\stabindex="-1"/);
});

test('marcos únicos: um banner (aviso), um main e um rodapé; sem regiões soltas', () => {
  assert.equal((html.match(/<header class="faixa-gov"/g) || []).length, 1);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<footer class="rodape"/g) || []).length, 1);
  assert.doesNotMatch(html, /role="region"/);
});
