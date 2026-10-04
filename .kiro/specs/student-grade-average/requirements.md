# Requirements Document

## Introduction

O NotaRápida é um site para cálculo da média final de alunos de colégio público. O site evolui o script `AulaPython-TRABALHOCONCLUIDO.py`, mantendo as regras de classificação dele (com a média de aprovação 6 como padrão configurável), mas trabalhando com três notas trimestrais (T1, T2 e T3) em vez de quatro notas bimestrais.

O fluxo do site tem duas telas:

1. **Tela_Inicial (home page):** o Usuário informa o nome do professor, escolhe como prefere ser chamado (Professora, Professor ou Prefiro não informar) e aciona "Entrar".
2. **Tela_do_Professor:** tela personalizada com saudação e cores conforme o Tratamento, onde o professor informa a média para aprovação (6,00 por padrão), o nome do aluno e as notas trimestrais, recebe a média final, a situação (aprovado ou reprovado) e a posição do aluno em relação à média (abaixo, na média ou acima) e consulta os 5 últimos lançamentos. Com um ou dois trimestres em branco, recebe um resultado parcial com a nota necessária no que falta para a aprovação e para ficar acima da média.

O nome do professor serve apenas para identificar e personalizar a tela. A entrada na Tela_do_Professor **não é uma autenticação**: não há senha, conta de usuário nem servidor. Todos os dados (nome do professor, Tratamento, média para aprovação, nomes dos alunos e notas) ficam somente na memória da aba aberta e são apagados ao acionar "Trocar professor", ao recarregar ou ao fechar a página.

O site será usado por muitos professores, cada um no próprio navegador. Como todo o processamento ocorre no navegador e não há servidor de aplicação nem banco de dados, cada aba funciona de forma isolada e o número de professores simultâneos não afeta o tempo de resposta.

Os Requisitos 1 a 13 são funcionais. Os Requisitos 14 a 22 são não funcionais.

### Escopo desta fase

Esta fase cobre a interface e o funcionamento do site executado localmente (abrindo os arquivos no navegador ou com um servidor local simples) e a publicação no GitHub Pages. O workflow do GitHub Actions `.github/workflows/pages.yml` executa `npm ci` e `npm test` a cada push na branch `main` e, se os testes passarem, publica somente a pasta `site/`, servida por HTTPS com o certificado do `github.io`. O GitHub Pages não permite cabeçalhos HTTP personalizados: a Política_de_Segurança_de_Conteúdo fica no elemento meta, a proteção contra quadros fica no script e o arquivo `site/_headers` vale somente para Netlify ou Cloudflare Pages. Domínio próprio está fora do escopo. Os requisitos marcados com "WHERE o NotaRápida for hospedado" valem para a publicação no GitHub Pages ou em outro provedor.

### Correção em relação ao script original

O script original usa quatro notas bimestrais. A pedido do usuário, esta versão usa três notas trimestrais e calcula a média como (T1 + T2 + T3) / 3.

No script original, o `match` avalia `media_final >= 6` antes de `>= 8` e `>= 9`. Como o primeiro caso verdadeiro encerra o `match`, as mensagens "acima da média" e "gênio" nunca são exibidas. Estes requisitos definem faixas sem sobreposição (Requisito 6), derivadas da média de aprovação configurável (Requisito 12), que com a média 6 reproduzem os limites 6, 8 e 9 do script e preservam a intenção original das quatro mensagens. O caso "Valor inválido" do script passa a ser tratado pela validação de entrada (Requisito 5).

Como a divisão por 3 pode gerar dízimas (ex.: (5,99 + 6 + 6) / 3 = 5,99666...), a Classificação usa o valor exato da média, sem arredondamento, e a exibição trunca a média em 2 casas decimais (Requisitos 6 e 8).

### Suposições a confirmar

1. **Armazenamento só em memória:** o padrão escolhido é manter os dados apenas na memória da aba, por privacidade. Ao recarregar a aba, o professor volta à Tela_Inicial e precisa digitar o nome de novo. A alternativa seria usar sessionStorage para manter o nome do professor ao recarregar a aba, com menor privacidade em computadores compartilhados.
2. **"Trocar professor" sem confirmação:** o botão apaga os dados imediatamente, sem pedir confirmação.
3. **Referências de desempenho:** os tempos dos Requisitos 14 a 17 são medidos no Dispositivo_de_Referência e na Conexão_4G_Típica definidos no Glossário.
4. **Até 5 abas simultâneas no mesmo dispositivo:** o Requisito 18, critério 10, usa esse limite como referência de teste.

## Glossary

- **NotaRápida**: O site de cálculo de média descrito neste documento.
- **Usuário**: Pessoa que utiliza o NotaRápida, normalmente um professor.
- **Professor**: Usuário identificado pelo Nome_do_Professor durante uma Sessão_do_Professor.
- **Nome_do_Professor**: Texto informado na Tela_Inicial, sem os espaços em branco do início e do fim, usado somente para personalizar a Tela_do_Professor. O Nome_do_Professor não é credencial de acesso.
- **Tela_Inicial**: Tela exibida ao carregar o NotaRápida, com o campo "Nome do professor", o grupo de opções de Tratamento e o botão "Entrar".
- **Tela_do_Professor**: Tela personalizada exibida após a entrada, com a saudação ao Professor, o aviso de privacidade, o Formulário_de_Notas, o Painel_de_Resultado, o Histórico_Recente e o botão "Trocar professor".
- **Sessão_do_Professor**: Período que começa quando o Validador aprova o Nome_do_Professor e termina quando o Usuário aciona "Trocar professor", recarrega a aba, fecha a aba ou sai da página.
- **Memória_da_Aba**: Memória volátil do navegador associada exclusivamente a uma aba aberta do NotaRápida (variáveis JavaScript), descartada quando a aba é recarregada ou fechada.
- **Armazenamento_Persistente**: Qualquer mecanismo que mantenha dados fora da Memória_da_Aba ou depois do fechamento da aba: cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers, arquivos ou servidores.
- **Formulário_de_Notas**: Componente da Tela_do_Professor onde o Usuário digita, em cinco campos, a Média_de_Aprovação, o nome do aluno e as três Notas_Trimestrais (T1, T2 e T3).
- **Validador**: Componente do NotaRápida que verifica se o Nome_do_Professor e os dados digitados no Formulário_de_Notas são válidos.
- **Leitor_de_Nota**: Componente do NotaRápida que converte o texto digitado em um campo de nota ou no campo "Média para aprovação" para um valor numérico.
- **Formatador_de_Nota**: Componente do NotaRápida que converte um valor numérico de nota ou média em texto para exibição.
- **Calculadora_de_Média**: Componente do NotaRápida que calcula a Média_Final, a Classificação e a Posição_em_Relação_à_Média ou, com Notas_Faltantes, o Resultado_Parcial.
- **Painel_de_Resultado**: Área da Tela_do_Professor que exibe o resultado do último cálculo.
- **Histórico_Recente**: Lista mantida apenas na Memória_da_Aba, contendo no máximo 5 Lançamentos da Sessão_do_Professor atual.
- **Lançamento**: Registro composto pelo nome do aluno, as Notas_Trimestrais informadas, a Média_de_Aprovação usada e, conforme o caso, a Média_Final, a Classificação e a Posição_em_Relação_à_Média (cálculo completo) ou o Resultado_Parcial (com Notas_Faltantes).
- **Nota_Trimestral**: Nota de um trimestre (T1, T2 ou T3), um número entre 0 e 10, inclusive, com no máximo 2 casas decimais.
- **Média_Final**: Valor exato de (T1 + T2 + T3) / 3, que pode ter infinitas casas decimais (ex.: 5,99666...).
- **Classificação**: Situação do aluno determinada pela Média_Final e pela Média_de_Aprovação, conforme as faixas do Requisito 6: "Reprovado", "Aprovado – na média", "Aprovado – acima da média" ou "Aprovado – excelente".
- **Posição_em_Relação_à_Média**: Indicador derivado da Média_Final e da Média_de_Aprovação: "Abaixo da média", "Na média" ou "Acima da média", conforme o Requisito 6.
- **Tratamento**: Forma de tratamento escolhida na Tela_Inicial: "feminino" (opção "Professora"), "masculino" (opção "Professor") ou "neutro" (opção "Prefiro não informar"). O Tratamento nunca é deduzido do Nome_do_Professor.
- **Tema_Visual**: Paleta de cores da Tela_do_Professor e do fundo da página associada ao Tratamento, conforme o Requisito 11, critério 7.
- **Média_de_Aprovação (M)**: Valor do campo "Média para aprovação", de 1 a 10, inclusive, com no máximo 2 casas decimais (6,00 por padrão), usado como limite de aprovação. Nos cálculos, M, A e E são tratados em centésimos inteiros (ex.: 6,00 = 600).
- **Limite_Acima (A)**: Limite a partir do qual a média fica acima da média: A = floor((M + 1000) / 2), em centésimos.
- **Limite_Excelente (E)**: Limite a partir do qual a média é excelente: E = floor((M + 3000) / 4), em centésimos.
- **Nota_Faltante**: Campo de nota (T1, T2 ou T3) vazio ou com apenas espaços em branco no envio, quando ao menos um dos outros dois campos de nota está preenchido.
- **Resultado_Parcial**: Resultado de um envio aprovado com 1 ou 2 Notas_Faltantes, composto pela média parcial e pelas duas Metas, sem Média_Final, Classificação nem Posição_em_Relação_à_Média.
- **Meta**: Para um alvo X (M na meta de aprovação, A na meta acima da média), a menor nota n, igual em cada trimestre faltante, que faz a soma das três notas alcançar 3X, ou o estado "garantida" (alvo já alcançado) ou "impossível" (alvo inalcançável mesmo com 10 em cada trimestre faltante).
- **Guia_Visual**: Conjunto documentado de cores (paleta), famílias e tamanhos de fonte (tipografia) e valores de espaçamento usados em todas as telas do NotaRápida.
- **Transição_de_Tela**: Animação exibida na troca entre a Tela_Inicial e a Tela_do_Professor, nos dois sentidos.
- **Animação_de_Resultado**: Animação exibida quando o Painel_de_Resultado apresenta um novo resultado.
- **Animação_de_Histórico**: Animação exibida quando um Lançamento é inserido ou removido do Histórico_Recente.
- **Movimento_Reduzido**: Preferência do sistema operacional ou do navegador que solicita menos movimento na interface (media query `prefers-reduced-motion: reduce`).
- **Interativa**: Estado de uma tela que está visível, com o foco no campo principal da tela, aceitando digitação e com os botões respondendo ao acionamento.
- **Dispositivo_de_Referência**: Computador com processador de 2 núcleos e 4 GB de memória RAM, ou celular Android com 3 GB de memória RAM, executando um dos navegadores do Requisito 21, critério 6.
- **Conexão_4G_Típica**: Conexão de rede com latência de ida e volta de 150 ms e velocidade de download de 1,6 Mbps.
- **Política_de_Segurança_de_Conteúdo**: Política Content-Security-Policy declarada pelo NotaRápida, que define de quais origens o navegador pode carregar e executar recursos.
- **Workflow_de_Publicação**: Workflow do GitHub Actions `.github/workflows/pages.yml`, que testa e publica a pasta `site/` no GitHub Pages.

## Requirements

### Requirement 1: Tela inicial e identificação do professor

**User Story:** Como professor, quero informar meu nome na página inicial, para acessar uma tela personalizada de lançamento de notas.

