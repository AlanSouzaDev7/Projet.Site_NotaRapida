'use strict';

// Histórico dos 35 últimos alunos consultados: somente leitura, resumo e faixas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const N = require('../site/js/notas.js');

const RUNS = { numRuns: 200 };
const nota = fc.integer({ min: 0, max: 1000 });
const mediaM = fc.integer({ min: 100, max: 1000 });
const texto = (c) => N.formatarCentesimos(c);

function entrar() {
  return N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto: 'Ana', tratamento: 'feminino' }).estado;
}

function calcular(estado, aluno, [a, b, c], m) {
  const campos = { media: texto(m), nomeAluno: aluno, t1: a === null ? '' : texto(a), t2: b === null ? '' : texto(b), t3: c === null ? '' : texto(c) };
  return N.reduzir(estado, { tipo: 'CALCULAR', campos }).estado;
}

function profundamenteCongelado(valor) {
  if (valor === null || typeof valor !== 'object') {
    return true;
  }
  return Object.isFrozen(valor) && Object.keys(valor).every((k) => profundamenteCongelado(valor[k]));
}

// ---------- Somente leitura ----------

test('o histórico guarda os 35 últimos alunos consultados', () => {
  assert.equal(N.constantes.TAMANHO_HISTORICO, 35);
  let e = entrar();
  for (let i = 0; i < 40; i += 1) {
    e = calcular(e, 'Aluno ' + i, [700, 800, 900], 600);
  }
  assert.equal(e.historico.length, 35);
  assert.equal(e.historico[0].nomeAluno, 'Aluno 39');
  assert.equal(e.historico[34].nomeAluno, 'Aluno 5');
});

test('lançamentos completos e parciais ficam congelados por inteiro', () => {
  fc.assert(fc.property(fc.tuple(nota, nota, nota), mediaM, fc.constantFrom([], [0], [1], [2], [0, 1], [1, 2], [0, 2]),
    (n, m, faltam) => {
      const notas = n.map((v, i) => (faltam.includes(i) ? null : v));
      const e = calcular(entrar(), 'Bia', notas, m);
      const l = e.historico[0];
      assert.equal(l.parcial, faltam.length > 0);
      assert.ok(profundamenteCongelado(l), 'lançamento congelado');
      assert.ok(profundamenteCongelado(e.resultado), 'resultado congelado');
      assert.ok(Object.isFrozen(e.historico), 'lista congelada');
    }), RUNS);
});

test('alterar nota, nome, classificação ou a lista do histórico lança erro e nada muda', () => {
  const e = calcular(entrar(), 'Caio', [700, 800, 900], 600);
  const l = e.historico[0];
  const antes = JSON.stringify(e.historico);

  assert.throws(() => { l.nomeAluno = 'Outro'; }, TypeError);
  assert.throws(() => { l.notas[0] = 1000; }, TypeError);
  assert.throws(() => { l.notas.push(5); }, TypeError);
  assert.throws(() => { l.classificacao = 'Reprovado'; }, TypeError);
  assert.throws(() => { l.soma = 0; }, TypeError);
  assert.throws(() => { delete l.nomeAluno; }, TypeError);
  assert.throws(() => { e.historico.push(l); }, TypeError);
  assert.throws(() => { e.historico[0] = l; }, TypeError);
  assert.throws(() => { e.historico.length = 0; }, TypeError);

  assert.equal(JSON.stringify(e.historico), antes);
});

test('lançamento parcial: metas e faltantes também são somente leitura', () => {
  const e = calcular(entrar(), 'Dani', [700, null, null], 600);
  const l = e.historico[0];
  assert.equal(l.parcial, true);
  assert.throws(() => { l.faltantes.push('T1'); }, TypeError);
  assert.throws(() => { l.aprovacao.status = 'garantida'; }, TypeError);
  assert.throws(() => { l.limites.acima = 0; }, TypeError);
});

