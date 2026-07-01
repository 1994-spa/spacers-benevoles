const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'marketing@spacerstoulouse.fr'
const FROM_NAME      = Deno.env.get('FROM_NAME')  || "Spacer's Toulouse Volley"
const APP_URL        = Deno.env.get('APP_URL')            || 'https://benevoles.spacerstoulouse.fr'
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
function json(obj, status){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) })
}
function svc(){ return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' } }
function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function buildHtml(m){
  const dateStr = m.date_mission ? new Date(m.date_mission + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'à définir'
  const heure = m.heure_rdv ? m.heure_rdv.slice(0, 5) : null
  const objs = Array.isArray(m.objectifs) ? m.objectifs : []
  const objRows = objs.map(function(o){ return '<div style="font-size:14px;color:#3F4A57;padding:4px 0;line-height:1.45;">&#10003;&nbsp; ' + esc(o) + '</div>' }).join('')
  const objHtml = objs.length
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="background-color:#F4F7FB;border-radius:12px;padding:16px 18px;"><div style="font-size:12px;font-weight:700;color:#042C53;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Ce qu\'il y a &agrave; faire</div>' + objRows + '</td></tr></table>'
    : ''
  const infoLigne = 'RDV ' + esc(dateStr) + (heure ? (' &agrave; ' + esc(heure)) : '') + (m.lieu ? (' &middot; ' + esc(m.lieu)) : '')
  const descHtml = m.description ? '<p style="font-size:15px;line-height:1.65;color:#3F4A57;margin:0 0 18px;white-space:pre-line;">' + esc(m.description) + '</p>' : ''
  return '' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF2F7;margin:0;padding:24px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:\'Segoe UI\',Arial,Helvetica,sans-serif;">' +
      '<tr><td bgcolor="#042C53" style="background-color:#042C53;padding:30px 30px 26px;text-align:center;">' +
        '<div style="font-size:11px;letter-spacing:3px;color:#F5C842;font-weight:700;text-transform:uppercase;">Spacer\'s Toulouse Volley</div>' +
        '<div style="font-size:38px;line-height:1;margin:16px 0 8px;">&#128588;</div>' +
        '<div style="font-size:22px;font-weight:800;color:#ffffff;">On a besoin de toi&nbsp;!</div>' +
        '<div style="font-size:13px;color:#9DC0E6;margin-top:6px;">Appel &agrave; b&eacute;n&eacute;voles &middot; hors match</div>' +
      '</td></tr>' +
      '<tr><td bgcolor="#F5C842" style="background-color:#F5C842;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>' +
      '<tr><td style="padding:28px 32px 30px;">' +
        '<div style="font-size:21px;font-weight:800;color:#042C53;margin-bottom:12px;">' + esc(m.titre || 'Coup de main') + '</div>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px;"><tr><td style="background-color:#E6F1FB;border-radius:8px;padding:9px 15px;font-size:13px;color:#185FA5;font-weight:600;">&#128197;&nbsp; ' + infoLigne + '</td></tr></table>' +
        descHtml +
        objHtml +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:4px 0;">' +
          '<a href="' + APP_URL + '" style="display:inline-block;background-color:#185FA5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 44px;border-radius:50px;">Je participe &#8594;</a>' +
        '</td></tr></table>' +
        '<p style="font-size:12px;color:#8A9BAD;text-align:center;margin:20px 0 0;line-height:1.6;">Connecte-toi &agrave; ton espace b&eacute;n&eacute;vole pour t\'inscrire.<br>Merci pour ton aide&nbsp;!</p>' +
      '</td></tr>' +
      '<tr><td bgcolor="#042C53" style="background-color:#042C53;padding:20px 30px;text-align:center;">' +
        '<div style="font-size:12px;color:#9DC0E6;font-weight:600;">Spacer\'s Toulouse Volley</div>' +
        '<div style="font-size:11px;color:#6E92BC;margin-top:4px;">Palais des Sports Andr&eacute; Brouat &middot; Toulouse</div>' +
      '</td></tr>' +
    '</table>' +
  '</td></tr></table>'
}

Deno.serve(async function(req){
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const uRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + jwt, apikey: ANON_KEY } })
    if (!uRes.ok) return json({ error: 'Unauthorized' }, 401)
    const user = await uRes.json()
    const uid = user && user.id
    if (!uid) return json({ error: 'Unauthorized' }, 401)

    const roleRes = await fetch(SUPABASE_URL + '/rest/v1/benevoles?id=eq.' + uid + '&select=role', { headers: svc() })
    const roleArr = await roleRes.json()
    const role = roleArr && roleArr[0] && roleArr[0].role
    if (role !== 'pilote' && role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const body = await req.json().catch(function(){ return {} })
    const missionId = body && body.mission_id
    if (!missionId) return json({ error: 'mission_id manquant' }, 400)

    const mRes = await fetch(SUPABASE_URL + '/rest/v1/missions?id=eq.' + missionId + '&select=*', { headers: svc() })
    const mArr = await mRes.json()
    const m = mArr && mArr[0]
    if (!m) return json({ error: 'Appel introuvable' }, 404)

    const rRes = await fetch(SUPABASE_URL + '/rest/v1/benevoles?select=email,prenom,statut_compte', { headers: svc() })
    let recipients = await rRes.json()
    if (!Array.isArray(recipients)) recipients = []
    recipients = recipients.filter(function(b){ return b.email && b.email.indexOf('@spacers-deleted.local') < 0 && (b.statut_compte == null || b.statut_compte === 'actif') })
    if (recipients.length === 0) return json({ sent: 0, info: 'Aucun destinataire' })

    const html = buildHtml(m)
    const subject = 'Appel à bénévoles : ' + (m.titre || 'coup de main')
    let sent = 0
    for (let i = 0; i < recipients.length; i += 100){
      const batch = recipients.slice(i, i + 100)
      const messages = batch.map(function(b){
        return { from: FROM_NAME + ' <' + FROM_EMAIL + '>', to: [b.email], subject: subject, html: html }
      })
      const resp = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + RESEND_API_KEY },
        body: JSON.stringify(messages)
      })
      if (resp.ok) sent += batch.length
      else console.error('Resend batch error', resp.status, await resp.text())
    }
    return json({ sent: sent })
  } catch (e) {
    console.error('notify-appel error', e)
    return json({ error: String(e && e.message || e) }, 500)
  }
})
