'use strict';

// Verificações estáticas: os arquivos do site são lidos como texto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const ler = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');

const htmlBruto = ler('index.html');
const html = htmlBruto.replace(/<!--[\s\S]*?-->/g, ''); // sem comentários
const css = ler('css/estilo.css');
const scripts = { 'js/notas.js': ler('js/notas.js'), 'js/app.js': ler('js/app.js') };

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
  assert.deepEqual(tags('script').map((t) => atributo(t, 'src')), ['js/notas.js', 'js/app.js']);
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
  assert.equal(texto.length, 6); // professor, média, aluno, T1, T2, T3
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
