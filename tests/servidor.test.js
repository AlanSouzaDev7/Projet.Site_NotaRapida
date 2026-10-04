'use strict';

// Servidor local (scripts/servir.js): rotas fechadas, cabeçalhos de segurança, compressão,
// limites contra abuso e várias visitas ao mesmo tempo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');
const zlib = require('node:zlib');
const fc = require('fast-check');
const { criarServidor, normalizarRota, escolherCodificacao, carregarSite } = require('../scripts/servir.js');

const SITE = path.join(__dirname, '..', 'site');
const SEM_FREIOS = { rajadaPorEndereco: 1e9, reposicaoPorSegundo: 1e9, conexoesPorEndereco: 1e6, conexoesTotais: 1e6 };

async function comServidor(limites, corpo) {
  const app = criarServidor({ raiz: SITE, limites });
  const { port } = await app.escutar(0, '127.0.0.1');
  try {
    return await corpo(port, app);
  } finally {
    await app.fechar();
  }
}

function pedir(porta, opcoes) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: porta, path: '/', method: 'GET', agent: false, ...opcoes }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo: Buffer.concat(partes) }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Envia bytes crus (para pedidos que o cliente http do Node não deixaria montar).
function bruto(porta, texto, esperaMs = 400) {
  return new Promise((resolve) => {
    const s = net.connect(porta, '127.0.0.1');
    let recebido = '';
    s.on('data', (c) => { recebido += c.toString('latin1'); });
    s.on('error', () => resolve(recebido));
    s.on('close', () => resolve(recebido));
    s.on('connect', () => s.write(texto));
    setTimeout(() => { s.destroy(); resolve(recebido); }, esperaMs);
  });
}

const statusDe = (resposta) => Number((/^HTTP\/1\.1 (\d{3})/.exec(resposta) || [])[1] || 0);

// Visitas simultâneas feitas por OUTRO processo, como na vida real: no mesmo processo, as
// centenas de conexões saem antes de o servidor aceitar qualquer uma e estouram a fila.
const CLIENTE_DE_CARGA = `
const http = require('node:http');
const porta = Number(process.argv[1]);
const n = Number(process.argv[2]);
const alvos = ['/', '/css/estilo.css', '/js/notas.js', '/js/app.js', '/img/icone.svg', '/img/ilustracao.svg'];
function pedir(agent, p) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: porta, path: p, agent, headers: { 'Accept-Encoding': 'br' } }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode === 200 ? 'ok' : String(res.statusCode)));
    });
    req.on('error', (e) => resolve(e.code || 'erro'));
    req.end();
  });
}
(async () => {
  const erros = {};
  let ok = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 6 });
    const rs = await Promise.all(alvos.map((p) => pedir(agent, p)));
    agent.destroy();
    if (rs.every((r) => r === 'ok')) { ok += 1; } else { rs.filter((r) => r !== 'ok').forEach((r) => { erros[r] = (erros[r] || 0) + 1; }); }
  }));
  console.log(JSON.stringify({ ok, erros }));
})();
`;

function visitasEmOutroProcesso(porta, n) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, ['-e', CLIENTE_DE_CARGA, String(porta), String(n)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let saida = '';
    filho.stdout.on('data', (c) => { saida += c; });
    filho.on('close', () => {
      try { resolve(JSON.parse(saida)); } catch (erro) { reject(new Error('saída do cliente: ' + saida)); }
    });
  });
}

// ---------- Rotas: só o que está em site/ e é público ----------

test('serve exatamente os arquivos públicos de site/ (sem _headers, ocultos nem diretórios)', () => {
  const rotas = [...carregarSite(SITE).keys()].sort();
  assert.deepEqual(rotas, ['/', '/ai.txt', '/css/estilo.css', '/img/icone.svg', '/img/ilustracao.svg', '/index.html', '/js/app.js', '/js/notas.js', '/robots.txt']);
});

