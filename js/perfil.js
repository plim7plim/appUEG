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
})();

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

  const { error } = await sb.from('profiles').update({ bio, ano_ingresso }).eq('id', PERFIL.id);

  if (error) {
    mostrarAviso('avisoPerfil', 'Não deu para salvar: ' + error.message);
  } else {
    PERFIL.bio = bio;
    PERFIL.ano_ingresso = ano_ingresso;
    mostrarAviso('avisoPerfil', 'Perfil salvo.', true);
  }

  btn.disabled = false;
  btn.textContent = 'Salvar';
};
