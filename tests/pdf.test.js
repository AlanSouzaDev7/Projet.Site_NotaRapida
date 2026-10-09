'use strict';

// Resumo em PDF dos alunos consultados: arquivo válido, conteúdo correto e nenhum dado digitado
// capaz de virar comando do PDF.
const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const N = require('../site/js/notas.js');
const P = require('../site/js/pdf.js');

const RUNS = { numRuns: 150 };
const DATA = new Date(2026, 9, 9, 15, 30, 7);

function entrar(tema) {
  return N.reduzir(N.estadoInicial(), { tipo: 'ENTRAR', texto: 'Professor Teste', tratamento: tema || 'neutro' }).estado;
}

function calcular(estado, nome, t1, t2, t3, media) {
  return N.reduzir(estado, { tipo: 'CALCULAR', campos: { media: media || '6', nomeAluno: nome, t1, t2, t3 } }).estado;
}

function sessao(alunos, tema) {
  let e = entrar(tema);
  for (const a of alunos) {
    e = calcular(e, a[0], a[1], a[2], a[3], a[4]);
  }
  return e;
}

const gerar = (estado, tema) => P.gerarResumo({ lancamentos: estado.historico, geradoEm: DATA, tema: tema || 'neutro' });
const bruto = (bytes) => Buffer.from(bytes).toString('latin1');

// WinAnsi -> Unicode, só o que o resumo usa fora do ASCII e do Latin-1.
const WINANSI = { 0x85: 0x2026, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014 };
const EN = String.fromCharCode(0x2013);
const EM = String.fromCharCode(0x2014);

function decodificar(hex) {
  let s = '';
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    s += String.fromCharCode(WINANSI[b] || b);
  }
  return s;
}

// Confere a estrutura do arquivo (cabeçalho, tabela xref, tamanhos dos fluxos, páginas)
// e devolve o texto de todas as páginas.
function analisar(bytes) {
  for (const b of bytes) {
    assert.ok(b < 128, 'o arquivo é só ASCII');
  }
  const t = bruto(bytes);
  assert.ok(t.startsWith('%PDF-1.4\n'));
  assert.ok(t.endsWith('%%EOF\n'));
  const inicio = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(t)[1]);
  const m = /^xref\n0 (\d+)\n/.exec(t.slice(inicio));
  assert.ok(m, 'startxref aponta para a tabela xref');
  const total = Number(m[1]);
  const linhas = t.slice(inicio + m[0].length).split('\n').slice(0, total);
  assert.equal(linhas[0], '0000000000 65535 f ');
  for (let i = 1; i < total; i += 1) {
    assert.match(linhas[i], /^\d{10} 00000 n $/);
    assert.ok(t.startsWith(i + ' 0 obj\n', Number(linhas[i].slice(0, 10))), 'objeto ' + i + ' está na posição da tabela');
    assert.ok(t.indexOf('endobj', Number(linhas[i].slice(0, 10))) > 0);
  }
  assert.match(t, new RegExp('trailer\\n<< /Size ' + total + ' /Root 1 0 R /Info 5 0 R >>'));
  const fluxos = [...t.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
  assert.ok(fluxos.length >= 1);
  for (const f of fluxos) {
    assert.equal(f[2].length, Number(f[1]), 'o /Length do fluxo confere');
  }
  const paginas = (t.match(/\/Type \/Page /g) || []).length;
  assert.equal(paginas, Number(/\/Count (\d+)/.exec(t)[1]));
  assert.equal(fluxos.length, paginas);
  const textos = fluxos.map((f) => [...f[2].matchAll(/<([0-9A-F]*)> Tj/g)].map((x) => decodificar(x[1])));
  return { bruto: t, paginas, textos, texto: textos.map((p) => p.join('\n')).join('\n') };
}

