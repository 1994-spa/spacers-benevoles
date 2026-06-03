const MAILJET_KEY    = Deno.env.get('MAILJET_API_KEY')
const MAILJET_SECRET = Deno.env.get('MAILJET_SECRET_KEY')
const FROM_EMAIL     = Deno.env.get('MAILJET_FROM_EMAIL') || 'marketing@spacerstoulouse.fr'
const FROM_NAME      = Deno.env.get('MAILJET_FROM_NAME')  || "Spacer's Toulouse Volley"
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
  const objHtml = objs.length
    ? '<div style="background:#E6F1FB;border-radius:12px;padding:14px;margin:16px 0;"><div style="font-size:13px;font-weight:700;color:#0C447C;margin-bottom:6px;">Ce qu\'il y a à faire</div><ul style="margin:0;padding-left:18px;color:#5F5E5A;font-size:14px;line-height:1.8;">' + objs.map(function(o){ return '<li>' + esc(o) + '</li>' }).join('') + '</ul></div>'
    : ''
  const infoLigne = 'RDV ' + esc(dateStr) + (heure ? (' à ' + esc(heure)) : '') + (m.lieu ? (' · ' + esc(m.lieu)) : '')
  return '' +
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">' +
    '<div style="background:linear-gradient(135deg,#042C53,#185FA5);padding:30px;text-align:center;">' +
      '<div style="font-size:40px;margin-bottom:10px;">&#128588;</div>' +
      '<div style="font-size:20px;font-weight:800;color:white;">On a besoin de toi !</div>' +
      '<div style="font-size:13px;color:rgba(181,212,244,0.85);margin-top:6px;">Appel à bénévoles · hors match</div>' +
    '</div>' +
    '<div style="padding:26px 30px;">' +
      '<div style="font-size:18px;font-weight:800;color:#0C447C;margin-bottom:6px;">' + esc(m.titre || 'Coup de main') + '</div>' +
      '<div style="font-size:13px;color:#185FA5;font-weight:600;margin-bottom:12px;">&#128197; ' + infoLigne + '</div>' +
      (m.description ? '<p style="color:#5F5E5A;font-size:14px;line-height:1.7;white-space:pre-line;">' + esc(m.description) + '</p>' : '') +
      objHtml +
      '<a href="' + APP_URL + '" style="display:block;background:#185FA5;color:white;border-radius:50px;padding:14px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:18px;">Je participe &#8594;</a>' +
      '<p style="font-size:12px;color:#888;margin-top:20px;text-align:center;">Connecte-toi à ton espace bénévole pour t\'inscrire. Merci pour ton aide !</p>' +
    '</div>' +
    '<div style="background:#042C53;padding:16px;text-align:center;"><p style="font-size:11px;color:rgba(181,212,244,0.5);margin:0;">Spacer\'s Toulouse Volley · Palais des Sports André Brouat</p></div>' +
  '</div>'
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
    const creds = btoa(MAILJET_KEY + ':' + MAILJET_SECRET)
    let sent = 0
    for (let i = 0; i < recipients.length; i += 50){
      const batch = recipients.slice(i, i + 50)
      const messages = batch.map(function(b){
        return { From: { Email: FROM_EMAIL, Name: FROM_NAME }, To: [{ Email: b.email, Name: b.prenom || b.email }], Subject: subject, HTMLPart: html }
      })
      const resp = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + creds },
        body: JSON.stringify({ Messages: messages })
      })
      if (resp.ok) sent += batch.length
      else console.error('Mailjet batch error', resp.status, await resp.text())
    }
    return json({ sent: sent })
  } catch (e) {
    console.error('notify-appel error', e)
    return json({ error: String(e && e.message || e) }, 500)
  }
})