// ============================================================
//  Dashboard do painel administrativo
// ============================================================

(async () => {
  await exigirLogin();
  const ok = await exigirAdmin();
  if (!ok) return;

  document.getElementById('conteudoAdmin').classList.remove('oculto');

  await Promise.all([carregarIndicadores(), carregarAtividade()]);
})();

async function contarProfiles(filtro) {
  let q = sb.from('profiles').select('id', { count: 'exact', head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  return error ? null : (count || 0);
}

async function carregarIndicadores() {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, alunos, professores, novos, bloqueadas] = await Promise.all([
    contarProfiles(),
    contarProfiles(q => q.eq('papel', 'aluno')),
    contarProfiles(q => q.eq('papel', 'professor')),
    contarProfiles(q => q.gte('criado_em', seteDiasAtras)),
    contarProfiles(q => q.eq('status_conta', 'bloqueada'))
  ]);

  const tiles = [
    [total, 'Usuários cadastrados', false],
    [alunos, 'Alunos', false],
    [professores, 'Professores', false],
    [novos, 'Novos (7 dias)', false],
    [bloqueadas, 'Contas bloqueadas', true]
  ];

  document.getElementById('dashStats').innerHTML = tiles.map(([valor, rotulo, alerta]) => `
    <div class="admin-stat${alerta && valor > 0 ? ' alerta' : ''}">
      <strong>${valor === null ? '—' : valor}</strong>
      <span>${esc(rotulo)}</span>
    </div>`).join('');
}

async function carregarAtividade() {
  const alvo = document.getElementById('dashAtividade');

  if (!temPermissao('consultar_logs')) {
    alvo.innerHTML = '<p class="admin-vazio">Você não tem permissão para consultar o histórico administrativo.</p>';
    return;
  }

  const { data, error } = await sb
    .from('admin_logs')
    .select('id, acao, resultado, criado_em, admin:admin_id(nome), afetado:usuario_afetado_id(nome)')
    .order('criado_em', { ascending: false })
    .limit(10);

  if (error) {
    alvo.innerHTML = '<p class="admin-vazio">Não foi possível carregar este conteúdo. <button type="button" id="btnRetentarAtividade" class="btn-texto">Tentar de novo</button></p>';
    const btn = document.getElementById('btnRetentarAtividade');
    if (btn) btn.onclick = carregarAtividade;
    return;
  }

  if (!data || !data.length) {
    alvo.innerHTML = '<p class="admin-vazio">Nenhuma ação administrativa registrada ainda.</p>';
    return;
  }

  alvo.innerHTML = data.map(l => {
    const admin = (l.admin && l.admin.nome) || 'Administrador removido';
    const afetado = l.afetado && l.afetado.nome;
    const falhou = l.resultado === 'falha';
    return `
      <div class="log-item">
        <span class="log-acao">${esc(rotuloAcao(l.acao))}</span>
        ${falhou ? '<span class="etiqueta etiqueta-bloqueada" style="margin-left:6px">falhou</span>' : ''}
        <div>${esc(admin)}${afetado ? ' → ' + esc(afetado) : ''}</div>
        <span class="log-quando">${esc(dataHoraBr(l.criado_em))}</span>
      </div>`;
  }).join('');
}

const ROTULOS_ACAO = {
  resetar_senha: 'Reset de senha solicitado',
  bloquear_usuario: 'Conta bloqueada',
  desbloquear_usuario: 'Conta desbloqueada'
};
function rotuloAcao(acao) {
  return ROTULOS_ACAO[acao] || acao;
}