test('arquivos fora de site/ e de configuração não são servidos, em nenhuma grafia de caminho', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const alvos = ['/_headers', '/.git/config', '/.gitignore', '/package.json', '/package-lock.json', '/README.md', '/tests/estatico.test.js',
      '/scripts/servir.js', '/node_modules/fast-check/package.json', '/.kiro/specs/student-grade-average/design.md', '/.env', '/css', '/css/', '/img/', '/js/',
      '/INDEX.HTML', '/index.html/', '/css/estilo.css/x', '/%5f%68eaders'];
    for (const alvo of alvos) {
      const r = await pedir(porta, { path: alvo });
      assert.ok([404, 400].includes(r.status), alvo + ' -> ' + r.status);
      assert.doesNotMatch(r.corpo.toString(), /DOCTYPE|"name": "notarapida"|\[core\]/i, alvo);
    }
  });
});

test('travessia de diretório é recusada (../, %2e%2e, %2f, barra invertida, nulo, dupla codificação)', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const maus = ['/../package.json', '/%2e%2e/package.json', '/%2E%2E/package.json', '/..%2fpackage.json', '/..%5cpackage.json', '/css/../../package.json',
      '/css/%2e%2e/%2e%2e/package.json', '/%252e%252e/package.json', '/..;/package.json', '/index.html%00.png', '/%00', '/css\\estilo.css', '/./index.html', '/%c0%ae%c0%ae/package.json'];
    for (const alvo of maus) {
      const resposta = await bruto(porta, 'GET ' + alvo + ' HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const status = statusDe(resposta);
      assert.ok([400, 404].includes(status), alvo + ' -> ' + status);
      assert.doesNotMatch(resposta, /"name": "notarapida"|<!doctype html>/i, alvo);
    }
  });
});

test('propriedade: nenhum texto vira caminho fora da lista; normalizarRota nunca lança', () => {
  const mapa = carregarSite(SITE);
  fc.assert(fc.property(fc.oneof(fc.string({ maxLength: 120 }), fc.string({ unit: 'binary', maxLength: 120 }),
    fc.array(fc.constantFrom('..', '.', '%2e%2e', '%2f', '%5c', '%00', '/', '\\', 'css', 'js', 'index.html', '%25', '?', '#', 'é'), { maxLength: 12 }).map((a) => '/' + a.join('/'))),
  (entrada) => {
    const rota = normalizarRota(entrada);
    if (rota !== null) {
      assert.equal(rota.charAt(0), '/');
      assert.doesNotMatch(rota, /\\|\u0000|\/\/|(^|\/)\.\.?(\/|$)|%2f|%5c/i);
    }
    const achou = rota === null ? undefined : mapa.get(rota);
    if (achou) {
      assert.ok(['/', '/index.html', '/ai.txt', '/robots.txt', '/css/estilo.css', '/js/app.js', '/js/notas.js', '/img/icone.svg', '/img/ilustracao.svg'].includes(rota));
    }
  }), { numRuns: 1500 });
});

// ---------- Cabeçalhos de segurança e conteúdo ----------

test('resposta traz os cabeçalhos de segurança de site/_headers (e a mesma CSP da página), sem HSTS nem Server', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const r = await pedir(porta, { headers: { 'Accept-Encoding': 'identity' } });
    assert.equal(r.status, 200);
    const meta = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'))[1];
    assert.ok(r.headers['content-security-policy'].startsWith(meta), 'mesma política da <meta>');
    assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['x-frame-options'], 'DENY');
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.equal(r.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(r.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(r.headers['cross-origin-embedder-policy'], 'require-corp');
    assert.match(r.headers['permissions-policy'], /camera=\(\)/);
    assert.equal(r.headers['strict-transport-security'], undefined);
    assert.equal(r.headers.server, undefined);
    assert.equal(r.headers['x-powered-by'], undefined);
    assert.match(r.headers['content-type'], /^text\/html; charset=utf-8$/);
    assert.equal(r.corpo.toString(), fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'));
  });
});

test('erros também levam os cabeçalhos de segurança e não vazam detalhes', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const r = await pedir(porta, { path: '/nao-existe' });
    assert.equal(r.status, 404);
    assert.equal(r.headers['x-frame-options'], 'DENY');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.doesNotMatch(r.corpo.toString(), /Error|at |node_modules|C:\\/);
  });
});

