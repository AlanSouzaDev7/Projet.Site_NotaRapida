'use strict';

// Correção de notas do histórico: o registro antigo nunca muda (entra um novo, com as mesmas
// regras do cálculo), o resto do histórico fica intacto e entradas inválidas não alteram nada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const N = require('../site/js/notas.js');

const RUNS = { numRuns: 200 };
const nota = fc.integer({ min: 0, max: 1000 });
const mediaM = fc.integer({ min: 100, max: 1000 });

function entrar() {
  return N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto: 'Professora Teste', tratamento: 'feminino' }).estado;
}

const texto = (c) => (c === null ? '' : N.formatarCentesimos(c));

function calcular(estado, nome, notas, media) {
  return N.reduzir(estado, {
    tipo: 'CALCULAR',
    campos: { media: texto(media === undefined ? 600 : media), nomeAluno: nome, t1: texto(notas[0]), t2: texto(notas[1]), t3: texto(notas[2]) }
  }).estado;
}

function editar(estado, id, t1, t2, t3, extras) {
  return N.reduzir(estado, { tipo: 'EDITAR_LANCAMENTO', id, campos: Object.assign({ t1, t2, t3 }, extras || {}) });
}

function tresRegistros() {
  let e = entrar();
  e = calcular(e, 'Ana', [700, 800, 900]);
  e = calcular(e, 'Beto', [300, null, null]);
  e = calcular(e, 'Carla', [500, 600, 400], 700);
  return e; // historico[0] = Carla, [1] = Beto, [2] = Ana
}

test('corrigir uma nota recalcula média e situação como um cálculo novo com as mesmas notas', () => {
  const e = tresRegistros();
  const ana = e.historico[2];
  const r = editar(e, ana.id, '2', '3', '4');
  assert.equal(r.evento.tipo, 'LANCAMENTO_EDITADO');
  const corrigido = r.evento.lancamento;
  const referencia = calcular(entrar(), 'Ana', [200, 300, 400]).historico[0];
  assert.deepEqual({ ...corrigido, id: 0 }, { ...referencia, id: 0 });
  assert.equal(corrigido.classificacao, 'Reprovado');
  assert.equal(N.formatarMedia(corrigido.soma), '3,00');
  // o registro antigo continua exatamente como era
  assert.equal(r.evento.anterior, ana);
  assert.equal(ana.classificacao, 'Aprovado – acima da média');
  assert.deepEqual(ana.notas, [700, 800, 900]);
});

test('o registro corrigido mantém id, nome, média de aprovação e lugar; o resto do histórico é o mesmo', () => {
  const e = tresRegistros();
  const carla = e.historico[0];
  const r = editar(e, carla.id, '9,5', '9,5', '9,5'); // com média 7,00: excelente a partir de 9,25
  const novo = r.estado.historico[0];
  assert.equal(novo.id, carla.id);
  assert.equal(novo.nomeAluno, 'Carla');
  assert.equal(novo.mediaAprovacao, 700, 'a média de aprovação do registro (7,00) continua valendo');
  assert.equal(novo.classificacao, 'Aprovado – excelente');
  assert.equal(r.estado.historico.length, 3);
  assert.equal(r.estado.historico[1], e.historico[1], 'mesma referência: o outro aluno não foi tocado');
  assert.equal(r.estado.historico[2], e.historico[2]);
  assert.equal(r.estado.proximoId, e.proximoId, 'corrigir não consome id');
  assert.notEqual(r.estado, e, 'estado novo; o anterior não foi modificado');
  assert.equal(e.historico[0], carla);
});

test('o registro novo e a lista nova são congelados; alterar qualquer um lança erro', () => {
  const e = tresRegistros();
  const r = editar(e, e.historico[1].id, '5', '6', '7');
  assert.ok(Object.isFrozen(r.estado.historico));
  assert.ok(Object.isFrozen(r.evento.lancamento) && Object.isFrozen(r.evento.lancamento.notas));
  assert.throws(() => { r.estado.historico[1].notas[0] = 999; }, TypeError);
  assert.throws(() => { r.estado.historico[1].classificacao = 'Aprovado'; }, TypeError);
  assert.throws(() => { r.estado.historico.push({}); }, TypeError);
  assert.throws(() => { r.estado.historico[0] = r.estado.historico[1]; }, TypeError);
  assert.throws(() => { e.historico[1].notas[0] = 999; }, TypeError, 'o antigo também segue imutável');
});