#### Acceptance Criteria

1. WHEN a página do NotaRápida é carregada, THE NotaRápida SHALL exibir a Tela_Inicial com o título visível "NotaRápida", um campo de texto vazio com o rótulo visível "Nome do professor", o grupo de opções de Tratamento do Requisito 11, critério 1, o botão "Entrar", o aviso "O seu nome é usado apenas para personalizar a tela e não é salvo.", nenhuma mensagem de erro e o título do documento "NotaRápida – Entrar".
2. WHEN a Tela_Inicial é exibida, seja no carregamento da página ou ao final da Transição_de_Tela iniciada pelo botão "Trocar professor", THE NotaRápida SHALL posicionar o foco no campo "Nome do professor".
3. WHEN o Usuário aciona o botão "Entrar" por clique, por toque ou pelas teclas Enter e Espaço com o foco no botão, ou pressiona Enter com o foco no campo "Nome do professor", THE Validador SHALL verificar o Nome_do_Professor sem recarregar a página e sem aguardar nenhuma resposta de rede.
4. IF o nome do professor estiver vazio ou contiver apenas caracteres de espaço em branco (espaço, tabulação ou quebra de linha) (ex.: "" ou "   "), THEN THE Validador SHALL exibir a mensagem "Informe o nome do professor." junto ao campo "Nome do professor".
5. IF o nome do professor tiver mais de 100 caracteres depois de removidos os espaços em branco do início e do fim, contando cada letra (acentuada ou não), espaço interno, número ou sinal como 1 caractere, THEN THE Validador SHALL exibir a mensagem "O nome deve ter no máximo 100 caracteres." junto ao campo "Nome do professor" (ex.: um nome com 101 caracteres é reprovado; um nome com 100 caracteres cercado de espaços no início e no fim é aprovado).
6. IF o Validador reprovar o nome do professor, THEN THE NotaRápida SHALL manter a Tela_Inicial exibida, manter no campo o texto exatamente como foi digitado, posicionar o foco no campo "Nome do professor", não registrar o Nome_do_Professor na Memória_da_Aba e não iniciar a Sessão_do_Professor.
7. WHEN o Validador aprova o nome do professor, THE NotaRápida SHALL registrar na Memória_da_Aba o Nome_do_Professor sem os espaços em branco do início e do fim, preservando os espaços internos, iniciar a Sessão_do_Professor e substituir a Tela_Inicial pela Tela_do_Professor por meio da Transição_de_Tela, nos tempos definidos no Requisito 15, critério 1.
8. THE NotaRápida SHALL identificar o Professor somente pelo Nome_do_Professor, sem solicitar senha, sem criar conta de usuário e sem consultar servidor para permitir a entrada na Tela_do_Professor.
9. WHEN o Usuário envia o nome do professor por um dos acionamentos do critério 3, THE Validador SHALL remover a mensagem de erro da tentativa anterior antes de exibir a mensagem resultante da nova validação, mantendo a mensagem anterior visível enquanto o Usuário edita o campo, até esse novo envio.
10. WHEN o Validador exibe uma mensagem de erro junto ao campo "Nome do professor", THE NotaRápida SHALL associar a mensagem ao campo para que as tecnologias assistivas leiam a mensagem quando o campo receber o foco.
11. THE Validador SHALL aprovar o nome do professor que tiver de 1 a 100 caracteres depois de removidos os espaços em branco do início e do fim, contados como no critério 5, aceitando qualquer combinação de letras acentuadas ou não, números, espaços internos e sinais (ex.: "Ana", "José D'Ávila", "Prof. 2", "<b>Ana</b>").
12. THE Tela_Inicial SHALL aceitar no campo "Nome do professor" a digitação ou colagem de até 1.000 caracteres, sem bloquear nem truncar o texto dentro desse limite antes da verificação pelo Validador, conforme o Requisito 20, critério 4.

### Requirement 2: Tela personalizada do professor

**User Story:** Como professor, quero uma tela com meu nome, para saber que estou na minha área de lançamento de notas.

#### Acceptance Criteria

1. WHEN a Tela_do_Professor é exibida, THE Tela_do_Professor SHALL exibir a saudação "Olá, Prof.ª {nome}" ou "Olá, Prof. {nome}", conforme o Tratamento (Requisito 11, critério 5), como o primeiro texto da tela, acima do aviso do critério 2 e do Formulário_de_Notas, e identificá-la para as tecnologias assistivas como o título principal da Tela_do_Professor. {nome} é o Nome_do_Professor completo, com até 100 caracteres, sem truncamento nem reticências e com quebra em mais de uma linha quando não couber em uma só.
2. THE Tela_do_Professor SHALL exibir, entre a saudação e o Formulário_de_Notas, o aviso "Os dados não são salvos. O nome do professor, os nomes dos alunos e as notas ficam apenas nesta aba e são apagados ao trocar de professor, recarregar ou fechar a página. Apenas os 5 últimos lançamentos aparecem." como texto visível desde a exibição da tela, sem exigir ação do Usuário e sem opção de ocultar o aviso.
3. THE Tela_do_Professor SHALL exibir o Formulário_de_Notas, o Painel_de_Resultado e o Histórico_Recente na disposição definida no Requisito 10, critérios 4 e 5, e exibir o botão "Trocar professor" visível e acionável durante toda a Sessão_do_Professor.
4. WHEN a Tela_do_Professor é exibida após a aprovação do Nome_do_Professor, THE Tela_do_Professor SHALL exibir o Formulário_de_Notas com os cinco campos sem mensagens de erro, o campo "Média para aprovação" preenchido com "6,00" (Requisito 12, critério 2) e os demais campos vazios, o Painel_de_Resultado com a indicação do Requisito 7, critério 8, e o Histórico_Recente vazio com a mensagem "Nenhuma nota lançada ainda.".
5. WHEN a Tela_do_Professor é exibida após a aprovação do Nome_do_Professor, THE NotaRápida SHALL posicionar o foco no campo "Nome do aluno" ao final da Transição_de_Tela, inclusive com o Movimento_Reduzido ativo, em até 1 segundo após o acionamento de "Entrar", conforme o Requisito 15, critério 1.
6. IF o Nome_do_Professor contiver acentos, apóstrofos, sinais de marcação ou outros caracteres especiais (ex.: "José D'Ávila", "<b>Ana</b>"), THEN THE Tela_do_Professor SHALL exibir o Nome_do_Professor na saudação literalmente como texto, com os mesmos caracteres e na mesma ordem em que foi registrado, sem interpretar nenhum conteúdo como marcação ou código.
7. WHILE a Tela_do_Professor estiver exibida, THE NotaRápida SHALL ocultar a Tela_Inicial visualmente e para as tecnologias assistivas e retirar o campo "Nome do professor" e o botão "Entrar" da ordem de foco pelo teclado.
8. WHILE a Tela_Inicial estiver exibida, THE NotaRápida SHALL ocultar a Tela_do_Professor visualmente e para as tecnologias assistivas e retirar todos os campos e botões da Tela_do_Professor da ordem de foco pelo teclado.
9. WHILE a Sessão_do_Professor estiver ativa, THE Tela_do_Professor SHALL manter a saudação com o mesmo Nome_do_Professor, sem alteração após cálculos, validações com erro ou o acionamento do botão "Limpar histórico".

### Requirement 3: Troca de professor

**User Story:** Como professor que divide o computador da escola com colegas, quero encerrar meu uso com um botão, para que o próximo professor não veja meus dados.

#### Acceptance Criteria

1. WHEN o Usuário aciona o botão "Trocar professor", THE NotaRápida SHALL, sem pedir confirmação e antes do início da Transição_de_Tela, descartar da Memória_da_Aba o Nome_do_Professor, o resultado do último cálculo exibido no Painel_de_Resultado, o Tratamento, os valores digitados nos cinco campos do Formulário_de_Notas, as mensagens de erro exibidas e todos os Lançamentos do Histórico_Recente, inclusive quando algum desses itens estiver vazio ou quando nenhum cálculo tiver sido concluído na Sessão_do_Professor.
2. WHEN o Usuário aciona o botão "Trocar professor", THE NotaRápida SHALL substituir a Tela_do_Professor pela Tela_Inicial por meio da Transição_de_Tela, exibindo a Tela_Inicial Interativa dentro do tempo definido no Requisito 15, critério 2, com o campo "Nome do professor" vazio, sem mensagem de erro e com o foco no campo "Nome do professor" ao final da Transição_de_Tela.
3. WHEN o Validador aprova o Nome_do_Professor em uma nova Sessão_do_Professor iniciada na mesma aba após o acionamento de "Trocar professor", THE Tela_do_Professor SHALL exibir a saudação somente com o novo Nome_do_Professor e o novo Tratamento, o Formulário_de_Notas com os cinco campos sem mensagens de erro, o campo "Média para aprovação" com "6,00" e os demais campos vazios, o Painel_de_Resultado com a indicação do Requisito 7, critério 8, e o Histórico_Recente vazio com a mensagem "Nenhuma nota lançada ainda.", inclusive quando o novo Nome_do_Professor for idêntico ao anterior.
4. FOR ALL sequências de Sessões_do_Professor na mesma aba separadas pelo acionamento de "Trocar professor", THE NotaRápida SHALL exibir em cada Sessão_do_Professor somente o Nome_do_Professor, o resultado do Painel_de_Resultado e os Lançamentos produzidos nessa mesma Sessão_do_Professor, inclusive quando duas Sessões_do_Professor tiverem o mesmo Nome_do_Professor (propriedade de modelo).
5. THE NotaRápida SHALL permitir acionar o botão "Trocar professor" por clique, por toque ou pelas teclas Enter e Espaço quando o botão estiver com o foco, em qualquer momento da Sessão_do_Professor, inclusive com campos preenchidos, com mensagens de erro exibidas ou durante a Animação_de_Resultado ou a Animação_de_Histórico.
6. WHEN o Usuário aciona o botão "Trocar professor", THE NotaRápida SHALL remover do conteúdo da página, inclusive das partes ocultas e dos textos destinados a tecnologias assistivas, a saudação com o Nome_do_Professor, o resultado do Painel_de_Resultado, as mensagens de erro e os Lançamentos do Histórico_Recente, de modo que nenhum desses dados possa ser lido na Tela_Inicial, pela inspeção da página ou por tecnologias assistivas.
7. WHEN o Usuário aciona o botão "Trocar professor", THE NotaRápida SHALL executar somente a Transição_de_Tela, sem executar a Animação_de_Resultado nem a Animação_de_Histórico pela remoção dos Lançamentos e sem anunciar resultado para tecnologias assistivas, encerrando qualquer Animação_de_Resultado ou Animação_de_Histórico que estiver em execução.

### Requirement 4: Lançamento de notas

**User Story:** Como professor, quero informar o nome do aluno e as três notas trimestrais, para obter a média final do aluno.

#### Acceptance Criteria

