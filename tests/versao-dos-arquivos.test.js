'use strict';

// Arquivos de versões diferentes no cache do navegador (o GitHub Pages guarda cada arquivo por
// 10 minutos, separadamente) faziam botões aparecerem sem funcionar. Duas defesas:
// 1) a publicação põe a versão nos endereços (scripts/versionar.js);
// 2) o app confere o contrato com notas.js e o HTML que recebeu, e avisa em vez de quebrar em silêncio.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fc = require('fast-check');
const { versionar } = require('../scripts/versionar.js');

const RAIZ = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const html = ler('site/index.html');
const VERSAO = '0123456789abcdef0123456789abcdef01234567';

test('versionar: css e js ganham ?v=; ícones, imagens e âncoras ficam como estão', () => {
  const { html: novo, trocas } = versionar(html, VERSAO);
  assert.equal(trocas, 4, 'estilo.css, notas.js, pdf.js e app.js');
  for (const caminho of ['css/estilo.css', 'js/notas.js', 'js/pdf.js', 'js/app.js']) {
    assert.ok(novo.includes('"' + caminho + '?v=0123456789"'), caminho);
    assert.ok(!novo.includes('"' + caminho + '"'), caminho + ' sem versão');
  }
  // o resto do documento não muda: só esses quatro atributos
  const semVersao = novo.replace(/\?v=0123456789/g, '');
  assert.equal(semVersao, html);
  assert.ok(novo.includes('href="img/icone.svg"') && novo.includes('src="img/ilustracao.svg"'));
  assert.ok(novo.includes('href="#conteudo"') && novo.includes('href="#i-pdf"'));
});

test('versionar: versão que não é hexadecimal de 7 a 40 caracteres é recusada (nada de texto solto no HTML)', () => {
  for (const ruim of ['', 'abc', 'xyz1234567', '0123456789"><script>', '../../etc', 'ABCDEF1234', '0123456789abcdef0123456789abcdef012345678']) {
    assert.throws(() => versionar(html, ruim), /versão inválida/, JSON.stringify(ruim));
  }
  fc.assert(fc.property(fc.stringMatching(/^[0-9a-f]{7,40}$/), (v) => {
    const { html: novo } = versionar(html, v);
    assert.ok(novo.includes('?v=' + v.slice(0, 10) + '"'));
  }), { numRuns: 50 });
});

test('versionar: HTML sem referências a css/ ou js/ não é alterado em silêncio (o script falha)', () => {
  const { trocas } = versionar('<html><link rel="icon" href="img/icone.svg"></html>', VERSAO);
  assert.equal(trocas, 0);
  const { execFileSync } = require('node:child_process');
  const tmp = path.join(require('node:os').tmpdir(), 'versionar-' + process.pid + '.html');
  fs.writeFileSync(tmp, '<html>sem arquivos</html>');
  assert.throws(() => execFileSync(process.execPath, [path.join(RAIZ, 'scripts/versionar.js'), tmp, VERSAO], { stdio: 'pipe' }), /Command failed|nenhuma referência/);
  fs.writeFileSync(tmp, html);
  const saida = execFileSync(process.execPath, [path.join(RAIZ, 'scripts/versionar.js'), tmp, VERSAO], { encoding: 'utf8' });
  assert.match(saida, /4 endereços versionados/);
  assert.equal(fs.readFileSync(tmp, 'utf8').match(/\?v=0123456789/g).length, 4);
  fs.rmSync(tmp);
});

test('o fluxo de publicação versiona o index.html antes de enviar o site, sem texto de evento no comando', () => {
  const fluxo = ler('.github/workflows/pages.yml');
  const publicar = fluxo.slice(fluxo.indexOf('\n  publicar:'));
  const posVersao = publicar.indexOf('scripts/versionar.js');
  const posEnvio = publicar.indexOf('actions/upload-pages-artifact');
  assert.ok(posVersao > 0 && posEnvio > posVersao, 'a versão entra antes do upload');
  assert.match(publicar, /env:\s*\n\s+VERSAO:\s*\$\{\{\s*github\.sha\s*\}\}/);
  assert.match(publicar, /run:\s*node scripts\/versionar\.js site\/index\.html "\$VERSAO"/);
  const comandos = [...publicar.matchAll(/^\s+run:\s*(.+)$/gm)].map((m) => m[1]);
  for (const c of comandos) {
    assert.doesNotMatch(c, /\$\{\{/, 'nenhum ${{ }} dentro de run: ' + c);
  }
});

test('contrato: o NIVEL que o app espera é o que notas.js publica, e o app avisa em vez de quebrar', () => {
  const notas = ler('site/js/notas.js');
  const app = ler('site/js/app.js');
  const publicado = /var NIVEL = (\d+);/.exec(notas);
  const esperado = /var NIVEL_ESPERADO = (\d+);/.exec(app);
  assert.ok(publicado && esperado, 'constantes encontradas');
  assert.equal(esperado[1], publicado[1]);
  assert.match(notas, /constantes:\s*Object\.freeze\(\{[\s\S]*NIVEL: NIVEL/);
  assert.match(app, /N\.constantes\.NIVEL !== NIVEL_ESPERADO/);
  assert.match(app, /idsAusentes\.length/);
  assert.match(app, /function avisarArquivosDesencontrados/);
  // o aviso usa só textContent e é lido por tecnologias assistivas
  assert.match(app, /aviso\.setAttribute\('role', 'alert'\)/);
  assert.match(ler('site/css/estilo.css'), /\.aviso-versao\s*\{/);
});

test('o NIVEL sobe junto com o contrato: o app só usa de notas.js o que o nível atual garante', () => {
  const N = require('../site/js/notas.js');
  assert.equal(typeof N.constantes.NIVEL, 'number');
  // tudo o que app.js chama em N existe no módulo (um nome que sumiu quebraria o app em silêncio)
  const app = ler('site/js/app.js');
  const usados = new Set([...app.matchAll(/\bN\.([A-Za-z]+)\b/g)].map((m) => m[1]));
  for (const nome of usados) {
    assert.ok(nome in N, 'N.' + nome + ' usado em app.js e ausente em notas.js');
  }
  // as ações que o reducer entende incluem a de edição que o botão Editar usa
  assert.match(ler('site/js/notas.js'), /tipo === 'EDITAR_LANCAMENTO'/);
  assert.match(app, /tipo: 'EDITAR_LANCAMENTO'/);
});