test('um novo cálculo não altera os lançamentos anteriores', () => {
  fc.assert(fc.property(fc.array(fc.tuple(nota, nota, nota), { minLength: 1, maxLength: 60 }), (lista) => {
    let e = entrar();
    const registros = [];
    lista.forEach((n, i) => {
      e = calcular(e, 'A' + i, n, 600);
      registros.push(e.historico[0]);
    });
    const vistos = e.historico.map((l) => l.id);
    registros.slice(-N.constantes.TAMANHO_HISTORICO).reverse().forEach((l, i) => {
      assert.equal(e.historico[i], l, 'mesma referência, sem cópia alterada');
      assert.equal(l.id, vistos[i]);
    });
  }), RUNS);
});

test('limpar o histórico devolve lista vazia e congelada; trocar de professor zera tudo', () => {
  let e = calcular(entrar(), 'Eva', [700, 800, 900], 600);
  e = N.reduzir(e, { tipo: 'LIMPAR_HISTORICO' }).estado;
  assert.deepEqual(e.historico, []);
  assert.ok(Object.isFrozen(e.historico));
  assert.throws(() => { e.historico.push(1); }, TypeError);
  e = N.reduzir(calcular(e, 'Fábio', [500, 500, 500], 600), { tipo: 'TROCAR_PROFESSOR' }).estado;
  assert.deepEqual(e, N.estadoInicial());
});

// ---------- Faixas ----------

test('faixas da média cobrem de 0,00 a 10,00 sem lacunas nem sobreposição', () => {
  fc.assert(fc.property(mediaM, (m) => {
    const faixas = N.faixasDaMedia(m);
    assert.ok(faixas.length >= 2);
    assert.equal(faixas[0].de, 0);
    assert.equal(faixas[faixas.length - 1].ate, 1000);
    for (let i = 1; i < faixas.length; i += 1) {
      assert.equal(faixas[i].de, faixas[i - 1].ate + 1);
    }
    for (const f of faixas) {
      assert.ok(f.de <= f.ate);
      assert.ok(Object.isFrozen(f));
    }
  }), RUNS);
});

test('faixas da média M = 6,00 e M = 10,00', () => {
  const rotulos = (m) => N.faixasDaMedia(m).map((f) => f.rotulo + ' ' + texto(f.de) + '–' + texto(f.ate));
  assert.deepEqual(rotulos(600), [
    'Reprovado 0,00–5,99', 'Na média 6,00–7,99', 'Acima da média 8,00–8,99', 'Excelente 9,00–10,00'
  ]);
  assert.deepEqual(rotulos(1000), ['Reprovado 0,00–9,99', 'Excelente 10,00–10,00']);
});

test('a média truncada exibida cai na faixa da classificação', () => {
  const porChave = { 'Reprovado': 'reprovado', 'Aprovado – na média': 'na-media', 'Aprovado – acima da média': 'acima', 'Aprovado – excelente': 'excelente' };
  fc.assert(fc.property(fc.tuple(nota, nota, nota), mediaM, (n, m) => {
    const r = N.calcular(n, m);
    const faixa = N.faixasDaMedia(m).find((f) => f.de <= r.mediaTruncada && r.mediaTruncada <= f.ate);
    assert.equal(faixa.chave, porChave[r.classificacao]);
  }), RUNS);
});

// ---------- Resumo ----------

test('resumo: contagens e média do grupo (só lançamentos completos)', () => {
  let e = entrar();
  e = calcular(e, 'A', [1000, 1000, 1000], 600); // 10,00 excelente
  e = calcular(e, 'B', [300, 300, 300], 600);    // 3,00 reprovado
  e = calcular(e, 'C', [700, 700, 700], 600);    // 7,00 na média
  e = calcular(e, 'D', [800, null, null], 600);  // parcial
  const r = N.resumirHistorico(e.historico);
  assert.deepEqual({ ...r }, { total: 4, aprovados: 2, reprovados: 1, emAndamento: 1, mediaGrupo: 666 });
  assert.ok(Object.isFrozen(r));
});

test('resumo: lista vazia e só parciais não têm média do grupo', () => {
  assert.equal(N.resumirHistorico([]).mediaGrupo, null);
  assert.equal(N.resumirHistorico([]).total, 0);
  const e = calcular(entrar(), 'A', [800, null, null], 600);
  const r = N.resumirHistorico(e.historico);
  assert.equal(r.mediaGrupo, null);
  assert.equal(r.emAndamento, 1);
});

