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

  var refs = {};
  var estado = N.estadoInicial();
  var transicao = { emCurso: false, destino: null, animacao: null };
  var animResultado = null;
  var animHistorico = null;
  var anuncioPendente = 0;

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
    refs.resMetas = el('res-metas');
    refs.resMetaAprovacao = el('res-meta-aprovacao');
    refs.resMetaAcima = el('res-meta-acima');
    refs.resMensagem = el('res-mensagem');
    refs.botaoLimpar = el('botao-limpar');
    refs.historicoVazio = el('historico-vazio');
    refs.historicoLista = el('historico-lista');
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

  function atualizarAjudaMedia(centesimos) {
    var l = N.limitesDaMedia(centesimos);
    refs.ajudaMedia.textContent = 'Acima da média a partir de ' + N.formatarCentesimos(l.acima) +
      ' · Excelente a partir de ' + N.formatarCentesimos(l.excelente);
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

  // O tema fica no body para que o fundo da página acompanhe a Tela_do_Professor.
  function aplicarTema(tratamento) {
    var classe = 'tema--' + N.normalizarTratamento(tratamento);
    CLASSES_TEMA.forEach(function (c) {
      document.body.classList.toggle(c, c === classe);
    });
  }

  function lerTratamento() {
    var marcado = refs.formEntrada.querySelector('input[name="tratamento"]:checked');
    return marcado ? marcado.value : 'neutro';
  }

  function restaurarTratamento() {
    refs.tratamentoNeutro.checked = true;
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

  function criarTexto(tag, classe, texto) {
    var no = document.createElement(tag);
    if (classe) {
      no.className = classe;
    }
    no.textContent = texto;
    return no;
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

  function renderResultado(lancamento) {
    var parcial = lancamento.parcial === true;
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
    refs.resMetas.hidden = true;
    refs.resBlocoMedia.hidden = false;
    refs.resBlocoClassificacao.hidden = false;
    refs.resMediaAprovacao.textContent = '';
    refs.resMensagem.textContent = '';
    refs.resultadoConteudo.classList.remove('anim-resultado');
    refs.resultadoConteudo.hidden = true;
    refs.resultadoVazio.hidden = false;
  }

  function criarItem(rotulo) {
    var item = document.createElement('div');
    item.className = 'notas-lista__item';
    item.appendChild(criarTexto('dt', '', rotulo));
    var dd = document.createElement('dd');
    item.appendChild(dd);
    return { item: item, dd: dd };
  }

  function criarItemNota(rotulo, centesimos) {
    var r = criarItem(rotulo);
    preencherNota(r.dd, centesimos);
    return r.item;
  }

  function criarItemTexto(rotulo, valor) {
    var r = criarItem(rotulo);
    r.dd.textContent = valor;
    return r.item;
  }

  function criarLancamento(lancamento) {
    var parcial = lancamento.parcial === true;
    var li = document.createElement('li');
    li.className = parcial ? 'lancamento lancamento--parcial' : 'lancamento';

    li.appendChild(criarTexto('p', 'lancamento__nome', lancamento.nomeAluno));

    var notas = document.createElement('dl');
    notas.className = 'notas-lista lancamento__notas';
    notas.appendChild(criarItemNota('T1', lancamento.notas[0]));
    notas.appendChild(criarItemNota('T2', lancamento.notas[1]));
    notas.appendChild(criarItemNota('T3', lancamento.notas[2]));
    notas.appendChild(parcial
      ? criarItemTexto('Média parcial', N.formatarCentesimos(lancamento.mediaParcial))
      : criarItemTexto('Média', N.formatarMedia(lancamento.soma)));
    li.appendChild(notas);

    var situacao = document.createElement('div');
    situacao.className = 'lancamento__situacao';
    var selo = criarTexto('span', 'selo', parcial ? TEXTO_EM_ANDAMENTO : lancamento.classificacao);
    aplicarCorSelo(selo, lancamento);
    situacao.appendChild(selo);
    if (!parcial) {
      situacao.appendChild(criarTexto('span', 'indicador', lancamento.posicao));
    }
    li.appendChild(situacao);

    if (parcial) {
      li.appendChild(criarTexto('p', 'lancamento__metas', N.montarResumoMetas(lancamento)));
    }

    li.appendChild(criarTexto('p', 'referencia-media lancamento__referencia',
      'Média para aprovação: ' + N.formatarCentesimos(lancamento.mediaAprovacao)));

    return li;
  }

  // Reconstrói a lista; devolve o <li> do Lançamento idNovo (se houver).
  function renderHistorico(historico, idNovo) {
    var itens = [];
    var novo = null;
    historico.forEach(function (lancamento) {
      var li = criarLancamento(lancamento);
      if (lancamento.id === idNovo) {
        novo = li;
      }
      itens.push(li);
    });
    refs.historicoLista.replaceChildren.apply(refs.historicoLista, itens);
    var vazio = historico.length === 0;
    refs.historicoLista.hidden = vazio;
    refs.historicoVazio.hidden = !vazio;
    if (!vazio) {
      refs.historicoVazio.classList.remove('anim-historico');
    }
    return novo;
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
    aplicarTema('neutro');
    restaurarTratamento();
    atualizarAjudaMedia(N.constantes.MEDIA_PADRAO);
    cancelarAnuncio();
    cancelarAnimacoesDeConteudo();
    refs.anuncio.textContent = '';
    refs.saudacao.textContent = '';
    limparResultado();
    renderHistorico([], null);
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
        refs.campos.nomeAluno.focus();
      } else {
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
    var itemNovo = renderHistorico(estado.historico, lancamento.id);
    esvaziarCamposDoAluno();
    limparErrosNotas();
    refs.campos.nomeAluno.focus();
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
    renderHistorico([], null);
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