test('trimestre em branco vira resultado parcial, e completar um parcial vira cálculo completo', () => {
  const e = tresRegistros();
  const ana = e.historico[2];
  const parcial = editar(e, ana.id, '7', '', '');
  assert.equal(parcial.evento.lancamento.parcial, true);
  assert.deepEqual(parcial.evento.lancamento.notas, [700, null, null]);
  assert.deepEqual(parcial.evento.lancamento.faltantes, ['T2', 'T3']);

  const beto = e.historico[1];
  const completo = editar(e, beto.id, '3', '4', '5');
  assert.equal(completo.evento.lancamento.parcial, false);
  assert.equal(completo.evento.lancamento.classificacao, 'Reprovado');
  assert.equal(N.resumirHistorico(completo.estado.historico).emAndamento, 0);
});

test('todas as notas em branco: erro "Informe ao menos uma nota." em T1 e nada muda', () => {
  const e = tresRegistros();
  const r = editar(e, e.historico[0].id, '', '  ', '');
  assert.equal(r.evento.tipo, 'EDICAO_INVALIDA');
  assert.equal(r.evento.erros.t1, N.mensagens.NENHUMA_NOTA || 'Informe ao menos uma nota.');
  assert.equal(r.evento.primeiroInvalido, 't1');
  assert.equal(r.estado, e, 'estado idêntico (mesma referência)');
});

test('notas inválidas: uma mensagem por campo, na ordem T1, T2, T3, e o estado fica como estava', () => {
  const e = tresRegistros();
  const r = editar(e, e.historico[0].id, 'abc', '11', '7,555');
  assert.equal(r.evento.tipo, 'EDICAO_INVALIDA');
  assert.deepEqual(Object.keys(r.evento.erros).sort(), ['t1', 't2', 't3']);
  assert.equal(r.evento.erros.t1, N.mensagens.NOTA_INVALIDA);
  assert.equal(r.evento.erros.t2, N.mensagens.NOTA_FORA);
  assert.equal(r.evento.erros.t3, N.mensagens.NOTA_CASAS);
  assert.equal(r.evento.primeiroInvalido, 't1');
  assert.equal(r.estado, e);
});

test('mesmas notas escritas de outro jeito (7,5 e 7,50) não contam como alteração', () => {
  const e = calcular(entrar(), 'Duda', [750, 600, 800]);
  const r = editar(e, e.historico[0].id, '7,5', '6.00', ' 8 ');
  assert.equal(r.evento.tipo, 'EDICAO_SEM_ALTERACAO');
  assert.equal(r.estado, e);
});

test('id inexistente, ação sem campos ou fora da tela do professor são ignorados', () => {
  const e = tresRegistros();
  assert.equal(editar(e, 999, '1', '2', '3').evento.tipo, 'IGNORADO');
  assert.equal(editar(e, undefined, '1', '2', '3').evento.tipo, 'IGNORADO');
  assert.equal(editar(e, e.historico[0].id, '1', '2', '3').evento.tipo, 'LANCAMENTO_EDITADO');
  assert.equal(N.reduzir(e, { tipo: 'EDITAR_LANCAMENTO', id: e.historico[0].id }).evento.tipo, 'EDICAO_INVALIDA');
  const inicial = N.estadoInicial();
  assert.equal(N.reduzir(inicial, { tipo: 'EDITAR_LANCAMENTO', id: 0, campos: { t1: '1', t2: '2', t3: '3' } }).evento.tipo, 'IGNORADO');
  const aposTroca = N.reduzir(e, { tipo: 'TROCAR_PROFESSOR' }).estado;
  assert.equal(editar(aposTroca, e.historico[0].id, '1', '2', '3').evento.tipo, 'IGNORADO');
});

test('só T1, T2 e T3 mudam: nome e média de aprovação enviados na ação são ignorados', () => {
  const e = tresRegistros();
  const carla = e.historico[0];
  const r = editar(e, carla.id, '8', '8', '8', { nomeAluno: 'Outro Nome', media: '1', id: 77, classificacao: 'Aprovado – excelente' });
  const novo = r.estado.historico[0];
  assert.equal(novo.nomeAluno, 'Carla');
  assert.equal(novo.mediaAprovacao, 700);
  assert.equal(novo.id, carla.id);
  assert.equal(novo.classificacao, 'Aprovado – na média', '8,00 com média 7,00 ainda não chega a 8,50 (acima da média), e a média enviada (1) foi ignorada');
});

