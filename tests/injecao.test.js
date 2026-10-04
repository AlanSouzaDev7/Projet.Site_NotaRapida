'use strict';

// Simulação de injeções no fluxo reduzir(): o texto digitado deve virar apenas
// dado (string literal), sem alterar tela, tratamento, ids ou histórico fora do esperado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const N = require('../site/js/notas.js');

const CARGAS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '\u202E',
  'Ana\u202Eodnaxela',
  '"><svg onload=alert(1)>',
  "'; DROP TABLE alunos; --",
  '{{constructor.constructor("alert(1)")()}}',
  '__proto__',
  'javascript:alert(1)',
  '\u0000\u200B\uFEFF',
  'a'.repeat(1000),
  '<'.repeat(1000)
];

function entrar(texto, tratamento) {
  return N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto, tratamento });
}

function campos(nomeAluno, extra) {
  return Object.assign({ media: '6', nomeAluno, t1: '7', t2: '8', t3: '9' }, extra);
}

test('nomes maliciosos do professor viram texto literal na saudação', () => {
  for (const carga of CARGAS) {
    const r = entrar(N.truncarCampo(carga), carga);
    const nome = carga.trim();
    if (N.contarCaracteres(nome) >= 1 && N.contarCaracteres(nome) <= 100) {
      assert.equal(r.evento.tipo, 'SESSAO_INICIADA', JSON.stringify(carga));
      assert.equal(r.estado.nomeProfessor, nome);
      assert.equal(r.estado.tela, 'professor');
      assert.equal(r.estado.tratamento, 'neutro'); // tratamento inválido vira neutro
      assert.equal(N.montarSaudacao(r.estado.nomeProfessor, r.estado.tratamento), 'Olá, Prof. ' + nome);
      assert.deepEqual(r.estado.historico, []);
    } else {
      assert.equal(r.evento.tipo, 'NOME_INVALIDO', JSON.stringify(carga));
      assert.deepEqual(r.estado, N.estadoInicial());
    }
  }
});

test('nomes maliciosos do aluno viram texto literal no lançamento e nas mensagens', () => {
  const sessao = entrar('Prof').estado;
  for (const carga of CARGAS) {
    const r = N.reduzir(sessao, { tipo: 'CALCULAR', campos: campos(N.truncarCampo(carga)) });
    const nome = carga.trim();
    if (N.contarCaracteres(nome) >= 1 && N.contarCaracteres(nome) <= 100) {
      assert.equal(r.evento.tipo, 'CALCULO_CONCLUIDO');
      const l = r.evento.lancamento;
      assert.equal(typeof l.nomeAluno, 'string');
      assert.equal(l.nomeAluno, nome);
      assert.equal(l.id, 0);
      assert.equal(r.estado.proximoId, 1);
      assert.equal(r.estado.tela, 'professor');
      assert.equal(r.estado.nomeProfessor, 'Prof');
      assert.deepEqual(r.estado.historico, [l]);
      assert.equal(N.montarMensagem(l.nomeAluno, l.classificacao, N.formatarMedia(l.soma)),
        'Parabéns ' + nome + ', você foi aprovado com a média final de 8,00. Você está acima da média.');
    } else {
      assert.equal(r.evento.tipo, 'FORMULARIO_INVALIDO');
      assert.equal(r.estado, sessao); // estado intocado
    }
  }
  // a sessão original não foi mutada
  assert.deepEqual(sessao.historico, []);
  assert.equal(sessao.proximoId, 0);
});

test('cargas nos campos de nota e de média são rejeitadas sem mudar o estado', () => {
  const sessao = entrar('Prof').estado;
  const congelada = JSON.stringify(sessao);
  for (const carga of CARGAS) {
    for (const campo of ['media', 't1', 't2', 't3']) {
      const r = N.reduzir(sessao, { tipo: 'CALCULAR', campos: campos('Ana', { [campo]: N.truncarCampo(carga) }) });
      assert.equal(r.evento.tipo, 'FORMULARIO_INVALIDO', campo + ' ' + JSON.stringify(carga));
      assert.ok(Object.prototype.hasOwnProperty.call(r.evento.erros, campo));
      assert.equal(r.estado, sessao);
    }
  }
  assert.equal(JSON.stringify(sessao), congelada);
  assert.equal(Object.prototype.polluted, undefined);
});

test('ações desconhecidas ou malformadas são ignoradas', () => {
  const sessao = entrar('Prof').estado;
  for (const acao of [null, undefined, {}, { tipo: '__proto__' }, { tipo: 'ENTRAR', texto: 'Outro' },
    { tipo: 'calcular' }, { tipo: { toString: () => 'CALCULAR' } }]) {
    const r = N.reduzir(sessao, acao);
    assert.equal(r.estado, sessao);
    assert.equal(r.evento.tipo, 'IGNORADO');
  }
});

test('qualquer texto do usuário só aparece como cópia literal (propriedade)', () => {
  const texto = fc.oneof(fc.string({ maxLength: 1200 }), fc.string({ unit: 'binary', maxLength: 1200 }),
    fc.constantFrom(...CARGAS));
  fc.assert(fc.property(texto, (t) => {
    const truncado = N.truncarCampo(t);
    assert.ok(truncado.length <= 1000);
    const r = entrar(truncado);
    if (r.evento.tipo === 'SESSAO_INICIADA') {
      assert.equal(r.estado.nomeProfessor, truncado.trim());
      const c = N.reduzir(r.estado, { tipo: 'CALCULAR', campos: campos(truncado) });
      assert.equal(c.evento.tipo, 'CALCULO_CONCLUIDO');
      assert.equal(c.evento.lancamento.nomeAluno, truncado.trim());
      assert.equal(c.estado.historico.length, 1);
    } else {
      assert.equal(r.evento.tipo, 'NOME_INVALIDO');
      assert.deepEqual(r.estado, N.estadoInicial());
    }
  }), { numRuns: 300 });
});
