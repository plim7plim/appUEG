// ============================================================
//  Painel administrativo — operações privilegiadas
//  (reset de senha, bloqueio e desbloqueio de conta)
//
//  Roda no servidor do Supabase (Deno), nunca no navegador. É o
//  único lugar do projeto que usa a service_role — ela fica só
//  aqui, como secret do projeto, e nunca é devolvida pro cliente.
//
//  Toda ação:
//   1. confere o JWT de quem chamou (é um usuário de verdade logado);
//   2. confere no banco se essa pessoa é admin e tem a permissão certa
//      (de novo, no servidor — o front já esconde o botão, mas quem
//      chamar a function direto no DevTools cai nessa checagem);
//   3. aplica um limite simples de chamadas por admin (anti-abuso);
//   4. executa a operação;
//   5. grava o resultado em admin_logs (nunca senha, token ou chave).
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// origem do site — restringe quem pode chamar a function pelo navegador.
// Ajuste aqui se o Mural UEG for servido de outro domínio além do GitHub Pages.
const ORIGENS_PERMITIDAS = [
  'https://plim7plim.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

function corsHeaders(origem: string | null) {
  const permitida = origem && ORIGENS_PERMITIDAS.includes(origem);
  return {
    'Access-Control-Allow-Origin': permitida ? origem! : ORIGENS_PERMITIDAS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

// service_role: ignora RLS de propósito (é o admin da própria função,
// já validamos a identidade e a permissão do chamador antes de usar)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
// anon: só pra disparar o e-mail de redefinição (mesmo endpoint que o
// login usa) — não precisa de privilégio nenhum pra isso
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

const LIMITE_JANELA_MIN = 10;
const LIMITE_POR_JANELA: Record<string, number> = {
  resetar_senha: 8,
  bloquear_usuario: 15,
  desbloquear_usuario: 15
};

const PERMISSAO_POR_ACAO: Record<string, string> = {
  resetar_senha: 'resetar_senha',
  bloquear_usuario: 'bloquear_contas',
  desbloquear_usuario: 'bloquear_contas'
};

Deno.serve(async (req) => {
  const origem = req.headers.get('origin');
  const headers = { ...corsHeaders(origem), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido.' }), { status: 405, headers });
  }

  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: 'Corpo da requisição inválido.' }), { status: 400, headers });
  }

  const { acao, usuario_id, motivo, redirect_to } = corpo || {};
  if (!acao || !PERMISSAO_POR_ACAO[acao]) {
    return new Response(JSON.stringify({ erro: 'Ação desconhecida.' }), { status: 400, headers });
  }
  if (!usuario_id || typeof usuario_id !== 'string') {
    return new Response(JSON.stringify({ erro: 'Usuário alvo não informado.' }), { status: 400, headers });
  }

  // 1) quem está chamando?
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ erro: 'Não autenticado.' }), { status: 401, headers });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ erro: 'Sessão inválida ou expirada.' }), { status: 401, headers });
  }
  const chamadorId = userData.user.id;

  // 2) é admin e tem a permissão certa pra essa ação?
  const permissaoNecessaria = PERMISSAO_POR_ACAO[acao];
  const { data: permissao } = await supabaseAdmin
    .from('admin_permissoes')
    .select('admin_id')
    .eq('admin_id', chamadorId)
    .eq('permissao', permissaoNecessaria)
    .maybeSingle();

  if (!permissao) {
    // mensagem genérica — não revela se a pessoa é admin sem essa permissão
    // ou não é admin nenhum
    return new Response(JSON.stringify({ erro: 'Você não tem permissão para executar esta ação.' }), { status: 403, headers });
  }

  // regra de negócio: ninguém bloqueia a própria conta por aqui
  if (acao === 'bloquear_usuario' && usuario_id === chamadorId) {
    return new Response(JSON.stringify({ erro: 'Você não pode bloquear a própria conta.' }), { status: 400, headers });
  }

  // 3) limite de chamadas (anti-abuso): conta quantas vezes esse admin
  // executou essa mesma ação nos últimos minutos
  const desde = new Date(Date.now() - LIMITE_JANELA_MIN * 60 * 1000).toISOString();
  const { count: chamadasRecentes } = await supabaseAdmin
    .from('admin_logs')
    .select('id', { count: 'exact', head: true })
    .eq('admin_id', chamadorId)
    .eq('acao', acao)
    .gte('criado_em', desde);

  if ((chamadasRecentes || 0) >= LIMITE_POR_JANELA[acao]) {
    return new Response(JSON.stringify({ erro: 'Muitas solicitações seguidas. Aguarde alguns minutos e tente de novo.' }), { status: 429, headers });
  }

  // 4) usuário alvo existe?
  const { data: alvo } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email')
    .eq('id', usuario_id)
    .maybeSingle();

  if (!alvo) {
    return new Response(JSON.stringify({ erro: 'Usuário não encontrado.' }), { status: 404, headers });
  }

  // 5) executa
  try {
    if (acao === 'resetar_senha') {
      if (!alvo.email) throw new Error('Este usuário não tem e-mail cadastrado.');

      const { error } = await supabaseAnon.auth.resetPasswordForEmail(alvo.email, {
        redirectTo: urlDeRedirecionamentoSegura(redirect_to)
      });
      if (error) throw new Error(error.message);

      await registrarLog(chamadorId, acao, alvo.id, {}, 'sucesso');
      return new Response(JSON.stringify({ ok: true, mensagem: 'Link de redefinição enviado.' }), { headers });
    }

    if (acao === 'bloquear_usuario') {
      const motivoLimpo = String(motivo || '').trim().slice(0, 500);
      if (!motivoLimpo) throw new Error('Informe o motivo do bloqueio.');

      const { error: erroBan } = await supabaseAdmin.auth.admin.updateUserById(usuario_id, {
        ban_duration: '876000h' // ~100 anos — Supabase não tem "permanente" de verdade, isso equivale
      });
      if (erroBan) throw new Error(erroBan.message);

      await supabaseAdmin.from('profiles').update({ status_conta: 'bloqueada' }).eq('id', usuario_id);
      await supabaseAdmin.from('contas_bloqueio').insert({
        usuario_id, motivo: motivoLimpo, bloqueado_por: chamadorId
      });

      await registrarLog(chamadorId, acao, alvo.id, { motivo: motivoLimpo }, 'sucesso');
      return new Response(JSON.stringify({ ok: true, mensagem: 'Conta bloqueada.' }), { headers });
    }

    if (acao === 'desbloquear_usuario') {
      const { error: erroUnban } = await supabaseAdmin.auth.admin.updateUserById(usuario_id, {
        ban_duration: 'none'
      });
      if (erroUnban) throw new Error(erroUnban.message);

      await supabaseAdmin.from('profiles').update({ status_conta: 'ativa' }).eq('id', usuario_id);
      await supabaseAdmin
        .from('contas_bloqueio')
        .update({ desbloqueado_por: chamadorId, desbloqueado_em: new Date().toISOString() })
        .eq('usuario_id', usuario_id)
        .is('desbloqueado_em', null);

      await registrarLog(chamadorId, acao, alvo.id, {}, 'sucesso');
      return new Response(JSON.stringify({ ok: true, mensagem: 'Conta desbloqueada.' }), { headers });
    }

    return new Response(JSON.stringify({ erro: 'Ação desconhecida.' }), { status: 400, headers });
  } catch (e) {
    await registrarLog(chamadorId, acao, alvo.id, { erro: String(e?.message || e) }, 'falha');
    return new Response(JSON.stringify({ erro: e?.message || 'Não foi possível completar a operação.' }), { status: 400, headers });
  }
});

// só aceita mandar o e-mail de reset pra uma URL de um domínio permitido
// (senão qualquer um poderia mandar redirect_to apontando pra um site
// falso e phishing a senha nova de alguém)
function urlDeRedirecionamentoSegura(candidata: unknown): string {
  const caiu = 'https://plim7plim.github.io/appUEG/redefinir-senha.html';
  if (typeof candidata !== 'string') return caiu;
  try {
    const u = new URL(candidata);
    if (!ORIGENS_PERMITIDAS.includes(u.origin)) return caiu;
    return u.href;
  } catch {
    return caiu;
  }
}

async function registrarLog(adminId: string, acao: string, usuarioAfetadoId: string, detalhes: Record<string, unknown>, resultado: 'sucesso' | 'falha') {
  try {
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId, acao, usuario_afetado_id: usuarioAfetadoId, detalhes, resultado
    });
  } catch {
    // não deixa uma falha ao gravar o log derrubar a resposta da operação
  }
}
