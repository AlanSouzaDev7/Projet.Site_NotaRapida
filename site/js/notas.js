/*
 * NotaRápida – lógica pura (sem DOM, sem temporizadores, sem armazenamento).
 * Notas em centésimos inteiros (0 a 1000); soma S de 0 a 3000.
 * Exportada como window.NotaRapida (navegador) e module.exports (Node, testes).
 */
(function (raiz, fabrica) {
  'use strict';
  var api = fabrica();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    raiz.NotaRapida = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITE_NOME = 100;
  // Mesmo valor do atributo maxlength dos campos (vale mesmo se o atributo for removido).
  var LIMITE_CAMPO = 1000;
  // Últimos alunos consultados que permanecem visíveis (somente leitura).
  var TAMANHO_HISTORICO = 35;
  // Limites da soma para a média padrão (M = 600): 3·600, 3·800 e 3·900.
  var LIMITES_SOMA = Object.freeze({ NA_MEDIA: 1800, ACIMA: 2400, EXCELENTE: 2700 });
  var MEDIA_PADRAO = 600;
  var TRATAMENTOS = Object.freeze(['feminino', 'masculino', 'neutro']);

  var CLASSIFICACOES = Object.freeze([
    'Reprovado',
    'Aprovado – na média',
    'Aprovado – acima da média',
    'Aprovado – excelente'
  ]);

  var POSICOES = Object.freeze(['Abaixo da média', 'Na média', 'Acima da média']);

  var mensagens = Object.freeze({
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

  var NOTA_MAXIMA = 1000;
  var ROTULOS_TRIMESTRE = Object.freeze(['T1', 'T2', 'T3']);

  // Textos das metas do resultado parcial (aprovação e acima da média).
  var TEXTOS_META = Object.freeze({
    aprovacao: Object.freeze({
      prefixo: 'Para alcançar a média de aprovação (',
      garantida: 'Média de aprovação já garantida.',
      impossivel: 'Não é mais possível alcançar a média de aprovação, mesmo com 10 no que falta.',
      curtoGarantida: 'garantida'
    }),
    acima: Object.freeze({
      prefixo: 'Para ficar acima da média (',
      garantida: 'Acima da média já garantido.',
      impossivel: 'Não é mais possível ficar acima da média, mesmo com 10 no que falta.',
      curtoGarantida: 'garantido'
    })
  });

  // Menos opcional, um ou mais dígitos e, opcionalmente, um único separador
  // (vírgula ou ponto) seguido de um ou mais dígitos (Req. 8.7).
  var REGEX_NOTA = /^(-?)([0-9]+)(?:[.,]([0-9]+))?$/;

  var ORDEM_CAMPOS = ['media', 'nomeAluno', 't1', 't2', 't3'];

  // Corta o texto bruto de um campo em LIMITE_CAMPO unidades UTF-16, a mesma
  // contagem do maxlength do HTML.
  function truncarCampo(texto) {
    return String(texto === null || texto === undefined ? '' : texto).slice(0, LIMITE_CAMPO);
  }

  function aparar(texto) {
    return String(texto === null || texto === undefined ? '' : texto).trim();
  }

  // Conta pontos de código após normalização NFC (letra acentuada = 1 caractere).
  function contarCaracteres(texto) {
    var s = String(texto === null || texto === undefined ? '' : texto);
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFC');
    }
    // Array.from percorre por ponto de código (pares substitutos contam como 1).
    return Array.from(s).length;
  }

  // Leitor_de_Nota
  function lerNota(texto) {
    var t = aparar(texto);
    if (t === '') {
      return { tipo: 'vazio' };
    }
    var m = REGEX_NOTA.exec(t);
    if (!m) {
      return { tipo: 'erro' };
    }
    var inteiro = m[2].replace(/^0+/, '');
    if (inteiro === '') {
      inteiro = '0';
    }
    return {
      tipo: 'numero',
      negativo: m[1] === '-',
      inteiro: inteiro,
      fracao: m[3] || ''
    };
  }

  // Formatador_de_Nota: 750 → "7,50"; 1000 → "10,00"; 50 → "0,50".
  function formatarCentesimos(c) {
    var inteiro = Math.floor(c / 100);
    var fracao = c % 100;
    return String(inteiro) + ',' + (fracao < 10 ? '0' : '') + String(fracao);
  }

  // Média exibida: trunca S/3 em centésimos, sem arredondar (1799 → "5,99").
  function formatarMedia(soma) {
    return formatarCentesimos(Math.floor(soma / 3));
  }

  function validarNome(texto, mensagemVazio) {
    var nome = aparar(texto);
    var n = contarCaracteres(nome);
    if (n === 0) {
      return { ok: false, erro: mensagemVazio };
    }
    if (n > LIMITE_NOME) {
      return { ok: false, erro: mensagens.NOME_LONGO };
    }
    return { ok: true, nome: nome };
  }

  function validarNomeProfessor(texto) {
    return validarNome(texto, mensagens.PROFESSOR_VAZIO);
  }

  function validarNomeAluno(texto) {
    return validarNome(texto, mensagens.ALUNO_VAZIO);
  }

  // Ordem do Req. 5.10: vazio → conversão → intervalo → casas decimais.
  function validarNota(texto) {
    var leitura = lerNota(texto);
    if (leitura.tipo === 'vazio') {
      return { ok: false, erro: mensagens.NOTA_VAZIA };
    }
    if (leitura.tipo === 'erro') {
      return { ok: false, erro: mensagens.NOTA_INVALIDA };
    }
    var inteiro = leitura.inteiro;
    var fracao = leitura.fracao;
    var fracaoNaoZero = /[1-9]/.test(fracao);
    var zero = inteiro === '0' && !fracaoNaoZero;
    // Intervalo decidido nas strings, sem ponto flutuante.
    var fora = (leitura.negativo && !zero) ||
      inteiro.length > 2 ||
      Number(inteiro) > 10 ||
      (inteiro === '10' && fracaoNaoZero);
    if (fora) {
      return { ok: false, erro: mensagens.NOTA_FORA };
    }
    if (fracao.length > 2) {
      return { ok: false, erro: mensagens.NOTA_CASAS };
    }
    var centesimos = Number(inteiro) * 100 + Number((fracao + '00').slice(0, 2));
    return { ok: true, centesimos: centesimos };
  }

  // Média para aprovação: vazio → conversão → intervalo (1 a 10) → casas.
  // Intervalo decidido nas strings, sem ponto flutuante, como em validarNota.
  function validarMediaAprovacao(texto) {
    var leitura = lerNota(texto);
    if (leitura.tipo === 'vazio') {
      return { ok: false, erro: mensagens.MEDIA_VAZIA };
    }
    if (leitura.tipo === 'erro') {
      return { ok: false, erro: mensagens.MEDIA_INVALIDA };
    }
    var inteiro = leitura.inteiro;
    var fracao = leitura.fracao;
    var fracaoNaoZero = /[1-9]/.test(fracao);
    // inteiro === '0' significa valor menor que 1 (zeros à esquerda já removidos).
    var fora = leitura.negativo ||
      inteiro === '0' ||
      inteiro.length > 2 ||
      Number(inteiro) > 10 ||
      (inteiro === '10' && fracaoNaoZero);
    if (fora) {
      return { ok: false, erro: mensagens.MEDIA_FORA };
    }
    if (fracao.length > 2) {
      return { ok: false, erro: mensagens.MEDIA_CASAS };
    }
    var centesimos = Number(inteiro) * 100 + Number((fracao + '00').slice(0, 2));
    return { ok: true, centesimos: centesimos };
  }

  function mediaOuPadrao(M) {
    return M === undefined || M === null ? MEDIA_PADRAO : M;
  }

  // Limites derivados da média M (centésimos): "acima" no ponto médio entre
  // M e 10; "excelente" a três quartos do caminho. M = 600 → 800 e 900.
  function limitesDaMedia(M) {
    var m = mediaOuPadrao(M);
    return {
      aprovacao: m,
      acima: Math.floor((m + 1000) / 2),
      excelente: Math.floor((m + 3000) / 4)
    };
  }

  // Dentro do formulário, nota vazia é "faltante" (centesimos: null);
  // nota preenchida segue as regras de validarNota.
  function validarNotaOpcional(texto) {
    if (lerNota(texto).tipo === 'vazio') {
      return { ok: true, centesimos: null, faltante: true };
    }
    return validarNota(texto);
  }

  // Avalia sempre todos os campos. Se `media` não for informado (undefined),
  // usa a média padrão 6,00 (compatibilidade com chamadas antigas).
  // Notas vazias são faltantes; com as 3 vazias, o erro fica no T1.
  function validarFormulario(campos) {
    var c = campos || {};
    var resultados = {
      media: c.media === undefined ? { ok: true, centesimos: MEDIA_PADRAO } : validarMediaAprovacao(c.media),
      nomeAluno: validarNomeAluno(c.nomeAluno),
      t1: validarNotaOpcional(c.t1),
      t2: validarNotaOpcional(c.t2),
      t3: validarNotaOpcional(c.t3)
    };
    if (resultados.t1.faltante && resultados.t2.faltante && resultados.t3.faltante) {
      resultados.t1 = { ok: false, erro: mensagens.NOTAS_TODAS_VAZIAS };
    }
    var erros = {};
    var primeiroInvalido = null;
    for (var i = 0; i < ORDEM_CAMPOS.length; i += 1) {
      var chave = ORDEM_CAMPOS[i];
      if (!resultados[chave].ok) {
        erros[chave] = resultados[chave].erro;
        if (primeiroInvalido === null) {
          primeiroInvalido = chave;
        }
      }
    }
    if (primeiroInvalido !== null) {
      return { ok: false, erros: erros, primeiroInvalido: primeiroInvalido };
    }
    return {
      ok: true,
      dados: {
        mediaAprovacao: resultados.media.centesimos,
        nomeAluno: resultados.nomeAluno.nome,
        notas: [resultados.t1.centesimos, resultados.t2.centesimos, resultados.t3.centesimos]
      }
    };
  }

  // Compara a soma exata com 3·M, 3·acima e 3·excelente, sem divisão.
  function classificarSoma(soma, M) {
    var l = limitesDaMedia(M);
    if (soma < 3 * l.aprovacao) {
      return CLASSIFICACOES[0];
    }
    if (soma < 3 * l.acima) {
      return CLASSIFICACOES[1];
    }
    if (soma < 3 * l.excelente) {
      return CLASSIFICACOES[2];
    }
    return CLASSIFICACOES[3];
  }

  function posicionarSoma(soma, M) {
    var l = limitesDaMedia(M);
    if (soma < 3 * l.aprovacao) {
      return POSICOES[0];
    }
    if (soma < 3 * l.acima) {
      return POSICOES[1];
    }
    return POSICOES[2];
  }

  // Calculadora_de_Média: notas = [c1, c2, c3] em centésimos; M em centésimos.
  function calcular(notas, M) {
    var m = mediaOuPadrao(M);
    var soma = notas[0] + notas[1] + notas[2];
    return {
      soma: soma,
      media: { numerador: soma, denominador: 3 },
      mediaTruncada: Math.floor(soma / 3),
      mediaAprovacao: m,
      limites: limitesDaMedia(m),
      classificacao: classificarSoma(soma, m),
      posicao: posicionarSoma(soma, m)
    };
  }

  // Meta para um alvo X: R = 3·X − Sk; menor nota inteira n com n·k ≥ R.
  function metaParaAlvo(alvo, somaConhecida, k) {
    var r = 3 * alvo - somaConhecida;
    if (r <= 0) {
      return { status: 'garantida' };
    }
    var n = Math.floor((r + k - 1) / k); // ceil(R / k) só com inteiros
    if (n > NOTA_MAXIMA) {
      return { status: 'impossivel' };
    }
    return { status: 'possivel', centesimos: n };
  }

  // Resultado_Parcial: notas com null nos faltantes (1 ou 2), M em centésimos.
  function calcularParcial(notas, M) {
    var m = mediaOuPadrao(M);
    var limites = limitesDaMedia(m);
    var faltantes = [];
    var soma = 0;
    for (var i = 0; i < 3; i += 1) {
      if (notas[i] === null || notas[i] === undefined) {
        faltantes.push(ROTULOS_TRIMESTRE[i]);
      } else {
        soma += notas[i];
      }
    }
    var k = faltantes.length;
    if (k < 1 || k > 2) {
      return null;
    }
    return {
      faltantes: faltantes,
      quantidadeFaltante: k,
      somaConhecida: soma,
      mediaParcial: Math.floor(soma / (3 - k)),
      mediaAprovacao: m,
      limites: limites,
      aprovacao: metaParaAlvo(limites.aprovacao, soma, k),
      acima: metaParaAlvo(limites.acima, soma, k)
    };
  }

  // ['T3'] → "T3"; ['T2', 'T3'] → "T2 e T3".
  function listarTrimestres(faltantes) {
    if (faltantes.length <= 1) {
      return faltantes.join('');
    }
    return faltantes.slice(0, -1).join(', ') + ' e ' + faltantes[faltantes.length - 1];
  }

  // tipo: 'aprovacao' | 'acima'; parcial: retorno de calcularParcial ou Lançamento parcial.
  function montarMeta(tipo, parcial) {
    var meta = parcial[tipo];
    var t = TEXTOS_META[tipo];
    if (meta.status === 'garantida') {
      return t.garantida;
    }
    if (meta.status === 'impossivel') {
      return t.impossivel;
    }
    var alvo = tipo === 'aprovacao' ? parcial.limites.aprovacao : parcial.limites.acima;
    var n = formatarCentesimos(meta.centesimos);
    var onde = parcial.faltantes.length === 1
      ? n + ' em ' + parcial.faltantes[0]
      : n + ' em cada um dos trimestres ' + listarTrimestres(parcial.faltantes);
    return t.prefixo + formatarCentesimos(alvo) + '): ' + onde;
  }

  function resumirMeta(tipo, meta) {
    if (meta.status === 'garantida') {
      return TEXTOS_META[tipo].curtoGarantida;
    }
    if (meta.status === 'impossivel') {
      return 'impossível';
    }
    return formatarCentesimos(meta.centesimos);
  }

  // Linha do histórico: "Aprovação: 7,00 · Acima: impossível".
  function montarResumoMetas(parcial) {
    return 'Aprovação: ' + resumirMeta('aprovacao', parcial.aprovacao) +
      ' · Acima: ' + resumirMeta('acima', parcial.acima);
  }

  function montarMensagemParcial(nome, faltantes) {
    return nome + ' ainda tem ' + listarTrimestres(faltantes) + ' por lançar.';
  }

  function comPonto(texto) {
    return /[.!?]$/.test(texto) ? texto : texto + '.';
  }

  // Anúncio aria-live do caso parcial: mensagem + as duas metas.
  function montarAnuncioParcial(parcial, nome) {
    return [
      montarMensagemParcial(nome, parcial.faltantes),
      montarMeta('aprovacao', parcial),
      montarMeta('acima', parcial)
    ].map(comPonto).join(' ');
  }

  // Qualquer valor fora da lista vira 'neutro'. O gênero nunca é deduzido do nome.
  function normalizarTratamento(tratamento) {
    return TRATAMENTOS.indexOf(tratamento) >= 0 ? tratamento : 'neutro';
  }

  function montarSaudacao(nome, tratamento) {
    var prefixo = normalizarTratamento(tratamento) === 'feminino' ? 'Prof.ª ' : 'Prof. ';
    return 'Olá, ' + prefixo + nome;
  }

  function rotuloSituacao(classificacao) {
    return classificacao === CLASSIFICACOES[0] ? 'Reprovado' : 'Aprovado';
  }

  function montarMensagem(nome, classificacao, mediaTexto) {
    var aprovado = 'Parabéns ' + nome + ', você foi aprovado com a média final de ' + mediaTexto + '.';
    switch (classificacao) {
      case CLASSIFICACOES[0]:
        return 'Infelizmente ' + nome + ', você foi reprovado com a média final de ' + mediaTexto + '.';
      case CLASSIFICACOES[1]:
        return aprovado + ' Você está na média.';
      case CLASSIFICACOES[2]:
        return aprovado + ' Você está acima da média.';
      case CLASSIFICACOES[3]:
        return aprovado + ' Você é um gênio!';
      default:
        return '';
    }
  }

  // Congela o valor e tudo o que há dentro dele: um Lançamento é um registro
  // somente leitura, nunca editado depois de calculado.
  function congelarProfundo(valor) {
    if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
      Object.freeze(valor);
      Object.keys(valor).forEach(function (chave) {
        congelarProfundo(valor[chave]);
      });
    }
    return valor;
  }

  // Mais recente primeiro, no máximo TAMANHO_HISTORICO; não muta a lista
  // recebida e devolve uma lista congelada.
  function adicionarAoHistorico(lista, lancamento) {
    return Object.freeze([lancamento].concat(lista || []).slice(0, TAMANHO_HISTORICO));
  }

  var HISTORICO_VAZIO = Object.freeze([]);

  function estadoInicial() {
    return {
      tela: 'inicial',
      nomeProfessor: null,
      tratamento: 'neutro',
      resultado: null,
      historico: HISTORICO_VAZIO,
      proximoId: 0
    };
  }

  // Faixas de classificação para a média M (centésimos), do pior ao melhor.
  // `de` e `ate` são a média exibida (truncada): "Na média: 6,00 a 7,99".
  // Faixas vazias (M = 10,00) ficam de fora.
  function faixasDaMedia(M) {
    var l = limitesDaMedia(M);
    var inicios = [0, l.aprovacao, l.acima, l.excelente];
    var chaves = ['reprovado', 'na-media', 'acima', 'excelente'];
    var rotulos = ['Reprovado', 'Na média', 'Acima da média', 'Excelente'];
    var faixas = [];
    for (var i = 0; i < 4; i += 1) {
      var ate = i === 3 ? NOTA_MAXIMA : inicios[i + 1] - 1;
      if (inicios[i] <= ate) {
        faixas.push(Object.freeze({ chave: chaves[i], rotulo: rotulos[i], de: inicios[i], ate: ate }));
      }
    }
    return Object.freeze(faixas);
  }

  // Resumo dos alunos do histórico. A média do grupo usa só os lançamentos
  // completos (com as 3 notas) e é truncada, como a média exibida.
  function resumirHistorico(historico) {
    var lista = historico || [];
    var resumo = { total: lista.length, aprovados: 0, reprovados: 0, emAndamento: 0, mediaGrupo: null };
    var soma = 0;
    var completos = 0;
    lista.forEach(function (l) {
      if (l.parcial === true) {
        resumo.emAndamento += 1;
        return;
      }
      completos += 1;
      soma += l.soma;
      if (rotuloSituacao(l.classificacao) === 'Reprovado') {
        resumo.reprovados += 1;
      } else {
        resumo.aprovados += 1;
      }
    });
    if (completos > 0) {
      resumo.mediaGrupo = Math.floor(soma / (3 * completos));
    }
    return Object.freeze(resumo);
  }

  var CARIMBOS = Object.freeze({
    excelente: 'Excelente',
    acima: 'Acima da média',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    andamento: 'Em andamento'
  });

  // Carimbo decorativo do resultado: { tom, texto } conforme a situação.
  function carimboDoLancamento(lancamento) {
    var tom = 'andamento';
    if (lancamento.parcial !== true) {
      tom = {
        'Reprovado': 'reprovado',
        'Aprovado – na média': 'aprovado',
        'Aprovado – acima da média': 'acima',
        'Aprovado – excelente': 'excelente'
      }[lancamento.classificacao] || 'aprovado';
    }
    return Object.freeze({ tom: tom, texto: CARIMBOS[tom] });
  }

  // Recados para o professor. `autor: ''` indica texto próprio do NotaRápida.
  var FRASES = Object.freeze([
    Object.freeze({ texto: 'Quem ensina aprende ao ensinar, e quem aprende ensina ao aprender.', autor: 'Paulo Freire' }),
    Object.freeze({ texto: 'Ensinar é um exercício de imortalidade.', autor: 'Rubem Alves' }),
    Object.freeze({ texto: 'Feliz aquele que transfere o que sabe e aprende o que ensina.', autor: 'Cora Coralina' }),
    Object.freeze({ texto: 'Se a educação sozinha não transforma a sociedade, sem ela tampouco a sociedade muda.', autor: 'Paulo Freire' }),
    Object.freeze({ texto: 'A leitura do mundo precede sempre a leitura da palavra.', autor: 'Paulo Freire' }),
    Object.freeze({ texto: 'Cada nota lançada é um passo na caminhada de quem aprende. Obrigado por acompanhar essa jornada.', autor: '' }),
    Object.freeze({ texto: 'Obrigado por ensinar: o seu trabalho transforma o futuro de cada aluno.', autor: '' })
  ]);

  function diaDoAno(data) {
    return Math.floor((Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) -
      Date.UTC(data.getFullYear(), 0, 0)) / 86400000);
  }

  // A mesma frase o dia inteiro; muda a cada dia.
  function fraseDoDia(data) {
    return FRASES[diaDoAno(data) % FRASES.length];
  }

  // 15 de outubro.
  function ehDiaDoProfessor(data) {
    return data.getMonth() === 9 && data.getDate() === 15;
  }

  var DIAS_SEMANA = Object.freeze(['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']);
  var MESES = Object.freeze(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']);

  // "Domingo, 4 de outubro" e "Quinta-feira, 1º de outubro". Feita à mão: a
  // primeira chamada de Intl.DateTimeFormat custa dezenas de ms em celulares
  // modestos e travaria a transição de tela.
  function formatarDataExtenso(data) {
    var dia = data.getDate();
    return DIAS_SEMANA[data.getDay()] + ', ' + (dia === 1 ? '1º' : String(dia)) + ' de ' + MESES[data.getMonth()];
  }

  function periodoDoDia(data) {
    var h = data.getHours();
    if (h >= 5 && h < 12) {
      return 'Bom dia';
    }
    return h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  // Cópia rasa do estado com as alterações indicadas (não muta o original).
  function comAlteracoes(estado, alteracoes) {
    var novo = {
      tela: estado.tela,
      nomeProfessor: estado.nomeProfessor,
      tratamento: estado.tratamento,
      resultado: estado.resultado,
      historico: estado.historico,
      proximoId: estado.proximoId
    };
    Object.keys(alteracoes).forEach(function (chave) {
      novo[chave] = alteracoes[chave];
    });
    return novo;
  }

  function ignorado(estado) {
    return { estado: estado, evento: { tipo: 'IGNORADO' } };
  }

  // Transição pura da sessão: devolve { estado, evento } sem mutar argumentos.
  function reduzir(estado, acao) {
    var tipo = acao && acao.tipo;

    if (tipo === 'ENTRAR') {
      if (estado.tela !== 'inicial') {
        return ignorado(estado);
      }
      var nome = validarNomeProfessor(acao.texto);
      if (!nome.ok) {
        return { estado: estado, evento: { tipo: 'NOME_INVALIDO', erro: nome.erro } };
      }
      var novo = estadoInicial();
      novo.tela = 'professor';
      novo.nomeProfessor = nome.nome;
      novo.tratamento = normalizarTratamento(acao.tratamento);
      return { estado: novo, evento: { tipo: 'SESSAO_INICIADA' } };
    }

    if (tipo === 'CALCULAR') {
      if (estado.tela !== 'professor') {
        return ignorado(estado);
      }
      var validacao = validarFormulario(acao.campos);
      if (!validacao.ok) {
        return {
          estado: estado,
          evento: {
            tipo: 'FORMULARIO_INVALIDO',
            erros: validacao.erros,
            primeiroInvalido: validacao.primeiroInvalido
          }
        };
      }
      var notas = validacao.dados.notas.slice();
      var lancamento;
      if (notas.indexOf(null) >= 0) {
        var p = calcularParcial(notas, validacao.dados.mediaAprovacao);
        lancamento = {
          id: estado.proximoId,
          parcial: true,
          nomeAluno: validacao.dados.nomeAluno,
          notas: notas,
          mediaAprovacao: p.mediaAprovacao,
          limites: p.limites,
          faltantes: p.faltantes,
          somaConhecida: p.somaConhecida,
          mediaParcial: p.mediaParcial,
          aprovacao: p.aprovacao,
          acima: p.acima
        };
      } else {
        var calculo = calcular(notas, validacao.dados.mediaAprovacao);
        lancamento = {
          id: estado.proximoId,
          parcial: false,
          nomeAluno: validacao.dados.nomeAluno,
          notas: notas,
          soma: calculo.soma,
          mediaTruncada: calculo.mediaTruncada,
          mediaAprovacao: calculo.mediaAprovacao,
          classificacao: calculo.classificacao,
          posicao: calculo.posicao
        };
      }
      congelarProfundo(lancamento);
      return {
        estado: comAlteracoes(estado, {
          resultado: lancamento,
          historico: adicionarAoHistorico(estado.historico, lancamento),
          proximoId: estado.proximoId + 1
        }),
        evento: { tipo: 'CALCULO_CONCLUIDO', lancamento: lancamento }
      };
    }

    if (tipo === 'LIMPAR_HISTORICO') {
      if (estado.tela !== 'professor') {
        return ignorado(estado);
      }
      return {
        estado: comAlteracoes(estado, { historico: HISTORICO_VAZIO }),
        evento: { tipo: 'HISTORICO_LIMPO', haviaItens: estado.historico.length > 0 }
      };
    }

    if (tipo === 'TROCAR_PROFESSOR') {
      if (estado.tela !== 'professor') {
        return ignorado(estado);
      }
      return { estado: estadoInicial(), evento: { tipo: 'SESSAO_ENCERRADA' } };
    }

    return ignorado(estado);
  }

  return Object.freeze({
    constantes: Object.freeze({
      LIMITE_NOME: LIMITE_NOME,
      LIMITE_CAMPO: LIMITE_CAMPO,
      TAMANHO_HISTORICO: TAMANHO_HISTORICO,
      LIMITES_SOMA: LIMITES_SOMA,
      MEDIA_PADRAO: MEDIA_PADRAO
    }),
    TRATAMENTOS: TRATAMENTOS,
    CLASSIFICACOES: CLASSIFICACOES,
    POSICOES: POSICOES,
    mensagens: mensagens,
    truncarCampo: truncarCampo,
    aparar: aparar,
    contarCaracteres: contarCaracteres,
    lerNota: lerNota,
    formatarCentesimos: formatarCentesimos,
    formatarMedia: formatarMedia,
    validarNomeProfessor: validarNomeProfessor,
    validarNomeAluno: validarNomeAluno,
    validarNota: validarNota,
    validarNotaOpcional: validarNotaOpcional,
    validarMediaAprovacao: validarMediaAprovacao,
    limitesDaMedia: limitesDaMedia,
    validarFormulario: validarFormulario,
    calcular: calcular,
    calcularParcial: calcularParcial,
    listarTrimestres: listarTrimestres,
    montarMeta: montarMeta,
    montarResumoMetas: montarResumoMetas,
    montarMensagemParcial: montarMensagemParcial,
    montarAnuncioParcial: montarAnuncioParcial,
    normalizarTratamento: normalizarTratamento,
    montarSaudacao: montarSaudacao,
    classificarSoma: classificarSoma,
    posicionarSoma: posicionarSoma,
    rotuloSituacao: rotuloSituacao,
    montarMensagem: montarMensagem,
    adicionarAoHistorico: adicionarAoHistorico,
    faixasDaMedia: faixasDaMedia,
    resumirHistorico: resumirHistorico,
    carimboDoLancamento: carimboDoLancamento,
    FRASES: FRASES,
    fraseDoDia: fraseDoDia,
    ehDiaDoProfessor: ehDiaDoProfessor,
    formatarDataExtenso: formatarDataExtenso,
    periodoDoDia: periodoDoDia,
    estadoInicial: estadoInicial,
    reduzir: reduzir
  });
});