test('compressão: brotli, gzip ou nada, conforme o navegador aceita, sempre com o mesmo conteúdo', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const original = fs.readFileSync(path.join(SITE, 'css', 'estilo.css'));
    const br = await pedir(porta, { path: '/css/estilo.css', headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
    assert.equal(br.headers['content-encoding'], 'br');
    assert.deepEqual(zlib.brotliDecompressSync(br.corpo), original);
    const gz = await pedir(porta, { path: '/css/estilo.css', headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.deepEqual(zlib.gunzipSync(gz.corpo), original);
    const nenhum = await pedir(porta, { path: '/css/estilo.css', headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0' } });
    assert.equal(nenhum.headers['content-encoding'], undefined);
    assert.deepEqual(nenhum.corpo, original);
    assert.match(br.headers.vary, /Accept-Encoding/i);
    assert.ok(br.corpo.length < original.length / 3, 'brotli reduz mais de 3x');
  });
  assert.equal(escolherCodificacao('x'.repeat(500), { br: Buffer.alloc(1), gz: Buffer.alloc(1) }), null);
});

test('ETag e 304: quem já tem o arquivo não baixa de novo; HEAD não traz corpo', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const a = await pedir(porta, { path: '/js/app.js', headers: { 'Accept-Encoding': 'br' } });
    const etag = a.headers.etag;
    assert.match(etag, /^"[0-9a-f]{24}"$/);
    const b = await pedir(porta, { path: '/js/app.js', headers: { 'Accept-Encoding': 'br', 'If-None-Match': etag } });
    assert.equal(b.status, 304);
    assert.equal(b.corpo.length, 0);
    const c = await pedir(porta, { path: '/js/app.js', headers: { 'If-None-Match': '"outro"' } });
    assert.equal(c.status, 200);
    const h = await pedir(porta, { path: '/js/app.js', method: 'HEAD', headers: { 'Accept-Encoding': 'br' } });
    assert.equal(h.status, 200);
    assert.equal(h.corpo.length, 0);
    assert.equal(Number(h.headers['content-length']), a.corpo.length);
  });
});

// ---------- Métodos e pedidos malformados ----------

test('só GET e HEAD: os demais métodos recebem 405 com Allow; CONNECT é derrubado', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    for (const metodo of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE', 'PROPFIND']) {
      const r = await bruto(porta, metodo + ' / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      assert.equal(statusDe(r), 405, metodo);
      assert.match(r, /Allow: GET, HEAD/i);
    }
    const conectou = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: porta, method: 'CONNECT', path: 'exemplo.com:443', agent: false });
      req.on('connect', () => resolve('ABRIU'));
      req.on('error', () => resolve('RECUSOU'));
      req.end();
    });
    assert.equal(conectou, 'RECUSOU');
  });
});

test('pedidos malformados ou perigosos: URL longa 414, cabeçalhos grandes 431, corpo em GET 400, Host inválido 400', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    assert.equal(statusDe(await bruto(porta, 'GET /' + 'a'.repeat(3000) + ' HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')), 414);
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\nX-Grande: ' + 'b'.repeat(9000) + '\r\n\r\n')), 431);
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5\r\nConnection: close\r\n\r\nabcde')), 400);
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n')), 400);
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: evil.com/<script>\r\nConnection: close\r\n\r\n')), 400);
    assert.equal(statusDe(await bruto(porta, 'GET http://evil.test/ HTTP/1.1\r\nHost: evil.test\r\nConnection: close\r\n\r\n')), 400);
    assert.equal(statusDe(await bruto(porta, 'GET * HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')), 400);
    assert.equal(statusDe(await bruto(porta, 'LIXO\r\n\r\n')), 400);
    // contrabando de pedidos (CL.TE): o segundo pedido embutido não pode ser atendido
    const r = await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 44\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nGET /css/estilo.css HTTP/1.1\r\nHost: localhost\r\n\r\n');
    assert.ok((r.match(/HTTP\/1\.1 \d{3}/g) || []).length <= 1, 'no máximo uma resposta (400)');
    assert.doesNotMatch(r, /box-sizing/);
  });
});

test('o servidor continua atendendo normalmente depois de uma sequência de pedidos inválidos', async () => {
  await comServidor(SEM_FREIOS, async (porta, app) => {
    const lixo = ['\r\n\r\n', 'GET', '\u0000\u0001\u0002', 'GET / HTTP/9.9\r\n\r\n', 'GET / HTTP/1.1\r\nHost\r\n\r\n', 'x'.repeat(70000)];
    for (const l of lixo) { await bruto(porta, l, 120); }
    const r = await pedir(porta, {});
    assert.equal(r.status, 200);
    assert.equal(app.estatisticas.erros, 0);
  });
});

