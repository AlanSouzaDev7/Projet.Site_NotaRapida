'use strict';

// Testes unitários do Leitor_de_Nota e do Validador (Req. 1, 5 e média para aprovação).
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../site/js/notas.js');

const M = N.mensagens;

test('mensagens têm o texto exato dos requisitos', () => {
  assert.deepEqual({ ...M }, {
    PROFESSOR_VAZIO: 'Informe o nome do professor.',
    ALUNO_VAZIO: 'Informe o nome do aluno.',
    NOME_LONGO: 'O nome deve ter no máximo 100 caracteres.',
    NOTA_VAZIA: 'Informe a nota.',
    NOTA_INVALIDA: 'Digite um número válido (ex.: 7,5).',
    NOTA_FORA: 'A nota deve estar entre 0 e 10.',
    NOTA_CASAS: 'Use no máximo 2 casas decimais.',
    MEDIA_VAZIA: 'Informe a média para aprovação.',
    MEDIA_INVALIDA: 'Digite um número válido (ex.: 7,5).',
    MEDIA_FORA: 'A média deve estar entre 1 e 10.',
    MEDIA_CASAS: 'Use no máximo 2 casas decimais.',
    NOTAS_TODAS_VAZIAS: 'Informe ao menos uma nota.'
  });
  assert.ok(Object.isFrozen(N));
  assert.ok(Object.isFrozen(N.mensagens));
  assert.ok(Object.isFrozen(N.constantes));
});

test('lerNota: formatos aceitos', () => {
  for (const t of ['7,5', '07,25', '7', '7.5', '10.0', ' 7,5\t', '-0', '0']) {
    assert.equal(N.lerNota(t).tipo, 'numero', t);
  }
  assert.deepEqual(N.lerNota('007,50'), { tipo: 'numero', negativo: false, inteiro: '7', fracao: '50' });
  assert.deepEqual(N.lerNota('-0'), { tipo: 'numero', negativo: true, inteiro: '0', fracao: '' });
});

test('lerNota: vazio e formatos rejeitados', () => {
  for (const t of ['', '   ', '\t\n', null, undefined]) {
    assert.equal(N.lerNota(t).tipo, 'vazio', String(t));
  }
  for (const t of ['abc', '7a', '7,5,1', '7,5,0', '7,', ',5', '7 5', '+7', '1e1', '1.000,5', '--1', '٧', 'NaN', 'Infinity', '0x1']) {
    assert.equal(N.lerNota(t).tipo, 'erro', t);
  }
});

test('validarNota: aceitos, inclusive limites 0 e 10', () => {
  const casos = [['0', 0], ['10', 1000], ['10,00', 1000], ['10.0', 1000], ['-0', 0], ['-0,00', 0],
    ['7,5', 750], ['7.55', 755], ['7,55', 755], [' 8 ', 800], ['0,01', 1], ['9,99', 999], ['007', 700]];
  for (const [t, c] of casos) {
    assert.deepEqual(N.validarNota(t), { ok: true, centesimos: c }, t);
  }
});

test('validarNota: rejeitados com a mensagem da primeira regra violada', () => {
  const casos = [
    ['', M.NOTA_VAZIA], ['   ', M.NOTA_VAZIA],
    ['abc', M.NOTA_INVALIDA], ['7a', M.NOTA_INVALIDA], ['7,5,1', M.NOTA_INVALIDA],
    ['10,01', M.NOTA_FORA], ['-1', M.NOTA_FORA], ['11', M.NOTA_FORA], ['-0,5', M.NOTA_FORA], ['100', M.NOTA_FORA],
    ['7,555', M.NOTA_CASAS], ['7,500', M.NOTA_CASAS], ['10,000', M.NOTA_CASAS], ['0,000', M.NOTA_CASAS],
    // intervalo vem antes das casas decimais
    ['11,555', M.NOTA_FORA], ['-7,555', M.NOTA_FORA], ['10,001', M.NOTA_FORA]
  ];
  for (const [t, erro] of casos) {
    assert.deepEqual(N.validarNota(t), { ok: false, erro }, t);
  }
});

test('validarMediaAprovacao: intervalo de 1 a 10', () => {
  const aceitos = [['1', 100], ['1,00', 100], ['6', 600], ['6,5', 650], ['10', 1000], ['10,00', 1000]];
  for (const [t, c] of aceitos) {
    assert.deepEqual(N.validarMediaAprovacao(t), { ok: true, centesimos: c }, t);
  }
  const rejeitados = [
    ['', M.MEDIA_VAZIA], ['x', M.MEDIA_INVALIDA], ['0', M.MEDIA_FORA], ['0,99', M.MEDIA_FORA],
    ['-0', M.MEDIA_FORA], ['-6', M.MEDIA_FORA], ['10,01', M.MEDIA_FORA], ['11', M.MEDIA_FORA],
    ['6,555', M.MEDIA_CASAS], ['0,999', M.MEDIA_FORA]
  ];
  for (const [t, erro] of rejeitados) {
    assert.deepEqual(N.validarMediaAprovacao(t), { ok: false, erro }, t);
  }
});

