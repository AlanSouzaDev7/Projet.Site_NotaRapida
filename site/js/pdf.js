/*
 * NotaRápida – resumo em PDF (lógica pura: sem DOM, sem rede, sem armazenamento).
 * Escreve o arquivo à mão (PDF 1.4, fontes padrão Helvetica, só texto e retângulos):
 * nenhuma biblioteca de terceiros e nenhum dado digitado sai do navegador.
 *
 * Segurança: todo texto vai para o arquivo em strings hexadecimais, já convertido
 * para a codificação das fontes (WinAnsi). Assim, um nome com parênteses, barras
 * ou marcação não consegue virar comando do PDF; o arquivo não tem JavaScript,
 * links, ações automáticas nem anexos.
 * Exportada como window.NotaRapidaPdf (navegador) e module.exports (Node, testes).
 */
(function (raiz, fabrica) {
  'use strict';
  var emNode = typeof module === 'object' && module && module.exports;
  var N = emNode ? require('./notas.js') : raiz.NotaRapida;
  var api = fabrica(N);
  if (emNode) {
    module.exports = api;
  } else {
    raiz.NotaRapidaPdf = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N) {
  'use strict';

  // A4 em pontos (1 pt = 1/72 polegada). As posições verticais são medidas do topo.
  var LARGURA_PAGINA = 595;
  var ALTURA_PAGINA = 842;
  var MARGEM = 40;
  var LARGURA_UTIL = LARGURA_PAGINA - 2 * MARGEM;
  var LIMITE_TOPO = ALTURA_PAGINA - 66; // o rodapé começa abaixo
  var LIMITE_TEXTO = 400; // um campo de texto nunca passa disso no arquivo
  var ALTURA_CABECALHO_TABELA = 26;
  var FATOR_LINHA = 1.28;
  var RECUO_CELULA = 4;
  var RECUO_VERTICAL = 5;

  var TEMAS = {
    neutro: { escura: '#082F66', acento: '#F5B820', suave: '#EDF3FB' },
    feminino: { escura: '#6E1D4A', acento: '#F4A98C', suave: '#FAF3F8' },
    masculino: { escura: '#0F2C41', acento: '#D08B3E', suave: '#EDF2F5' }
  };
  var COR_TEXTO = '#12203A';
  var COR_SUAVE = '#43506A';
  var COR_BORDA = '#D3DDEB';
  var COR_APROVADO = '#15803D';
  var COR_REPROVADO = '#B91C1C';
  var COR_ANDAMENTO = '#475569';

  // ---------- Fontes: larguras (Helvetica e Helvetica-Bold, de 32 a 126) ----------

  var LARGURA_NORMAL = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
  ];
  var LARGURA_NEGRITO = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
  ];
  // Caracteres fora de a-z com largura própria: byte -> [normal, negrito].
  var LARGURA_ESPECIAL = {
    0x80: [556, 556], 0x85: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500],
    0x94: [333, 500], 0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x99: [1000, 1000],
    0xA0: [278, 278], 0xA1: [333, 333], 0xA7: [556, 556], 0xA9: [737, 737], 0xAA: [370, 370],
    0xAB: [556, 556], 0xAE: [737, 737], 0xB0: [400, 400], 0xB1: [584, 584], 0xB5: [556, 611],
    0xB7: [278, 278], 0xBA: [365, 365], 0xBB: [556, 556], 0xBF: [611, 611], 0xC6: [1000, 1000],
    0xD7: [584, 584], 0xDF: [611, 611], 0xE6: [889, 889], 0xF7: [584, 584],
    0xEC: [278, 278], 0xED: [278, 278], 0xEE: [278, 278], 0xEF: [278, 278], // ì í î ï são mais largos que o i
    0xA6: [260, 280], 0xA8: [333, 333], 0xAC: [584, 584], 0xAD: [333, 333], 0xAF: [333, 333], 0xB2: [333, 333],
    0xB3: [333, 333], 0xB4: [333, 333], 0xB6: [537, 556], 0xB8: [333, 333], 0xB9: [333, 333], 0xBC: [834, 834],
    0xBD: [834, 834], 0xBE: [834, 834], 0xD0: [722, 722], 0xD8: [778, 778], 0xDE: [667, 667], 0xF0: [556, 611],
    0xF8: [611, 611], 0xFE: [556, 611]
  };

  // ---------- Texto: Unicode -> bytes WinAnsi ----------

  // Unicode que o WinAnsi coloca entre 0x80 e 0x9F.
  var EXTRAS_WINANSI = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91,
    0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
    0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  };
  // Vira espaço: tabulação, quebras de linha e os separadores de linha e de parágrafo do Unicode.
  var ESPACOS = [9, 10, 13, 0x2028, 0x2029];
  // Não têm desenho: controles, hífen opcional, espaços de largura zero, marcas de direção
  // (como o RLO, que inverte o texto) e o BOM.
  var INVISIVEIS = [[0x00, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x206F], [0xFEFF, 0xFEFF]];
  // Acentos soltos (combinantes) que sobram depois de juntar as letras acentuadas.
  var MARCAS = [0x0300, 0x036F];
  var ELIPSE = 0x85;
  var INTERROGACAO = 63;

  function normalizar(texto, forma) {
    return typeof texto.normalize === 'function' ? texto.normalize(forma) : texto;
  }

  function byteWinAnsi(codigo) {
    if ((codigo >= 0x20 && codigo <= 0x7E) || (codigo >= 0xA0 && codigo <= 0xFF)) {
      return codigo;
    }
    return EXTRAS_WINANSI[codigo] !== undefined ? EXTRAS_WINANSI[codigo] : null;
  }

  function emFaixa(c, faixas) {
    for (var i = 0; i < faixas.length; i += 1) {
      if (c >= faixas[i][0] && c <= faixas[i][1]) {
        return true;
      }
    }
    return false;
  }

  // Separadores viram espaço; o que não tem desenho sai (e, com `semMarcas`, os acentos soltos).
  function limpar(s, semMarcas) {
    var saida = '';
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charCodeAt(i);
      if (ESPACOS.indexOf(c) >= 0) {
        saida += ' ';
      } else if (!emFaixa(c, INVISIVEIS) && !(semMarcas && c >= MARCAS[0] && c <= MARCAS[1])) {
        saida += s.charAt(i);
      }
    }
    return saida;
  }

  // Texto qualquer -> lista de bytes. O que a fonte não tem vira "?", exceto letras
  // com acento raro, que viram a letra sem acento.
  function codificar(texto) {
    var s = String(texto === undefined || texto === null ? '' : texto).slice(0, LIMITE_TEXTO);
    s = limpar(normalizar(limpar(s, false), 'NFC'), true);
    var bytes = [];
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
        i += 1; // par substituto (emoji e afins): um único caractere sem desenho
        bytes.push(INTERROGACAO);
        continue;
      }
      var b = byteWinAnsi(c);
      if (b === null) {
        var base = normalizar(String.fromCharCode(c), 'NFD').charCodeAt(0);
        b = byteWinAnsi(base);
      }
      bytes.push(b === null ? INTERROGACAO : b);
    }
    return bytes;
  }

  function hexadecimal(bytes) {
    var saida = '<';
    for (var i = 0; i < bytes.length; i += 1) {
      saida += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16).toUpperCase();
    }
    return saida + '>';
  }

  // Largura de cada byte (milésimos de em), calculada uma vez.
  function larguraDoByte(b, negrito) {
    if (b >= 32 && b <= 126) {
      return (negrito ? LARGURA_NEGRITO : LARGURA_NORMAL)[b - 32];
    }
    if (LARGURA_ESPECIAL[b]) {
      return LARGURA_ESPECIAL[b][negrito ? 1 : 0];
    }
    if (b >= 0xA0) { // letra acentuada: mesma largura da letra sem acento
      var base = normalizar(String.fromCharCode(b), 'NFD').charCodeAt(0);
      if (base >= 32 && base <= 126) {
        return (negrito ? LARGURA_NEGRITO : LARGURA_NORMAL)[base - 32];
      }
    }
    return 556;
  }

  var TABELA_NORMAL = [];
  var TABELA_NEGRITO = [];
  for (var codigoByte = 0; codigoByte < 256; codigoByte += 1) {
    TABELA_NORMAL.push(larguraDoByte(codigoByte, false));
    TABELA_NEGRITO.push(larguraDoByte(codigoByte, true));
  }

  function larguraDosBytes(bytes, tamanho, negrito) {
    var tabela = negrito ? TABELA_NEGRITO : TABELA_NORMAL;
    var soma = 0;
    for (var i = 0; i < bytes.length; i += 1) {
      soma += tabela[bytes[i]];
    }
    return soma * tamanho / 1000;
  }

  function dividirPalavras(bytes) {
    var palavras = [];
    var atual = [];
    for (var i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 32) {
        if (atual.length) {
          palavras.push(atual);
          atual = [];
        }
      } else {
        atual.push(bytes[i]);
      }
    }
    if (atual.length) {
      palavras.push(atual);
    }
    return palavras;
  }

  // Quebra em linhas que cabem em `maximo` pontos. Palavras maiores que a linha são
  // cortadas; passando de `maxLinhas`, a última termina em reticências.
  function quebrar(bytes, maximo, tamanho, negrito, maxLinhas) {
    var tabela = negrito ? TABELA_NEGRITO : TABELA_NORMAL;
    var espaco = tabela[32] * tamanho / 1000;
    var linhas = [];
    var atual = [];
    var largura = 0;

    function fechar() {
      linhas.push(atual);
      atual = [];
      largura = 0;
    }

    dividirPalavras(bytes).forEach(function (palavra) {
      var w = larguraDosBytes(palavra, tamanho, negrito);
      if (atual.length && largura + espaco + w <= maximo) {
        atual = atual.concat([32], palavra);
        largura += espaco + w;
        return;
      }
      if (atual.length) {
        fechar();
      }
      while (w > maximo) {
        var corte = 0;
        var acumulado = 0;
        while (corte < palavra.length && acumulado + tabela[palavra[corte]] * tamanho / 1000 <= maximo) {
          acumulado += tabela[palavra[corte]] * tamanho / 1000;
          corte += 1;
        }
        corte = Math.max(corte, 1);
        atual = palavra.slice(0, corte);
        fechar();
        palavra = palavra.slice(corte);
        w = larguraDosBytes(palavra, tamanho, negrito);
      }
      atual = palavra;
      largura = w;
    });
    if (atual.length) {
      fechar();
    }
    if (!linhas.length) {
      linhas.push([]);
    }
    if (maxLinhas && linhas.length > maxLinhas) {
      linhas = linhas.slice(0, maxLinhas);
      var ultima = linhas[maxLinhas - 1];
      while (ultima.length && larguraDosBytes(ultima.concat([ELIPSE]), tamanho, negrito) > maximo) {
        ultima = ultima.slice(0, -1);
      }
      linhas[maxLinhas - 1] = ultima.concat([ELIPSE]);
    }
    return linhas;
  }

  // ---------- Desenho ----------

  function num(n) {
    return isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
  }

  // '#RRGGBB' -> 'r g b' (0 a 1, três casas: o suficiente para não alterar a cor)
  function componentes(cor) {
    var v = parseInt(cor.slice(1), 16);
    function parte(x) {
      return String(Math.round(x / 255 * 1000) / 1000);
    }
    return parte((v >> 16) & 255) + ' ' + parte((v >> 8) & 255) + ' ' + parte(v & 255);
  }

  function retangulo(pagina, x, topo, largura, altura, cor) {
    pagina.push(componentes(cor) + ' rg ' + num(x) + ' ' + num(ALTURA_PAGINA - topo - altura) + ' ' + num(largura) + ' ' + num(altura) + ' re f');
  }

  function linhaHorizontal(pagina, x1, x2, topo, cor, espessura) {
    var y = num(ALTURA_PAGINA - topo);
    pagina.push(componentes(cor) + ' RG ' + num(espessura) + ' w ' + num(x1) + ' ' + y + ' m ' + num(x2) + ' ' + y + ' l S');
  }

  // Escreve uma linha de texto; `topo` é o topo da linha e a base fica um corpo abaixo.
  function texto(pagina, x, topo, bytes, tamanho, negrito, cor) {
    if (!bytes.length) {
      return;
    }
    pagina.push('BT /' + (negrito ? 'F2' : 'F1') + ' ' + num(tamanho) + ' Tf ' + componentes(cor) + ' rg ' +
      num(x) + ' ' + num(ALTURA_PAGINA - topo - tamanho) + ' Td ' + hexadecimal(bytes) + ' Tj ET');
  }

  function textoAlinhado(pagina, alinhamento, x, largura, topo, bytes, tamanho, negrito, cor) {
    var w = larguraDosBytes(bytes, tamanho, negrito);
    var xs = alinhamento === 'centro' ? x + (largura - w) / 2 : alinhamento === 'direita' ? x + largura - w : x;
    texto(pagina, xs, topo, bytes, tamanho, negrito, cor);
  }

  function doisDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dataEHora(data) {
    return doisDigitos(data.getDate()) + '/' + doisDigitos(data.getMonth() + 1) + '/' + data.getFullYear() +
      ', às ' + doisDigitos(data.getHours()) + ':' + doisDigitos(data.getMinutes());
  }

  function nomeDoArquivo(data) {
    return 'notarapida-resumo-' + data.getFullYear() + '-' + doisDigitos(data.getMonth() + 1) + '-' + doisDigitos(data.getDate()) + '.pdf';
  }

  // Quatro quartos azul e branco, o mesmo motivo geométrico da faixa do site (não é símbolo oficial).
  function logotipo(pagina, x, topo, lado) {
    var m = lado / 2;
    retangulo(pagina, x, topo, m, m, '#5AA9E6');
    retangulo(pagina, x + m, topo, m, m, '#FFFFFF');
    retangulo(pagina, x, topo + m, m, m, '#FFFFFF');
    retangulo(pagina, x + m, topo + m, m, m, '#5AA9E6');
  }

  function cabecalhoPrimeiraPagina(pagina, tema, data) {
    retangulo(pagina, 0, 0, LARGURA_PAGINA, 70, tema.escura);
    retangulo(pagina, 0, 70, LARGURA_PAGINA, 3, tema.acento);
    logotipo(pagina, MARGEM, 20, 30);
    texto(pagina, MARGEM + 42, 18, codificar('NotaRápida'), 20, true, '#FFFFFF');
    texto(pagina, MARGEM + 42, 43, codificar('Resumo dos alunos consultados'), 11, false, '#DCE8F8');
    textoAlinhado(pagina, 'direita', MARGEM, LARGURA_UTIL, 31, codificar('Gerado em ' + dataEHora(data)), 8.5, false, '#FFFFFF');
  }

  function cabecalhoContinuacao(pagina, tema) {
    retangulo(pagina, 0, 0, LARGURA_PAGINA, 30, tema.escura);
    retangulo(pagina, 0, 30, LARGURA_PAGINA, 2, tema.acento);
    logotipo(pagina, MARGEM, 8, 16);
    texto(pagina, MARGEM + 26, 9, codificar('NotaRápida  ·  Resumo dos alunos consultados'), 10, true, '#FFFFFF');
  }

  function cartoesDeResumo(pagina, topo, resumo, tema) {
    var cartoes = [
      { valor: String(resumo.total), sufixo: ' de ' + N.constantes.TAMANHO_HISTORICO, rotulo: 'Consultados', cor: tema.escura },
      { valor: String(resumo.aprovados), sufixo: '', rotulo: 'Aprovados', cor: COR_APROVADO },
      { valor: String(resumo.reprovados), sufixo: '', rotulo: 'Reprovados', cor: COR_REPROVADO },
      { valor: String(resumo.emAndamento), sufixo: '', rotulo: 'Em andamento', cor: COR_ANDAMENTO },
      { valor: resumo.mediaGrupo === null ? '—' : N.formatarCentesimos(resumo.mediaGrupo), sufixo: '', rotulo: 'Média do grupo', cor: tema.escura }
    ];
    var folga = 8;
    var largura = (LARGURA_UTIL - folga * (cartoes.length - 1)) / cartoes.length;
    cartoes.forEach(function (c, i) {
      var x = MARGEM + i * (largura + folga);
      retangulo(pagina, x, topo, largura, 46, tema.suave);
      retangulo(pagina, x, topo, 3, 46, c.cor);
      var valor = codificar(c.valor);
      texto(pagina, x + 11, topo + 8, valor, 16, true, c.cor);
      if (c.sufixo) {
        texto(pagina, x + 11 + larguraDosBytes(valor, 16, true) + 2, topo + 14, codificar(c.sufixo), 8, false, COR_SUAVE);
      }
      texto(pagina, x + 11, topo + 31, codificar(c.rotulo), 8, false, COR_SUAVE);
    });
  }

  // ---------- Gráficos da turma (pizza e barras, lado a lado) ----------

  var ALTURA_GRAFICOS = 266;
  var FOLGA_PAINEIS = 13;
  var LARGURA_PAINEL = (LARGURA_UTIL - FOLGA_PAINEIS) / 2;
  var ALTURA_PAINEL = 150;

  function alunosTexto(n) {
    return n + (n === 1 ? ' aluno' : ' alunos');
  }

  // Percentual com até uma casa e vírgula ("26,5%", "50%"): grupos do mesmo tamanho mostram
  // sempre o mesmo valor (arredondar para somar 100 daria 27% e 26% para dois grupos iguais).
  function formatarPercentual(valor, total) {
    if (total <= 0) {
      return '0%';
    }
    var p = Math.round(valor * 1000 / total) / 10;
    return String(p).replace('.', ',') + '%';
  }

  // Passo do eixo das barras: no máximo 5 divisões, com números redondos.
  function passoDoEixo(maximo) {
    var passos = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (var i = 0; i < passos.length; i += 1) {
      if (Math.ceil(maximo / passos[i]) <= 5) {
        return passos[i];
      }
    }
    return passos[passos.length - 1];
  }

  // Uma fatia da pizza: `de` e `ate` são frações da volta, no sentido horário a partir do topo.
  // O PDF não tem arco: cada trecho de até 90 graus vira uma curva de Bézier.
  function fatia(pagina, cx, topoCy, raio, de, ate, cor) {
    var cy = ALTURA_PAGINA - topoCy;
    var inteiro = ate - de >= 0.99999;
    var a0 = Math.PI / 2 - 2 * Math.PI * de;
    var total = -2 * Math.PI * (ate - de);
    var partes = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2) - 1e-9));
    var passo = total / partes;
    var k = 4 / 3 * Math.tan(passo / 4);
    var ops = [componentes(cor) + ' rg ' + componentes('#FFFFFF') + ' RG 1.2 w'];
    var x = cx + raio * Math.cos(a0);
    var y = cy + raio * Math.sin(a0);
    ops.push(inteiro ? num(x) + ' ' + num(y) + ' m' : num(cx) + ' ' + num(cy) + ' m ' + num(x) + ' ' + num(y) + ' l');
    for (var i = 0; i < partes; i += 1) {
      var a = a0 + passo * i;
      var b = a + passo;
      ops.push(num(cx + raio * (Math.cos(a) - k * Math.sin(a))) + ' ' + num(cy + raio * (Math.sin(a) + k * Math.cos(a))) + ' ' +
        num(cx + raio * (Math.cos(b) + k * Math.sin(b))) + ' ' + num(cy + raio * (Math.sin(b) - k * Math.cos(b))) + ' ' +
        num(cx + raio * Math.cos(b)) + ' ' + num(cy + raio * Math.sin(b)) + ' c');
    }
    ops.push('h B');
    pagina.push(ops.join(' '));
  }

  function painel(pagina, x, topo, titulo, tema) {
    retangulo(pagina, x, topo, LARGURA_PAINEL, ALTURA_PAINEL, tema.suave);
    retangulo(pagina, x, topo, LARGURA_PAINEL, 2, tema.escura);
    texto(pagina, x + 12, topo + 11, codificar(titulo), 8.5, true, COR_TEXTO);
  }

  // dados: [{ rotulo, valor, cor }] na ordem aprovados, reprovados, em andamento.
  function graficoDePizza(pagina, x, topo, dados, total, tema) {
    painel(pagina, x, topo, 'Pizza: situação dos alunos', tema);
    var raio = 50;
    var cx = x + 14 + raio;
    var cy = topo + 34 + raio;
    var inicio = 0;
    dados.forEach(function (d) {
      if (d.valor > 0) {
        var fim = inicio + d.valor / total;
        fatia(pagina, cx, cy, raio, inicio, Math.min(fim, 1), d.cor);
        inicio = fim;
      }
    });
    dados.forEach(function (d, i) {
      var y = topo + 46 + i * 31;
      retangulo(pagina, x + 130, y + 1, 8, 8, d.cor);
      texto(pagina, x + 143, y, codificar(d.rotulo), 8.5, true, COR_TEXTO);
      texto(pagina, x + 143, y + 11, codificar(alunosTexto(d.valor) + '  ·  ' + formatarPercentual(d.valor, total)), 8, false, COR_SUAVE);
    });
  }

  function graficoDeBarras(pagina, x, topo, dados, tema) {
    painel(pagina, x, topo, 'Barras: alunos por situação', tema);
    var maximo = 0;
    dados.forEach(function (d) {
      maximo = Math.max(maximo, d.valor);
    });
    var passo = passoDoEixo(Math.max(maximo, 1));
    var eixo = Math.max(1, Math.ceil(maximo / passo)) * passo;
    var esquerda = x + 34;
    var largura = LARGURA_PAINEL - 34 - 12;
    var cima = topo + 42;
    var altura = 74;
    for (var v = 0; v <= eixo; v += passo) {
      var y = cima + altura - altura * v / eixo;
      linhaHorizontal(pagina, esquerda, esquerda + largura, y, v === 0 ? COR_SUAVE : COR_BORDA, v === 0 ? 0.8 : 0.5);
      textoAlinhado(pagina, 'direita', x + 6, 22, y - 3.5, codificar(String(v)), 7, false, COR_SUAVE);
    }
    var faixa = largura / dados.length;
    var larguraBarra = Math.min(40, faixa * 0.55);
    dados.forEach(function (d, i) {
      var h = altura * d.valor / eixo;
      var bx = esquerda + faixa * i + (faixa - larguraBarra) / 2;
      if (h > 0) {
        retangulo(pagina, bx, cima + altura - h, larguraBarra, h, d.cor);
      }
      textoAlinhado(pagina, 'centro', bx - 10, larguraBarra + 20, cima + altura - h - 12, codificar(String(d.valor)), 9, true, COR_TEXTO);
      textoAlinhado(pagina, 'centro', esquerda + faixa * i, faixa, cima + altura + 6, codificar(d.rotulo), 8, false, COR_TEXTO);
    });
  }

  // Média da turma (barra de 0 a 10) e, logo abaixo, a pizza e as barras lado a lado.
  // Os alunos em andamento entram nos dois gráficos; só a média os deixa de fora, porque
  // ainda não têm as três notas (a mesma regra da "Média do grupo" da tela).
  function graficosDaTurma(pagina, topo, resumo, tema) {
    var completos = resumo.aprovados + resumo.reprovados;
    texto(pagina, MARGEM, topo, codificar('Visão geral da turma'), 12, true, tema.escura);
    texto(pagina, MARGEM, topo + 17, codificar('Situação dos ' + alunosTexto(resumo.total) + ' consultados, incluindo os que ainda estão em andamento.'), 8, false, COR_SUAVE);

    var faixaTopo = topo + 34;
    retangulo(pagina, MARGEM, faixaTopo, LARGURA_UTIL, 52, tema.suave);
    retangulo(pagina, MARGEM, faixaTopo, 3, 52, tema.escura);
    texto(pagina, MARGEM + 14, faixaTopo + 8, codificar('Média da turma'), 8, false, COR_SUAVE);
    texto(pagina, MARGEM + 14, faixaTopo + 20, codificar(resumo.mediaGrupo === null ? '—' : N.formatarCentesimos(resumo.mediaGrupo)), 20, true, tema.escura);
    if (resumo.mediaGrupo !== null) {
      var gx = MARGEM + 150;
      var gl = LARGURA_UTIL - 150 - 16;
      retangulo(pagina, gx, faixaTopo + 15, gl, 10, COR_BORDA);
      retangulo(pagina, gx, faixaTopo + 15, gl * Math.min(resumo.mediaGrupo, 1000) / 1000, 10, tema.escura);
      [0, 5, 10].forEach(function (marca) {
        textoAlinhado(pagina, 'centro', gx + gl * marca / 10 - 10, 20, faixaTopo + 29, codificar(String(marca)), 7, false, COR_SUAVE);
      });
    } else {
      texto(pagina, MARGEM + 150, faixaTopo + 20, codificar('Ainda não há aluno com as três notas lançadas.'), 8.5, false, COR_SUAVE);
    }
    var nota = completos > 0
      ? 'Média de ' + alunosTexto(completos) + ' com as três notas lançadas.' +
        (resumo.emAndamento > 0 ? ' Alunos em andamento (' + resumo.emAndamento + ') aparecem nos gráficos, mas ainda não entram na média.' : '')
      : 'Todos os ' + alunosTexto(resumo.total) + ' consultados estão em andamento e aparecem nos gráficos.';
    texto(pagina, MARGEM, faixaTopo + 58, codificar(nota), 7.5, false, COR_SUAVE);

    var dados = [
      { rotulo: 'Aprovados', valor: resumo.aprovados, cor: COR_APROVADO },
      { rotulo: 'Reprovados', valor: resumo.reprovados, cor: COR_REPROVADO },
      { rotulo: 'Em andamento', valor: resumo.emAndamento, cor: COR_ANDAMENTO }
    ];
    var painelTopo = faixaTopo + 76;
    graficoDePizza(pagina, MARGEM, painelTopo, dados, resumo.total, tema);
    graficoDeBarras(pagina, MARGEM + LARGURA_PAINEL + FOLGA_PAINEIS, painelTopo, dados, tema);
  }

  // ---------- Tabela ----------

  var COLUNAS = [
    { titulo: '#', largura: 24, alinhamento: 'centro' },
    { titulo: 'Aluno', largura: 166, alinhamento: 'esquerda' },
    { titulo: 'T1', largura: 32, alinhamento: 'centro' },
    { titulo: 'T2', largura: 32, alinhamento: 'centro' },
    { titulo: 'T3', largura: 32, alinhamento: 'centro' },
    { titulo: 'Média', largura: 44, alinhamento: 'centro' },
    { titulo: 'Situação', largura: 130, alinhamento: 'esquerda' },
    { titulo: 'Média p/ aprovação', largura: 55, alinhamento: 'centro' }
  ];

  function cabecalhoDaTabela(pagina, topo, tema) {
    retangulo(pagina, MARGEM, topo, LARGURA_UTIL, ALTURA_CABECALHO_TABELA, tema.escura);
    var x = MARGEM;
    COLUNAS.forEach(function (coluna) {
      var linhas = quebrar(codificar(coluna.titulo), coluna.largura - 2 * RECUO_CELULA, 7.5, true, 2);
      var base = topo + (ALTURA_CABECALHO_TABELA - linhas.length * 7.5 * FATOR_LINHA) / 2;
      linhas.forEach(function (linha, i) {
        textoAlinhado(pagina, coluna.alinhamento, x + RECUO_CELULA, coluna.largura - 2 * RECUO_CELULA,
          base + i * 7.5 * FATOR_LINHA, linha, 7.5, true, '#FFFFFF');
      });
      x += coluna.largura;
    });
  }

  function notaTexto(centesimos) {
    return centesimos === null ? '—' : N.formatarCentesimos(centesimos);
  }

  // Blocos de texto de cada coluna de um Lançamento (completo ou em andamento).
  function blocosDoLancamento(l, posicao) {
    var parcial = l.parcial === true;
    var notas = Array.isArray(l.notas) ? l.notas : [null, null, null];
    var blocos = [
      [{ texto: String(posicao), tamanho: 8, cor: COR_SUAVE }],
      [{ texto: String(l.nomeAluno), tamanho: 8.5, cor: COR_TEXTO, maxLinhas: 4 }]
    ];
    notas.slice(0, 3).forEach(function (nota) {
      blocos.push([{ texto: notaTexto(nota), tamanho: 8.5, cor: nota === null ? COR_SUAVE : COR_TEXTO }]);
    });
    if (parcial) {
      blocos.push([
        { texto: N.formatarCentesimos(l.mediaParcial), tamanho: 9, negrito: true, cor: COR_TEXTO },
        { texto: 'parcial', tamanho: 7, cor: COR_SUAVE }
      ]);
      blocos.push([
        { texto: 'Em andamento', tamanho: 8, negrito: true, cor: COR_ANDAMENTO },
        { texto: N.montarResumoMetas(l), tamanho: 7, cor: COR_SUAVE, maxLinhas: 3 }
      ]);
    } else {
      blocos.push([{ texto: N.formatarMedia(l.soma), tamanho: 9, negrito: true, cor: COR_TEXTO }]);
      blocos.push([{
        texto: String(l.classificacao), tamanho: 8, negrito: true, maxLinhas: 3,
        cor: N.rotuloSituacao(l.classificacao) === 'Reprovado' ? COR_REPROVADO : COR_APROVADO
      }]);
    }
    blocos.push([{ texto: N.formatarCentesimos(l.mediaAprovacao), tamanho: 8.5, cor: COR_TEXTO }]);
    return blocos;
  }

  // Quebra os blocos de cada coluna e mede a altura da linha da tabela.
  function medirLinha(l, posicao) {
    var celulas = blocosDoLancamento(l, posicao).map(function (blocos, i) {
      var largura = COLUNAS[i].largura - 2 * RECUO_CELULA;
      var linhas = [];
      var altura = 0;
      blocos.forEach(function (b) {
        quebrar(codificar(b.texto), largura, b.tamanho, b.negrito === true, b.maxLinhas || 2).forEach(function (bytes) {
          linhas.push({ bytes: bytes, tamanho: b.tamanho, negrito: b.negrito === true, cor: b.cor });
          altura += b.tamanho * FATOR_LINHA;
        });
      });
      return { linhas: linhas, altura: altura };
    });
    var maior = 0;
    celulas.forEach(function (c) {
      maior = Math.max(maior, c.altura);
    });
    return { celulas: celulas, altura: maior + 2 * RECUO_VERTICAL };
  }

  function desenharLinha(pagina, topo, medida, listrada, tema) {
    if (listrada) {
      retangulo(pagina, MARGEM, topo, LARGURA_UTIL, medida.altura, tema.suave);
    }
    var x = MARGEM;
    medida.celulas.forEach(function (celula, i) {
      var y = topo + RECUO_VERTICAL;
      celula.linhas.forEach(function (linha) {
        textoAlinhado(pagina, COLUNAS[i].alinhamento, x + RECUO_CELULA, COLUNAS[i].largura - 2 * RECUO_CELULA,
          y, linha.bytes, linha.tamanho, linha.negrito, linha.cor);
        y += linha.tamanho * FATOR_LINHA;
      });
      x += COLUNAS[i].largura;
    });
    linhaHorizontal(pagina, MARGEM, MARGEM + LARGURA_UTIL, topo + medida.altura, COR_BORDA, 0.5);
  }

  var AVISO_RODAPE = 'Documento gerado pelo NotaRápida, projeto independente e não oficial, sem vínculo com o Governo do Estado do Rio de Janeiro. ' +
    'Não substitui diário de classe, boletim ou sistema oficial de notas.';

  function rodape(pagina, numero, total) {
    linhaHorizontal(pagina, MARGEM, MARGEM + LARGURA_UTIL, ALTURA_PAGINA - 46, COR_BORDA, 0.75);
    quebrar(codificar(AVISO_RODAPE), LARGURA_UTIL - 90, 7, false, 3).forEach(function (linha, i) {
      texto(pagina, MARGEM, ALTURA_PAGINA - 38 + i * 9, linha, 7, false, COR_SUAVE);
    });
    textoAlinhado(pagina, 'direita', MARGEM, LARGURA_UTIL, ALTURA_PAGINA - 38,
      codificar('Página ' + numero + ' de ' + total), 8, true, COR_SUAVE);
  }

  // ---------- Arquivo PDF ----------

  function preencher(n, casas) {
    var s = String(n);
    while (s.length < casas) {
      s = '0' + s;
    }
    return s;
  }

  // Título do documento em UTF-16BE (hexadecimal), para os acentos aparecerem no leitor de PDF.
  function tituloHexadecimal(titulo) {
    var saida = '<FEFF';
    for (var i = 0; i < titulo.length; i += 1) {
      saida += preencher(titulo.charCodeAt(i).toString(16).toUpperCase(), 4);
    }
    return saida + '>';
  }

  function montarArquivo(paginas, data) {
    var total = 5 + 2 * paginas.length;
    var saida = '%PDF-1.4\n';
    var posicoes = [];

    function objeto(numero, corpo) {
      posicoes[numero] = saida.length;
      saida += numero + ' 0 obj\n' + corpo + '\nendobj\n';
    }

    var filhas = [];
    for (var p = 0; p < paginas.length; p += 1) {
      filhas.push((6 + 2 * p) + ' 0 R');
    }
    objeto(1, '<< /Type /Catalog /Pages 2 0 R /Lang (pt-BR) /ViewerPreferences << /DisplayDocTitle true >> >>');
    objeto(2, '<< /Type /Pages /Kids [' + filhas.join(' ') + '] /Count ' + paginas.length + ' >>');
    objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objeto(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    objeto(5, '<< /Title ' + tituloHexadecimal('NotaRápida – Resumo dos alunos consultados') +
      ' /Producer (NotaRapida) /Creator (NotaRapida) /CreationDate (D:' + data.getFullYear() +
      preencher(data.getMonth() + 1, 2) + preencher(data.getDate(), 2) + preencher(data.getHours(), 2) +
      preencher(data.getMinutes(), 2) + preencher(data.getSeconds(), 2) + ') >>');
    paginas.forEach(function (operacoes, i) {
      var conteudo = operacoes.join('\n');
      objeto(6 + 2 * i, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + LARGURA_PAGINA + ' ' + ALTURA_PAGINA +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (7 + 2 * i) + ' 0 R >>');
      objeto(7 + 2 * i, '<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream');
    });

    var inicioDaTabela = saida.length;
    saida += 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var n = 1; n <= total; n += 1) {
      saida += preencher(posicoes[n], 10) + ' 00000 n \n';
    }
    saida += 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + inicioDaTabela + '\n%%EOF\n';

    var bytes = new Uint8Array(saida.length);
    for (var i = 0; i < saida.length; i += 1) {
      bytes[i] = saida.charCodeAt(i) & 0xFF; // o arquivo inteiro é ASCII
    }
    return bytes;
  }

  // dados: { lancamentos, geradoEm (Date), tema ('neutro' | 'feminino' | 'masculino') }.
  // Devolve os bytes do PDF, ou null quando não há nenhum aluno consultado.
  function gerarResumo(dados) {
    var lista = dados && dados.lancamentos ? Array.prototype.slice.call(dados.lancamentos) : [];
    if (!lista.length) {
      return null;
    }
    var data = dados.geradoEm instanceof Date && !isNaN(dados.geradoEm.getTime()) ? dados.geradoEm : new Date();
    var tema = TEMAS[N.normalizarTratamento(dados.tema)];

    var paginas = [];
    var pagina = [];
    var resumo = N.resumirHistorico(lista);
    cabecalhoPrimeiraPagina(pagina, tema, data);
    cartoesDeResumo(pagina, 86, resumo, tema);
    texto(pagina, MARGEM, 143, codificar('Do mais recente para o mais antigo.'), 8, false, COR_SUAVE);
    texto(pagina, MARGEM, 154, codificar('A média do grupo considera só os alunos com as três notas lançadas; alunos em andamento não entram na conta.'), 8, false, COR_SUAVE);
    var topo = 170;
    cabecalhoDaTabela(pagina, topo, tema);
    topo += ALTURA_CABECALHO_TABELA;

    lista.forEach(function (lancamento, i) {
      var medida = medirLinha(lancamento, i + 1);
      if (topo + medida.altura > LIMITE_TOPO) {
        paginas.push(pagina);
        pagina = [];
        cabecalhoContinuacao(pagina, tema);
        topo = 46;
        cabecalhoDaTabela(pagina, topo, tema);
        topo += ALTURA_CABECALHO_TABELA;
      }
      desenharLinha(pagina, topo, medida, i % 2 === 1, tema);
      topo += medida.altura;
    });

    // No fim do documento: média da turma e os gráficos (numa página nova se não couberem).
    topo += 22;
    if (topo + ALTURA_GRAFICOS > LIMITE_TOPO) {
      paginas.push(pagina);
      pagina = [];
      cabecalhoContinuacao(pagina, tema);
      topo = 52;
    }
    graficosDaTurma(pagina, topo, resumo, tema);
    paginas.push(pagina);

    paginas.forEach(function (operacoes, i) {
      rodape(operacoes, i + 1, paginas.length);
    });
    return montarArquivo(paginas, data);
  }

  // Larguras (em pontos) das linhas em que o texto seria quebrado: serve para conferir os limites.
  function medirLinhas(textoQualquer, maximo, tamanho, negrito, maxLinhas) {
    return quebrar(codificar(textoQualquer), maximo, tamanho, negrito === true, maxLinhas).map(function (bytes) {
      return larguraDosBytes(bytes, tamanho, negrito === true);
    });
  }

  return Object.freeze({
    gerarResumo: gerarResumo,
    nomeDoArquivo: nomeDoArquivo,
    codificar: codificar,
    medirLinhas: medirLinhas,
    formatarPercentual: formatarPercentual
  });
});
