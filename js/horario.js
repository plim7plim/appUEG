// ============================================================
//  Horário de aula: imagem fixa + professor responsável por matéria
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  await carregarProfessores();
})();

async function carregarProfessores() {
  const alvo = document.getElementById('professores');

  const { data, error } = await sb
    .from('turmas')
    .select('nome, disciplina, professor:profiles(id, nome, foto_url, bio)');

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar os professores. ${esc(error.message)}</div>`;
    return;
  }

  const turmas = ordenarPorNome((data || []).filter(t => t.professor), t => t.professor.nome);
  if (!turmas.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma turma cadastrada ainda.</div>`;
    return;
  }

  alvo.innerHTML = turmas.map(t => `
    <div class="pessoa">
      <a href="usuario.html?id=${t.professor.id}"><img class="avatar avatar-pessoa" src="${avatarDe(t.professor)}" alt=""></a>
      <div class="pessoa-info">
        <h3><a href="usuario.html?id=${t.professor.id}">${esc(t.professor.nome)}</a></h3>
        <span class="etiqueta etiqueta-atividade">${esc(t.disciplina || t.nome)}</span>
        <p class="pessoa-bio">${t.professor.bio ? esc(t.professor.bio) : '<em>Sem bio ainda.</em>'}</p>
      </div>
    </div>`).join('');
}