1. THE Formulário_de_Notas SHALL exibir, nesta ordem, o campo "Média para aprovação" do Requisito 12, um campo de texto para o nome do aluno com o rótulo visível "Nome do aluno" e três campos de nota com os rótulos visíveis "T1", "T2" e "T3".
2. THE Formulário_de_Notas SHALL exibir, após os três campos de nota, um botão com o texto "Calcular média" que possa ser acionado por clique, por toque ou pelas teclas Enter e Espaço quando o botão estiver com o foco.
3. WHEN o Usuário aciona o botão "Calcular média", THE Validador SHALL verificar a Média_de_Aprovação, o nome do aluno e as três Notas_Trimestrais conforme as regras dos Requisitos 5, 12 e 13, avaliando os cinco campos no mesmo acionamento, mesmo quando um campo anterior for inválido.
4. WHEN o Validador aprova a Média_de_Aprovação, o nome do aluno e as três Notas_Trimestrais, THE Calculadora_de_Média SHALL calcular a Média_Final, a Classificação e a Posição_em_Relação_à_Média uma única vez por acionamento, ou o Resultado_Parcial quando houver Notas_Faltantes (Requisito 13), usando o nome sem espaços no início e no fim e os valores numéricos produzidos pelo Leitor_de_Nota, dentro dos tempos definidos no Requisito 14.
5. WHEN o Usuário pressiona a tecla Enter com o foco em qualquer um dos cinco campos do Formulário_de_Notas, THE Formulário_de_Notas SHALL executar a mesma validação e o mesmo cálculo realizados pelo acionamento do botão "Calcular média".
6. WHEN um Lançamento é adicionado ao Histórico_Recente, THE Formulário_de_Notas SHALL esvaziar o campo "Nome do aluno" e os três campos de nota, manter o texto do campo "Média para aprovação", remover as mensagens de erro exibidas e posicionar o foco no campo "Nome do aluno", mantendo o resultado exibido no Painel_de_Resultado.
7. WHEN o Usuário envia o Formulário_de_Notas pelo botão "Calcular média" ou pela tecla Enter, THE NotaRápida SHALL processar o envio sem recarregar a página e sem remover nem alterar os Lançamentos já presentes no Histórico_Recente, exceto pelas inclusões e remoções definidas no Requisito 9.
8. THE Formulário_de_Notas SHALL aceitar a digitação de qualquer caractere nos campos de nota e no campo "Média para aprovação", incluindo vírgula e ponto, e de até 1.000 caracteres em cada campo, sem bloquear nem truncar o texto digitado dentro desse limite antes da verificação pelo Validador.

### Requirement 5: Validação dos dados de entrada

**User Story:** Como professor, quero ser avisado quando digitar um dado inválido, para não gerar uma média incorreta.

#### Acceptance Criteria

1. IF o nome do aluno estiver vazio ou contiver apenas caracteres de espaço em branco (espaço, tabulação ou quebra de linha), THEN THE Validador SHALL exibir a mensagem "Informe o nome do aluno." junto ao campo do nome do aluno.
2. IF o nome do aluno tiver mais de 100 caracteres depois de removidos os espaços em branco do início e do fim, contando cada letra (acentuada ou não), espaço interno, número ou sinal como 1 caractere, THEN THE Validador SHALL exibir a mensagem "O nome deve ter no máximo 100 caracteres." junto ao campo do nome do aluno.
3. IF um campo de nota (T1, T2 ou T3) estiver vazio ou contiver apenas caracteres de espaço em branco, THEN THE Validador SHALL aplicar a regra de Notas_Faltantes do Requisito 13: tratar o campo como Nota_Faltante, sem mensagem de erro, quando ao menos um dos outros dois campos de nota estiver preenchido, e exibir "Informe ao menos uma nota." somente junto ao campo T1 quando os três campos de nota estiverem vazios.
4. IF o Leitor_de_Nota retornar erro de conversão para o texto não vazio de um campo de nota (ex.: "abc", "7a", "7,5,1"), THEN THE Validador SHALL exibir a mensagem "Digite um número válido (ex.: 7,5)." junto ao campo de nota correspondente.
5. IF o valor convertido pelo Leitor_de_Nota for menor que 0 ou maior que 10, THEN THE Validador SHALL exibir a mensagem "A nota deve estar entre 0 e 10." junto ao campo de nota correspondente, considerando os limites 0 e 10 (ex.: "0", "10", "10,00") como válidos.
6. IF o texto de um campo de nota tiver mais de 2 dígitos depois do separador decimal (vírgula ou ponto), THEN THE Validador SHALL exibir a mensagem "Use no máximo 2 casas decimais." junto ao campo de nota correspondente (ex.: "7,555" e "7,500" são rejeitados; "7,5" e "7,55" são aceitos).
7. IF o Validador encontrar um ou mais dados inválidos, THEN THE NotaRápida SHALL manter nos campos os valores exatamente como foram digitados, exibir ao mesmo tempo as mensagens de erro de todos os campos inválidos, não acionar a Calculadora_de_Média e manter o Histórico_Recente e o Painel_de_Resultado inalterados.
8. IF o Validador encontrar dados inválidos, THEN THE Formulário_de_Notas SHALL posicionar o foco no primeiro campo inválido, seguindo a ordem: Média para aprovação, nome do aluno, T1, T2, T3.
9. THE Validador SHALL remover os espaços em branco do início e do fim do nome do aluno, preservando os espaços internos, antes de validar o nome e de repassá-lo para o registro no Lançamento.
10. THE Validador SHALL exibir no máximo 1 mensagem de erro por campo, avaliando as regras de cada campo de nota preenchido nesta ordem: erro de conversão (critério 4), intervalo de 0 a 10 (critério 5) e casas decimais (critério 6), avaliando o campo "Média para aprovação" na ordem do Requisito 12, critério 5, e exibindo somente a mensagem da primeira regra violada.
11. WHEN o Usuário envia o Formulário_de_Notas (pelo botão "Calcular média" ou pela tecla Enter), THE Validador SHALL remover todas as mensagens de erro da tentativa anterior antes de exibir as mensagens resultantes da nova validação.
12. WHEN o Validador exibe uma mensagem de erro junto a um campo, THE Formulário_de_Notas SHALL associar a mensagem a esse campo para que as tecnologias assistivas leiam a mensagem quando o campo receber o foco.

### Requirement 6: Cálculo da média e classificação

**User Story:** Como professor, quero que a média e a situação do aluno sigam as regras da escola, para comunicar o resultado corretamente.

#### Acceptance Criteria

1. WHEN o Validador aprova as três Notas_Trimestrais, THE Calculadora_de_Média SHALL calcular a Média_Final como o valor exato de (T1 + T2 + T3) / 3, sem arredondamento nem truncamento (ex.: as notas 5,99; 6 e 6 produzem a Média_Final 5,99666...).
2. WHEN a Calculadora_de_Média calcula uma soma S das três Notas_Trimestrais, em centésimos inteiros, menor que 3M, THE Calculadora_de_Média SHALL atribuir a Classificação "Reprovado" (ex., com M = 6,00: as notas 0; 0; 0 e as notas 5,99; 6; 6 recebem "Reprovado").
3. WHEN a Calculadora_de_Média calcula uma soma S maior ou igual a 3M e menor que 3A, THE Calculadora_de_Média SHALL atribuir a Classificação "Aprovado – na média" (ex., com M = 6,00: as notas 6; 6; 6 e as notas 7,99; 8; 8 recebem "Aprovado – na média").
4. WHEN a Calculadora_de_Média calcula uma soma S maior ou igual a 3A e menor que 3E, THE Calculadora_de_Média SHALL atribuir a Classificação "Aprovado – acima da média" (ex., com M = 6,00: as notas 8; 8; 8 e as notas 8,99; 9; 9 recebem "Aprovado – acima da média").
5. WHEN a Calculadora_de_Média calcula uma soma S maior ou igual a 3E, THE Calculadora_de_Média SHALL atribuir a Classificação "Aprovado – excelente" (ex., com M = 6,00: as notas 9; 9; 9 e as notas 10; 10; 10 recebem "Aprovado – excelente").
6. THE Calculadora_de_Média SHALL determinar a Classificação a partir do valor exato da Média_Final, independentemente do texto exibido pelo Formatador_de_Nota, comparando a soma S em centésimos inteiros com 3M, 3A e 3E (1800, 2400 e 2700 quando M = 6,00), com M, A e E definidos no Requisito 12, critério 6.
7. WHEN a Calculadora_de_Média atribui uma Classificação, THE Calculadora_de_Média SHALL atribuir a Posição_em_Relação_à_Média "Abaixo da média" para S menor que 3M, "Na média" para S maior ou igual a 3M e menor que 3A, e "Acima da média" para S maior ou igual a 3A.
8. FOR ALL conjuntos de três Notas_Trimestrais válidas (entre 0 e 10, inclusive, com no máximo 2 casas decimais), THE Calculadora_de_Média SHALL produzir uma Média_Final maior ou igual à menor Nota_Trimestral e menor ou igual à maior Nota_Trimestral (propriedade invariante).
9. FOR ALL conjuntos de três Notas_Trimestrais válidas, THE Calculadora_de_Média SHALL produzir a mesma Média_Final, a mesma Classificação e a mesma Posição_em_Relação_à_Média para qualquer uma das 6 ordens possíveis das três notas (propriedade de confluência).
10. FOR ALL Médias_Finais entre 0 e 10, inclusive, e Médias_de_Aprovação válidas, THE Calculadora_de_Média SHALL atribuir exatamente uma Classificação dentre "Reprovado", "Aprovado – na média", "Aprovado – acima da média" e "Aprovado – excelente", correspondente à faixa definida nos critérios 2 a 5, e exatamente uma Posição_em_Relação_à_Média correspondente à faixa definida no critério 7 (propriedade invariante).
11. FOR ALL conjuntos de três Notas_Trimestrais válidas, THE Calculadora_de_Média SHALL produzir uma Média_Final cujo produto por 3 seja exatamente igual a T1 + T2 + T3, em comparação exata sem erro de ponto flutuante (ex.: em centésimos inteiros) (propriedade de ida e volta).
12. FOR ALL pares de conjuntos válidos calculados com a mesma Média_de_Aprovação em que cada Nota_Trimestral do segundo conjunto seja maior ou igual à Nota_Trimestral correspondente do primeiro, THE Calculadora_de_Média SHALL atribuir ao segundo conjunto uma Média_Final maior ou igual e uma Classificação igual ou superior, na ordem "Reprovado" < "Aprovado – na média" < "Aprovado – acima da média" < "Aprovado – excelente" (propriedade metamórfica).
13. FOR ALL conjuntos de três Notas_Trimestrais válidas, THE Calculadora_de_Média SHALL atribuir uma Classificação cuja faixa contenha também o valor numérico do texto da Média_Final produzido pelo Formatador_de_Nota (ex.: a Média_Final 5,99666... é exibida como "5,99" e recebe "Reprovado") (propriedade invariante).

### Requirement 7: Exibição do resultado

**User Story:** Como professor, quero ver o resultado do cálculo de forma clara, para informar o aluno sobre a situação dele.

#### Acceptance Criteria