// ---------- Abuso: limites por endereço e conexões lentas ----------

test('limite de pedidos por endereço: a rajada passa, o excesso recebe 429 com Retry-After', async () => {
  await comServidor({ rajadaPorEndereco: 40, reposicaoPorSegundo: 0.001 }, async (porta, app) => {
    const respostas = [];
    for (let i = 0; i < 60; i += 1) { respostas.push(await pedir(porta, { path: '/robots.txt' })); }
    assert.equal(respostas.filter((r) => r.status === 200).length, 40);
    const limitadas = respostas.filter((r) => r.status === 429);
    assert.equal(limitadas.length, 20);
    assert.equal(limitadas[0].headers['retry-after'], '1');
    assert.equal(app.estatisticas.recusados429, 20);
  });
});

test('o limite padrão não barra uma sala inteira atrás do mesmo IP (100 professores = 600 pedidos de uma vez)', async () => {
  await comServidor({}, async (porta, app) => {
    const r = await visitasEmOutroProcesso(porta, 100);
    assert.deepEqual(r, { ok: 100, erros: {} });
    assert.equal(app.estatisticas.recusados429, 0);
  });
});

test('um endereço que inunda não atrapalha os demais: o balde é por endereço', async () => {
  await comServidor({ rajadaPorEndereco: 30, reposicaoPorSegundo: 0.001 }, async (porta, app) => {
    for (let i = 0; i < 60; i += 1) { await pedir(porta, { path: '/robots.txt' }); }
    assert.ok(app.estatisticas.recusados429 >= 30);
    // outro endereço de origem (127.0.0.2 existe no Linux e no Windows; no macOS cai no teste acima)
    const outro = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: porta, path: '/robots.txt', localAddress: '127.0.0.2', agent: false }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', () => resolve('sem-127.0.0.2'));
      req.end();
    });
    assert.ok(outro === 200 || outro === 'sem-127.0.0.2', 'outro endereço: ' + outro);
  });
});

test('limite de conexões por endereço derruba o excesso', async () => {
  await comServidor({ ...SEM_FREIOS, conexoesPorEndereco: 5 }, async (porta, app) => {
    const sockets = await Promise.all(Array.from({ length: 12 }, () => new Promise((resolve) => {
      const s = net.connect(porta, '127.0.0.1');
      s.on('connect', () => resolve(s));
      s.on('error', () => resolve(s));
    })));
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(app.estatisticas.conexoesRecusadas >= 7, 'recusadas: ' + app.estatisticas.conexoesRecusadas);
    sockets.forEach((s) => s.destroy());
  });
});

test('ataque distribuído: no teto global as conexões lentas mais antigas saem e quem é legítimo continua sendo atendido', async () => {
  await comServidor({ ...SEM_FREIOS, conexoesTotais: 20, tempoCabecalhosMs: 60000, tempoPedidoMs: 60000 }, async (porta, app) => {
    // 20 conexões que só gotejam cabeçalhos ocupam todas as vagas
    const lentas = await Promise.all(Array.from({ length: 20 }, () => new Promise((resolve) => {
      const s = net.connect(porta, '127.0.0.1');
      s.on('connect', () => { s.write('GET / HTTP/1.1\r\nHost: x\r\n'); resolve(s); });
      s.on('data', () => {});
      s.on('error', () => {});
    })));
    await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 10; i += 1) {
      const r = await pedir(porta, { path: '/robots.txt' });
      assert.equal(r.status, 200, 'professor ' + i);
    }
    // cada professor legítimo fecha a conexão depois de ser atendido e devolve a vaga: basta expulsar a mais antiga
    assert.ok(app.estatisticas.conexoesExpulsas >= 1, 'expulsas: ' + app.estatisticas.conexoesExpulsas);
    assert.ok(app.estatisticas.conexoesRecusadas === 0, 'nenhum professor foi recusado');
    lentas.forEach((s) => s.destroy());
  });
});