test('resumo: aprovados + reprovados + em andamento = total', () => {
  fc.assert(fc.property(fc.array(fc.tuple(fc.tuple(nota, nota, nota), mediaM, fc.constantFrom([], [0], [1, 2])), { maxLength: 30 }),
    (lista) => {
      let e = entrar();
      lista.forEach(([n, m, faltam], i) => {
        e = calcular(e, 'A' + i, n.map((v, k) => (faltam.includes(k) ? null : v)), m);
      });
      const r = N.resumirHistorico(e.historico);
      assert.equal(r.total, e.historico.length);
      assert.equal(r.aprovados + r.reprovados + r.emAndamento, r.total);
    }), RUNS);
});

// ---------- Carimbo ----------

test('carimbo conforme a classificação e o resultado parcial', () => {
  const tom = (notas, m) => N.carimboDoLancamento(calcular(entrar(), 'X', notas, m).historico[0]);
  assert.deepEqual({ ...tom([1000, 1000, 1000], 600) }, { tom: 'excelente', texto: 'Excelente' });
  assert.deepEqual({ ...tom([800, 800, 800], 600) }, { tom: 'acima', texto: 'Acima da média' });
  assert.deepEqual({ ...tom([600, 600, 600], 600) }, { tom: 'aprovado', texto: 'Aprovado' });
  assert.deepEqual({ ...tom([100, 100, 100], 600) }, { tom: 'reprovado', texto: 'Reprovado' });
  assert.deepEqual({ ...tom([900, null, null], 600) }, { tom: 'andamento', texto: 'Em andamento' });
});

// ---------- Recados e datas ----------

test('frase do dia: sempre uma frase da lista e a mesma durante o dia', () => {
  assert.ok(N.FRASES.length >= 5);
  for (const f of N.FRASES) {
    assert.ok(f.texto.length > 0 && typeof f.autor === 'string');
    assert.ok(Object.isFrozen(f));
  }
  fc.assert(fc.property(fc.date({ min: new Date(2020, 0, 1), max: new Date(2040, 11, 31), noInvalidDate: true }), (d) => {
    const manha = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6);
    const noite = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23);
    assert.ok(N.FRASES.includes(N.fraseDoDia(d)));
    assert.equal(N.fraseDoDia(manha), N.fraseDoDia(noite));
  }), RUNS);
});

test('frase do dia muda de um dia para o outro', () => {
  const a = N.fraseDoDia(new Date(2026, 9, 4));
  const b = N.fraseDoDia(new Date(2026, 9, 5));
  assert.notEqual(a, b);
});

test('Dia do Professor é 15 de outubro', () => {
  assert.equal(N.ehDiaDoProfessor(new Date(2026, 9, 15)), true);
  assert.equal(N.ehDiaDoProfessor(new Date(2026, 9, 14)), false);
  assert.equal(N.ehDiaDoProfessor(new Date(2026, 8, 15)), false);
  assert.equal(N.ehDiaDoProfessor(new Date(2027, 9, 15, 23, 59)), true);
});

test('data por extenso coincide com o Intl pt-BR em todos os dias de 2025 a 2029 (única diferença: "1º" no dia 1)', () => {
  const intl = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  for (let d = new Date(2025, 0, 1); d.getFullYear() < 2030; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const esperado = intl.format(d).replace(', 1 de ', ', 1º de ');
    assert.equal(N.formatarDataExtenso(d), esperado.charAt(0).toUpperCase() + esperado.slice(1), String(d));
  }
  assert.equal(N.formatarDataExtenso(new Date(2026, 9, 4)), 'Domingo, 4 de outubro');
  assert.equal(N.formatarDataExtenso(new Date(2026, 9, 1)), 'Quinta-feira, 1º de outubro');
});

test('período do dia', () => {
  const h = (hora) => N.periodoDoDia(new Date(2026, 9, 4, hora));
  assert.equal(h(4), 'Boa noite');
  assert.equal(h(5), 'Bom dia');
  assert.equal(h(11), 'Bom dia');
  assert.equal(h(12), 'Boa tarde');
  assert.equal(h(17), 'Boa tarde');
  assert.equal(h(18), 'Boa noite');
  assert.equal(h(0), 'Boa noite');
});
