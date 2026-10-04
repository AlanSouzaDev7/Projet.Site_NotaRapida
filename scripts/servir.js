'use strict';

/*
 * Servidor local do NotaRápida (sem dependências): serve só a pasta site/.
 *
 * Feito para vários professores abrindo o site ao mesmo tempo (por exemplo, numa
 * rede da escola) sem perder segurança nem velocidade:
 *  - todos os arquivos são lidos, comprimidos (brotli/gzip) e conferidos UMA vez,
 *    na inicialização; atender um pedido é só devolver bytes da memória;
 *  - a busca é por uma lista fechada de rotas: não existe acesso ao disco por
 *    pedido, então caminhos como ../ ou %2e%2e não têm como funcionar;
 *  - só GET e HEAD; limites de tamanho, de tempo, de conexões e de pedidos por
 *    endereço protegem de abuso, sem barrar uma sala inteira atrás do mesmo IP;
 *  - os cabeçalhos de segurança vêm de site/_headers (a mesma política da página);
 *  - nada de pessoas é registrado: só contadores, mostrados ao encerrar.
 *
 * Uso: node scripts/servir.js [--porta=8080] [--lan]
 *      (sem --lan, só este computador acessa; --lan abre para a rede local)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const os = require('node:os');

const LIMITES = Object.freeze({
  conexoesTotais: 4096,
  conexoesPorEndereco: 1200, // uma escola inteira pode sair por um só IP (NAT)
  rajadaPorEndereco: 1500, // pedidos de uma vez por endereço
  reposicaoPorSegundo: 300, // e a reposição, por segundo
  recusasParaBloqueio: 300, // 429 seguidos de um endereço antes de bloqueá-lo por um tempo
  bloqueioMs: 10000,
  maxCabecalhos: 100,
  tamanhoMaxUrl: 2048,
  tamanhoMaxCabecalhos: 8192,
  tempoCabecalhosMs: 5000,
  tempoPedidoMs: 10000,
  tempoOciosoMs: 5000,
  pedidosPorConexao: 500
});

const TIPOS = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
});

// Usados só se site/_headers não existir.
const CABECALHOS_MINIMOS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY'
});

// Lê o bloco "/*" de site/_headers. HSTS fica de fora: este servidor fala HTTP.
function lerCabecalhosDeSeguranca(raiz) {
  let texto;
  try {
    texto = fs.readFileSync(path.join(raiz, '_headers'), 'utf8');
  } catch (erro) {
    return Object.assign({}, CABECALHOS_MINIMOS);
  }
  const cabecalhos = {};
  let dentro = false;
  for (const linha of texto.split(/\r?\n/)) {
    if (/^\s*#/.test(linha) || linha.trim() === '') {
      continue;
    }
    if (!/^\s/.test(linha)) {
      dentro = linha.trim() === '/*';
      continue;
    }
    const i = linha.indexOf(':');
    if (dentro && i > 0) {
      const nome = linha.slice(0, i).trim();
      if (nome.toLowerCase() !== 'strict-transport-security') {
        cabecalhos[nome] = linha.slice(i + 1).trim();
      }
    }
  }
  return Object.keys(cabecalhos).length ? cabecalhos : Object.assign({}, CABECALHOS_MINIMOS);
}

function listarArquivos(dir, base, saida) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name.startsWith('_')) {
      continue; // ocultos e de configuração (como _headers) nunca são servidos
    }
    const completo = path.join(dir, item.name);
    if (item.isDirectory()) {
      listarArquivos(completo, base + item.name + '/', saida);
    } else if (item.isFile() && TIPOS[path.extname(item.name).toLowerCase()]) {
      saida.push({ rota: '/' + base + item.name, arquivo: completo });
    }
  }
  return saida;
}

function menor(original, comprimido) {
  return comprimido.length < original.length * 0.95 ? comprimido : null;
}

// Lê, comprime e confere tudo uma única vez. Devolve rota -> entrada.
function carregarSite(raiz) {
  const mapa = new Map();
  for (const { rota, arquivo } of listarArquivos(raiz, '', [])) {
    const corpo = fs.readFileSync(arquivo);
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()];
    const gz = menor(corpo, zlib.gzipSync(corpo, { level: 9 }));
    const br = menor(corpo, zlib.brotliCompressSync(corpo, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: corpo.length
      }
    }));
    const etag = '"' + crypto.createHash('sha256').update(corpo).digest('hex').slice(0, 24) + '"';
    const entrada = Object.freeze({ tipo, corpo, gz, br, etag });
    mapa.set(rota, entrada);
    if (rota === '/index.html') {
      mapa.set('/', entrada);
    }
  }
  return mapa;
}

// Caminho do pedido -> rota da lista, ou null se for suspeito. Só a forma
// canônica é aceita: nada de //, /./, /../, barra codificada (%2f, %5c) nem barra
// invertida, para que um proxy na frente e este servidor nunca vejam caminhos
// diferentes. Decodifica uma única vez: %252e%252e vira o texto "%2e%2e", que
// não existe na lista.
function normalizarRota(alvo) {
  if (typeof alvo !== 'string' || alvo.charAt(0) !== '/') {
    return null; // "*", URLs absolutas e vazios
  }
  const semConsulta = alvo.split('?')[0].split('#')[0];
  if (/%2f|%5c/i.test(semConsulta)) {
    return null;
  }
  let decodificado;
  try {
    decodificado = decodeURIComponent(semConsulta);
  } catch (erro) {
    return null;
  }
  if (/[\u0000-\u001F\u007F\\]/.test(decodificado) || decodificado.includes('//')) {
    return null; // nulos, controles, barra invertida e barras duplicadas
  }
  if (decodificado.split('/').some((p) => p === '..' || p === '.')) {
    return null;
  }
  return decodificado;
}

// Melhor codificação aceita pelo navegador (respeita q=0).
function escolherCodificacao(cabecalho, entrada) {
  if (typeof cabecalho !== 'string' || cabecalho.length > 200) {
    return null;
  }
  const aceitas = {};
  for (const parte of cabecalho.split(',')) {
    const [nome, ...params] = parte.trim().toLowerCase().split(';');
    const q = params.map((p) => /^\s*q\s*=\s*([0-9.]+)/.exec(p)).find(Boolean);
    aceitas[nome.trim()] = q ? Number(q[1]) : 1;
  }
  if (entrada.br && aceitas.br > 0) {
    return 'br';
  }
  if (entrada.gz && aceitas.gzip > 0) {
    return 'gzip';
  }
  return null;
}

function etagCorresponde(cabecalho, etag) {
  if (typeof cabecalho !== 'string' || cabecalho.length > 500) {
    return false;
  }
  return cabecalho.split(',').some((e) => {
    const t = e.trim();
    return t === '*' || t === etag || t === 'W/' + etag;
  });
}

function criarServidor(opcoes) {
  const raiz = path.resolve(opcoes.raiz);
  const limites = Object.freeze(Object.assign({}, LIMITES, opcoes.limites || {}));
  const seguranca = lerCabecalhosDeSeguranca(raiz);
  const estatisticas = { pedidos: 0, naoModificado: 0, recusados429: 0, metodos405: 0, invalidos: 0, naoEncontrado: 0, conexoesRecusadas: 0, conexoesExpulsas: 0, bloqueios: 0, erros: 0 };
  let mapa = carregarSite(raiz);

  // Pedidos por endereço: balde de fichas (rajada + reposição).
  const baldes = new Map();
  const conexoesPorEndereco = new Map();
  const bloqueados = new Map(); // endereço -> até quando (ms)
  function consumirFicha(endereco) {
    const agora = Date.now();
    let b = baldes.get(endereco);
    if (!b) {
      b = { fichas: limites.rajadaPorEndereco, em: agora, recusas: 0 };
      baldes.set(endereco, b);
    }
    b.fichas = Math.min(limites.rajadaPorEndereco, b.fichas + ((agora - b.em) / 1000) * limites.reposicaoPorSegundo);
    b.em = agora;
    if (b.fichas < 1) {
      // Quem insiste depois de recusado é bloqueado por um tempo: as conexões dele
      // passam a ser derrubadas na hora, sem sequer ler o pedido (poupa processamento).
      b.recusas += 1;
      if (b.recusas >= limites.recusasParaBloqueio) {
        bloqueados.set(endereco, agora + limites.bloqueioMs);
        estatisticas.bloqueios += 1;
        b.recusas = 0;
      }
      return false;
    }
    b.recusas = 0;
    b.fichas -= 1;
    return true;
  }
  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [endereco, b] of baldes) {
      if (b.em < agora - 60000) {
        baldes.delete(endereco);
      }
    }
    for (const [endereco, ate] of bloqueados) {
      if (ate < agora) {
        bloqueados.delete(endereco);
      }
    }
  }, 5000);
  limpeza.unref();

  // Conexões abertas. As "incompletas" ainda não mandaram um pedido: um navegador
  // manda o pedido em milissegundos, quem só goteja cabeçalhos (slowloris) fica
  // incompleto por muito tempo. Ao atingir o teto, as incompletas mais antigas
  // saem para dar vaga a conexões novas, em vez de recusar quem é legítimo.
  const incompletas = new Set();
  let abertas = 0;
  function contar(socket) {
    socket.nrContada = true;
    abertas += 1;
    incompletas.add(socket);
  }
  function descontar(socket) {
    incompletas.delete(socket);
    if (socket.nrContada) {
      socket.nrContada = false;
      abertas -= 1;
      const endereco = socket.nrEndereco;
      const restantes = (conexoesPorEndereco.get(endereco) || 1) - 1;
      if (restantes <= 0) {
        conexoesPorEndereco.delete(endereco);
      } else {
        conexoesPorEndereco.set(endereco, restantes);
      }
    }
  }

  function responder(res, status, texto, extras) {
    const corpo = Buffer.from(texto + '\n', 'utf8');
    res.writeHead(status, Object.assign({}, seguranca, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': corpo.length,
      'Cache-Control': 'no-store'
    }, extras || {}));
    res.end(corpo);
  }

  function tratar(req, res) {
    estatisticas.pedidos += 1;
    const endereco = req.socket.remoteAddress || 'desconhecido';

    if (!consumirFicha(endereco)) {
      estatisticas.recusados429 += 1;
      return responder(res, 429, 'Muitos pedidos. Tente de novo em instantes.', { 'Retry-After': '1', Connection: 'close' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      estatisticas.metodos405 += 1;
      return responder(res, 405, 'Método não permitido.', { Allow: 'GET, HEAD', Connection: 'close' });
    }
    if (typeof req.url !== 'string' || req.url.length > limites.tamanhoMaxUrl) {
      estatisticas.invalidos += 1;
      return responder(res, 414, 'Endereço muito longo.', { Connection: 'close' });
    }
    // O Node só descarta cabeçalhos além do limite; aqui o pedido é recusado.
    if (req.rawHeaders.length >= limites.maxCabecalhos * 2) {
      estatisticas.invalidos += 1;
      return responder(res, 431, 'Cabeçalhos demais.', { Connection: 'close' });
    }
    // GET/HEAD não têm corpo; qualquer corpo é tentativa de contrabando de pedidos.
    if ((req.headers['content-length'] && req.headers['content-length'] !== '0') || req.headers['transfer-encoding']) {
      estatisticas.invalidos += 1;
      return responder(res, 400, 'Pedido inválido.', { Connection: 'close' });
    }
    const host = req.headers.host;
    if (typeof host !== 'string' || host.length > 255 || !/^[A-Za-z0-9.\-[\]:]+$/.test(host)) {
      estatisticas.invalidos += 1;
      return responder(res, 400, 'Pedido inválido.', { Connection: 'close' });
    }
    const rota = normalizarRota(req.url);
    if (rota === null) {
      estatisticas.invalidos += 1;
      return responder(res, 400, 'Pedido inválido.', { Connection: 'close' });
    }
    const entrada = mapa.get(rota);
    if (!entrada) {
      estatisticas.naoEncontrado += 1;
      return responder(res, 404, 'Não encontrado.');
    }

    const codificacao = escolherCodificacao(req.headers['accept-encoding'], entrada);
    const corpo = codificacao === 'br' ? entrada.br : codificacao === 'gzip' ? entrada.gz : entrada.corpo;
    const cabecalhos = Object.assign({}, seguranca, {
      'Content-Type': entrada.tipo,
      'Cache-Control': 'no-cache', // sempre confere o ETag: nunca mistura versões
      ETag: entrada.etag,
      Vary: 'Accept-Encoding',
      'Accept-Ranges': 'none'
    });
    if (codificacao) {
      cabecalhos['Content-Encoding'] = codificacao;
    }
    if (etagCorresponde(req.headers['if-none-match'], entrada.etag)) {
      estatisticas.naoModificado += 1;
      res.writeHead(304, cabecalhos);
      return res.end();
    }
    cabecalhos['Content-Length'] = corpo.length;
    res.writeHead(200, cabecalhos);
    return res.end(req.method === 'HEAD' ? undefined : corpo);
  }

  const servidor = http.createServer({
    maxHeaderSize: limites.tamanhoMaxCabecalhos,
    keepAliveTimeout: limites.tempoOciosoMs,
    headersTimeout: limites.tempoCabecalhosMs,
    requestTimeout: limites.tempoPedidoMs,
    connectionsCheckingInterval: Math.max(100, Math.min(1000, limites.tempoCabecalhosMs)),
    joinDuplicateHeaders: false
  }, (req, res) => {
    try {
      tratar(req, res);
    } catch (erro) {
      estatisticas.erros += 1;
      if (!res.headersSent) {
        responder(res, 500, 'Erro interno.', { Connection: 'close' });
      } else {
        res.destroy();
      }
    }
  });
  servidor.maxRequestsPerSocket = limites.pedidosPorConexao;
  servidor.maxHeadersCount = limites.maxCabecalhos;
  servidor.on('connection', (socket) => {
    const endereco = socket.remoteAddress || 'desconhecido';
    const agora = Date.now();
    const ate = bloqueados.get(endereco);
    if (ate !== undefined && agora < ate) {
      estatisticas.conexoesRecusadas += 1;
      socket.destroy(); // endereço bloqueado: derruba sem ler nada
      return;
    }
    const n = (conexoesPorEndereco.get(endereco) || 0) + 1;
    if (n > limites.conexoesPorEndereco) {
      estatisticas.conexoesRecusadas += 1;
      socket.destroy();
      return;
    }
    if (abertas >= limites.conexoesTotais) {
      const maisAntiga = incompletas.values().next().value; // Set mantém a ordem de chegada
      if (maisAntiga === undefined) {
        estatisticas.conexoesRecusadas += 1;
        socket.destroy();
        return;
      }
      estatisticas.conexoesExpulsas += 1;
      descontar(maisAntiga);
      maisAntiga.destroy();
    }
    socket.nrEndereco = endereco;
    conexoesPorEndereco.set(endereco, n);
    contar(socket);
    socket.once('close', () => descontar(socket));
  });
  // Primeiro pedido recebido: a conexão deixou de ser "incompleta".
  servidor.prependListener('request', (req) => incompletas.delete(req.socket));
  servidor.on('clientError', (erro, socket) => {
    estatisticas.invalidos += 1;
    if (socket.writable) {
      const status = erro.code === 'HPE_HEADER_OVERFLOW' ? '431 Request Header Fields Too Large'
        : erro.code === 'ERR_HTTP_REQUEST_TIMEOUT' ? '408 Request Timeout'
          : '400 Bad Request';
      socket.end('HTTP/1.1 ' + status + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    } else {
      socket.destroy();
    }
  });
  servidor.on('connect', (req, socket) => socket.destroy()); // CONNECT não é aceito
  servidor.on('close', () => clearInterval(limpeza));

  return {
    servidor,
    estatisticas,
    limites,
    rotas: () => [...mapa.keys()].sort(),
    recarregar: () => { mapa = carregarSite(raiz); },
    escutar: (porta, host) => new Promise((resolve, reject) => {
      servidor.once('error', reject);
      servidor.listen({ port: porta, host, backlog: 1024 }, () => resolve(servidor.address()));
    }),
    fechar: () => new Promise((resolve) => {
      servidor.close(() => resolve());
      servidor.closeAllConnections();
    })
  };
}

function enderecosDaRede() {
  const saida = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) {
        saida.push(i.address);
      }
    }
  }
  return saida;
}

async function iniciar(argv) {
  const arg = (nome) => (argv.find((a) => a.startsWith('--' + nome + '=')) || '').split('=')[1];
  const lan = argv.includes('--lan');
  const porta = Number(arg('porta') || process.env.PORT || 8080);
  const host = lan ? '0.0.0.0' : '127.0.0.1';
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    console.error('Porta inválida.');
    process.exit(1);
  }
  const app = criarServidor({ raiz: path.join(__dirname, '..', 'site') });
  const fonte = path.join(__dirname, '..', 'site');
  let timer = null;
  try {
    fs.watch(fonte, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { try { app.recarregar(); } catch (erro) { /* arquivo ainda sendo salvo */ } }, 150);
    });
  } catch (erro) { /* sem observação de arquivos: reinicie para ver alterações */ }

  await app.escutar(porta, host);
  console.log('NotaRápida em http://localhost:' + porta + '/ (' + app.rotas().length + ' arquivos em memória)');
  if (lan) {
    console.log('Aberto para a rede local (HTTP, sem criptografia): ' + enderecosDaRede().map((a) => 'http://' + a + ':' + porta + '/').join('  '));
  } else {
    console.log('Só este computador acessa. Use --lan para abrir para a rede local.');
  }
  const encerrar = async () => {
    const e = app.estatisticas;
    console.log('\nEncerrando. Pedidos: ' + e.pedidos + ' | 304: ' + e.naoModificado + ' | limitados (429): ' + e.recusados429 + ' | inválidos: ' + e.invalidos + ' | outros métodos: ' + e.metodos405);
    await app.fechar();
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

module.exports = { criarServidor, carregarSite, normalizarRota, escolherCodificacao, lerCabecalhosDeSeguranca, LIMITES };

if (require.main === module) {
  iniciar(process.argv.slice(2));
}
