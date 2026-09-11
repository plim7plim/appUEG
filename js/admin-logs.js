// ============================================================
//  Painel administrativo — histórico de ações (auditoria)
// ============================================================

(async () => {
  await exigirLogin();
  const ok = await exigirAdmin();
  if (!ok) return;

  if (!temPermissao('consultar_logs')) {
    document.getElementById('semPermissao').classList.remove('oculto');
    return;
  }

  document.getElementById('conteudoLogs').classList.remove('oculto');
  await carregarLogs();
})();

const ROTULOS_ACAO_LOG = {
  resetar_senha: 'Reset de senha',
  bloquear_usuario: 'Bloqueio de conta',
  desbloquear_usuario: 'Desbloqueio de conta'
};

async function carregarLogs() {
  const alvo = document.getElementById('listaLogs');

  const { data, error } = await sb
    .from('admin_logs')
    .select('id, acao, resultado, detalhes, criado_em, admin:admin_id(nome), afetado:usuario_afetado_id(nome)')
    .order('criado_em', { ascending: false })
    .limit(200);

  if (error) {
    alvo.innerHTML = '<p class="admin-vazio">Não foi possível carregar este conteúdo. <button type="button" id="btnRetentarLogs" class="btn-texto">Tentar de novo</button></p>';
    document.getElementById('btnRetentarLogs').onclick = carregarLogs;
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
    const motivo = l.detalhes && l.detalhes.motivo;
    return `
      <div class="log-item">
        <span class="log-acao">${esc(ROTULOS_ACAO_LOG[l.acao] || l.acao)}</span>
        <span class="etiqueta ${falhou ? 'etiqueta-bloqueada' : 'etiqueta-ativa'}" style="margin-left:6px">${falhou ? 'falhou' : 'sucesso'}</span>
        <div style="font-size:.88rem;margin-top:2px">${esc(admin)}${afetado ? ' → ' + esc(afetado) : ''}</div>
        ${motivo ? `<div style="font-size:.83rem;color:var(--tinta-fraca);margin-top:2px">Motivo: ${esc(motivo)}</div>` : ''}
        <span class="log-quando">${esc(dataHoraBr(l.criado_em))}</span>
      </div>`;
  }).join('');
}
