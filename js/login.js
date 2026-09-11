// ============================================================
//  Login e cadastro
// ============================================================

const abaEntrar = document.getElementById('abaEntrar');
const abaCriar = document.getElementById('abaCriar');
const formEntrar = document.getElementById('formEntrar');
const formCriar = document.getElementById('formCriar');

abaEntrar.onclick = () => trocarAba('entrar');
abaCriar.onclick = () => trocarAba('criar');

function trocarAba(qual) {
  esconderAviso('aviso');
  const entrando = qual === 'entrar';
  abaEntrar.classList.toggle('ativa', entrando);
  abaCriar.classList.toggle('ativa', !entrando);
  formEntrar.classList.toggle('oculto', !entrando);
  formCriar.classList.toggle('oculto', entrando);
}

// já está logado? vai direto pras turmas
(async () => {
  const user = await usuarioAtual();
  if (user) window.location.href = 'comunidade.html';
})();

// ---------- entrar ----------
formEntrar.onsubmit = async (e) => {
  e.preventDefault();
  esconderAviso('aviso');
  const btn = document.getElementById('btnEntrar');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById('e_email').value.trim(),
    password: document.getElementById('e_senha').value
  });

  if (error) {
    mostrarAviso('aviso', 'E-mail ou senha não conferem. Tente de novo.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
    return;
  }
  window.location.href = 'comunidade.html';
};

// ---------- esqueci a senha ----------
document.getElementById('linkEsqueciSenha').onclick = async (e) => {
  e.preventDefault();
  esconderAviso('aviso');

  const email = document.getElementById('e_email').value.trim();
  if (!email) {
    mostrarAviso('aviso', 'Digite seu e-mail no campo acima e clique em "Esqueceu a senha?" de novo.');
    document.getElementById('e_email').focus();
    return;
  }

  const link = document.getElementById('linkEsqueciSenha');
  link.textContent = 'Enviando...';

  // Não revela se o e-mail existe ou não (evita que alguém descubra quem
  // tem conta): a mensagem é sempre a mesma, e o Supabase já limita quantos
  // pedidos de reset saem pro mesmo e-mail em pouco tempo.
  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('redefinir-senha.html', window.location.href).href
  });

  mostrarAviso('aviso', 'Se esse e-mail tiver conta no Mural UEG, foi enviado um link para redefinir a senha.', true);
  link.textContent = 'Esqueceu a senha?';
};

// ---------- criar conta ----------
formCriar.onsubmit = async (e) => {
  e.preventDefault();
  esconderAviso('aviso');
  const btn = document.getElementById('btnCriar');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  const email = document.getElementById('c_email').value.trim();
  const senha = document.getElementById('c_senha').value;
  const nome = document.getElementById('c_nome').value.trim();
  const matricula = document.getElementById('c_matricula').value.trim();
  const papel = document.querySelector('input[name=papel]:checked').value;

  const { data, error } = await sb.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, papel, matricula } }
  });

  if (error) {
    const msg = /already/i.test(error.message)
      ? 'Esse e-mail já tem conta. Use a aba Entrar.'
      : 'Não deu para criar a conta: ' + error.message;
    mostrarAviso('aviso', msg);
    btn.disabled = false;
    btn.textContent = 'Criar conta';
    return;
  }

  // se a confirmação por e-mail estiver ligada, não vem sessão
  if (!data.session) {
    mostrarAviso('aviso', 'Conta criada. Confirme o e-mail e volte para entrar.', true);
    btn.disabled = false;
    btn.textContent = 'Criar conta';
    trocarAba('entrar');
    return;
  }

  window.location.href = 'comunidade.html';
};