1. WHEN a Calculadora_de_Média conclui um cálculo com as três Notas_Trimestrais, THE Painel_de_Resultado SHALL substituir integralmente o resultado anterior, inclusive um Resultado_Parcial, e exibir o nome do aluno sem os espaços do início e do fim, as três Notas_Trimestrais identificadas como "T1", "T2" e "T3" e formatadas pelo Formatador_de_Nota (2 casas decimais, vírgula como separador decimal), a Média_Final formatada pelo Formatador_de_Nota, o texto da Classificação e o texto da Posição_em_Relação_à_Média exatamente como definidos no Requisito 6.
2. WHEN a Calculadora_de_Média conclui um cálculo com a Classificação "Reprovado", THE Painel_de_Resultado SHALL exibir a mensagem "Infelizmente {nome}, você foi reprovado com a média final de {média}.", em que {nome} é o nome do aluno sem os espaços do início e do fim e {média} é a Média_Final formatada pelo Formatador_de_Nota (ex.: "5,99").
3. WHEN a Calculadora_de_Média conclui um cálculo com a Classificação "Aprovado – na média", THE Painel_de_Resultado SHALL exibir a mensagem "Parabéns {nome}, você foi aprovado com a média final de {média}. Você está na média.", com {nome} e {média} definidos como no critério 2.
4. WHEN a Calculadora_de_Média conclui um cálculo com a Classificação "Aprovado – acima da média", THE Painel_de_Resultado SHALL exibir a mensagem "Parabéns {nome}, você foi aprovado com a média final de {média}. Você está acima da média.", com {nome} e {média} definidos como no critério 2.
5. WHEN a Calculadora_de_Média conclui um cálculo com a Classificação "Aprovado – excelente", THE Painel_de_Resultado SHALL exibir a mensagem "Parabéns {nome}, você foi aprovado com a média final de {média}. Você é um gênio!", com {nome} e {média} definidos como no critério 2.
6. THE Painel_de_Resultado SHALL exibir junto à mensagem de resultado o rótulo textual "Reprovado" para a Classificação "Reprovado" ou o rótulo textual "Aprovado" para as três Classificações de aprovação, apresentando o rótulo "Reprovado" em uma cor diferente da cor usada, de forma idêntica, para as três Classificações de aprovação, com contraste mínimo de 4,5:1 entre o texto e o fundo, conforme o Requisito 21.
7. THE Painel_de_Resultado SHALL exibir junto ao rótulo do critério 6 o indicador textual da Posição_em_Relação_à_Média ("Abaixo da média", "Na média" ou "Acima da média"), identificável pelo texto e sem depender apenas da cor.
8. WHILE nenhum cálculo tiver sido concluído na Sessão_do_Professor atual, THE Painel_de_Resultado SHALL exibir somente uma indicação textual de que nenhum resultado foi calculado ainda, sem nome de aluno, Notas_Trimestrais, Média_Final, Classificação ou Posição_em_Relação_à_Média.
9. WHEN o Painel_de_Resultado exibe um novo resultado, THE NotaRápida SHALL anunciar para tecnologias assistivas, uma única vez, a mensagem de resultado completa definida nos critérios 2 a 5 ou, no Resultado_Parcial, a mensagem do Requisito 13, critério 5, seguida das duas Metas dos critérios 6 e 7, cada texto terminado em ponto, sem retirar o foco do campo "Nome do aluno" definido no Requisito 4, critério 6.
10. IF o Validador encontrar um ou mais dados inválidos, THEN THE Painel_de_Resultado SHALL manter inalterado o conteúdo exibido antes do envio (o resultado anterior ou a indicação do critério 8) e THE NotaRápida SHALL não anunciar novo resultado para tecnologias assistivas.
11. IF o nome do aluno contiver acentos, apóstrofos, sinais de marcação ou outros caracteres especiais (ex.: "José D'Ávila", "<b>Ana</b>"), THEN THE Painel_de_Resultado SHALL exibir o nome literalmente como texto, caractere por caractere, sem interpretar nenhum conteúdo como marcação ou código.

### Requirement 8: Leitura e formatação de notas

**User Story:** Como professor de escola brasileira, quero digitar e ler notas com vírgula decimal, para usar o formato numérico que já conheço.

#### Acceptance Criteria

1. WHEN o texto de um campo de nota, após a remoção dos espaços no início e no fim, contém um número com vírgula como separador decimal ou sem separador decimal (ex.: "7,5", "07,25", "7"), THE Leitor_de_Nota SHALL converter o texto no valor numérico correspondente (ex.: 7,5; 7,25; 7).
2. WHEN o texto de um campo de nota, após a remoção dos espaços no início e no fim, contém um número com ponto como separador decimal (ex.: "7.5", "10.0"), THE Leitor_de_Nota SHALL converter o texto no valor numérico correspondente (ex.: 7,5; 10).
3. THE Leitor_de_Nota SHALL remover os espaços e as tabulações no início e no fim do texto de um campo de nota antes da conversão, sem remover espaços entre os caracteres do número.
4. IF o texto de um campo de nota, após a remoção dos espaços no início e no fim, não estiver vazio e não seguir o formato numérico aceito (ex.: "abc", "7,5,0", "7,", ",5", "7 5", "+7", "1e1", "1.000,5"), THEN THE Leitor_de_Nota SHALL retornar um erro de conversão ao Validador, sem produzir valor numérico.
5. THE Formatador_de_Nota SHALL exibir Notas_Trimestrais, Médias_Finais, médias parciais, Médias_de_Aprovação, limites A e E e notas das Metas no Painel_de_Resultado, nas mensagens de resultado e no Histórico_Recente com pelo menos um dígito antes da vírgula, vírgula como separador decimal, exatamente 2 casas decimais e sem separador de milhar (ex.: 7,5 → "7,50"; 10 → "10,00"; 0,5 → "0,50") e, quando a Média_Final tiver mais de 2 casas decimais, descartando as casas excedentes sem arredondamento (ex.: 5,99666... → "5,99"; 6,66666... → "6,66").
6. FOR ALL Notas_Trimestrais válidas (de 0 a 10, inclusive, com no máximo 2 casas decimais), converter com o Leitor_de_Nota o texto produzido pelo Formatador_de_Nota SHALL produzir exatamente o valor numérico original (ex.: 7,5 → "7,50" → 7,5) (propriedade de ida e volta).
7. THE Leitor_de_Nota SHALL reconhecer como formato numérico aceito somente o texto formado, nesta ordem, por: um sinal de menos opcional, um ou mais dígitos de 0 a 9 e, opcionalmente, um único separador decimal (vírgula ou ponto) seguido de um ou mais dígitos de 0 a 9.
8. WHEN o texto de um campo de nota segue o formato numérico aceito mas representa um valor menor que 0, maior que 10 ou com mais de 2 casas decimais (ex.: "-1", "11", "7,555"), THE Leitor_de_Nota SHALL entregar o valor convertido ao Validador, sem retornar erro de conversão, para que o Validador exiba as mensagens dos critérios 5 e 6 do Requisito 5.
9. IF o texto de um campo de nota estiver vazio após a remoção dos espaços no início e no fim, THEN THE Leitor_de_Nota SHALL indicar campo vazio ao Validador, sem retornar erro de conversão, para que o Validador aplique a regra de Notas_Faltantes do critério 3 do Requisito 5 ou, no campo "Média para aprovação", exiba a mensagem de campo vazio do Requisito 12, critério 5.

### Requirement 9: Histórico dos 5 últimos lançamentos

**User Story:** Como professor, quero ver os últimos lançamentos feitos, para conferir rapidamente os resultados recentes durante o uso.

#### Acceptance Criteria

1. WHEN a Calculadora_de_Média conclui um cálculo, THE NotaRápida SHALL adicionar no início do Histórico_Recente um novo Lançamento composto pelo nome do aluno após a remoção de espaços no início e no fim, pelas três Notas_Trimestrais convertidas pelo Leitor_de_Nota, pela Média_Final, pela Classificação e pela Posição_em_Relação_à_Média calculadas, inclusive quando os dados forem idênticos aos de um Lançamento já presente no Histórico_Recente.
2. THE Histórico_Recente SHALL conter no máximo 5 Lançamentos.
3. WHEN um novo Lançamento é adicionado e o Histórico_Recente já contém 5 Lançamentos, THE NotaRápida SHALL remover o Lançamento adicionado há mais tempo, mantendo o Histórico_Recente com exatamente 5 Lançamentos.
4. THE NotaRápida SHALL exibir os Lançamentos do Histórico_Recente do mais recente para o mais antigo, mostrando para cada um o nome completo do aluno sem truncamento, as três Notas_Trimestrais identificadas como "T1", "T2" e "T3" e a Média_Final no formato produzido pelo Formatador_de_Nota (ex.: "7,50"), a Classificação com o mesmo texto atribuído pela Calculadora_de_Média e a Posição_em_Relação_à_Média.
5. WHILE o Histórico_Recente estiver vazio, inclusive ao exibir a Tela_do_Professor e após o acionamento do botão "Limpar histórico", THE NotaRápida SHALL exibir a mensagem "Nenhuma nota lançada ainda." no lugar da lista de Lançamentos.
6. FOR ALL sequências de N Lançamentos adicionados desde o início da Sessão_do_Professor ou desde o último acionamento do botão "Limpar histórico", com N maior ou igual a 0, THE Histórico_Recente SHALL conter exatamente os min(N, 5) Lançamentos mais recentes, na ordem inversa de adição (propriedade de modelo).
7. WHEN o Usuário aciona o botão "Limpar histórico", THE NotaRápida SHALL remover todos os Lançamentos do Histórico_Recente sem alterar o conteúdo do Painel_de_Resultado, o Nome_do_Professor nem os valores digitados no Formulário_de_Notas.
8. THE NotaRápida SHALL exibir o botão "Limpar histórico" na área do Histórico_Recente.
9. IF o Usuário acionar o botão "Limpar histórico" com o Histórico_Recente vazio, THEN THE NotaRápida SHALL manter o Histórico_Recente vazio, continuar exibindo a mensagem "Nenhuma nota lançada ainda." e não exibir mensagem de erro.
10. IF o nome do aluno de um Lançamento contiver sinais de marcação ou outros caracteres especiais, THEN THE NotaRápida SHALL exibir o nome no Histórico_Recente literalmente como texto, sem interpretar nenhum conteúdo como marcação ou código.

### Requirement 10: Interface fluida e profissional

**User Story:** Como professor, quero uma interface limpa, consistente e com transições suaves, para usar o site com conforto e confiança.

#### Acceptance Criteria