test('o arquivo é um PDF válido: cabeçalho, tabela xref, tamanhos, páginas e só ASCII', () => {
  const e = sessao([['Maria Souza', '7,5', '6', '8'], ['Joao', '8', '9', '10']]);
  const a = analisar(gerar(e));
  assert.equal(a.paginas, 1);
  assert.match(a.bruto, /\/Lang \(pt-BR\)/);
  assert.match(a.bruto, /\/Title <FEFF/);
});

test('o conteúdo traz o resumo, os alunos, as notas, a situação e o aviso de site não oficial', () => {
  const e = sessao([
    ['Maria Souza', '7,5', '6', '8'],
    ['João Pedro', '8', '9', '10'],
    ['Ana Lima', '3', '4', '2'],
    ['Beto Alves', '7', '', '']
  ]);
  const r = N.resumirHistorico(e.historico);
  const { texto } = analisar(gerar(e));
  for (const esperado of ['NotaRápida', 'Resumo dos alunos consultados', 'Gerado em 09/10/2026, às 15:30',
    'Consultados', 'de 35', 'Aprovados', 'Reprovados', 'Em andamento', 'Média do grupo', N.formatarCentesimos(r.mediaGrupo),
    'Maria Souza', 'João Pedro', 'Ana Lima', 'Beto Alves', '7,50', '10,00', 'Aprovado ' + EN + ' na média',
    'Aprovado ' + EN + ' excelente', 'Reprovado', 'parcial', 'Aprovação: ', 'Página 1 de 1', 'não oficial',
    'substitui diário de classe, boletim ou sistema oficial de notas']) {
    assert.ok(texto.includes(esperado), 'falta no PDF: ' + esperado);
  }
  assert.ok(texto.includes(EM), 'nota em branco aparece como traço');
  // do mais recente para o mais antigo, como na tela
  const posicoes = ['Beto Alves', 'Ana Lima', 'João Pedro', 'Maria Souza'].map((n) => texto.indexOf(n, texto.indexOf('Situação')));
  assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b));
});

test('sem alunos consultados não há o que resumir: devolve null', () => {
  assert.equal(P.gerarResumo({ lancamentos: [], geradoEm: DATA }), null);
  assert.equal(P.gerarResumo({ geradoEm: DATA }), null);
  assert.equal(P.gerarResumo(null), null);
  assert.equal(gerar(entrar()), null);
});

test('os 35 alunos do histórico ocupam mais de uma página e todas têm rodapé numerado', () => {
  const alunos = [];
  for (let i = 1; i <= 40; i += 1) {
    alunos.push(['Aluno ' + String(i).padStart(2, '0'), String(i % 11), String((i * 3) % 11), String((i * 7) % 11)]);
  }
  const e = sessao(alunos);
  assert.equal(e.historico.length, 35);
  const a = analisar(gerar(e));
  assert.ok(a.paginas >= 2, 'páginas: ' + a.paginas);
  for (let p = 1; p <= a.paginas; p += 1) {
    assert.ok(a.textos[p - 1].includes('Página ' + p + ' de ' + a.paginas), 'rodapé da página ' + p);
  }
  // só os 35 mais recentes (40 até 06), do mais recente para o mais antigo
  assert.ok(a.texto.includes('Aluno 40') && a.texto.includes('Aluno 06'));
  assert.ok(!a.texto.includes('Aluno 05'));
  const ordem = [];
  for (let i = 40; i >= 6; i -= 1) {
    ordem.push(a.texto.indexOf('Aluno ' + String(i).padStart(2, '0')));
  }
  assert.ok(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), 'ordem dos alunos');
});

