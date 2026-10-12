'use strict';

// Sem scripts (JavaScript desligado, ou um quadro com sandbox sem allow-scripts, em que o
// anti-quadro de app.js não roda), o NotaRápida não pode aparecer: um formulário de aparência
// real, mas inerte, serviria de isca para outro site sobrepor. O conteúdo fica escondido até
// app.js terminar de iniciar e marcar <html class="app-pronto">.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const css = ler('site/css/estilo.css');
const app = ler('site/js/app.js');
const html = ler('site/index.html');

test('sem app-pronto, a faixa, o palco, o rodapé e o atalho ficam escondidos', () => {
  const regra = css.match(/((?:html:not\(\.app-pronto\) [^,{]+,?\s*)+)\{([^}]*)\}/);
  assert.ok(regra, 'regra html:not(.app-pronto) em estilo.css');
  const seletores = regra[1].split(',').map((s) => s.trim()).filter(Boolean);
  for (const alvo of ['.palco', '.faixa-gov', '.rodape', '.pular']) {
    assert.ok(seletores.includes('html:not(.app-pronto) ' + alvo), alvo);
  }
  assert.match(regra[2], /display:\s*none\s*!important/);
});

test('o aviso de JavaScript desligado continua visível e fora do que é escondido', () => {
  assert.match(html, /<noscript><p class="aviso-noscript">Ative o JavaScript para usar o NotaRápida\.<\/p><\/noscript>/);
  assert.doesNotMatch(css, /html:not\(\.app-pronto\)\s+(noscript|\.aviso-noscript|\.aviso-versao|\.aviso-quadro)/);
});

test('app.js só marca app-pronto no fim de iniciar(), depois das conferências', () => {
  const inicio = app.indexOf('function iniciar() {');
  assert.ok(inicio > 0);
  const corpo = app.slice(inicio, app.indexOf('\n  }\n', inicio));
  const marca = corpo.indexOf("classList.add('app-pronto')");
  assert.ok(marca > 0, 'iniciar() adiciona app-pronto');
  assert.ok(marca > corpo.indexOf('idsAusentes.length'), 'depois da conferência dos elementos');
  assert.ok(marca > corpo.indexOf('restaurarTelaInicial(true)'), 'depois de ligar a tela');
  assert.equal(app.split("classList.add('app-pronto')").length, 2, 'em um único lugar');
  // o anti-quadro e a guarda de versão saem antes de iniciar(): nunca chegam a marcar
  assert.ok(app.indexOf('return; // não inicia o NotaRápida') < inicio);
});