1. THE NotaRápida SHALL aplicar na Tela_Inicial e na Tela_do_Professor somente as cores, famílias de fonte, tamanhos de fonte e espaçamentos definidos no Guia_Visual, que especifica, no mínimo, a cor padrão da borda dos campos, a cor de erro, a cor de destaque dos botões sob o ponteiro, a cor do rótulo "Reprovado" e a cor do rótulo "Aprovado".
2. THE NotaRápida SHALL usar na tipografia somente famílias de fonte já instaladas no sistema do Usuário, sem carregar arquivos de fonte, com a lista de fontes terminada em uma família genérica do navegador, de modo que todo texto seja exibido mesmo quando as demais famílias da lista não estiverem instaladas.
3. THE NotaRápida SHALL exibir o bloco da Tela_Inicial formado pelo título "NotaRápida", pelo campo "Nome do professor", pelo botão "Entrar" e pelo aviso de privacidade centralizado horizontalmente na janela de visualização, com diferença de no máximo 2 pixels CSS entre a distância do bloco à borda esquerda e a distância do bloco à borda direita da janela, em larguras de 320 a 1920 pixels CSS.
4. WHILE a largura da janela de visualização for maior ou igual a 1024 pixels CSS, THE Tela_do_Professor SHALL exibir o Formulário_de_Notas à esquerda e o Painel_de_Resultado à direita, lado a lado, e o Histórico_Recente abaixo dos dois.
5. WHILE a largura da janela de visualização for menor que 1024 pixels CSS, THE Tela_do_Professor SHALL exibir o Formulário_de_Notas, o Painel_de_Resultado e o Histórico_Recente em uma única coluna, nesta ordem.
6. WHEN a tela exibida muda entre a Tela_Inicial e a Tela_do_Professor, em qualquer sentido, THE NotaRápida SHALL executar a Transição_de_Tela com a duração definida no Requisito 17, salvo o disposto no critério 11.
7. WHEN o Painel_de_Resultado exibe um novo resultado, inclusive quando os dados forem idênticos aos do resultado anterior, THE NotaRápida SHALL executar a Animação_de_Resultado com a duração definida no Requisito 17, salvo o disposto no critério 11.
8. WHEN um Lançamento é inserido ou removido do Histórico_Recente, incluindo a remoção do Lançamento mais antigo definida no Requisito 9, critério 3, e a remoção pelo botão "Limpar histórico", THE NotaRápida SHALL executar a Animação_de_Histórico com a duração definida no Requisito 17, salvo o disposto no critério 11.
9. WHILE o ponteiro do mouse estiver sobre um botão, THE NotaRápida SHALL exibir o fundo ou a borda do botão na cor de destaque do Guia_Visual, diferente da cor usada quando o ponteiro não está sobre o botão, mantendo o contraste mínimo definido no Requisito 21, critério 5, e voltando à cor anterior quando o ponteiro sair do botão.
10. WHEN o Validador exibe uma mensagem de erro junto a um campo, THE NotaRápida SHALL exibir a borda do campo na cor de erro do Guia_Visual, com contraste mínimo de 3:1 em relação ao fundo adjacente, junto com a mensagem textual de erro, de modo que o erro seja identificável pelo texto, sem depender apenas da cor.
11. WHILE o Movimento_Reduzido estiver ativo, THE NotaRápida SHALL exibir a Transição_de_Tela, a Animação_de_Resultado e a Animação_de_Histórico sem deslocamento, mudança de escala ou rotação de elementos, ou com duração menor ou igual a 0,01 segundo (10 ms), em substituição às durações do Requisito 17.
12. FOR ALL sequências de ações do Usuário, THE NotaRápida SHALL exibir, ao final de cada animação, os mesmos textos, os mesmos elementos visíveis, a mesma ordem dos Lançamentos, as mesmas cores e o mesmo elemento com foco exibidos para a mesma sequência de ações com o Movimento_Reduzido ativo (propriedade invariante).
13. THE NotaRápida SHALL exibir no Histórico_Recente a Classificação de cada Lançamento com a mesma cor usada no Painel_de_Resultado para o rótulo correspondente: a cor do rótulo "Reprovado" para a Classificação "Reprovado" e a cor do rótulo "Aprovado" para as três Classificações de aprovação.
14. WHEN a mensagem de erro de um campo é removida, seja por uma nova validação (Requisito 1, critério 9, e Requisito 5, critério 11), pelo esvaziamento do Formulário_de_Notas (Requisito 4, critério 6) ou pelo acionamento de "Trocar professor" (Requisito 3, critério 1), THE NotaRápida SHALL exibir a borda do campo na cor padrão da borda dos campos do Guia_Visual.
15. IF o Validador encontrar um ou mais dados inválidos, ou o Usuário acionar o botão "Limpar histórico" com o Histórico_Recente vazio, THEN THE NotaRápida SHALL não executar a Animação_de_Resultado nem a Animação_de_Histórico.

### Requirement 11: Tratamento e tema visual

**User Story:** Como professor, quero escolher como prefiro ser chamado, para receber uma saudação adequada e uma tela com cores correspondentes, sem que o site deduza essa escolha pelo meu nome.

#### Acceptance Criteria

1. THE Tela_Inicial SHALL exibir, entre o campo "Nome do professor" e o botão "Entrar", um grupo de opções de escolha única com a legenda visível "Como prefere ser chamado(a)?" e as opções "Professora", "Professor" e "Prefiro não informar", nesta ordem.
2. WHEN a Tela_Inicial é exibida, seja no carregamento da página, ao retornar à página pelo histórico do navegador ou ao final da Transição_de_Tela iniciada por "Trocar professor", THE Tela_Inicial SHALL apresentar selecionada somente a opção "Prefiro não informar".
3. WHEN o Validador aprova o Nome_do_Professor, THE NotaRápida SHALL registrar na Memória_da_Aba o Tratamento da opção selecionada: "feminino" para "Professora", "masculino" para "Professor" e "neutro" para "Prefiro não informar".
4. IF nenhuma opção estiver selecionada ou o valor recebido for diferente de "feminino", "masculino" e "neutro", THEN THE NotaRápida SHALL registrar o Tratamento "neutro".
5. WHEN a Tela_do_Professor é exibida, THE Tela_do_Professor SHALL exibir a saudação "Olá, Prof.ª {nome}" para o Tratamento "feminino" e "Olá, Prof. {nome}" para os Tratamentos "masculino" e "neutro", com {nome} definido como no Requisito 2, critério 1.
6. FOR ALL Nomes_do_Professor válidos e Tratamentos, THE NotaRápida SHALL produzir uma saudação cujo prefixo ("Prof.ª " ou "Prof. ") depende somente do Tratamento e cujo restante é o Nome_do_Professor sem alteração, de modo que dois nomes diferentes com o mesmo Tratamento recebam o mesmo prefixo (propriedade invariante).
7. WHILE a Sessão_do_Professor estiver ativa, THE NotaRápida SHALL aplicar à Tela_do_Professor e ao fundo da página o Tema_Visual do Tratamento registrado: cor primária #A3366F com realce rosa e lilás no cabeçalho para "feminino", cor primária #1E3A5F com realce cinza-azulado no cabeçalho para "masculino" e cor primária #1D4ED8 sem realce no cabeçalho para "neutro".
8. WHILE a Tela_Inicial estiver exibida, inclusive durante a Transição_de_Tela de saída, THE Tela_Inicial SHALL usar as cores do Tema_Visual neutro, independentemente da opção selecionada no grupo de Tratamento.
9. THE NotaRápida SHALL usar nos três Temas_Visuais as mesmas cores para o rótulo "Aprovado", o rótulo "Reprovado", o selo "Em andamento" e as mensagens e bordas de erro.
10. WHEN a Sessão_do_Professor termina, por "Trocar professor", recarga, fechamento ou saída da página, THE NotaRápida SHALL descartar o Tratamento, mantido até então somente na Memória_da_Aba, e aplicar o Tema_Visual neutro, de modo que a Sessão_do_Professor seguinte use somente o Tratamento escolhido na nova entrada.

### Requirement 12: Média de aprovação configurável

**User Story:** Como professor, quero informar a média de aprovação da minha escola, para que a situação e a posição do aluno sigam a regra que eu uso.

#### Acceptance Criteria

1. THE Formulário_de_Notas SHALL exibir, como primeiro campo e antes do campo "Nome do aluno", um campo de texto com o rótulo visível "Média para aprovação", acompanhado do texto de ajuda "Acima da média a partir de {A} · Excelente a partir de {E}" associado ao campo para tecnologias assistivas, com {A} e {E} formatados pelo Formatador_de_Nota.
2. WHEN a Tela_do_Professor é exibida após a aprovação do Nome_do_Professor, THE Formulário_de_Notas SHALL preencher o campo "Média para aprovação" com "6,00" e exibir o texto de ajuda "Acima da média a partir de 8,00 · Excelente a partir de 9,00".
3. WHEN o Usuário altera o texto do campo "Média para aprovação" para uma Média_de_Aprovação válida, THE Formulário_de_Notas SHALL atualizar o texto de ajuda com os valores de A e E derivados do novo valor, sem aguardar o envio do formulário.
4. IF o Usuário alterar o texto do campo "Média para aprovação" para um valor que o Validador reprovaria, THEN THE Formulário_de_Notas SHALL manter o texto de ajuda do último valor válido e exibir a mensagem de erro somente no envio do formulário.
5. IF o texto do campo "Média para aprovação" for reprovado no envio, THEN THE Validador SHALL exibir junto ao campo somente a mensagem da primeira regra violada, nesta ordem: vazio ou só espaços ("Informe a média para aprovação."), erro de conversão do Leitor_de_Nota ("Digite um número válido (ex.: 7,5)."), valor menor que 1 ou maior que 10, inclusive negativo ("A média deve estar entre 1 e 10.") e mais de 2 casas decimais ("Use no máximo 2 casas decimais.").
6. THE Calculadora_de_Média SHALL derivar de M, em centésimos inteiros, o Limite_Acima A = floor((M + 1000) / 2) e o Limite_Excelente E = floor((M + 3000) / 4).
7. THE Calculadora_de_Média SHALL determinar a Classificação e a Posição_em_Relação_à_Média de cada cálculo com as três notas comparando a soma S das Notas_Trimestrais, em centésimos inteiros, com 3M, 3A e 3E, conforme o Requisito 6, critérios 2 a 7, sem divisão nem ponto flutuante.
8. FOR ALL Médias_de_Aprovação válidas, THE Calculadora_de_Média SHALL produzir limites com M ≤ A ≤ E ≤ 1000, em centésimos (propriedade invariante).
9. WHEN M é 6,00, THE Calculadora_de_Média SHALL produzir A = 8,00 e E = 9,00, reproduzindo as faixas 6, 8 e 9 do script original (ex.: as notas 5,99; 6; 6 recebem "Reprovado" e as notas 8; 8; 8 recebem "Aprovado – acima da média").
10. WHEN um Lançamento é adicionado ao Histórico_Recente, THE NotaRápida SHALL registrar no Lançamento a Média_de_Aprovação usada, exibir "Média para aprovação: {M}" no Painel_de_Resultado e no Lançamento do Histórico_Recente, com {M} formatado pelo Formatador_de_Nota, e manter no campo "Média para aprovação" o texto usado no envio.

### Requirement 13: Resultado parcial com trimestres em branco

**User Story:** Como professor, quero lançar um aluno antes de todos os trimestres terem nota, para saber quanto ele precisa tirar no que falta para ser aprovado e para ficar acima da média.

#### Acceptance Criteria

