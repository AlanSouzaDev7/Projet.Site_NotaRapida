'use strict';

// Cadeia de entrega: o fluxo de deploy e as dependências não podem ser o elo fraco.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const lerRaiz = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const workflow = lerRaiz('.github/workflows/pages.yml');
const semComentarios = workflow.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');

// Blocos de cada job (texto a partir de "  nome:" até o próximo job).
function jobs() {
  const corpo = semComentarios.slice(semComentarios.indexOf('\njobs:') + 6);
  const partes = corpo.split(/\n  (?=[a-z][\w-]*:\n)/).filter((p) => /^[a-z][\w-]*:\n/.test(p.trimStart()) || /^[a-z]/.test(p));
  const mapa = {};
  for (const p of partes) {
    const nome = (/^\s*([a-z][\w-]*):/.exec(p) || [])[1];
    if (nome) { mapa[nome] = p; }
  }
  return mapa;
}

test('toda action fica presa a um commit de 40 caracteres (não a uma tag que pode ser movida)', () => {
  const usos = [...semComentarios.matchAll(/uses:\s*([^\s]+)/g)].map((m) => m[1]);
  assert.ok(usos.length >= 5, 'actions encontradas: ' + usos.length);
  for (const u of usos) {
    assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, u);
  }
  // o comentário ao lado diz a versão, para quem for atualizar
  for (const linha of workflow.split('\n').filter((l) => /uses:/.test(l))) {
    assert.match(linha, /# v\d+/, linha.trim());
  }
});

test('permissões: nada por padrão e o mínimo em cada job', () => {
  assert.match(semComentarios, /^permissions:\s*\{\}\s*$/m, 'permissions: {} no topo');
  const j = jobs();
  assert.deepEqual(Object.keys(j).sort(), ['publicar', 'testar']);
  assert.match(j.testar, /permissions:\s*\n\s+contents:\s*read\s*\n/);
  assert.doesNotMatch(j.testar, /pages:\s*write|id-token:\s*write/, 'testar não publica nem emite token');
  assert.match(j.publicar, /pages:\s*write/);
  assert.match(j.publicar, /id-token:\s*write/);
});

test('jobs com tempo limite, checkout sem credenciais gravadas e instalação sem scripts', () => {
  const j = jobs();
  for (const nome of ['testar', 'publicar']) {
    assert.match(j[nome], /timeout-minutes:\s*\d+/, nome);
  }
  const checkouts = [...semComentarios.matchAll(/actions\/checkout@[0-9a-f]{40}\s*\n\s+with:\s*\n\s+persist-credentials:\s*false/g)];
  assert.equal(checkouts.length, 2);
  assert.match(semComentarios, /npm ci --ignore-scripts/);
  assert.doesNotMatch(semComentarios, /npm (install|i)\b(?! --ignore)/);
});

test('o fluxo só roda em push na main e manualmente: nunca com código de forks (pull_request_target)', () => {
  assert.doesNotMatch(semComentarios, /pull_request_target|pull_request\b|issue_comment|workflow_run/);
  assert.match(semComentarios, /on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]\s*\n\s+workflow_dispatch:/);
});

test('o fluxo não usa segredos, não executa texto vindo de eventos e publica só site/', () => {
  assert.doesNotMatch(semComentarios, /secrets\./);
  assert.doesNotMatch(semComentarios, /\$\{\{\s*github\.(event|head_ref)/);
  assert.match(semComentarios, /path:\s*site\s*$/m);
});

test('dependências: só devDependencies, versão exata e sem scripts de instalação', () => {
  const pkg = JSON.parse(lerRaiz('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies, undefined, 'o site não depende de pacote nenhum em produção');
  for (const [nome, versao] of Object.entries(pkg.devDependencies)) {
    assert.match(versao, /^\d+\.\d+\.\d+$/, nome + ' deve ter versão exata, sem ^ ou ~');
  }
  for (const gancho of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']) {
    assert.equal(pkg.scripts[gancho], undefined, gancho);
  }
  const lock = JSON.parse(lerRaiz('package-lock.json'));
  for (const [caminho, info] of Object.entries(lock.packages)) {
    if (caminho) {
      assert.match(info.integrity || '', /^sha512-/, caminho + ' com hash de integridade');
      assert.match(info.resolved || '', /^https:\/\/registry\.npmjs\.org\//, caminho + ' vem do registro oficial');
      assert.notEqual(info.hasInstallScript, true, caminho + ' não pode ter script de instalação');
    }
  }
});

test('o site não publica nada além do necessário: sem mapas de código, segredos, caminhos locais ou e-mails', () => {
  const SITE = path.join(RAIZ, 'site');
  const arquivos = [];
  (function andar(dir) {
    for (const i of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, i.name);
      if (i.isDirectory()) { andar(p); } else { arquivos.push(p); }
    }
  })(SITE);
  const proibidosNoNome = /\.(map|env|pem|key|bak|orig|swp|log)$|(^|\/)\.|node_modules|\.test\./i;
  for (const a of arquivos) {
    const rel = path.relative(SITE, a).replace(/\\/g, '/');
    assert.doesNotMatch(rel, proibidosNoNome, 'arquivo suspeito em site/: ' + rel);
    const texto = fs.readFileSync(a, 'utf8');
    assert.doesNotMatch(texto, /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|xox[baprs]-|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}/, rel);
    assert.doesNotMatch(texto, /[A-Za-z]:\\Users\\|\/home\/[a-z]+\/|\/Users\/[A-Za-z]+\//, 'caminho local em ' + rel);
    assert.doesNotMatch(texto, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'e-mail em ' + rel);
    assert.doesNotMatch(texto, /sourceMappingURL/, 'mapa de código em ' + rel);
  }
});
