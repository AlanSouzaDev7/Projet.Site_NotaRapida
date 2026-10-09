'use strict';

// Propriedades (fast-check) da lógica pura em site/js/notas.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const N = require('../site/js/notas.js');

const RUNS = { numRuns: 300 };
const nota = fc.integer({ min: 0, max: 1000 });           // centésimos
const tresNotas = fc.tuple(nota, nota, nota);
const mediaM = fc.integer({ min: 100, max: 1000 });       // média para aprovação
const soma = fc.integer({ min: 0, max: 3000 });

const idxClass = (c) => N.CLASSIFICACOES.indexOf(c);
const permutacoes = ([a, b, c]) => [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

test('média entre a menor e a maior nota (Req. 6.8)', () => {
  fc.assert(fc.property(tresNotas, mediaM, (n, m) => {
    const r = N.calcular(n, m);
    const min = Math.min(...n);
    const max = Math.max(...n);
    return 3 * min <= r.soma && r.soma <= 3 * max && min <= r.mediaTruncada && r.mediaTruncada <= max;
  }), RUNS);
});

test('confluência nas 6 ordens das notas (Req. 6.9)', () => {
  fc.assert(fc.property(tresNotas, mediaM, (n, m) => {
    const base = N.calcular(n, m);
    for (const p of permutacoes(n)) {
      const r = N.calcular(p, m);
      assert.equal(r.soma, base.soma);
      assert.equal(r.mediaTruncada, base.mediaTruncada);
      assert.equal(r.classificacao, base.classificacao);
      assert.equal(r.posicao, base.posicao);
    }
  }), RUNS);
});

test('média × 3 = soma, em inteiros (Req. 6.11)', () => {
  fc.assert(fc.property(tresNotas, ([a, b, c]) => {
    const r = N.calcular([a, b, c]);
    return r.media.denominador === 3 && r.media.numerador === a + b + c && r.soma === a + b + c;
  }), RUNS);
});

test('exatamente uma classificação e uma posição para qualquer M de 1 a 10 (Req. 6.10)', () => {
  fc.assert(fc.property(soma, mediaM, (s, m) => {
    const l = N.limitesDaMedia(m);
    assert.ok(l.aprovacao <= l.acima && l.acima <= l.excelente && l.excelente <= 1000);
    const faixasC = [s < 3 * l.aprovacao,
      s >= 3 * l.aprovacao && s < 3 * l.acima,
      s >= 3 * l.acima && s < 3 * l.excelente,
      s >= 3 * l.excelente];
    const faixasP = [s < 3 * l.aprovacao, s >= 3 * l.aprovacao && s < 3 * l.acima, s >= 3 * l.acima];
    assert.equal(faixasC.filter(Boolean).length, 1);
    assert.equal(faixasP.filter(Boolean).length, 1);
    assert.equal(N.classificarSoma(s, m), N.CLASSIFICACOES[faixasC.indexOf(true)]);
    assert.equal(N.posicionarSoma(s, m), N.POSICOES[faixasP.indexOf(true)]);
  }), RUNS);
});

test('monotonicidade: notas maiores nunca pioram média nem classificação (Req. 6.12)', () => {
  fc.assert(fc.property(tresNotas, tresNotas, mediaM, (x, y, m) => {
    const menor = x.map((v, i) => Math.min(v, y[i]));
    const maior = x.map((v, i) => Math.max(v, y[i]));
    const a = N.calcular(menor, m);
    const b = N.calcular(maior, m);
    return b.soma >= a.soma && idxClass(b.classificacao) >= idxClass(a.classificacao);
  }), RUNS);
});

test('M maior nunca melhora a classificação', () => {
  fc.assert(fc.property(soma, mediaM, mediaM, (s, m1, m2) => {
    const baixo = Math.min(m1, m2);
    const alto = Math.max(m1, m2);
    return idxClass(N.classificarSoma(s, alto)) <= idxClass(N.classificarSoma(s, baixo));
  }), RUNS);
});

test('M = 600 equivale aos limites 1800/2400/2700 (e é o padrão)', () => {
  const L = N.constantes.LIMITES_SOMA;
  const antiga = (s) => (s < L.NA_MEDIA ? 0 : s < L.ACIMA ? 1 : s < L.EXCELENTE ? 2 : 3);
  assert.deepEqual({ ...L }, { NA_MEDIA: 1800, ACIMA: 2400, EXCELENTE: 2700 });
  fc.assert(fc.property(soma, (s) => {
    const c = N.CLASSIFICACOES[antiga(s)];
    return N.classificarSoma(s, 600) === c && N.classificarSoma(s) === c;
  }), RUNS);
});

test('média truncada exibida cai na mesma faixa da média exata (Req. 6.13)', () => {
  fc.assert(fc.property(tresNotas, mediaM, (n, m) => {
    const r = N.calcular(n, m);
    const exibida = N.validarNota(N.formatarMedia(r.soma));
    assert.equal(exibida.ok, true);
    assert.equal(exibida.centesimos, r.mediaTruncada);
    assert.equal(N.classificarSoma(3 * exibida.centesimos, m), r.classificacao);
    assert.equal(N.posicionarSoma(3 * exibida.centesimos, m), r.posicao);
  }), RUNS);
});

test('ida e volta: formatar → ler devolve os mesmos centésimos (vírgula e ponto)', () => {
  fc.assert(fc.property(nota, (c) => {
    const texto = N.formatarCentesimos(c);
    const v1 = N.validarNota(texto);
    const v2 = N.validarNota(texto.replace(',', '.'));
    return v1.ok && v1.centesimos === c && v2.ok && v2.centesimos === c;
  }), RUNS);
  fc.assert(fc.property(mediaM, (m) => {
    const v = N.validarMediaAprovacao(N.formatarCentesimos(m));
    return v.ok && v.centesimos === m;
  }), RUNS);
});

// ---------- Sessão (reduzir) ----------

function entrar(nome, tratamento) {
  return N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto: nome, tratamento }).estado;
}