1. THE Formulário_de_Notas SHALL exibir junto aos campos T1, T2 e T3 o texto de ajuda "Deixe em branco os trimestres ainda sem nota.", associado aos três campos para tecnologias assistivas.
2. WHEN o Usuário envia o Formulário_de_Notas com um ou dois campos de nota vazios ou com apenas espaços em branco, THE Validador SHALL tratar cada um desses campos como Nota_Faltante, sem exibir mensagem de erro junto a ele, e validar os demais campos conforme o Requisito 5.
3. IF os três campos de nota estiverem vazios ou com apenas espaços em branco no envio, THEN THE Validador SHALL exibir a mensagem "Informe ao menos uma nota." somente junto ao campo T1.
4. WHEN o Validador aprova um envio com k Notas_Faltantes (k = 1 ou 2), THE Calculadora_de_Média SHALL calcular, em centésimos inteiros, para o alvo X = M (Meta de aprovação) e para o alvo X = A (Meta acima da média), o valor R = 3X − Sk, em que Sk é a soma das notas informadas, e atribuir à Meta o estado "garantida" quando R ≤ 0, o estado "impossível" quando ceil(R / k) > 1000 e, nos demais casos, a nota n = ceil(R / k) em cada trimestre faltante.
5. WHEN a Calculadora_de_Média conclui um Resultado_Parcial, THE Painel_de_Resultado SHALL exibir o nome do aluno, o selo "Em andamento", o texto "Média parcial {p}" com p = floor(Sk / (3 − k)) formatado pelo Formatador_de_Nota, as notas informadas formatadas, o traço "—" lido como "sem nota" pelas tecnologias assistivas em cada Nota_Faltante, as duas Metas e a mensagem "{nome} ainda tem {T} por lançar.", sem Média_Final, Classificação nem Posição_em_Relação_à_Média, em que {T} é o rótulo da Nota_Faltante (ex.: "T3") ou os dois rótulos unidos por " e " (ex.: "T2 e T3").
6. WHEN o Painel_de_Resultado exibe a Meta de aprovação, THE Painel_de_Resultado SHALL exibir exatamente "Para alcançar a média de aprovação ({M}): {n} em {T}" quando k = 1, "Para alcançar a média de aprovação ({M}): {n} em cada um dos trimestres {T}" quando k = 2, "Média de aprovação já garantida." no estado "garantida" e "Não é mais possível alcançar a média de aprovação, mesmo com 10 no que falta." no estado "impossível", com {M} e {n} formatados pelo Formatador_de_Nota e {T} definido como no critério 5.
7. WHEN o Painel_de_Resultado exibe a Meta acima da média, THE Painel_de_Resultado SHALL exibir exatamente "Para ficar acima da média ({A}): {n} em {T}" quando k = 1, "Para ficar acima da média ({A}): {n} em cada um dos trimestres {T}" quando k = 2, "Acima da média já garantido." no estado "garantida" e "Não é mais possível ficar acima da média, mesmo com 10 no que falta." no estado "impossível", com {A} e {n} formatados pelo Formatador_de_Nota e {T} definido como no critério 5.
8. WHEN um Resultado_Parcial é adicionado ao Histórico_Recente, THE NotaRápida SHALL exibir no Lançamento as notas informadas, o traço "—" nas Notas_Faltantes, "Média parcial {p}", o selo "Em andamento" sem indicador de Posição_em_Relação_à_Média e o resumo "Aprovação: {a} · Acima: {b}", em que {a} é n formatado, "garantida" ou "impossível" e {b} é n formatado, "garantido" ou "impossível".
9. FOR ALL Resultados_Parciais e alvos X, THE Calculadora_de_Média SHALL produzir a Meta mínima: no estado possível, Sk + k·n ≥ 3X e Sk + k·(n − 1) < 3X; no estado "garantida", Sk ≥ 3X; e no estado "impossível", Sk + k·1000 < 3X, todos em centésimos inteiros (propriedade de mínimo).
10. FOR ALL Resultados_Parciais, THE Calculadora_de_Média SHALL produzir Metas coerentes: Meta de aprovação "impossível" implica Meta acima da média "impossível"; Meta acima da média "garantida" implica Meta de aprovação "garantida"; com as duas Metas possíveis, o n da aprovação é menor ou igual ao n acima da média; e preencher as Notas_Faltantes com o n de uma Meta possível faz a Calculadora_de_Média atribuir uma Classificação de aprovação (Meta de aprovação) ou a Posição_em_Relação_à_Média "Acima da média" (Meta acima da média) (propriedade de coerência).

### Requirement 14: Tempo de resposta (não funcional)

**User Story:** Como professor, quero respostas imediatas ao lançar notas, para trabalhar sem esperas.

#### Acceptance Criteria

1. WHEN o Usuário envia o Formulário_de_Notas com dados válidos, pelo botão "Calcular média" ou pela tecla Enter, THE NotaRápida SHALL concluir a validação, o cálculo da Média_Final, da Classificação e da Posição_em_Relação_à_Média e a atualização do conteúdo do Painel_de_Resultado e do Histórico_Recente em até 100 ms após o acionamento, sem contar a duração das animações, inclusive quando o Histórico_Recente já contiver 5 Lançamentos e o nome do aluno tiver 100 caracteres, medido conforme os critérios 7 e 8.
2. WHEN o Usuário envia o Formulário_de_Notas com dados válidos, pelo botão "Calcular média" ou pela tecla Enter, THE NotaRápida SHALL exibir o novo resultado completamente visível, com a Animação_de_Resultado e a Animação_de_Histórico concluídas e o conteúdo na posição final, em até 1 segundo após o acionamento, com o Movimento_Reduzido ativo ou inativo, medido conforme os critérios 7 e 8.
3. IF o Validador encontrar dados inválidos ao enviar o nome do professor na Tela_Inicial ou o Formulário_de_Notas, THEN THE NotaRápida SHALL exibir todas as mensagens de erro e posicionar o foco no campo definido no Requisito 1, critério 6, ou no Requisito 5, critério 8, em até 100 ms após o envio, medido conforme os critérios 7 e 8.
4. WHEN o Usuário digita um caractere em um campo visível ("Nome do professor", "Nome do aluno", "T1", "T2" ou "T3"), THE NotaRápida SHALL exibir o caractere no campo em até 50 ms, inclusive durante a Transição_de_Tela, a Animação_de_Resultado e a Animação_de_Histórico e com até 1.000 caracteres já presentes no campo, medido conforme os critérios 7 e 8.
5. WHEN o Usuário aciona o botão "Limpar histórico", THE NotaRápida SHALL remover os Lançamentos do conteúdo do Histórico_Recente e exibir a mensagem "Nenhuma nota lançada ainda." em até 100 ms após o acionamento, sem contar a duração da Animação_de_Histórico, inclusive quando o Histórico_Recente contiver 5 Lançamentos, medido conforme os critérios 7 e 8.
6. THE NotaRápida SHALL atender aos tempos dos critérios 1 a 5 sem enviar nem aguardar requisições de rede, inclusive com o navegador sem conexão de rede após o carregamento completo da página.
7. THE NotaRápida SHALL ter cada tempo deste requisito contado a partir do instante do evento de entrada do Usuário (clique, toque ou pressionamento de tecla) até a exibição do primeiro quadro renderizado na tela que mostra o conteúdo exigido pelo critério correspondente.
8. THE NotaRápida SHALL atender a cada limite dos critérios 1 a 5 em pelo menos 19 de 20 repetições consecutivas da ação correspondente, medidas no Dispositivo_de_Referência, com a aba do NotaRápida em primeiro plano, a página completamente carregada e nenhuma outra aba ou aplicativo executando tarefas em primeiro plano.

### Requirement 15: Tempo de entrada na tela do professor (não funcional)

**User Story:** Como professor, quero entrar na minha tela logo após informar meu nome, para começar a lançar notas sem demora.

#### Acceptance Criteria

1. WHEN o Usuário aciona "Entrar" com um Nome_do_Professor que o Validador aprova, por qualquer uma das formas do Requisito 1, critério 3 (clique, toque, teclas Enter ou Espaço no botão, ou Enter no campo "Nome do professor"), THE NotaRápida SHALL exibir a Tela_do_Professor Interativa, com a saudação do Requisito 2, critério 1, e o foco no campo "Nome do aluno" (Requisito 2, critério 5), em até 1 segundo após o acionamento, incluindo a Transição_de_Tela, medido no Dispositivo_de_Referência, inclusive com Nome_do_Professor de 100 caracteres e com o Movimento_Reduzido ativo ou inativo.
2. WHEN o Usuário aciona "Trocar professor" por qualquer uma das formas do Requisito 3, critério 5, THE NotaRápida SHALL exibir a Tela_Inicial Interativa, com o campo "Nome do professor" vazio e com o foco, e com os dados descartados conforme o Requisito 3, critério 1, em até 1 segundo após o acionamento, incluindo a Transição_de_Tela, medido no Dispositivo_de_Referência, com até 5 Lançamentos no Histórico_Recente e com o Movimento_Reduzido ativo ou inativo.
3. THE NotaRápida SHALL executar a entrada na Tela_do_Professor e a troca de professor sem enviar requisições de rede e sem aguardar respostas de rede, atendendo aos tempos dos critérios 1 e 2 também com o navegador sem conexão de rede após o carregamento completo da página (Requisito 19, critério 7).
4. IF o Usuário acionar novamente "Entrar" ou "Trocar professor", por qualquer uma das formas dos critérios 1 e 2, enquanto a Transição_de_Tela iniciada por esse mesmo botão estiver em execução, THEN THE NotaRápida SHALL executar uma única troca de tela, ignorar os acionamentos repetidos sem reiniciar a Transição_de_Tela, sem criar nova Sessão_do_Professor e sem exibir mensagem de erro, e exibir na saudação o Nome_do_Professor aprovado no primeiro acionamento.
5. WHEN o Usuário aciona "Entrar" com um Nome_do_Professor que o Validador aprova, ou aciona "Trocar professor", THE NotaRápida SHALL iniciar a Transição_de_Tela em até 100 ms após o acionamento, medido no Dispositivo_de_Referência.
6. IF o Usuário acionar "Trocar professor" enquanto a Transição_de_Tela de entrada na Tela_do_Professor estiver em execução, THEN THE NotaRápida SHALL encerrar a Transição_de_Tela de entrada, descartar os dados conforme o Requisito 3, critério 1, e exibir a Tela_Inicial Interativa com o campo "Nome do professor" vazio e com o foco, em até 1 segundo após o acionamento de "Trocar professor".

### Requirement 16: Carregamento inicial e tamanho do site (não funcional)

**User Story:** Como professor de colégio público, quero que o site abra rápido em computadores simples e no celular, para usá-lo mesmo com conexão limitada.

#### Acceptance Criteria

1. WHEN o arquivo principal do NotaRápida é aberto localmente no computador do Dispositivo_de_Referência, diretamente ou por um servidor local simples de arquivos estáticos, em um dos navegadores do Requisito 22, critério 1, THE NotaRápida SHALL exibir a Tela_Inicial Interativa em até 2 segundos, contados do início da navegação até a página (abertura do arquivo ou envio do endereço), em cada uma de 5 aberturas consecutivas.
2. WHERE o NotaRápida for hospedado, THE NotaRápida SHALL exibir a Tela_Inicial Interativa em até 2 segundos, contados do início da navegação até a página, em uma Conexão_4G_Típica, com o cache do navegador vazio, em cada uma de 5 aberturas consecutivas, tanto no computador quanto no celular Android do Dispositivo_de_Referência.
3. THE NotaRápida SHALL ter tamanho total de no máximo 200 KB (204.800 bytes) sem compressão, somando todos os arquivos que o navegador carrega durante o uso da Tela_Inicial e da Tela_do_Professor (HTML, CSS, JavaScript, imagens e ícones), sem contar arquivos de teste e de documentação que a página não carrega.
4. THE NotaRápida SHALL funcionar em tempo de execução somente com o código do próprio site, sem carregar na página frameworks ou bibliotecas de interface de terceiros nem arquivos de ferramentas de teste ou de desenvolvimento.
5. WHILE a página do NotaRápida estiver carregando, antes de a Tela_Inicial ficar Interativa, THE NotaRápida SHALL exibir somente o conteúdo da Tela_Inicial, sem exibir a Tela_do_Professor, mensagens de erro do Validador ou textos e campos sem as cores, fontes e espaçamentos do Guia_Visual.

### Requirement 17: Duração das animações (não funcional)

**User Story:** Como professor, quero animações curtas e suaves, para que a interface pareça fluida sem atrasar meu trabalho.

#### Acceptance Criteria

