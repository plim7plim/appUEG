// Deve rodar antes do SDK: o link enviado pelo painel pode apontar para a
// página inicial. Preserve o fragmento até a tela de nova senha processá-lo.
let REDIRECIONANDO_RECUPERACAO = false;
(function encaminharRecuperacao() {
  const atual = new URL(window.location.href);
  const tipo = new URLSearchParams(atual.hash.slice(1)).get('type') || atual.searchParams.get('type');
  if (tipo !== 'recovery' || atual.pathname.endsWith('/redefinir-senha.html')) return;
  const destino = new URL('redefinir-senha.html', atual);
  destino.search = atual.search;
  destino.hash = atual.hash;
  REDIRECIONANDO_RECUPERACAO = true;
  window.location.replace(destino.href);
})();
