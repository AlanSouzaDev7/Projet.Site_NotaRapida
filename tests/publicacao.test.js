'use strict';

// Onde o NotaRápida é publicado. No GitHub Pages, alansouzadev7.github.io é a mesma origem
// para todos os projetos da conta: outra página dali lia as notas (window.open) e um Service
// Worker na raiz reescrevia o app. O app foi para o Cloudflare (origem só dele, com os
// cabeçalhos de site/_headers valendo); o GitHub Pages ficou só com a página de aviso.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const NOVO = 'https://projet-site-notarapida.alanmartinsdesouza07.workers.dev/';

test('wrangler.jsonc: o deploy do Cloudflare envia só site/, com 404 de verdade e sem prévias', () => {
  const texto = ler('wrangler.jsonc');
  const config = JSON.parse(texto.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.name, 'projet-site-notarapida', 'o nome do Worker criado no painel');
  assert.equal(config.main, undefined, 'só arquivos estáticos: nenhum código roda no servidor');
  assert.equal(config.assets.directory, './site');
  assert.equal(config.assets.not_found_handling, 'none', 'endereço inexistente é 404, e não o app');
  assert.equal(config.assets.binding, undefined);
  assert.equal(config.preview_urls, false, 'sem endereços de prévia publicados');
  assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(fs.existsSync(path.join(RAIZ, 'site/_headers')), 'os cabeçalhos ficam dentro da pasta publicada');
});

for (const arquivo of ['redirecionamento/index.html', 'redirecionamento/404.html']) {
  test(arquivo + ': só o aviso e o redirecionamento para o endereço novo', () => {
    const html = ler(arquivo);
    assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">/);
    assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=' + NOVO + '">'));
    assert.ok(html.includes('<a href="' + NOVO + '">'));
    assert.ok(html.includes('<link rel="canonical" href="' + NOVO + '">'));
    assert.match(html, /<meta name="robots" content="noindex, noai, noimageai">/);
    assert.match(html, /não oficial/);
    // nada do app e nada que rode: sem scripts, estilos, imagens, formulários ou quadros
    assert.doesNotMatch(html, /<(script|style|link rel="stylesheet"|img|form|iframe|input)\b/i);
    assert.doesNotMatch(html, /\son\w+=/i);
    // os únicos endereços são o novo
    const urls = html.match(/https?:\/\/[^\s"'<>]+/g);
    assert.deepEqual([...new Set(urls)], [NOVO]);
  });
}

test('a pasta de aviso só tem as duas páginas, iguais', () => {
  assert.deepEqual(fs.readdirSync(path.join(RAIZ, 'redirecionamento')).sort(), ['404.html', 'index.html']);
  assert.equal(ler('redirecionamento/404.html'), ler('redirecionamento/index.html'));
});

test('o README aponta para o endereço novo logo no topo', () => {
  const acesso = ler('README.md').split('\n').slice(0, 5).find((l) => l.startsWith('**Acesse o site:'));
  assert.ok(acesso, 'linha "Acesse o site" no topo');
  assert.ok(acesso.includes('(' + NOVO + ')'), 'o link de acesso é o endereço novo');
  assert.ok(!acesso.includes('github.io'), 'o endereço antigo não é mais o de acesso');
});
