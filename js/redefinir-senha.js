// ============================================================
//  Definir nova senha — página de destino do link enviado por
//  e-mail (recuperação própria ou reset iniciado por um admin).
//  O Supabase já grava uma sessão temporária de "recovery" ao
//  abrir esta página com o link; só falta pedir a nova senha e
//  chamar updateUser — sem nunca ver ou guardar a senha antiga.
// ============================================================

let LINK_VALIDO = false;

function mostrarFormulario() {
  if (LINK_VALIDO) return;
  LINK_VALIDO = true;
  document.getElementById('verificando').classList.add('oculto');
  document.getElementById('formNovaSenha').classList.remove('oculto');
}

function mostrarLinkInvalido() {
  if (LINK_VALIDO) return;
  document.getElementById('verificando').classList.add('oculto');
  document.getElementById('linkInvalido').classList.remove('oculto');
}

sb.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') mostrarFormulario();
});

// se a aba já processou o link antes deste script rodar (ou o navegador
// restaurou sessão), confere se já tem uma sessão válida também
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) mostrarFormulario();
  // dá um tempo pro evento PASSWORD_RECOVERY chegar antes de desistir
  setTimeout(() => { if (!LINK_VALIDO) mostrarLinkInvalido(); }, 4000);
})();

document.getElementById('formNovaSenha').onsubmit = async (e) => {
  e.preventDefault();
  esconderAviso('aviso');

  const senha = document.getElementById('novaSenha').value;
  const confirmacao = document.getElementById('confirmarSenha').value;

  if (senha !== confirmacao) {
    mostrarAviso('aviso', 'As senhas não são iguais.');
    return;
  }

  const btn = document.getElementById('btnSalvarSenha');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const { error } = await sb.auth.updateUser({ password: senha });

  if (error) {
    mostrarAviso('aviso', 'Não foi possível salvar a nova senha: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Salvar nova senha';
    return;
  }

  mostrarAviso('aviso', 'Senha alterada com sucesso. Redirecionando...', true);
  setTimeout(() => { window.location.href = 'comunidade.html'; }, 1500);
};
