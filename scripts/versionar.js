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
 */

const fs = require('node:fs');

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

function principal(argv) {
  const [arquivo, versao] = argv;
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

module.exports = { versionar, REFERENCIA };

if (require.main === module) {
  process.exitCode = principal(process.argv.slice(2));
}
