// ============================================================
//  Conheça seus colegas: professores e alunos, alunos agrupados
//  por ano de ingresso.
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  await carregarColegas();
})();

async function carregarColegas() {
  const alvo = document.getElementById('colegas');

  const { data, error } = await sb
    .from('profiles')
    .select('id, nome, papel, foto_url, bio, ano_ingresso')
    .order('nome', { ascending: true });

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar. ${esc(error.message)}</div>`;
    return;
  }

  const pessoas = data || [];
  if (!pessoas.length) {
    alvo.innerHTML = `<div class="vazio">Ninguém por aqui ainda.</div>`;
    return;
  }

  const professores = pessoas.filter(p => p.papel === 'professor');
  const alunos = pessoas.filter(p => p.papel !== 'professor');

  let html = '';

  if (professores.length) {
    html += secaoColegas(`Professores (${professores.length})`, professores);
  }

  if (alunos.length) {
    const grupos = {};
    alunos.forEach(a => {
      const chave = a.ano_ingresso || 'sem-ano';
      (grupos[chave] = grupos[chave] || []).push(a);
    });

    Object.keys(grupos)
      .filter(k => k !== 'sem-ano')
      .map(Number)
      .sort((a, b) => b - a)
      .forEach(ano => {
        html += secaoColegas(`Alunos — ingresso ${ano} (${grupos[ano].length})`, grupos[ano]);
      });

    if (grupos['sem-ano']) {
      html += secaoColegas(`Alunos — ano não informado (${grupos['sem-ano'].length})`, grupos['sem-ano']);
    }
  }

  alvo.innerHTML = html;
}

function secaoColegas(titulo, lista) {
  return `
    <h2 class="secao-grupo">${esc(titulo)}</h2>
    <div class="pessoas">${lista.map(cartaoPessoa).join('')}</div>`;
}

function cartaoPessoa(p) {
  const ehProf = p.papel === 'professor';
  return `
    <div class="pessoa">
      <a href="usuario.html?id=${p.id}"><img class="avatar avatar-pessoa" src="${avatarDe(p)}" alt=""></a>
      <div class="pessoa-info">
        <h3><a href="usuario.html?id=${p.id}">${esc(p.nome)}</a></h3>
        <span class="etiqueta${ehProf ? ' etiqueta-atividade' : ''}">${ehProf ? 'Professor' : 'Aluno'}</span>
        <p class="pessoa-bio">${p.bio ? esc(p.bio) : '<em>Sem bio ainda.</em>'}</p>
      </div>
    </div>`;
}
