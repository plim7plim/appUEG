// ============================================================
//  Meu perfil: foto e bio
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  document.getElementById('avatarPreview').src = perfil.foto_url || AVATAR_PADRAO;
  document.getElementById('p_bio').value = perfil.bio || '';
  preencherAnos();
  document.getElementById('p_ano_ingresso').value = perfil.ano_ingresso || '';
  document.getElementById('p_github').value = perfil.github_url || '';
  document.getElementById('p_linkedin').value = perfil.linkedin_url || '';
})();

// Aceita link completo ("https://github.com/fulano") ou só o usuário
// ("fulano") — nos dois casos guarda a URL completa.
function normalizarRedeUrl(valor, prefixo) {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return prefixo + v.replace(/^\/+/, '');
}

function preencherAnos() {
  const sel = document.getElementById('p_ano_ingresso');
  // curso começou em 2026, só essa turma existe por enquanto
  const opts = '<option value="">Prefiro não dizer</option><option value="2026">2026</option>';
  sel.innerHTML = opts;
}

// ---------- trocar foto ----------
document.getElementById('p_foto').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    mostrarAviso('avisoPerfil', 'Escolha um arquivo de imagem.');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    mostrarAviso('avisoPerfil', 'A imagem precisa ter até 2 MB.');
    return;
  }

  esconderAviso('avisoPerfil');
  const extensao = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const caminho = `${PERFIL.id}/avatar.${extensao}`;

  const { error: erroUpload } = await sb.storage
    .from('avatars')
    .upload(caminho, file, { upsert: true, cacheControl: '3600' });

  if (erroUpload) {
    mostrarAviso('avisoPerfil', 'Não deu para enviar a foto: ' + erroUpload.message);
    return;
  }

  const { data: pub } = sb.storage.from('avatars').getPublicUrl(caminho);
  const urlComCache = pub.publicUrl + '?t=' + Date.now();

  const { error: erroUpdate } = await sb.from('profiles')
    .update({ foto_url: urlComCache }).eq('id', PERFIL.id);

  if (erroUpdate) {
    mostrarAviso('avisoPerfil', 'Foto enviada, mas não salvou no perfil: ' + erroUpdate.message);
    return;
  }

  PERFIL.foto_url = urlComCache;
  document.getElementById('avatarPreview').src = urlComCache;
  mostrarAviso('avisoPerfil', 'Foto atualizada.', true);
};

// ---------- salvar bio ----------
document.getElementById('formPerfil').onsubmit = async (e) => {
  e.preventDefault();
  esconderAviso('avisoPerfil');
  const btn = document.getElementById('btnSalvarPerfil');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const bio = document.getElementById('p_bio').value.trim();
  const anoValor = document.getElementById('p_ano_ingresso').value;
  const ano_ingresso = anoValor ? Number(anoValor) : null;
  const github_url = normalizarRedeUrl(document.getElementById('p_github').value, 'https://github.com/');
  const linkedin_url = normalizarRedeUrl(document.getElementById('p_linkedin').value, 'https://www.linkedin.com/in/');

  const { error } = await sb.from('profiles')
    .update({ bio, ano_ingresso, github_url, linkedin_url }).eq('id', PERFIL.id);

  if (error) {
    mostrarAviso('avisoPerfil', 'Não deu para salvar: ' + error.message);
  } else {
    PERFIL.bio = bio;
    PERFIL.ano_ingresso = ano_ingresso;
    PERFIL.github_url = github_url;
    PERFIL.linkedin_url = linkedin_url;
    mostrarAviso('avisoPerfil', 'Perfil salvo.', true);
  }

  btn.disabled = false;
  btn.textContent = 'Salvar';
};
