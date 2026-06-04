// ────────────────────────────────────────────────────────────────────
// thank-you - Email de remerciement apres validation de presence (match)
// ────────────────────────────────────────────────────────────────────
const MAILJET_KEY    = Deno.env.get('MAILJET_API_KEY')!
const MAILJET_SECRET = Deno.env.get('MAILJET_SECRET_KEY')!
const FROM_EMAIL     = Deno.env.get('MAILJET_FROM_EMAIL') || 'marketing@spacerstoulouse.fr'
const FROM_NAME      = Deno.env.get('MAILJET_FROM_NAME')  || "Spacer's Toulouse Volley"
const APP_URL        = Deno.env.get('APP_URL')            || 'https://benevoles.spacerstoulouse.fr'
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('THANKYOU_WEBHOOK_SECRET') || null

const PRESENT = ['present_ponctuel', 'present_retard']

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch (_e) {
    return d || ''
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (WEBHOOK_SECRET) {
      if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
    }

    const payload = await req.json()
    const rec = payload?.record
    const old = payload?.old_record
    if (!rec) return new Response('No record', { status: 400 })

    const now = rec.statut_jour_match
    const before = old?.statut_jour_match
    if (!PRESENT.includes(now)) return new Response('Skipped (not present)', { status: 200 })
    if (PRESENT.includes(before)) return new Response('Skipped (already present)', { status: 200 })

    const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }

    const bRes = await fetch(
      `${SUPABASE_URL}/rest/v1/benevoles?id=eq.${rec.benevole_id}&select=email,prenom,nom,statut_compte`,
      { headers }
    )
    const bArr = await bRes.json()
    const b = Array.isArray(bArr) ? bArr[0] : null
    if (!b?.email) return new Response('Skipped (no email)', { status: 200 })
    if (b.email.includes('@spacers-deleted.local')) return new Response('Skipped (anonymized)', { status: 200 })
    if (b.statut_compte && b.statut_compte !== 'actif') return new Response('Skipped (not active)', { status: 200 })

    const mRes = await fetch(
      `${SUPABASE_URL}/rest/v1/matchs?id=eq.${rec.match_id}&select=adversaire,date_match,heure,lieu`,
      { headers }
    )
    const mArr = await mRes.json()
    const m = Array.isArray(mArr) ? mArr[0] : null

    const message = {
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: b.email, Name: `${b.prenom || ''} ${b.nom || ''}`.trim() || b.email }],
      Subject: `Merci d'avoir \u00e9t\u00e9 l\u00e0${b.prenom ? ', ' + b.prenom : ''} !`,
      HTMLPart: thankHTML(b, m),
    }

    const creds = btoa(`${MAILJET_KEY}:${MAILJET_SECRET}`)
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${creds}` },
      body: JSON.stringify({ Messages: [message] }),
    })
    const txt = await res.text()
    if (!res.ok) {
      console.error('Mailjet error', res.status, txt)
      return new Response(JSON.stringify({ error: 'Mailjet failed', status: res.status }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, email: b.email }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('thank-you error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})

function thankHTML(b: any, m: any): string {
  const prenom = b.prenom || 'B\u00e9n\u00e9vole'
  const adv = m?.adversaire || ''
  const dateStr = m ? fmtDate(m.date_match) : ''
  const heure = m?.heure || ''
  const lieu = m?.lieu || ''
  const infoLine = [dateStr, heure, lieu].filter(Boolean).join(' &middot; ')
  const matchCard = adv ? `
        <div style="background:#F4F8FC;border:1px solid #E1EBF4;border-radius:14px;padding:16px 18px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9aa7b4;margin-bottom:7px;">Ta soir&eacute;e</div>
          <div style="font-size:18px;font-weight:800;color:#042C53;">Spacers <span style="color:#F5C842;">vs</span> ${adv}</div>
          ${infoLine ? `<div style="font-size:13px;color:#5a6b7b;margin-top:7px;">&#128197; ${infoLine}</div>` : ''}
        </div>` : ''
  return `
    <div style="background:#EEF2F7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Merci pour ton coup de main, ${prenom} !</div>
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(4,44,83,0.10);">
        <div style="background:linear-gradient(135deg,#042C53,#185FA5);padding:36px 32px 30px;text-align:center;">
          <div style="font-size:50px;line-height:1;margin-bottom:10px;">&#128588;</div>
          <div style="font-size:23px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Merci d'avoir &eacute;t&eacute; l&agrave; !</div>
          <div style="font-size:11px;color:rgba(181,212,244,0.9);margin-top:8px;letter-spacing:1.5px;text-transform:uppercase;">Spacer's Toulouse Volley</div>
        </div>
        <div style="height:4px;background:#F5C842;"></div>
        <div style="padding:30px 32px;">
          <p style="font-size:16px;color:#1a1a18;margin:0 0 14px;">Bonjour <strong style="color:#185FA5;">${prenom}</strong>,</p>
          <p style="color:#5a6b7b;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Un grand merci pour ton coup de main ! Sans des b&eacute;n&eacute;voles comme toi, ces soir&eacute;es au Palais des Sports ne seraient pas les m&ecirc;mes.
          </p>
          ${matchCard}
          <div style="background:#FFF7E0;border:1px solid #F3E0A8;border-radius:12px;padding:14px 16px;margin:18px 0;text-align:center;">
            <div style="font-size:13px;color:#7a611f;line-height:1.6;">
              &#10024; Ta pr&eacute;sence a bien &eacute;t&eacute; enregistr&eacute;e.<br>Retrouve tes points et ton niveau dans ton espace.
            </div>
          </div>
          <a href="${APP_URL}" style="display:block;background:#042C53;color:#ffffff;border-radius:50px;padding:15px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;">Voir mon espace &#8594;</a>
          <p style="font-size:13px;color:#9aa7b4;line-height:1.6;margin:22px 0 0;text-align:center;">
            &#127952; On esp&egrave;re te revoir tr&egrave;s vite sur un prochain match !
          </p>
        </div>
        <div style="background:#042C53;padding:18px;text-align:center;">
          <div style="font-size:11px;color:rgba(181,212,244,0.6);line-height:1.6;">Spacer's Toulouse Volley<br>Palais des Sports Andr&eacute; Brouat &middot; Toulouse</div>
        </div>
      </div>
    </div>`
}