1. WHILE o Movimento_Reduzido não estiver ativo, WHEN a tela exibida muda entre a Tela_Inicial e a Tela_do_Professor, em qualquer sentido, THE NotaRápida SHALL executar a Transição_de_Tela com duração entre 200 e 400 ms, inclusive, medida do primeiro ao último quadro com movimento, dentro do limite de 1 segundo do Requisito 15, critérios 1 e 2.
2. WHILE o Movimento_Reduzido não estiver ativo, WHEN o Painel_de_Resultado exibe um novo resultado, THE NotaRápida SHALL executar a Animação_de_Resultado com duração entre 150 e 300 ms, inclusive, medida do primeiro ao último quadro com movimento.
3. WHILE a Transição_de_Tela, a Animação_de_Resultado ou a Animação_de_Histórico estiver em execução, THE NotaRápida SHALL aceitar a digitação nos campos visíveis, exibindo cada caractere em até 50 ms conforme o Requisito 14, critério 4, e o acionamento dos botões visíveis, exceto os acionamentos repetidos de "Entrar" e "Trocar professor" durante a Transição_de_Tela, que são ignorados conforme o Requisito 15, critério 4.
4. WHEN a Calculadora_de_Média conclui um cálculo ou o Usuário aciona o botão "Limpar histórico", THE NotaRápida SHALL atualizar o conteúdo do Painel_de_Resultado e do Histórico_Recente dentro dos prazos do Requisito 14, critérios 1 e 5, antes do início da animação correspondente, sem somar a duração da animação a esses prazos.
5. WHEN o Painel_de_Resultado exibe um novo resultado durante a Animação_de_Resultado, ou o Histórico_Recente é alterado durante a Animação_de_Histórico, THE NotaRápida SHALL encerrar imediatamente a animação em execução do mesmo tipo, iniciar a nova animação a partir do estado mais recente e exibir ao final somente o resultado do último cálculo e no máximo 5 Lançamentos, com o mesmo conteúdo exibido com o Movimento_Reduzido ativo (Requisito 10, critério 12).
6. WHILE a Transição_de_Tela, a Animação_de_Resultado ou a Animação_de_Histórico estiver em execução no Dispositivo_de_Referência, THE NotaRápida SHALL manter uma taxa média de pelo menos 50 quadros por segundo, medida durante toda a animação, inclusive com o Histórico_Recente contendo 5 Lançamentos com nomes de aluno de 100 caracteres.
7. WHILE o Movimento_Reduzido não estiver ativo, WHEN um ou mais Lançamentos são inseridos ou removidos do Histórico_Recente, THE NotaRápida SHALL executar uma única Animação_de_Histórico com duração entre 150 e 300 ms, inclusive, medida do primeiro ao último quadro com movimento, incluindo a inserção de um Lançamento junto com a remoção do mais antigo (Requisito 9, critério 3) e a remoção de todos os Lançamentos pelo botão "Limpar histórico".
8. WHILE a Animação_de_Resultado ou a Animação_de_Histórico estiver em execução, THE NotaRápida SHALL manter o foco no elemento em que ele foi posicionado pelo Requisito 4, critério 6, ou pelo Usuário, sem que a animação mova o foco nem oculte o indicador de foco do Requisito 21, critério 7.

### Requirement 18: Uso por muitos professores (não funcional)

**User Story:** Como coordenador, quero que muitos professores usem o site ao mesmo tempo, cada um com o seu nome, para que ninguém veja os dados de outro professor.

#### Acceptance Criteria

1. THE NotaRápida SHALL manter em cada aba ou janela do navegador uma Sessão_do_Professor independente, com a própria tela exibida (Tela_Inicial ou Tela_do_Professor), o próprio Nome_do_Professor, os próprios valores digitados no Formulário_de_Notas, o próprio Painel_de_Resultado e o próprio Histórico_Recente.
2. WHEN o Usuário abre o NotaRápida em uma nova aba ou janela do navegador, inclusive enquanto outras abas ou janelas do mesmo navegador estiverem com uma Sessão_do_Professor ativa, THE NotaRápida SHALL exibir a Tela_Inicial conforme o Requisito 1, critério 1, com o campo "Nome do professor" vazio, sem exibir nenhum Nome_do_Professor, nome de aluno, Nota_Trimestral ou Lançamento de outras abas ou janelas.
3. WHEN o Usuário, em uma aba do NotaRápida, digita em um campo, aciona "Entrar", "Calcular média", "Limpar histórico" ou "Trocar professor", recarrega a aba ou fecha a aba, THE NotaRápida SHALL manter inalterados, em todas as demais abas e janelas, a tela exibida, o Nome_do_Professor, os valores digitados no Formulário_de_Notas, o conteúdo do Painel_de_Resultado e os Lançamentos do Histórico_Recente.
4. WHEN um Usuário abre o NotaRápida no mesmo computador e no mesmo navegador depois que outro Professor acionou "Trocar professor", recarregou a aba ou fechou a aba, THE NotaRápida SHALL exibir a Tela_Inicial com o campo "Nome do professor" vazio, sem exibir o Nome_do_Professor, os nomes de alunos ou as Notas_Trimestrais do Professor anterior e sem oferecê-los como sugestão de preenchimento automático, conforme o Requisito 19, critério 8.
5. THE NotaRápida SHALL executar a entrada na Tela_do_Professor, a validação, o cálculo da Média_Final, da Classificação e da Posição_em_Relação_à_Média e a atualização do Painel_de_Resultado e do Histórico_Recente no navegador do Usuário, sem servidor de aplicação, sem banco de dados e sem depender de requisições de rede após o carregamento completo da página, de modo que o atendimento aos tempos dos Requisitos 14 e 15 não dependa do número de professores usando o site em outros navegadores ou dispositivos.
6. WHERE o NotaRápida for hospedado, THE NotaRápida SHALL ser entregue somente como arquivos estáticos (HTML, CSS, JavaScript, imagens e ícones).
7. THE NotaRápida SHALL manter o Nome_do_Professor e os demais dados do Requisito 19, critério 1, somente na Memória_da_Aba em que foram informados, sem compartilhá-los com outras abas, janelas, dispositivos ou serviços.
8. IF duas ou mais Sessões_do_Professor, em abas, janelas ou dispositivos diferentes, usarem o mesmo Nome_do_Professor, THEN THE NotaRápida SHALL exibir em cada Sessão_do_Professor somente o Painel_de_Resultado e os Lançamentos feitos nessa mesma Sessão_do_Professor, sem reunir nem recuperar Lançamentos de outra Sessão_do_Professor com o mesmo nome.
9. WHEN o Usuário duplica uma aba do NotaRápida pelo comando "Duplicar" do navegador ou reabre uma aba fechada pelo comando de reabrir aba do navegador, THE NotaRápida SHALL exibir na aba resultante a Tela_Inicial com o campo "Nome do professor" vazio, sem nenhum Nome_do_Professor, valor do Formulário_de_Notas, resultado do Painel_de_Resultado ou Lançamento da aba de origem.
10. WHILE até 5 abas ou janelas do NotaRápida estiverem abertas ao mesmo tempo no mesmo navegador do Dispositivo_de_Referência, cada uma com uma Sessão_do_Professor ativa e com até 5 Lançamentos no Histórico_Recente, THE NotaRápida SHALL atender, na aba em uso, aos tempos dos Requisitos 14 e 15.

### Requirement 19: Armazenamento temporário dos dados (não funcional)

**User Story:** Como gestor da escola, quero que os nomes dos professores e dos alunos fiquem guardados apenas durante o uso do site, para preservar a privacidade e dispensar infraestrutura de banco de dados.

#### Acceptance Criteria

1. THE NotaRápida SHALL manter os seguintes dados somente na Memória_da_Aba, desde a digitação até o fim da Sessão_do_Professor: o Nome_do_Professor, os nomes dos alunos, os textos digitados nos campos da Tela_Inicial e do Formulário_de_Notas, as Notas_Trimestrais, as Médias_Finais, as Classificações, as Posições_em_Relação_à_Média e os Lançamentos do Histórico_Recente.
2. THE NotaRápida SHALL manter os dados do critério 1 fora de qualquer Armazenamento_Persistente (cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers, arquivos ou servidores), de modo que, a qualquer momento do uso, a origem do NotaRápida tenha 0 cookies, 0 entradas em localStorage e em sessionStorage, 0 bancos IndexedDB, 0 caches em Cache Storage e 0 service workers registrados.
3. THE NotaRápida SHALL executar no navegador do Usuário a validação dos dados, o cálculo da Média_Final, a determinação da Classificação e a determinação da Posição_em_Relação_à_Média, sem incluir nenhum dos dados do critério 1 no endereço, nos cabeçalhos ou no corpo de nenhuma requisição de rede.
4. WHEN o Usuário aciona "Trocar professor", THE NotaRápida SHALL descartar da Memória_da_Aba os dados do critério 1, conforme o Requisito 3, critério 1.
5. WHEN o Usuário recarrega a página, ou fecha e reabre a página (inclusive pela opção do navegador de reabrir a aba fechada ou de restaurar a sessão anterior), THE NotaRápida SHALL exibir a Tela_Inicial com o campo "Nome do professor" vazio, sem nenhum dado do critério 1 da sessão anterior em nenhum campo, texto ou lista, inclusive nos campos do Formulário_de_Notas exibidos após a nova entrada.
6. WHEN o Usuário retorna à página do NotaRápida pelos botões Voltar ou Avançar do navegador depois de navegar para outro endereço na mesma aba, THE NotaRápida SHALL exibir a Tela_Inicial com o campo "Nome do professor" vazio, sem nenhum dado do critério 1 da sessão anterior, inclusive quando o navegador restaurar a página sem recarregá-la.
7. WHILE o navegador estiver sem conexão de rede após o carregamento completo da página, inclusive quando a conexão cair durante a Sessão_do_Professor, THE NotaRápida SHALL permitir a entrada na Tela_do_Professor, validar os dados, calcular a Média_Final, exibir o resultado no Painel_de_Resultado e atualizar o Histórico_Recente da mesma forma que com conexão de rede, sem descartar os Lançamentos já presentes e sem exibir mensagem de erro de conexão.
8. THE NotaRápida SHALL desativar o preenchimento automático nos campos "Nome do professor", "Nome do aluno", "T1", "T2" e "T3", de modo que, nos navegadores do Requisito 21, critério 6, nenhum valor digitado em Sessões_do_Professor anteriores seja sugerido nesses campos.
9. THE NotaRápida SHALL manter o endereço (URL) da página igual ao endereço de abertura durante todo o uso, sem incluir no endereço nenhum dado do critério 1 e sem criar novas entradas no histórico de navegação do navegador ao entrar na Tela_do_Professor, ao calcular médias, ao acionar "Limpar histórico" ou ao acionar "Trocar professor".
10. IF o navegador estiver em modo de navegação privada ou com cookies e armazenamento de sites bloqueados, THEN THE NotaRápida SHALL atender aos Requisitos 1 a 9 e 11 a 13 com os mesmos resultados obtidos em navegação normal, sem exibir mensagem de erro relacionada a armazenamento.

### Requirement 20: Segurança (não funcional)

**User Story:** Como gestor da escola, quero que o site seja protegido contra ataques comuns na web, para que os dados digitados não sejam expostos nem manipulados.

#### Acceptance Criteria