test('nomes: 1 a 100 caracteres após o trim, contando acentos como 1', () => {
  assert.deepEqual(N.validarNomeAluno('A'), { ok: true, nome: 'A' });
  const cem = 'a'.repeat(100);
  assert.deepEqual(N.validarNomeAluno('   ' + cem + '\t\n'), { ok: true, nome: cem });
  assert.deepEqual(N.validarNomeAluno('a'.repeat(101)), { ok: false, erro: M.NOME_LONGO });
  // 100 letras acentuadas, compostas (NFC) e decompostas (NFD)
  assert.equal(N.validarNomeProfessor('é'.repeat(100)).ok, true);
  assert.equal(N.validarNomeProfessor('e\u0301'.repeat(100)).ok, true);
  assert.deepEqual(N.validarNomeProfessor('ç'.repeat(101)), { ok: false, erro: M.NOME_LONGO });
  // espaços internos preservados; textos literais
  for (const nome of ["José D'Ávila", 'Prof. 2', '<b>Ana</b>', 'Ana  Maria']) {
    assert.deepEqual(N.validarNomeProfessor(nome), { ok: true, nome });
  }
  assert.deepEqual(N.validarNomeProfessor(''), { ok: false, erro: M.PROFESSOR_VAZIO });
  assert.deepEqual(N.validarNomeProfessor(' \t\n '), { ok: false, erro: M.PROFESSOR_VAZIO });
  assert.deepEqual(N.validarNomeAluno('   '), { ok: false, erro: M.ALUNO_VAZIO });
});

test('validarFormulario: todos os campos avaliados, ordem media → aluno → T1 → T2 → T3', () => {
  const r = N.validarFormulario({ media: '0', nomeAluno: '', t1: 'abc', t2: '11', t3: '7,555' });
  assert.equal(r.ok, false);
  assert.equal(r.primeiroInvalido, 'media');
  assert.deepEqual(r.erros, {
    media: M.MEDIA_FORA, nomeAluno: M.ALUNO_VAZIO, t1: M.NOTA_INVALIDA, t2: M.NOTA_FORA, t3: M.NOTA_CASAS
  });
  assert.deepEqual(Object.keys(r.erros), ['media', 'nomeAluno', 't1', 't2', 't3']);

  const r2 = N.validarFormulario({ media: '6', nomeAluno: 'Ana', t1: '', t2: 'x', t3: '' });
  assert.equal(r2.primeiroInvalido, 't2');
  assert.deepEqual(r2.erros, { t2: M.NOTA_INVALIDA });

  const vazias = N.validarFormulario({ media: '6', nomeAluno: 'Ana', t1: '', t2: ' ', t3: '' });
  assert.deepEqual(vazias, { ok: false, erros: { t1: M.NOTAS_TODAS_VAZIAS }, primeiroInvalido: 't1' });

  const ok = N.validarFormulario({ media: '7', nomeAluno: '  Bia ', t1: '8', t2: '', t3: '9,5' });
  assert.deepEqual(ok, { ok: true, dados: { mediaAprovacao: 700, nomeAluno: 'Bia', notas: [800, null, 950] } });

  // sem `media`: média padrão 6,00
  const padrao = N.validarFormulario({ nomeAluno: 'C', t1: '1', t2: '2', t3: '3' });
  assert.equal(padrao.dados.mediaAprovacao, 600);
});

test('formatador e classificações de referência', () => {
  assert.equal(N.formatarCentesimos(750), '7,50');
  assert.equal(N.formatarCentesimos(1000), '10,00');
  assert.equal(N.formatarCentesimos(50), '0,50');
  assert.equal(N.formatarCentesimos(0), '0,00');
  assert.equal(N.formatarMedia(1799), '5,99');
  assert.equal(N.calcular([599, 600, 600]).classificacao, 'Reprovado');
  assert.equal(N.calcular([799, 800, 800]).classificacao, 'Aprovado – na média');
  assert.equal(N.calcular([899, 900, 900]).classificacao, 'Aprovado – acima da média');
  assert.equal(N.calcular([1000, 1000, 1000]).classificacao, 'Aprovado – excelente');
  assert.equal(N.montarMensagem('Ana', 'Aprovado – acima da média', '8,00'),
    'Parabéns Ana, você foi aprovado com a média final de 8,00. Você está acima da média.');
  assert.equal(N.montarMensagem('Ana', 'Aprovado – excelente', '9,00'),
    'Parabéns Ana, você foi aprovado com a média final de 9,00. Você é um gênio!');
});

test('truncarCampo corta em 1000 unidades e trata nulos', () => {
  assert.equal(N.constantes.LIMITE_CAMPO, 1000);
  assert.equal(N.truncarCampo('x'.repeat(5000)).length, 1000);
  assert.equal(N.truncarCampo('abc'), 'abc');
  assert.equal(N.truncarCampo(undefined), '');
  assert.equal(N.truncarCampo(null), '');
});