function campos(aluno, [a, b, c], m) {
  return {
    media: N.formatarCentesimos(m), nomeAluno: aluno,
    t1: N.formatarCentesimos(a), t2: N.formatarCentesimos(b), t3: N.formatarCentesimos(c)
  };
}

test('histórico = min(N, 35) lançamentos mais recentes, do mais novo ao mais antigo', () => {
  assert.equal(N.constantes.TAMANHO_HISTORICO, 35);
  fc.assert(fc.property(fc.array(fc.tuple(tresNotas, mediaM), { maxLength: 80 }), (lista) => {
    let e = entrar('Ana');
    lista.forEach(([n, m], i) => {
      e = N.reduzir(e, { tipo: 'CALCULAR', campos: campos('Aluno ' + i, n, m) }).estado;
    });
    const esperado = lista.map((_, i) => i).reverse().slice(0, 35);
    assert.deepEqual(e.historico.map((l) => l.id), esperado);
    assert.deepEqual(e.historico.map((l) => l.nomeAluno), esperado.map((i) => 'Aluno ' + i));
    assert.equal(e.historico.length, Math.min(lista.length, 35));
  }), RUNS);
});

test('isolamento: após TROCAR_PROFESSOR nada da sessão anterior permanece', () => {
  const acao = fc.oneof(
    fc.record({ tipo: fc.constant('CALCULAR'), n: tresNotas, m: mediaM }),
    fc.constant({ tipo: 'LIMPAR_HISTORICO' }),
    fc.constant({ tipo: 'TROCAR' })
  );
  fc.assert(fc.property(fc.array(acao, { maxLength: 30 }), fc.constantFrom('Ana', 'Bruno'), (acoes, nome) => {
    let sessao = 0;
    let e = entrar(nome, 'feminino');
    for (const a of acoes) {
      if (a.tipo === 'TROCAR') {
        e = N.reduzir(e, { tipo: 'TROCAR_PROFESSOR' }).estado;
        assert.deepEqual(e, N.estadoInicial());
        sessao += 1;
        e = N.reduzir(e, { tipo: 'ENTRAR', texto: nome }).estado; // mesmo nome
        assert.equal(e.resultado, null);
        assert.deepEqual(e.historico, []);
        assert.equal(e.tratamento, 'neutro');
      } else if (a.tipo === 'CALCULAR') {
        e = N.reduzir(e, { tipo: 'CALCULAR', campos: campos('S' + sessao, a.n, a.m) }).estado;
      } else {
        e = N.reduzir(e, a).estado;
      }
      assert.equal(e.nomeProfessor, nome);
      for (const l of e.historico) {
        assert.equal(l.nomeAluno, 'S' + sessao);
      }
      if (e.resultado) {
        assert.equal(e.resultado.nomeAluno, 'S' + sessao);
      }
    }
  }), RUNS);
});