1. THE NotaRápida SHALL inserir o Nome_do_Professor e os nomes dos alunos na página somente como texto literal em todos os pontos em que aparecem (saudação da Tela_do_Professor, Painel_de_Resultado, mensagens de resultado, Histórico_Recente e anúncios para tecnologias assistivas), sem tratar dados digitados pelo Usuário como marcação HTML (ex.: "<script>alert(1)</script>" e "<img src=x onerror=alert(1)>" são exibidos literalmente, caractere por caractere, e nenhum script é executado).
2. THE NotaRápida SHALL declarar uma Política_de_Segurança_de_Conteúdo que permita carregar scripts, estilos, imagens e fontes somente a partir dos arquivos do próprio site e que bloqueie scripts inline e atributos de evento inline (ex.: onclick), a execução de código a partir de texto (eval e equivalentes), conexões de rede iniciadas por script, plugins, o carregamento de quadros, a alteração do endereço base da página e o envio de formulários para qualquer endereço.
3. THE NotaRápida SHALL carregar somente arquivos do próprio site, sem scripts de terceiros, CDNs, fontes externas, ferramentas de análise de uso (analytics) ou anúncios, de modo que a ferramenta de rede do navegador registre, do início do carregamento até o fim da Sessão_do_Professor, somente requisições a arquivos do próprio site.
4. IF o Usuário digitar ou colar em um campo um texto que faria o campo ultrapassar 1.000 caracteres, THEN THE NotaRápida SHALL manter no campo no máximo 1.000 caracteres, descartando o texto excedente, sem exibir mensagem de erro e continuando a responder dentro dos tempos do Requisito 14.
5. THE NotaRápida SHALL manter os dados do Requisito 19, critério 1, fora das mensagens do console do navegador em todos os momentos, inclusive nas falhas de validação, nos erros de execução e nos avisos.
6. THE NotaRápida SHALL atender aos critérios 1 a 8 do Requisito 19, que tratam do armazenamento temporário e da ausência de requisições de rede com dados.
7. WHERE o NotaRápida for hospedado, THE NotaRápida SHALL ser servido somente por HTTPS, redirecionando requisições HTTP para HTTPS.
8. WHERE o NotaRápida for hospedado, THE NotaRápida SHALL enviar a Política_de_Segurança_de_Conteúdo como cabeçalho HTTP, com no mínimo as mesmas restrições do critério 2 e com a proibição de exibir o site dentro de quadros de outros sites, e enviar também os cabeçalhos Strict-Transport-Security com duração mínima de 31.536.000 segundos (1 ano), X-Content-Type-Options com o valor "nosniff" e Referrer-Policy com o valor "no-referrer".
9. THE NotaRápida SHALL declarar a Política_de_Segurança_de_Conteúdo em um elemento meta do documento HTML principal, posicionado antes de qualquer referência a script ou folha de estilo, usando somente diretivas que os navegadores aplicam quando declaradas em elemento meta (sem frame-ancestors, report-uri, report-to nem sandbox).
10. WHEN o NotaRápida é aberto diretamente como arquivo local ou servido por um servidor local simples (Requisito 22, critérios 1 e 2), THE NotaRápida SHALL aplicar a Política_de_Segurança_de_Conteúdo sem bloquear nenhum arquivo do próprio site e sem que o console do navegador registre violação da política ou aviso de diretiva ignorada durante a execução dos fluxos dos Requisitos 1 a 13.
11. THE NotaRápida SHALL exibir na saudação somente um Nome_do_Professor aprovado pelo Validador (de 1 a 100 caracteres) e SHALL encaminhar à Calculadora_de_Média, ao Painel_de_Resultado e ao Histórico_Recente somente nomes de aluno aprovados pelo Validador (de 1 a 100 caracteres) e Notas_Trimestrais que sigam o formato do Requisito 8, critério 7, estejam entre 0 e 10, inclusive, e tenham no máximo 2 casas decimais.

### Requirement 21: Usabilidade, acessibilidade e compatibilidade (não funcional)

**User Story:** Como usuário de colégio público, quero acessar o site pelo celular ou pelo computador da escola, para usar o sistema em qualquer dispositivo disponível.

#### Acceptance Criteria

1. THE NotaRápida SHALL exibir todo o conteúdo e todas as funcionalidades da Tela_Inicial e da Tela_do_Professor sem rolagem horizontal e sem sobreposição ou corte de texto em janelas de visualização com largura entre 320 e 1920 pixels CSS, nas orientações retrato e paisagem, incluindo uma janela de 1280 pixels CSS com zoom do navegador de até 400%, e mantendo esse comportamento na condição de maior conteúdo: nomes de professor e de aluno com 100 caracteres (com e sem espaços internos), mensagens de erro exibidas ao mesmo tempo nos quatro campos do Formulário_de_Notas e 5 Lançamentos no Histórico_Recente.
2. THE NotaRápida SHALL exibir em português do Brasil todos os textos da interface, incluindo rótulos, botões, saudação, mensagens de erro do Validador, mensagens do Painel_de_Resultado, textos do Histórico_Recente, avisos e títulos do documento, e SHALL declarar o idioma da página como português do Brasil para tecnologias assistivas.
3. THE NotaRápida SHALL associar cada campo da Tela_Inicial e do Formulário_de_Notas a um rótulo textual visível que também seja o nome lido por tecnologias assistivas, e SHALL associar a cada campo a mensagem de erro do Validador exibida junto a ele, de modo que a mensagem seja lida por tecnologias assistivas quando o campo receber o foco.
4. THE NotaRápida SHALL permitir, somente pelo teclado (teclas Tab, Shift+Tab, Enter e Espaço), preencher todos os campos e acionar os botões "Entrar", "Calcular média", "Limpar histórico" e "Trocar professor", de modo que, em cada elemento com foco, a tecla Tab mova o foco para o próximo elemento e Shift+Tab mova o foco para o elemento anterior da ordem definida nos critérios 8 e 9, sem que o foco fique preso em nenhum elemento.
5. THE NotaRápida SHALL apresentar, calculado pela fórmula de razão de contraste das WCAG 2.1 e em todos os estados exibidos (normal, com o ponteiro sobre o botão, com foco e com erro), contraste mínimo de 4,5:1 entre todo texto e seu fundo, incluindo textos dos botões, mensagens de erro, Classificações, indicadores de Posição_em_Relação_à_Média e textos de exemplo dentro dos campos, e contraste mínimo de 3:1 entre as bordas dos campos, a borda ou o fundo dos botões e o fundo adjacente.
6. THE NotaRápida SHALL atender a todos os critérios de aceitação dos Requisitos 1 a 20, com os mesmos resultados, nas duas versões estáveis principais mais recentes, na data de entrega, do Chrome (Windows e Android), Firefox (Windows), Edge (Windows) e Safari (macOS e iOS).
7. WHEN um campo ou botão do NotaRápida recebe o foco pelo teclado ou pelo posicionamento automático de foco definido nos Requisitos 1 a 5, THE NotaRápida SHALL exibir, enquanto o elemento mantiver o foco, um indicador de foco visível ao redor de todo o elemento, com espessura mínima de 2 pixels CSS, contraste mínimo de 3:1 em relação ao fundo adjacente e sem ser encoberto por outro conteúdo da página.
8. WHILE a Tela_Inicial estiver exibida, THE Tela_Inicial SHALL apresentar a ordem de foco pelo teclado na sequência: campo "Nome do professor" e botão "Entrar".
9. WHILE a Tela_do_Professor estiver exibida, THE Tela_do_Professor SHALL apresentar a ordem de foco pelo teclado na sequência: campo "Nome do aluno", T1, T2, T3, botão "Calcular média", botão "Limpar histórico" e botão "Trocar professor", na mesma sequência em largura maior ou igual e menor que 1024 pixels CSS.
10. THE NotaRápida SHALL exibir cada campo e cada botão com área de toque mínima de 44 × 44 pixels CSS, com zoom do navegador em 100%.
11. WHEN a página do NotaRápida é carregada ou a tela exibida muda entre a Tela_Inicial e a Tela_do_Professor, THE NotaRápida SHALL atualizar o título do documento, até o fim da Transição_de_Tela, para "NotaRápida – Entrar" quando a Tela_Inicial for exibida e para "NotaRápida – Lançamento de notas" quando a Tela_do_Professor for exibida.
12. WHILE uma tela estiver oculta conforme o Requisito 2, critérios 7 e 8, a partir do início da Transição_de_Tela que a oculta, THE NotaRápida SHALL impedir que os campos e botões dessa tela recebam o foco pelo teclado ou sejam acionados.
13. THE NotaRápida SHALL exibir, com zoom do navegador em 100%, o texto digitado nos campos com tamanho de fonte mínimo de 16 pixels CSS e os demais textos da interface com tamanho de fonte mínimo de 14 pixels CSS.
14. THE NotaRápida SHALL permitir que o Usuário amplie a página pelo gesto de pinça nos navegadores de celular do critério 6 e pelo zoom do navegador nos computadores, até pelo menos 400%, sem bloquear nem limitar a ampliação.

### Requirement 22: Execução local e escopo de hospedagem (não funcional)

**User Story:** Como desenvolvedor, quero executar o site localmente, para testar a interface antes de decidir a hospedagem.

#### Acceptance Criteria

1. WHEN o Usuário abre o arquivo HTML principal do NotaRápida diretamente pelo protocolo file:// (por clique duplo no arquivo, arrastando o arquivo para a janela ou digitando o caminho na barra de endereços) no Chrome, Firefox ou Edge (Windows) ou no Safari (macOS), nas versões definidas no Requisito 21, critério 6, THE NotaRápida SHALL atender aos Requisitos 1 a 21, exceto os critérios marcados com "WHERE o NotaRápida for hospedado", sem exigir alteração de configurações do navegador, extensões ou parâmetros de inicialização.
2. WHEN o NotaRápida é servido por um servidor local simples de arquivos estáticos, que apenas entrega os arquivos do NotaRápida sem alterá-los e sem processamento no servidor, e aberto no mesmo computador em um dos navegadores do critério 1, THE NotaRápida SHALL atender aos Requisitos 1 a 21, exceto os critérios marcados com "WHERE o NotaRápida for hospedado", com os mesmos resultados obtidos pela abertura do critério 1.
3. THE NotaRápida SHALL ser carregado e executado nos modos dos critérios 1 e 2 sem conexão com a internet desde o primeiro carregamento e sem instalação de dependências de tempo de execução, plugins ou extensões do navegador.
4. THE NotaRápida SHALL ser entregue nesta fase como um conjunto de arquivos estáticos locais (HTML, CSS, JavaScript e imagens) reunidos em uma única pasta, prontos para abertura sem etapa de compilação, empacotamento ou instalação executada pelo Usuário, e sem configuração de hospedagem, domínio ou deploy.
5. WHEN o NotaRápida é aberto pelo protocolo file:// em um dos navegadores do critério 1, THE NotaRápida SHALL carregar e executar todo o seu código sem usar módulos ES (import e export), sem carregar arquivos por requisições iniciadas por script e sem registrar nenhum erro de carregamento ou de bloqueio de recurso no console do navegador.
6. WHEN o NotaRápida é aberto pelo protocolo file:// ou pelo servidor local do critério 2, THE NotaRápida SHALL declarar a Política_de_Segurança_de_Conteúdo do Requisito 20, critério 2, dentro do próprio arquivo HTML principal, sem depender de cabeçalhos HTTP, e de forma que a política não bloqueie nenhum script, estilo ou imagem do próprio NotaRápida em nenhum dos dois modos.
7. IF a pasta do NotaRápida for copiada ou movida para outro local do mesmo computador ou de outro computador, THEN THE NotaRápida SHALL atender aos critérios 1 e 2 a partir do novo local, sem alteração de nenhum arquivo.
