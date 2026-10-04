/*
 * NotaRápida – interface.
 * Estado só em variáveis desta IIFE (Memória_da_Aba). Dados digitados entram
 * na página apenas por textContent/createElement/replaceChildren.
 */
(function () {
  'use strict';

  // Anti-quadro sem cabeçalho HTTP (o GitHub Pages não aceita frame-ancestors
  // nem X-Frame-Options). Se o acesso a window.top falhar, trata como quadro.
  function estaEmQuadro() {
    try {
      return window.top !== window.self;
    } catch (erro) {
      return true;
    }
  }

  function bloquearQuadro() {
    document.documentElement.classList.add('em-quadro');
    var aviso = document.getElementById('aviso-quadro');
    if (aviso) {
      aviso.hidden = false;
    }
  }

  if (estaEmQuadro()) {
    document.documentElement.classList.add('em-quadro');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bloquearQuadro);
    } else {
      bloquearQuadro();
    }
    return; // não inicia o NotaRápida
  }

  var N = window.NotaRapida;
  if (!N) {
    return;
  }

  var DUR_TELA = 300;
  var DUR_CURTA = 200;
  var FOLGA_TIMEOUT = 100;
  var TITULO_INICIAL = 'NotaRápida – Entrar';
  var TITULO_PROFESSOR = 'NotaRápida – Lançamento de notas';
  var MEDIA_INICIAL_TEXTO = '6,00';
  var CLASSES_TEMA = ['tema--feminino', 'tema--masculino', 'tema--neutro'];

  // Campos do Formulário_de_Notas, na ordem de validação e de foco.
  var CAMPOS_NOTAS = [
    { chave: 'media', campo: 'campo-media', erro: 'erro-media', ajuda: 'ajuda-media' },
    { chave: 'nomeAluno', campo: 'campo-aluno', erro: 'erro-aluno' },
    { chave: 't1', campo: 'campo-t1', erro: 'erro-t1', ajuda: 'dica-notas' },
    { chave: 't2', campo: 'campo-t2', erro: 'erro-t2', ajuda: 'dica-notas' },
    { chave: 't3', campo: 'campo-t3', erro: 'erro-t3', ajuda: 'dica-notas' }
  ];
  var TEXTO_EM_ANDAMENTO = 'Em andamento';
  var CLASSES_META = ['meta--possivel', 'meta--garantida', 'meta--impossivel'];
  var CLASSES_CARIMBO = ['carimbo--excelente', 'carimbo--acima', 'carimbo--aprovado', 'carimbo--reprovado', 'carimbo--andamento'];
  // A régua desenha a escala de 0 a 10 em 320 unidades (0,032 por centésimo).
  var LARGURA_REGUA = 320;
  var ESCALA_REGUA = LARGURA_REGUA / 1000;
  var SEGMENTOS_REGUA = ['reprovado', 'na-media', 'acima', 'excelente'];

  var refs = {};
  var estado = N.estadoInicial();
  var transicao = { emCurso: false, destino: null, animacao: null };
  var animResultado = null;
  var animHistorico = null;
  var anuncioPendente = 0;
  var mediaDaLegenda = null;

  function el(id) {
    return document.getElementById(id);
  }

  function obterRefs() {
    refs.telaInicial = el('tela-inicial');
    refs.telaProfessor = el('tela-professor');
    refs.formEntrada = el('form-entrada');
    refs.campoProfessor = el('campo-professor');
    refs.erroProfessor = el('erro-professor');
    refs.tratamentoNeutro = el('tratamento-neutro');
    refs.saudacao = el('saudacao');
    refs.saudacaoPeriodo = el('saudacao-periodo');
    refs.homenagem = el('homenagem');
    refs.recadoTexto = el('recado-texto');
    refs.recadoRodape = el('recado-rodape');
    refs.recadoAutor = el('recado-autor');
    refs.formNotas = el('form-notas');
    refs.ajudaMedia = el('ajuda-media');
    refs.campos = {};
    refs.erros = {};
    refs.ajudas = {};
    CAMPOS_NOTAS.forEach(function (c) {
      refs.campos[c.chave] = el(c.campo);
      refs.erros[c.chave] = el(c.erro);
      refs.ajudas[c.chave] = c.ajuda || '';
    });
    refs.painelResultado = el('painel-resultado');
    refs.resMediaAprovacao = el('res-media-aprovacao');
    refs.resultadoVazio = el('resultado-vazio');
    refs.resultadoConteudo = el('resultado-conteudo');
    refs.resAluno = el('res-aluno');
    refs.resSelo = el('res-selo');
    refs.resPosicao = el('res-posicao');
    refs.resMedia = el('res-media');
    refs.resT1 = el('res-t1');
    refs.resT2 = el('res-t2');
    refs.resT3 = el('res-t3');
    refs.resClassificacao = el('res-classificacao');
    refs.resBlocoMedia = el('res-bloco-media');
    refs.resBlocoClassificacao = el('res-bloco-classificacao');
    refs.resCarimbo = el('res-carimbo');
    refs.resCarimboTexto = el('res-carimbo-texto');
    refs.resRegua = {};
    SEGMENTOS_REGUA.forEach(function (chave) {
      refs.resRegua[chave] = el('reg-' + chave);
    });
    refs.resReguaMarcador = el('reg-marcador');
    refs.resReguaRotulo = el('res-regua-rotulo');
    refs.resFaixas = el('res-faixas');
    refs.resMetas = el('res-metas');
    refs.resMetaAprovacao = el('res-meta-aprovacao');
    refs.resMetaAcima = el('res-meta-acima');
    refs.resMensagem = el('res-mensagem');
    refs.botaoLimpar = el('botao-limpar');
    refs.historicoVazio = el('historico-vazio');
    refs.historicoTabela = el('historico-tabela');
    refs.historicoCorpo = el('historico-corpo');
    refs.resumo = el('resumo');
    refs.resumoNota = el('resumo-nota');
    refs.sumTotal = el('sum-total');
    refs.sumAprovados = el('sum-aprovados');
    refs.sumReprovados = el('sum-reprovados');
    refs.sumAndamento = el('sum-andamento');
    refs.sumMedia = el('sum-media');
    refs.botaoTrocar = el('botao-trocar');
    refs.anuncio = el('anuncio');
  }

  // ---------- Controlador de animação ----------

  // Aplica a classe, espera animationend (do próprio elemento) ou o timeout de
  // segurança. A finalização roda uma única vez. cancelar() encerra sem callback.
  function animar(elemento, classe, duracao, aoTerminar) {
    var encerrada = false;
    var timeout = 0;

    function desligar() {
      encerrada = true;
      window.clearTimeout(timeout);
      elemento.removeEventListener('animationend', aoFimDaAnimacao);
      elemento.classList.remove(classe);
    }

    function finalizar() {
      if (encerrada) {
        return;
      }
      desligar();
      if (aoTerminar) {
        aoTerminar();
      }
    }

    function aoFimDaAnimacao(evento) {
      if (evento.target === elemento) {
        finalizar();
      }
    }

    elemento.classList.remove(classe);
    void elemento.offsetWidth; // força reflow para reiniciar a animação
    elemento.classList.add(classe);
    elemento.addEventListener('animationend', aoFimDaAnimacao);
    timeout = window.setTimeout(finalizar, duracao + FOLGA_TIMEOUT);

    return {
      finalizar: finalizar,
      cancelar: function () {
        if (!encerrada) {
          desligar();
        }
      }
    };
  }

  function cancelarAnimacoesDeConteudo() {
    if (animResultado) {
      animResultado.cancelar();
      animResultado = null;
    }
    if (animHistorico) {
      animHistorico.cancelar();
      animHistorico = null;
    }
  }

  // ---------- Erros de campo ----------

  // idAjuda (opcional): texto de ajuda que continua associado ao campo.
  function mostrarErro(campo, mensagemEl, texto, idAjuda) {
    mensagemEl.textContent = texto;
    mensagemEl.hidden = false;
    campo.setAttribute('aria-invalid', 'true');
    campo.setAttribute('aria-describedby', idAjuda ? mensagemEl.id + ' ' + idAjuda : mensagemEl.id);
  }

  function limparErro(campo, mensagemEl, idAjuda) {
    mensagemEl.textContent = '';
    mensagemEl.hidden = true;
    campo.removeAttribute('aria-invalid');
    if (idAjuda) {
      campo.setAttribute('aria-describedby', idAjuda);
    } else {
      campo.removeAttribute('aria-describedby');
    }
  }

  function limparErroProfessor() {
    limparErro(refs.campoProfessor, refs.erroProfessor);
  }

  function limparErrosNotas() {
    CAMPOS_NOTAS.forEach(function (c) {
      limparErro(refs.campos[c.chave], refs.erros[c.chave], refs.ajudas[c.chave]);
    });
  }

  function mostrarErrosNotas(erros) {
    CAMPOS_NOTAS.forEach(function (c) {
      if (Object.prototype.hasOwnProperty.call(erros, c.chave)) {
        mostrarErro(refs.campos[c.chave], refs.erros[c.chave], erros[c.chave], refs.ajudas[c.chave]);
      }
    });
  }

  // Todos os campos, inclusive a média (fim de sessão).
  function esvaziarCamposNotas() {
    CAMPOS_NOTAS.forEach(function (c) {
      refs.campos[c.chave].value = '';
    });
  }

  // Após o cálculo: só aluno e notas; a média para aprovação permanece.
  function esvaziarCamposDoAluno() {
    CAMPOS_NOTAS.forEach(function (c) {
      if (c.chave !== 'media') {
        refs.campos[c.chave].value = '';
      }
    });
  }

  // ---------- Média para aprovação e tema ----------

  function criarTexto(tag, classe, texto) {
    var no = document.createElement(tag);
    if (classe) {
      no.className = classe;
    }
    no.textContent = texto;
    return no;
  }

  // Legenda das faixas para a média M: "Na média  6,00 a 7,99" etc.
  function preencherFaixas(lista, centesimos) {
    var itens = N.faixasDaMedia(centesimos).map(function (faixa) {
      var li = document.createElement('li');
      li.className = 'faixas__item faixas__item--' + faixa.chave;
      var ponto = document.createElement('span');
      ponto.className = 'faixas__ponto';
      ponto.setAttribute('aria-hidden', 'true');
      var texto = document.createElement('span');
      texto.appendChild(criarTexto('span', 'faixas__nome', faixa.rotulo));
      texto.appendChild(criarTexto('span', 'faixas__intervalo',
        N.formatarCentesimos(faixa.de) + ' a ' + N.formatarCentesimos(faixa.ate)));
      li.appendChild(ponto);
      li.appendChild(texto);
      return li;
    });
    lista.replaceChildren.apply(lista, itens);
  }

  // Redesenha só quando a média muda: digitar não recria a lista a cada tecla.
  function atualizarAjudaMedia(centesimos) {
    if (centesimos === mediaDaLegenda) {
      return;
    }
    mediaDaLegenda = centesimos;
    preencherFaixas(refs.ajudaMedia, centesimos);
  }

  // Atualiza a ajuda só com valor válido; inválido mantém o último texto válido.
  function aoDigitarMedia() {
    var v = N.validarMediaAprovacao(refs.campos.media.value);
    if (v.ok) {
      atualizarAjudaMedia(v.centesimos);
    }
  }

  function prepararMediaInicial() {
    refs.campos.media.value = MEDIA_INICIAL_TEXTO;
    atualizarAjudaMedia(N.constantes.MEDIA_PADRAO);
  }

  function trocarClasseDeTema(elemento, tratamento) {
    var classe = 'tema--' + N.normalizarTratamento(tratamento);
    CLASSES_TEMA.forEach(function (c) {
      elemento.classList.toggle(c, c === classe);
    });
  }

  // O tema vai para o body (o fundo da página acompanha a Tela_do_Professor) e
  // também para a própria tela. Ao sair, o body volta ao neutro na hora, mas a
  // tela do professor mantém as suas cores até desaparecer: nada recalcula nem
  // repinta durante o fade-out.
  function aplicarTema(tratamento) {
    trocarClasseDeTema(document.body, tratamento);
    trocarClasseDeTema(refs.telaProfessor, tratamento);
  }

  function aplicarTemaDaPagina(tratamento) {
    trocarClasseDeTema(document.body, tratamento);
  }

  function lerTratamento() {
    var marcado = refs.formEntrada.querySelector('input[name="tratamento"]:checked');
    return marcado ? marcado.value : 'neutro';
  }

  function restaurarTratamento() {
    refs.tratamentoNeutro.checked = true;
  }

  // ---------- Cabeçalho da Tela_do_Professor ----------

  // Período do dia, data, recado do dia e, em 15 de outubro, a homenagem.
  function prepararCabecalho(data) {
    refs.saudacaoPeriodo.textContent = N.periodoDoDia(data) + ' · ' + N.formatarDataExtenso(data);
    var frase = N.fraseDoDia(data);
    refs.recadoTexto.textContent = '“' + frase.texto + '”';
    refs.recadoAutor.textContent = frase.autor;
    refs.recadoRodape.hidden = frase.autor === '';
    refs.homenagem.hidden = !N.ehDiaDoProfessor(data);
  }

  function limparCabecalho() {
    refs.saudacaoPeriodo.textContent = '';
    refs.recadoTexto.textContent = '';
    refs.recadoAutor.textContent = '';
    refs.recadoRodape.hidden = true;
    refs.homenagem.hidden = true;
  }

  // ---------- Renderização ----------

  // Selo: aprovado, reprovado ou "Em andamento" (resultado parcial).
  function aplicarCorSelo(elemento, lancamento) {
    var andamento = lancamento.parcial === true;
    var reprovado = !andamento && N.rotuloSituacao(lancamento.classificacao) === 'Reprovado';
    elemento.classList.toggle('selo--andamento', andamento);
    elemento.classList.toggle('selo--reprovado', reprovado);
    elemento.classList.toggle('selo--aprovado', !andamento && !reprovado);
  }

  // Nota informada → "7,50"; faltante → "—" (lido como "sem nota").
  function preencherNota(dd, centesimos) {
    if (centesimos === null) {
      var traco = criarTexto('span', 'nota-faltante', '—');
      traco.setAttribute('aria-hidden', 'true');
      dd.replaceChildren(traco, criarTexto('span', 'visualmente-oculto', 'sem nota'));
    } else {
      dd.textContent = N.formatarCentesimos(centesimos);
    }
  }

  function aplicarMeta(li, tipo, lancamento) {
    var status = lancamento[tipo].status;
    li.textContent = N.montarMeta(tipo, lancamento);
    CLASSES_META.forEach(function (c) {
      li.classList.toggle(c, c === 'meta--' + status);
    });
  }

  function textoMensagem(lancamento) {
    if (lancamento.parcial) {
      return N.montarMensagemParcial(lancamento.nomeAluno, lancamento.faltantes);
    }
    return N.montarMensagem(lancamento.nomeAluno, lancamento.classificacao, N.formatarMedia(lancamento.soma));
  }

  function textoAnuncio(lancamento) {
    if (lancamento.parcial) {
      return N.montarAnuncioParcial(lancamento, lancamento.nomeAluno);
    }
    return textoMensagem(lancamento);
  }

  // Posiciona as quatro faixas e a seta (só atributos SVG, nada de estilo).
  function desenharRegua(lancamento) {
    var parcial = lancamento.parcial === true;
    var valor = parcial ? lancamento.mediaParcial : lancamento.mediaTruncada;
    var faixas = N.faixasDaMedia(lancamento.mediaAprovacao);
    SEGMENTOS_REGUA.forEach(function (chave) {
      var rect = refs.resRegua[chave];
      var faixa = faixas.filter(function (f) { return f.chave === chave; })[0];
      var x = 0;
      var largura = 0;
      if (faixa) {
        x = faixa.de * ESCALA_REGUA;
        largura = Math.min(faixa.ate + 1, 1000) * ESCALA_REGUA - x;
      }
      rect.setAttribute('x', String(x));
      rect.setAttribute('width', String(largura));
    });
    var posicao = Math.min(Math.max(valor, 0), 1000) * ESCALA_REGUA;
    refs.resReguaMarcador.setAttribute('transform', 'translate(' + posicao + ' 0)');
    refs.resReguaRotulo.textContent = (parcial ? 'A seta marca a média parcial: ' : 'A seta marca a média final: ') +
      N.formatarCentesimos(valor) + ' em uma escala de 0 a 10.';
  }

  function aplicarCarimbo(lancamento) {
    var c = N.carimboDoLancamento(lancamento);
    CLASSES_CARIMBO.forEach(function (classe) {
      refs.resCarimbo.classList.toggle(classe, classe === 'carimbo--' + c.tom);
    });
    refs.resCarimboTexto.textContent = c.texto;
  }

  function renderResultado(lancamento) {
    var parcial = lancamento.parcial === true;
    desenharRegua(lancamento);
    aplicarCarimbo(lancamento);
    preencherFaixas(refs.resFaixas, lancamento.mediaAprovacao);
    refs.resAluno.textContent = lancamento.nomeAluno;
    aplicarCorSelo(refs.resSelo, lancamento);
    preencherNota(refs.resT1, lancamento.notas[0]);
    preencherNota(refs.resT2, lancamento.notas[1]);
    preencherNota(refs.resT3, lancamento.notas[2]);
    refs.resMediaAprovacao.textContent = N.formatarCentesimos(lancamento.mediaAprovacao);
    refs.resMensagem.textContent = textoMensagem(lancamento);

    if (parcial) {
      refs.resSelo.textContent = TEXTO_EM_ANDAMENTO;
      refs.resPosicao.textContent = 'Média parcial ' + N.formatarCentesimos(lancamento.mediaParcial);
      refs.resMedia.textContent = '';
      refs.resClassificacao.textContent = '';
      aplicarMeta(refs.resMetaAprovacao, 'aprovacao', lancamento);
      aplicarMeta(refs.resMetaAcima, 'acima', lancamento);
    } else {
      refs.resSelo.textContent = N.rotuloSituacao(lancamento.classificacao);
      refs.resPosicao.textContent = lancamento.posicao;
      refs.resMedia.textContent = N.formatarMedia(lancamento.soma);
      refs.resClassificacao.textContent = lancamento.classificacao;
      refs.resMetaAprovacao.textContent = '';
      refs.resMetaAcima.textContent = '';
    }
    refs.resBlocoMedia.hidden = parcial;
    refs.resBlocoClassificacao.hidden = parcial;
    refs.resMetas.hidden = !parcial;
    refs.resultadoVazio.hidden = true;
    refs.resultadoConteudo.hidden = false;
  }

  function limparResultado() {
    refs.resAluno.textContent = '';
    refs.resSelo.textContent = '';
    refs.resSelo.classList.remove('selo--aprovado', 'selo--reprovado', 'selo--andamento');
    refs.resPosicao.textContent = '';
    refs.resMedia.textContent = '';
    refs.resT1.textContent = '';
    refs.resT2.textContent = '';
    refs.resT3.textContent = '';
    refs.resClassificacao.textContent = '';
    refs.resMetaAprovacao.textContent = '';
    refs.resMetaAcima.textContent = '';
    refs.resCarimboTexto.textContent = '';
    CLASSES_CARIMBO.forEach(function (classe) {
      refs.resCarimbo.classList.remove(classe);
    });
    refs.resReguaRotulo.textContent = '';
    refs.resFaixas.replaceChildren();
    refs.resMetas.hidden = true;
    refs.resBlocoMedia.hidden = false;
    refs.resBlocoClassificacao.hidden = false;
    refs.resMediaAprovacao.textContent = '';
    refs.resMensagem.textContent = '';
    refs.resultadoConteudo.classList.remove('anim-resultado');
    refs.resultadoConteudo.hidden = true;
    refs.resultadoVazio.hidden = false;
  }

  // Células do histórico: texto puro (nunca campos editáveis). O atributo
  // data-rotulo dá o nome da coluna quando a tabela vira lista de fichas.
  function criarCelula(tag, rotulo, classe) {
    var c = document.createElement(tag);
    c.className = classe;
    if (rotulo) {
      c.setAttribute('data-rotulo', rotulo);
    }
    return c;
  }

  function criarCelulaNota(rotulo, centesimos) {
    var td = criarCelula('td', rotulo, 'lancamento__nota');
    preencherNota(td, centesimos);
    return td;
  }

  // Uma linha da tabela somente leitura: um aluno consultado.
  function criarLancamento(lancamento) {
    var parcial = lancamento.parcial === true;
    var tr = document.createElement('tr');
    tr.className = parcial ? 'lancamento lancamento--parcial' : 'lancamento';

    var nome = criarCelula('th', '', 'lancamento__nome');
    nome.setAttribute('scope', 'row');
    nome.textContent = lancamento.nomeAluno;
    tr.appendChild(nome);

    tr.appendChild(criarCelulaNota('T1', lancamento.notas[0]));
    tr.appendChild(criarCelulaNota('T2', lancamento.notas[1]));
    tr.appendChild(criarCelulaNota('T3', lancamento.notas[2]));

    var media = criarCelula('td', parcial ? 'Média parcial' : 'Média', 'lancamento__media');
    media.textContent = parcial ? N.formatarCentesimos(lancamento.mediaParcial) : N.formatarMedia(lancamento.soma);
    if (parcial) {
      media.appendChild(criarTexto('span', 'lancamento__parcial', 'parcial'));
    }
    tr.appendChild(media);

    var situacao = criarCelula('td', 'Situação', 'lancamento__celula-situacao');
    var selos = document.createElement('div');
    selos.className = 'lancamento__situacao';
    var selo = criarTexto('span', 'selo', parcial ? TEXTO_EM_ANDAMENTO : lancamento.classificacao);
    aplicarCorSelo(selo, lancamento);
    selos.appendChild(selo);
    if (!parcial) {
      selos.appendChild(criarTexto('span', 'indicador', lancamento.posicao));
    }
    situacao.appendChild(selos);
    if (parcial) {
      situacao.appendChild(criarTexto('p', 'lancamento__metas', N.montarResumoMetas(lancamento)));
    }
    tr.appendChild(situacao);

    var aprovacao = criarCelula('td', 'Média para aprovação', 'lancamento__aprovacao');
    aprovacao.textContent = N.formatarCentesimos(lancamento.mediaAprovacao);
    tr.appendChild(aprovacao);

    return tr;
  }

  function renderResumo(historico) {
    var r = N.resumirHistorico(historico);
    refs.sumTotal.textContent = String(r.total);
    refs.sumAprovados.textContent = String(r.aprovados);
    refs.sumReprovados.textContent = String(r.reprovados);
    refs.sumAndamento.textContent = String(r.emAndamento);
    refs.sumMedia.textContent = r.mediaGrupo === null ? '—' : N.formatarCentesimos(r.mediaGrupo);
    var vazio = r.total === 0;
    refs.resumo.hidden = vazio;
    refs.resumoNota.hidden = vazio;
  }

  // Esvazia a tabela e o resumo (limpar o histórico, trocar de professor).
  function esvaziarHistorico() {
    refs.historicoCorpo.replaceChildren();
    refs.historicoTabela.hidden = true;
    refs.historicoVazio.hidden = false;
    renderResumo([]);
  }

  // Coloca só a linha do Lançamento novo no topo e descarta as que passam do
  // limite; as demais linhas não são recriadas (nada pisca, e um texto
  // selecionado para copiar continua selecionado).
  function inserirNoHistorico(lancamento) {
    var tr = criarLancamento(lancamento);
    refs.historicoCorpo.insertBefore(tr, refs.historicoCorpo.firstChild);
    while (refs.historicoCorpo.children.length > N.constantes.TAMANHO_HISTORICO) {
      refs.historicoCorpo.removeChild(refs.historicoCorpo.lastChild);
    }
    refs.historicoTabela.hidden = false;
    refs.historicoVazio.hidden = true;
    refs.historicoVazio.classList.remove('anim-historico');
    return tr;
  }

  // Em telas de toque, focar um campo abre o teclado virtual: ele cobriria o
  // resultado e o navegador rolaria de volta ao campo. Nesses aparelhos o foco
  // não é movido sozinho para "Nome do aluno" (a pessoa toca no campo quando quiser).
  function ehTelaDeToque() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  }

  function movimentoReduzido() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Em telas estreitas o resultado fica abaixo do formulário e sairia da tela:
  // leva o painel até ele. Onde os dois cabem lado a lado, não rola.
  function revelarResultado() {
    var topo = refs.painelResultado.getBoundingClientRect().top;
    var altura = window.innerHeight || document.documentElement.clientHeight;
    if (topo > altura * 0.6) {
      refs.painelResultado.scrollIntoView({ behavior: movimentoReduzido() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function cancelarAnuncio() {
    if (anuncioPendente) {
      window.cancelAnimationFrame(anuncioPendente);
      anuncioPendente = 0;
    }
  }

  // Esvazia e escreve no próximo quadro, para que uma mensagem igual à
  // anterior também seja lida pelas tecnologias assistivas.
  function anunciar(texto) {
    cancelarAnuncio();
    refs.anuncio.textContent = '';
    anuncioPendente = window.requestAnimationFrame(function () {
      anuncioPendente = 0;
      refs.anuncio.textContent = texto;
    });
  }

  // Remove do DOM todos os dados da sessão (saudação, resultado, histórico,
  // anúncio, os campos e as mensagens de erro) e volta ao tratamento e tema neutros.
  function limparDadosDaPagina() {
    aplicarTemaDaPagina('neutro');
    restaurarTratamento();
    atualizarAjudaMedia(N.constantes.MEDIA_PADRAO);
    cancelarAnuncio();
    cancelarAnimacoesDeConteudo();
    refs.anuncio.textContent = '';
    refs.saudacao.textContent = '';
    limparCabecalho();
    limparResultado();
    esvaziarHistorico();
    refs.historicoVazio.classList.remove('anim-historico');
    refs.campoProfessor.value = '';
    limparErroProfessor();
    esvaziarCamposNotas();
    limparErrosNotas();
  }

  // ---------- Transição_de_Tela ----------

  function trocarTela(destino) {
    var entra = destino === 'professor' ? refs.telaProfessor : refs.telaInicial;
    var sai = destino === 'professor' ? refs.telaInicial : refs.telaProfessor;

    transicao.emCurso = true;
    transicao.destino = destino;

    // A tela que sai deixa de receber foco e acionamentos desde o início.
    sai.setAttribute('inert', '');
    entra.removeAttribute('inert');
    entra.hidden = false;
    document.title = destino === 'professor' ? TITULO_PROFESSOR : TITULO_INICIAL;
    window.scrollTo(0, 0);

    entra.classList.remove('tela--saindo');
    sai.classList.remove('tela--entrando');
    sai.classList.remove('tela--saindo');
    void sai.offsetWidth;
    sai.classList.add('tela--saindo');

    transicao.animacao = animar(entra, 'tela--entrando', DUR_TELA, function () {
      sai.hidden = true;
      sai.classList.remove('tela--saindo');
      transicao.emCurso = false;
      transicao.destino = null;
      transicao.animacao = null;
      if (destino === 'professor') {
        refs.campoProfessor.value = '';
        restaurarTratamento();
        limparErroProfessor();
        if (!ehTelaDeToque()) {
          refs.campos.nomeAluno.focus();
        }
      } else {
        trocarClasseDeTema(refs.telaProfessor, 'neutro');
        refs.campoProfessor.focus();
      }
    });
  }

  // ---------- Controladores ----------

  function aoEnviarEntrada(evento) {
    evento.preventDefault();
    if (transicao.emCurso) {
      return;
    }
    var r = N.reduzir(estado, {
      tipo: 'ENTRAR',
      texto: N.truncarCampo(refs.campoProfessor.value),
      tratamento: lerTratamento()
    });
    if (r.evento.tipo === 'NOME_INVALIDO') {
      limparErroProfessor();
      mostrarErro(refs.campoProfessor, refs.erroProfessor, r.evento.erro);
      refs.campoProfessor.focus();
      return;
    }
    if (r.evento.tipo !== 'SESSAO_INICIADA') {
      return;
    }
    estado = r.estado;
    limparErroProfessor();
    refs.saudacao.textContent = N.montarSaudacao(estado.nomeProfessor, estado.tratamento);
    prepararCabecalho(new Date());
    prepararMediaInicial();
    limparErrosNotas();
    aplicarTema(estado.tratamento);
    trocarTela('professor');
  }

  function aoEnviarNotas(evento) {
    evento.preventDefault();
    var campos = {};
    CAMPOS_NOTAS.forEach(function (c) {
      campos[c.chave] = N.truncarCampo(refs.campos[c.chave].value);
    });
    var r = N.reduzir(estado, { tipo: 'CALCULAR', campos: campos });

    if (r.evento.tipo === 'FORMULARIO_INVALIDO') {
      limparErrosNotas();
      mostrarErrosNotas(r.evento.erros);
      refs.campos[r.evento.primeiroInvalido].focus();
      return;
    }
    if (r.evento.tipo !== 'CALCULO_CONCLUIDO') {
      return;
    }

    estado = r.estado;
    var lancamento = r.evento.lancamento;

    // Conteúdo final primeiro; animações depois (Req. 14.4).
    renderResultado(lancamento);
    var itemNovo = inserirNoHistorico(lancamento);
    renderResumo(estado.historico);
    esvaziarCamposDoAluno();
    limparErrosNotas();
    if (ehTelaDeToque()) {
      var emUso = document.activeElement;
      if (emUso && emUso.tagName === 'INPUT') {
        emUso.blur(); // fecha o teclado virtual para o resultado ficar à vista
      }
    } else {
      refs.campos.nomeAluno.focus({ preventScroll: true });
    }
    revelarResultado();
    anunciar(textoAnuncio(lancamento));

    cancelarAnimacoesDeConteudo();
    animResultado = animar(refs.resultadoConteudo, 'anim-resultado', DUR_CURTA, function () {
      animResultado = null;
    });
    if (itemNovo) {
      animHistorico = animar(itemNovo, 'anim-historico', DUR_CURTA, function () {
        animHistorico = null;
      });
    }
  }

  function aoLimparHistorico() {
    var r = N.reduzir(estado, { tipo: 'LIMPAR_HISTORICO' });
    if (r.evento.tipo !== 'HISTORICO_LIMPO') {
      return;
    }
    estado = r.estado;
    if (!r.evento.haviaItens) {
      return; // nada muda, sem animação (Req. 9.9, 10.15)
    }
    if (animHistorico) {
      animHistorico.cancelar();
      animHistorico = null;
    }
    esvaziarHistorico();
    animHistorico = animar(refs.historicoVazio, 'anim-historico', DUR_CURTA, function () {
      animHistorico = null;
    });
  }

  function aoTrocarProfessor() {
    if (transicao.emCurso && transicao.destino === 'inicial') {
      return; // acionamento repetido durante a própria transição (Req. 12.4)
    }
    if (estado.tela !== 'professor') {
      return;
    }
    if (transicao.emCurso && transicao.destino === 'professor') {
      // Cancela a entrada em andamento (Req. 12.6).
      if (transicao.animacao) {
        transicao.animacao.cancelar();
      }
      transicao.emCurso = false;
      transicao.destino = null;
      transicao.animacao = null;
    }
    // Dados descartados antes do início da transição (Req. 3.1, 3.6, 3.7).
    estado = N.reduzir(estado, { tipo: 'TROCAR_PROFESSOR' }).estado;
    limparDadosDaPagina();
    trocarTela('inicial');
  }

  // ---------- Ciclo de vida ----------

  // O primeiro layout da Tela_do_Professor custa caro em celulares modestos
  // (fontes e texto ainda não foram usados): ~6x mais que os seguintes. Faz esse
  // layout uma vez, em ociosidade e na mesma tarefa em que a tela é ocultada de
  // novo, fora do fluxo e invisível. Nada é pintado nem lido por leitores de tela.
  function aquecerTelaDoProfessor() {
    var tela = refs.telaProfessor;
    if (estado.tela !== 'inicial' || transicao.emCurso || !tela.hidden) {
      return;
    }
    tela.classList.add('tela--aquecendo');
    tela.hidden = false;
    void tela.offsetHeight; // força o layout agora, e não no clique em "Entrar"
    tela.hidden = true;
    tela.classList.remove('tela--aquecendo');
  }

  function agendarAquecimento() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(aquecerTelaDoProfessor, { timeout: 2000 });
    } else {
      window.setTimeout(aquecerTelaDoProfessor, 600);
    }
  }

  // Volta à Tela_Inicial vazia, sem animação.
  function restaurarTelaInicial(focar) {
    if (transicao.animacao) {
      transicao.animacao.cancelar();
    }
    transicao = { emCurso: false, destino: null, animacao: null };
    estado = N.estadoInicial();
    limparDadosDaPagina();

    refs.telaProfessor.classList.remove('tela--entrando', 'tela--saindo');
    refs.telaInicial.classList.remove('tela--entrando', 'tela--saindo');
    trocarClasseDeTema(refs.telaProfessor, 'neutro');
    refs.telaProfessor.hidden = true;
    refs.telaProfessor.setAttribute('inert', '');
    refs.telaInicial.hidden = false;
    refs.telaInicial.removeAttribute('inert');
    document.title = TITULO_INICIAL;

    if (focar) {
      refs.campoProfessor.focus();
    }
  }

  function iniciar() {
    obterRefs();
    refs.formEntrada.addEventListener('submit', aoEnviarEntrada);
    refs.formNotas.addEventListener('submit', aoEnviarNotas);
    refs.campos.media.addEventListener('input', aoDigitarMedia);
    refs.botaoLimpar.addEventListener('click', aoLimparHistorico);
    refs.botaoTrocar.addEventListener('click', aoTrocarProfessor);

    window.addEventListener('pagehide', function () {
      restaurarTelaInicial(false);
    });
    window.addEventListener('pageshow', function (evento) {
      if (evento.persisted) {
        restaurarTelaInicial(true);
      }
    });

    // Esvazia campos restaurados pelo navegador (duplicar/reabrir aba).
    restaurarTelaInicial(true);
    agendarAquecimento();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