// ---------- Resultado parcial ----------

// Notas com 1 ou 2 faltantes (null) em posições quaisquer.
const notasParciais = fc.tuple(tresNotas, fc.constantFrom([0], [1], [2], [0, 1], [0, 2], [1, 2]))
  .map(([n, faltam]) => n.map((v, i) => (faltam.includes(i) ? null : v)));

const alvoDe = (p, tipo) => (tipo === 'aprovacao' ? p.limites.aprovacao : p.limites.acima);
const rank = (meta) => ({ garantida: 0, possivel: 1, impossivel: 2 })[meta.status];

test('parcial: n é a menor nota que alcança o alvo; garantida e impossível nos casos certos', () => {
  fc.assert(fc.property(notasParciais, mediaM, (notas, m) => {
    const p = N.calcularParcial(notas, m);
    const k = notas.filter((v) => v === null).length;
    const sk = notas.reduce((acc, v) => acc + (v === null ? 0 : v), 0);
    assert.equal(p.quantidadeFaltante, k);
    assert.equal(p.somaConhecida, sk);
    for (const tipo of ['aprovacao', 'acima']) {
      const x = alvoDe(p, tipo);
      const meta = p[tipo];
      const r = 3 * x - sk;
      // garantida exatamente quando R ≤ 0
      assert.equal(meta.status === 'garantida', r <= 0);
      // impossível exatamente quando o n mínimo passaria de 10,00
      assert.equal(meta.status === 'impossivel', r > 0 && Math.ceil(r / k) > 1000);
      if (meta.status === 'possivel') {
        const n = meta.centesimos;
        assert.ok(n >= 1 && n <= 1000);
        assert.ok(n * k + sk >= 3 * x, 'n alcança o alvo');
        assert.ok((n - 1) * k + sk < 3 * x, 'n − 1 não alcança');
      }
    }
  }), RUNS);
});

test('parcial: meta "acima" nunca é mais fácil que a meta de aprovação', () => {
  fc.assert(fc.property(notasParciais, mediaM, (notas, m) => {
    const p = N.calcularParcial(notas, m);
    assert.ok(rank(p.aprovacao) <= rank(p.acima));
    if (p.aprovacao.status === 'possivel' && p.acima.status === 'possivel') {
      assert.ok(p.acima.centesimos >= p.aprovacao.centesimos);
    }
  }), RUNS);
});

test('parcial: preencher os faltantes com n atinge o alvo no cálculo completo', () => {
  fc.assert(fc.property(notasParciais, mediaM, (notas, m) => {
    const p = N.calcularParcial(notas, m);
    if (p.aprovacao.status === 'possivel') {
      const cheias = notas.map((v) => (v === null ? p.aprovacao.centesimos : v));
      assert.notEqual(N.calcular(cheias, m).classificacao, 'Reprovado');
    }
    if (p.acima.status === 'possivel') {
      const cheias = notas.map((v) => (v === null ? p.acima.centesimos : v));
      assert.equal(N.calcular(cheias, m).posicao, 'Acima da média');
    }
  }), RUNS);
});

// ---------- Saudação e tratamento ----------

test('normalizarTratamento e montarSaudacao', () => {
  const qualquer = fc.oneof(fc.constantFrom('feminino', 'masculino', 'neutro', 'Feminino', ''), fc.string(), fc.anything());
  fc.assert(fc.property(qualquer, fc.string({ minLength: 1, maxLength: 100 }), (t, nome) => {
    const norm = N.normalizarTratamento(t);
    assert.ok(N.TRATAMENTOS.includes(norm));
    assert.equal(norm, N.TRATAMENTOS.includes(t) ? t : 'neutro');
    const esperado = (norm === 'feminino' ? 'Olá, Prof.ª ' : 'Olá, Prof. ') + nome;
    assert.equal(N.montarSaudacao(nome, t), esperado);
  }), RUNS);
});