test('quando só há conexões legítimas em andamento no teto, a nova é recusada (nada legítimo é expulso)', async () => {
  await comServidor({ ...SEM_FREIOS, conexoesTotais: 3 }, async (porta, app) => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: 3 });
    for (let i = 0; i < 3; i += 1) { assert.equal((await pedir(porta, { path: '/robots.txt', agent })).status, 200); }
    // 3 conexões ociosas (já atendidas) ocupam o teto; a quarta é recusada
    const extra = await pedir(porta, { path: '/robots.txt' }).then((r) => r.status, () => 'recusada');
    assert.ok(extra === 'recusada' || extra === 200);
    assert.equal(app.estatisticas.conexoesExpulsas, 0);
    agent.destroy();
  });
});

test('inundação: depois de muitas recusas o endereço é bloqueado e as conexões novas são derrubadas na hora', async () => {
  await comServidor({ rajadaPorEndereco: 5, reposicaoPorSegundo: 0.001, recusasParaBloqueio: 10, bloqueioMs: 600 }, async (porta, app) => {
    const respostas = [];
    for (let i = 0; i < 40; i += 1) { respostas.push(await pedir(porta, { path: '/robots.txt' }).catch(() => ({ status: 'derrubada' }))); }
    assert.equal(respostas.filter((r) => r.status === 200).length, 5);
    assert.equal(respostas.filter((r) => r.status === 429).length, 10);
    assert.ok(respostas.filter((r) => r.status === 'derrubada').length >= 20, 'derrubadas');
    assert.equal(app.estatisticas.bloqueios, 1);
    await new Promise((r) => setTimeout(r, 800));
    assert.equal((await pedir(porta, { path: '/robots.txt' })).status, 429, 'passado o bloqueio, a conexão volta a ser lida');
  });
});

test('pedidos com cabeçalhos demais (150) são recusados com 431', async () => {
  await comServidor(SEM_FREIOS, async (porta) => {
    const muitos = Array.from({ length: 150 }, (_, i) => 'H' + i + ': v').join('\r\n');
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\n' + muitos + '\r\nConnection: close\r\n\r\n')), 431);
    assert.equal(statusDe(await bruto(porta, 'GET / HTTP/1.1\r\nHost: localhost\r\nAccept: */*\r\nConnection: close\r\n\r\n')), 200);
  });
});

test('conexão lenta (slowloris): cabeçalhos incompletos são encerrados pelo servidor', async () => {
  await comServidor({ ...SEM_FREIOS, tempoCabecalhosMs: 300, tempoPedidoMs: 600 }, async (porta) => {
    const { fechouEm, resposta } = await new Promise((resolve) => {
      const t0 = Date.now();
      let recebido = '';
      const s = net.connect(porta, '127.0.0.1');
      s.on('connect', () => { s.write('GET / HTTP/1.1\r\nHost: localhost\r\nX-Devagar: 1\r\n'); });
      s.on('data', (c) => { recebido += c.toString('latin1'); }); // sem ler, o Node nunca vê o FIN
      s.on('close', () => resolve({ fechouEm: Date.now() - t0, resposta: recebido }));
      s.on('error', () => {});
      setTimeout(() => { s.destroy(); resolve({ fechouEm: -1, resposta: recebido }); }, 4000);
    });
    assert.ok(fechouEm > 0 && fechouEm < 3000, 'fechou em ' + fechouEm + ' ms');
    assert.equal(statusDe(resposta), 408);
  });
});

// ---------- Várias visitas ao mesmo tempo ----------

test('300 professores abrindo o site ao mesmo tempo (1.800 conexões): nenhuma falha', async () => {
  await comServidor(SEM_FREIOS, async (porta, app) => {
    const r = await visitasEmOutroProcesso(porta, 300);
    assert.deepEqual(r, { ok: 300, erros: {} });
    assert.equal(app.estatisticas.erros, 0);
  });
});

test('30 professores simultâneos, o triplo do limite que o servidor do Python aguentava (10), todos atendidos com os limites padrão', async () => {
  await comServidor({}, async (porta, app) => {
    const r = await visitasEmOutroProcesso(porta, 30);
    assert.deepEqual(r, { ok: 30, erros: {} });
    assert.equal(app.estatisticas.recusados429, 0);
  });
});