test('nomes hostis viram texto inofensivo: nenhum comando, script ou ação entra no PDF', () => {
  const nomes = [
    'Ana ) Tj ET /JavaScript (alert(1)) <<',
    '<script>alert(1)</script> \\) \\( %PDF-1.4 endobj',
    'Evil' + String.fromCharCode(0x202E) + 'txt' + String.fromCharCode(0) + String.fromCharCode(7) + ' ' + String.fromCodePoint(0x1F600) + ' ' + String.fromCharCode(0x4E2D, 0x6587),
    '/OpenAction << /S /Launch /F (cmd.exe) >>',
    '/URI (http://exemplo.invalido) /SubmitForm /AA'
  ];
  const e = sessao(nomes.map((n) => [n, '7', '8', '9']));
  assert.equal(e.historico.length, nomes.length);
  const a = analisar(gerar(e));
  // nada que o PDF interprete como ação, script, link ou anexo
  assert.doesNotMatch(a.bruto, /\/(JavaScript|JS|OpenAction|AA|URI|Launch|EmbeddedFile|EmbeddedFiles|SubmitForm|ImportData|GoToR|GoToE|RichMedia|XFA|AcroForm|Names|Annots|Action)\b/);
  assert.ok(!a.bruto.includes('alert'), 'o texto digitado só existe em hexadecimal');
  // e aparece na página como texto comum
  assert.ok(a.texto.includes('Ana ) Tj ET /JavaScript (alert(1)) <<'));
  assert.ok(a.texto.includes('<script>alert(1)</script>'));
  assert.ok(a.texto.includes('Evil'), 'o RLO e o caractere nulo foram retirados, e o resto ficou');
  assert.ok(!a.texto.includes(String.fromCharCode(0x202E)));
  assert.ok(a.texto.includes('?'), 'o que a fonte não tem (emoji, chinês) vira ?');
});

test('o PDF não leva o nome do professor nem dados que não sejam do resumo', () => {
  const e = sessao([['Maria', '7', '8', '9']]);
  const bytes = P.gerarResumo({ lancamentos: e.historico, geradoEm: DATA, professor: 'Professor Secreto', nomeProfessor: 'Segredo', tema: 'neutro' });
  const a = analisar(bytes);
  assert.ok(!a.texto.includes('Secreto') && !a.texto.includes('Segredo') && !a.texto.includes('Professor Teste'));
});

test('os três temas geram arquivos válidos e diferentes entre si', () => {
  const alunos = [['Maria', '7', '8', '9'], ['Jose', '3', '4', '2']];
  const arquivos = ['neutro', 'feminino', 'masculino'].map((t) => gerar(sessao(alunos, t), t));
  arquivos.forEach((b) => analisar(b));
  assert.notEqual(bruto(arquivos[0]), bruto(arquivos[1]));
  assert.notEqual(bruto(arquivos[0]), bruto(arquivos[2]));
  assert.notEqual(bruto(arquivos[1]), bruto(arquivos[2]));
  // tema desconhecido volta ao neutro
  assert.equal(bruto(gerar(sessao(alunos), 'qualquer coisa')), bruto(arquivos[0]));
});

test('o nome do arquivo não leva dado pessoal: só a data', () => {
  assert.equal(P.nomeDoArquivo(DATA), 'notarapida-resumo-2026-10-09.pdf');
  assert.equal(P.nomeDoArquivo(new Date(2027, 0, 5)), 'notarapida-resumo-2027-01-05.pdf');
});

test('o módulo é congelado e não usa DOM, rede nem armazenamento', () => {
  assert.ok(Object.isFrozen(P));
  assert.deepEqual(Object.keys(P).sort(), ['codificar', 'gerarResumo', 'medirLinhas', 'nomeDoArquivo']);
});

// ---------- Propriedades ----------

const UNICODE_ALEATORIO = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 150 }),
  fc.string({ unit: 'grapheme', maxLength: 150 }),
  fc.string({ unit: 'grapheme-ascii', maxLength: 150 }),
  fc.constantFrom('', ' ', '(', ')', '\\', '<', '>', '%', '/', '((((((', '))))))', String.fromCharCode(0xD83D), String.fromCharCode(0x202E).repeat(50),
    'a' + String.fromCharCode(0x301).repeat(200), 'W'.repeat(1000), 'MMMMM '.repeat(200))
);

