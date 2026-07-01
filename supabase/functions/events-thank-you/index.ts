// events-thank-you - Email de remerciement apres validation de presence (evenement)
// Declenche par le trigger trg_thankyou_event sur INSERT de events_presences.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'marketing@spacerstoulouse.fr'
const FROM_NAME      = Deno.env.get('FROM_NAME')  || "Spacer's Toulouse Volley"
const APP_URL        = Deno.env.get('APP_URL')            || 'https://benevoles.spacerstoulouse.fr'
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('THANKYOU_WEBHOOK_SECRET') || null

const CAT: Record<string, { lbl: string; emo: string }> = {
  convivial: { lbl: 'Convivial', emo: '&#127881;' },
  sportif:   { lbl: 'Sportif',   emo: '&#127952;' },
  formation: { lbl: 'Formation', emo: '&#127891;' },
  sortie:    { lbl: 'Sortie',    emo: '&#128652;' },
}

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
    if (!rec?.benevole_id || !rec?.event_id) return new Response('No record', { status: 400 })

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

    const eRes = await fetch(
      `${SUPABASE_URL}/rest/v1/events_benevoles?id=eq.${rec.event_id}&select=titre,date_event,lieu,categorie`,
      { headers }
    )
    const eArr = await eRes.json()
    const ev = Array.isArray(eArr) ? eArr[0] : null

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [b.email],
        subject: `Merci d'avoir \u00e9t\u00e9 l\u00e0${b.prenom ? ', ' + b.prenom : ''} !`,
        html: thankHTML(b, ev),
      }),
    })
    const txt = await res.text()
    if (!res.ok) {
      console.error('Resend error', res.status, txt)
      return new Response(JSON.stringify({ error: 'Resend failed', status: res.status }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, email: b.email }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('events-thank-you error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})

function thankHTML(b: any, ev: any): string {
  const prenom = b.prenom || 'B\u00e9n\u00e9vole'
  const titre = ev?.titre || ''
  const dateStr = ev ? fmtDate(ev.date_event) : ''
  const lieu = ev?.lieu || ''
  const infoLine = [dateStr, lieu].filter(Boolean).join(' &middot; ')
  const cat = ev?.categorie ? CAT[ev.categorie] : null
  const evCard = titre ? `
        <div style="background:#F4F8FC;border:1px solid #E1EBF4;border-radius:14px;padding:16px 18px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9aa7b4;margin-bottom:7px;">Ton &eacute;v&eacute;nement</div>
          <div style="font-size:18px;font-weight:800;color:#042C53;">${titre}</div>
          ${infoLine ? `<div style="font-size:13px;color:#5a6b7b;margin-top:7px;">&#128197; ${infoLine}</div>` : ''}
          ${cat ? `<div style="display:inline-block;margin-top:10px;background:#EAF1F8;color:#185FA5;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">${cat.emo} ${cat.lbl}</div>` : ''}
        </div>` : ''
  return `
    <div style="background:#EEF2F7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Merci d'avoir particip&eacute;, ${prenom} !</div>
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(4,44,83,0.10);">
        <div style="background:linear-gradient(135deg,#042C53,#185FA5);padding:36px 32px 30px;text-align:center;">
          <div style="font-size:50px;line-height:1;margin-bottom:10px;">&#127881;</div>
          <div style="font-size:23px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Merci d'avoir &eacute;t&eacute; l&agrave; !</div>
          <div style="font-size:11px;color:rgba(181,212,244,0.9);margin-top:8px;letter-spacing:1.5px;text-transform:uppercase;">Spacer's Toulouse Volley</div>
        </div>
        <div style="height:4px;background:#F5C842;"></div>
        <div style="padding:30px 32px;">
          <p style="font-size:16px;color:#1a1a18;margin:0 0 14px;">Bonjour <strong style="color:#185FA5;">${prenom}</strong>,</p>
          <p style="color:#5a6b7b;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Un grand merci d'avoir particip&eacute; &agrave; cette soir&eacute;e b&eacute;n&eacute;vole ! Ces moments font vivre le club autant que les matchs, et c'est gr&acirc;ce &agrave; des b&eacute;n&eacute;voles comme toi.
          </p>
          ${evCard}
          <div style="background:#FFF7E0;border:1px solid #F3E0A8;border-radius:12px;padding:14px 16px;margin:18px 0;text-align:center;">
            <div style="font-size:13px;color:#7a611f;line-height:1.6;">
              &#10024; Ta participation a bien &eacute;t&eacute; enregistr&eacute;e.<br>Merci de faire vivre la communaut&eacute; b&eacute;n&eacute;vole !
            </div>
          </div>
          <a href="${APP_URL}" style="display:block;background:#042C53;color:#ffffff;border-radius:50px;padding:15px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;">Voir mon espace &#8594;</a>
          <p style="font-size:13px;color:#9aa7b4;line-height:1.6;margin:22px 0 0;text-align:center;">
            &#127881; On esp&egrave;re te revoir tr&egrave;s vite &agrave; un prochain &eacute;v&eacute;nement !
          </p>
        </div>
        <div style="background:#042C53;padding:18px;text-align:center;">
          <div style="font-size:11px;color:rgba(181,212,244,0.6);line-height:1.6;">Spacer's Toulouse Volley<br>Palais des Sports Andr&eacute; Brouat &middot; Toulouse</div>
        </div>
      </div>
    </div>`
}
