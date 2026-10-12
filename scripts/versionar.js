'use strict';

/*
 * Acrescenta a versão aos endereços dos arquivos do site em um index.html:
 *   css/estilo.css  ->  css/estilo.css?v=1a2b3c4d5e
 *
 * Por quê: o GitHub Pages deixa o navegador guardar cada arquivo por 10 minutos, cada um
 * por conta própria. Logo depois de uma publicação, um navegador pode juntar o index.html
 * novo com um .js antigo (ou o contrário): o botão aparece, mas não funciona. Com a versão
 * no endereço, o HTML e os arquivos que ele chama são sempre da mesma publicação.
 *
 * Roda no fluxo de publicação, só na cópia que vai para o Pages; o código-fonte não muda.
 * Uso: node scripts/versionar.js site/index.html <versão (hexadecimal, 7 a 40 caracteres)>
 *      node scripts/versionar.js site/index.html --commit-do-build
 *
 * --commit-do-build (Cloudflare): usa o commit que o git do clone baixou e, só se não houver
 * git, as variáveis CF_PAGES_COMMIT_SHA ou WORKERS_CI_COMMIT_SHA. Cada candidato passa pela
 * mesma validação; o build do Cloudflare já entregou variável vazia e até "main".
 */

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const VERSAO_VALIDA = /^[0-9a-f]{7,40}$/;
// href="css/..." e src="js/..." (e só esses: ícones, imagens e âncoras ficam como estão)
const REFERENCIA = /\b(href|src)="((?:css|js)\/[^"?#]+)"/g;

function versionar(html, versao) {
  if (!VERSAO_VALIDA.test(versao)) {
    throw new Error('versão inválida: ' + JSON.stringify(versao));
  }
  let trocas = 0;
  const saida = html.replace(REFERENCIA, (todo, atributo, caminho) => {
    trocas += 1;
    return atributo + '="' + caminho + '?v=' + versao.slice(0, 10) + '"';
  });
  return { html: saida, trocas };
}

// O commit do build: o que o git do clone diz e, sem git, as variáveis do Cloudflare.
// Devolve { versao, origem } com a primeira versão válida, ou null.
function commitDoBuild(ambiente = process.env, perguntarAoGit = gitHead) {
  const candidatos = [['git rev-parse HEAD', perguntarAoGit()],
    ['CF_PAGES_COMMIT_SHA', ambiente.CF_PAGES_COMMIT_SHA],
    ['WORKERS_CI_COMMIT_SHA', ambiente.WORKERS_CI_COMMIT_SHA]];
  for (const [origem, valor] of candidatos) {
    const versao = String(valor || '').trim().toLowerCase();
    if (VERSAO_VALIDA.test(versao)) {
      return { versao, origem };
    }
  }
  return null;
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (erro) {
    return '';
  }
}

function principal(argv) {
  let [arquivo, versao] = argv;
  if (versao === '--commit-do-build') {
    const achado = commitDoBuild();
    if (!achado) {
      console.error('nenhum commit válido no build (git, CF_PAGES_COMMIT_SHA, WORKERS_CI_COMMIT_SHA): nada foi versionado');
      return 1;
    }
    console.log('versão do build tirada de ' + achado.origem);
    versao = achado.versao;
  }
  if (!arquivo || !versao) {
    console.error('uso: node scripts/versionar.js <index.html> <versão>');
    return 2;
  }
  const original = fs.readFileSync(arquivo, 'utf8');
  const { html, trocas } = versionar(original, versao);
  if (trocas === 0) {
    console.error('nenhuma referência a css/ ou js/ encontrada em ' + arquivo + ': nada foi versionado');
    return 1;
  }
  fs.writeFileSync(arquivo, html);
  console.log(trocas + ' endereços versionados em ' + arquivo + ' (?v=' + versao.slice(0, 10) + ')');
  return 0;
}

module.exports = { versionar, commitDoBuild, REFERENCIA };

if (require.main === module) {
  process.exitCode = principal(process.argv.slice(2));
}