test('o painel de resultado acompanha a correção só quando mostrava o mesmo aluno', () => {
  const e = tresRegistros(); // o resultado exibido é o de Carla (último cálculo)
  assert.equal(e.resultado, e.historico[0]);
  const daCarla = editar(e, e.historico[0].id, '1', '1', '1');
  assert.equal(daCarla.estado.resultado, daCarla.estado.historico[0], 'resultado trocou junto com o registro');
  assert.equal(daCarla.estado.resultado.classificacao, 'Reprovado');
  const daAna = editar(e, e.historico[2].id, '1', '1', '1');
  assert.equal(daAna.estado.resultado, e.resultado, 'outro aluno: o resultado exibido continua o mesmo');
});

test('textos hostis nas notas são recusados sem mudar nada', () => {
  const e = tresRegistros();
  const hostis = ['<script>alert(1)</script>', '7' + String.fromCharCode(0x202E) + '5', '9'.repeat(1000), '-0,5', '1e1', "7'); DROP TABLE", '__proto__', '0x10'];
  for (const h of hostis) {
    const r = editar(e, e.historico[0].id, h, '5', '5');
    assert.equal(r.evento.tipo, 'EDICAO_INVALIDA', h.slice(0, 20));
    assert.equal(r.estado, e);
  }
  assert.equal(editar(e, e.historico[0].id, '5', '5', '5').evento.tipo, 'LANCAMENTO_EDITADO');
});

// ---------- Propriedades ----------

test('propriedade: corrigir equivale a calcular de novo as mesmas notas, para qualquer nota e média', () => {
  const notaOuVazio = fc.option(nota, { nil: null });
  fc.assert(fc.property(fc.tuple(nota, nota, nota), mediaM, fc.tuple(notaOuVazio, notaOuVazio, notaOuVazio), (inicial, m, novas) => {
    fc.pre(novas.some((n) => n !== null));
    const e = calcular(entrar(), 'Zé', inicial, m);
    const r = editar(e, e.historico[0].id, texto(novas[0]), texto(novas[1]), texto(novas[2]));
    const referencia = calcular(entrar(), 'Zé', novas, m).historico[0];
    if (inicial.every((v, i) => v === novas[i])) {
      assert.equal(r.evento.tipo, 'EDICAO_SEM_ALTERACAO');
      return;
    }
    assert.equal(r.evento.tipo, 'LANCAMENTO_EDITADO');
    assert.deepEqual({ ...r.evento.lancamento, id: 0 }, { ...referencia, id: 0 });
  }), RUNS);
});

test('propriedade: em qualquer sequência de cálculos, correções e limpezas o histórico se mantém coerente', () => {
  const acao = fc.oneof(
    fc.tuple(fc.constant('calcular'), nota, nota, nota),
    fc.tuple(fc.constant('editar'), fc.integer({ min: 0, max: 60 }), nota, nota),
    fc.tuple(fc.constant('limpar'), fc.constant(0), fc.constant(0), fc.constant(0))
  );
  fc.assert(fc.property(fc.array(acao, { maxLength: 90 }), (acoes) => {
    let e = entrar();
    let contador = 0;
    for (const [tipo, a, b, c] of acoes) {
      if (tipo === 'calcular') {
        e = calcular(e, 'Aluno ' + contador, [a, b, c]);
        contador += 1;
      } else if (tipo === 'editar') {
        const antes = e;
        const alvo = antes.historico.find((l) => l.id === a);
        const r = editar(e, a, texto(b), texto(c), texto(b));
        e = r.estado;
        if (!alvo) {
          assert.equal(r.evento.tipo, 'IGNORADO');
          assert.equal(e, antes);
        } else {
          // o nome e a ordem não mudam; os demais registros são os mesmos objetos
          assert.deepEqual(e.historico.map((l) => l.id), antes.historico.map((l) => l.id));
          e.historico.forEach((l, i) => {
            if (l.id !== a) {
              assert.equal(l, antes.historico[i]);
            } else {
              assert.equal(l.nomeAluno, alvo.nomeAluno);
            }
          });
        }
      } else {
        e = N.reduzir(e, { tipo: 'LIMPAR_HISTORICO' }).estado;
      }
      assert.ok(e.historico.length <= N.constantes.TAMANHO_HISTORICO);
      assert.ok(Object.isFrozen(e.historico));
      const ids = e.historico.map((l) => l.id);
      assert.equal(new Set(ids).size, ids.length, 'ids únicos');
      assert.deepEqual(ids, [...ids].sort((x, y) => y - x), 'do mais recente para o mais antigo');
      assert.ok(e.historico.every((l) => Object.isFrozen(l)));
      const r = N.resumirHistorico(e.historico);
      assert.equal(r.aprovados + r.reprovados + r.emAndamento, r.total);
    }
  }), RUNS);
});