function lancamentoDireto(id, nome, parcial) {
  const l = parcial
    ? { id, parcial: true, nomeAluno: nome, notas: [700, null, null], mediaAprovacao: 600, limites: {}, faltantes: [1, 2], somaConhecida: 700, mediaParcial: 700,
      aprovacao: { status: 'possivel', centesimos: 550 }, acima: { status: 'impossivel' } }
    : { id, parcial: false, nomeAluno: nome, notas: [700, 800, 900], soma: 2400, mediaTruncada: 800, mediaAprovacao: 600,
      classificacao: 'Aprovado ' + EN + ' acima da média', posicao: 'Acima da média' };
  return Object.freeze(l);
}

test('propriedade: com qualquer nome (até 1.000 caracteres, Unicode qualquer) o PDF continua válido e só ASCII', () => {
  fc.assert(fc.property(fc.array(fc.tuple(UNICODE_ALEATORIO, fc.boolean()), { minLength: 1, maxLength: 40 }), (lista) => {
    const lancamentos = lista.map(([nome, parcial], i) => lancamentoDireto(i, nome, parcial));
    const a = analisar(P.gerarResumo({ lancamentos, geradoEm: DATA, tema: 'feminino' }));
    assert.doesNotMatch(a.bruto, /\/(JavaScript|JS|OpenAction|AA|URI|Launch|EmbeddedFile|SubmitForm)\b/);
    assert.ok(a.paginas >= 1);
  }), RUNS);
});

test('propriedade: codificar só produz bytes que a fonte tem (ASCII, Latin-1 ou WinAnsi) e no máximo 400', () => {
  const extras = new Set(Object.keys(WINANSI).map(Number).concat([0x80, 0x82, 0x83, 0x84, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8E, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9E, 0x9F]));
  fc.assert(fc.property(UNICODE_ALEATORIO, (texto) => {
    const bytes = P.codificar(texto);
    assert.ok(bytes.length <= 400);
    for (const b of bytes) {
      assert.ok((b >= 32 && b <= 126) || (b >= 160 && b <= 255) || extras.has(b), 'byte fora da codificação: ' + b);
    }
  }), RUNS);
  assert.deepEqual(P.codificar('a(b)c\\'), [97, 40, 98, 41, 99, 92], 'parênteses e barra só são escapados no hexadecimal');
  assert.deepEqual(P.codificar(null), []);
  assert.deepEqual(P.codificar('Ação'), [65, 231, 227, 111]);
});

test('propriedade: nenhuma linha quebrada passa da largura da coluna e o limite de linhas vale', () => {
  fc.assert(fc.property(UNICODE_ALEATORIO, fc.integer({ min: 40, max: 300 }), fc.constantFrom(7, 8.5, 10, 12), fc.boolean(), fc.integer({ min: 1, max: 5 }),
    (texto, maximo, tamanho, negrito, maxLinhas) => {
      const larguras = P.medirLinhas(texto, maximo, tamanho, negrito, maxLinhas);
      assert.ok(larguras.length >= 1 && larguras.length <= maxLinhas);
      for (const w of larguras) {
        assert.ok(w <= maximo + 1e-6, 'linha de ' + w + ' pt em coluna de ' + maximo);
      }
    }), RUNS);
});

test('desempenho: 35 alunos com nomes de 100 caracteres em menos de meio segundo', () => {
  const nome = 'Maria das Gracas Aparecida de Nazare Silva dos Santos Pereira Albuquerque Cavalcanti de Mendonca 99';
  const lancamentos = Array.from({ length: 35 }, (_, i) => lancamentoDireto(i, nome.slice(0, 100), i % 4 === 0));
  const antes = process.hrtime.bigint();
  analisar(P.gerarResumo({ lancamentos, geradoEm: DATA }));
  const ms = Number(process.hrtime.bigint() - antes) / 1e6;
  assert.ok(ms < 500, 'levou ' + ms.toFixed(0) + ' ms');
});
