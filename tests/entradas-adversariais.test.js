'use strict';

// Textos feitos para travar o navegador (ReDoS, quadráticos, normalização Unicode): o tempo
// de cada validação tem de ficar baixo e crescer em linha reta com o tamanho do texto.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../site/js/notas.js');

const mil = (trecho) => trecho.repeat(Math.ceil(1000 / trecho.length)).slice(0, 1000);

// Entradas clássicas para expressões regulares e normalização.
const ADVERSARIAIS = {
  zeros: mil('0'),
  sinais: mil('-'),
  virgulas: mil(','),
  pares: mil('0,'),
  espacos_e_um: ' '.repeat(999) + '1',
  noves_e_letra: '9'.repeat(999) + 'a',
  um_ponto: '1'.repeat(998) + '.1',
  um_ponto_final: '1'.repeat(999) + '.',
  marcas_combinantes: 'a' + mil('́'),
  pares_substitutos: mil('😀'),
  substituto_solto: mil('\uD83D'),
  controle_bidi: mil('‮'),
  zero_largura: mil('​'),
  nulos: mil('\u0000'),
  hangul_decomposto: mil('각'),
  fracao_longa: '0,' + '0'.repeat(998),
  negativo_longo: '-' + '0'.repeat(999),
  tabs: mil('\t') + '7',
  digitos_arabes: mil('٧'),
  quebras: mil('\n')
};

const TETO_MS = 25; // folgado: o esperado é bem menos de 1 ms

function medir(f) {
  const a = performance.now();
  f();
  return performance.now() - a;
}

test('cada validação com texto adversarial de 1.000 caracteres responde em milissegundos', () => {
  const funcoes = {
    lerNota: (t) => N.lerNota(t),
    validarNota: (t) => N.validarNota(t),
    validarNotaOpcional: (t) => N.validarNotaOpcional(t),
    validarMediaAprovacao: (t) => N.validarMediaAprovacao(t),
    validarNomeAluno: (t) => N.validarNomeAluno(t),
    validarNomeProfessor: (t) => N.validarNomeProfessor(t),
    contarCaracteres: (t) => N.contarCaracteres(t),
    truncarCampo: (t) => N.truncarCampo(t),
    formulario: (t) => N.validarFormulario({ media: t, nomeAluno: t, t1: t, t2: t, t3: t })
  };
  for (const [nomeEntrada, texto] of Object.entries(ADVERSARIAIS)) {
    for (const [nomeFuncao, f] of Object.entries(funcoes)) {
      f(texto); // aquecimento
      const ms = Math.min(medir(() => f(texto)), medir(() => f(texto)), medir(() => f(texto)));
      assert.ok(ms < TETO_MS, `${nomeFuncao}(${nomeEntrada}) levou ${ms.toFixed(2)} ms`);
    }
  }
});

test('a sessão inteira (entrar e calcular) com textos adversariais também é rápida', () => {
  for (const [nomeEntrada, texto] of Object.entries(ADVERSARIAIS)) {
    const ms = medir(() => {
      let e = N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto, tratamento: texto }).estado;
      for (let i = 0; i < 5; i += 1) {
        e = N.reduzir(e, { tipo: 'CALCULAR', campos: { media: '6', nomeAluno: texto, t1: '7', t2: texto, t3: '' } }).estado;
      }
      N.resumirHistorico(e.historico);
    });
    assert.ok(ms < 60, `${nomeEntrada}: ${ms.toFixed(2)} ms`);
  }
});

test('o tempo cresce em linha reta (e não em potência) com o tamanho do texto', () => {
  // Mesmo sem o corte em 1.000 caracteres, 100x mais texto não pode custar milhares de vezes mais.
  const entradas = { zeros: '0', pares: '0,', marcas: 'á', substitutos: '😀' };
  for (const [nome, unidade] of Object.entries(entradas)) {
    const pequeno = unidade.repeat(1000);
    const grande = unidade.repeat(100000);
    const funcoes = [(t) => N.validarNota(t), (t) => N.validarMediaAprovacao(t), (t) => N.validarNomeAluno(t), (t) => N.contarCaracteres(t)];
    for (const f of funcoes) {
      f(pequeno);
      const tp = Math.max(0.01, Math.min(medir(() => f(pequeno)), medir(() => f(pequeno))));
      const tg = Math.min(medir(() => f(grande)), medir(() => f(grande)));
      assert.ok(tg < 400, `${nome}: 100.000 caracteres levaram ${tg.toFixed(1)} ms`);
      assert.ok(tg / tp < 2000, `${nome}: crescimento ${(tg / tp).toFixed(0)}x para 100x mais texto`);
    }
  }
});

test('truncarCampo limita qualquer texto a 1.000 unidades antes de qualquer outra coisa', () => {
  assert.equal(N.truncarCampo('x'.repeat(5000000)).length, 1000);
  assert.equal(N.truncarCampo(null), '');
  assert.equal(N.truncarCampo(undefined), '');
  const ms = medir(() => N.truncarCampo('y'.repeat(5000000)));
  assert.ok(ms < 50, 'cortar 5 milhões de caracteres levou ' + ms.toFixed(1) + ' ms');
});
