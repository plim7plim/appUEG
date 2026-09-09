// ============================================================
//  Meu perfil: foto e bio
// ============================================================

const LINGUAGENS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#',
  'PHP', 'Go', 'Rust', 'Kotlin', 'Swift', 'Ruby', 'SQL', 'Outra'
];

const AREAS_TI = [
  'Desenvolvimento Web', 'Desenvolvimento Mobile', 'Inteligência Artificial / Dados',
  'Banco de Dados', 'Redes e Infraestrutura', 'Segurança da Informação',
  'DevOps / Cloud', 'Jogos', 'UX/UI Design', 'Sistemas Embarcados'
];

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  document.getElementById('avatarPreview').src = perfil.foto_url || AVATAR_PADRAO;
  document.getElementById('p_bio').value = perfil.bio || '';
  preencherAnos();
  document.getElementById('p_ano_ingresso').value = perfil.ano_ingresso || '';
  document.getElementById('p_github').value = perfil.github_url || '';
  document.getElementById('p_linkedin').value = perfil.linkedin_url || '';
  preencherLinguagens();
  document.getElementById('p_linguagem').value = perfil.linguagem_favorita || '';
  preencherAreas(perfil.areas_favoritas || []);
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

function preencherLinguagens() {
  const sel = document.getElementById('p_linguagem');
  sel.innerHTML = '<option value="">Prefiro não dizer</option>' +
    LINGUAGENS.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
}

function preencherAreas(selecionadas) {
  const alvo = document.getElementById('p_areas');
  alvo.innerHTML = AREAS_TI.map(area => `
    <label>
      <input type="checkbox" name="p_area" value="${esc(area)}" ${selecionadas.includes(area) ? 'checked' : ''}>
      ${esc(area)}
    </label>`).join('');
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
  const linguagem_favorita = document.getElementById('p_linguagem').value || null;
  const areasMarcadas = [...document.querySelectorAll('input[name=p_area]:checked')].map(c => c.value);
  const areas_favoritas = areasMarcadas.length ? areasMarcadas : null;

  const { error } = await sb.from('profiles')
    .update({ bio, ano_ingresso, github_url, linkedin_url, linguagem_favorita, areas_favoritas }).eq('id', PERFIL.id);

  if (error) {
    mostrarAviso('avisoPerfil', 'Não deu para salvar: ' + error.message);
  } else {
    PERFIL.bio = bio;
    PERFIL.ano_ingresso = ano_ingresso;
    PERFIL.github_url = github_url;
    PERFIL.linkedin_url = linkedin_url;
    PERFIL.linguagem_favorita = linguagem_favorita;
    PERFIL.areas_favoritas = areas_favoritas;
    mostrarAviso('avisoPerfil', 'Alterações salvas.', true);
  }

  btn.disabled = false;
  btn.textContent = 'Salvar';
};
