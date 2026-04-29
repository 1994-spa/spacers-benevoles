import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAILJET_KEY  = Deno.env.get('MAILJET_API_KEY')!
const MAILJET_SECRET = Deno.env.get('MAILJET_SECRET_KEY')!

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

Deno.serve(async () => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Récupérer tous les matchs ouverts
    const { data: matchs } = await sb
      .from('matchs')
      .select('*')
      .eq('statut_inscriptions', 'ouvert')

    if (!matchs || matchs.length === 0) {
      return new Response('Aucun match ouvert', { status: 200 })
    }

    const results: string[] = []

    for (const match of matchs) {
      const matchDate = new Date(match.date_match)
      matchDate.setHours(0, 0, 0, 0)
      const joursAvant = Math.round((matchDate.getTime() - today.getTime()) / 86400000)

      console.log(`Match vs ${match.adversaire} : J${joursAvant > 0 ? '-' : '+'}${Math.abs(joursAvant)}`)

      // ── J-15 : Ouverture inscriptions → TOUS les bénévoles actifs
      if (joursAvant === 15) {
        const { data: benevoles } = await sb
          .from('benevoles')
          .select('email, prenom, nom')
          .eq('statut_compte', 'actif')

        if (benevoles?.length) {
          await sendBulkEmail(benevoles, {
            subject: `🏐 Inscriptions ouvertes — Spacers vs ${match.adversaire}`,
            type: 'ouverture',
            match
          })
          results.push(`J-15 → ${benevoles.length} emails envoyés`)
        }
      }

      // ── J-10 : Relance → bénévoles qui N'ONT PAS répondu
      if (joursAvant === 10) {
        const nonRepondants = await getNonRepondants(match.id)
        if (nonRepondants.length) {
          await sendBulkEmail(nonRepondants, {
            subject: `⏰ On a besoin de toi — Spacers vs ${match.adversaire} — J-10`,
            type: 'relance_j10',
            match
          })
          results.push(`J-10 → ${nonRepondants.length} relances envoyées`)
        }
      }

      // ── J-5 : Urgence → bénévoles qui N'ONT PAS répondu
      if (joursAvant === 5) {
        const nonRepondants = await getNonRepondants(match.id)
        if (nonRepondants.length) {
          await sendBulkEmail(nonRepondants, {
            subject: `🚨 URGENT — Dernière chance Spacers vs ${match.adversaire}`,
            type: 'urgence_j5',
            match
          })
          results.push(`J-5 → ${nonRepondants.length} urgences envoyées`)
        }
      }

      // ── J-1 : Convocation → bénévoles qui ont répondu OUI
      if (joursAvant === 1) {
        const { data: confirmes } = await sb
          .from('inscriptions')
          .select('*, benevoles(email, prenom, nom)')
          .eq('match_id', match.id)
          .eq('statut', 'disponible')

        const destinataires = confirmes
          ?.map((i: any) => i.benevoles)
          .filter(Boolean) || []

        if (destinataires.length) {
          await sendBulkEmail(destinataires, {
            subject: `✅ Convocation — Spacers vs ${match.adversaire} demain`,
            type: 'convocation_j1',
            match
          })
          results.push(`J-1 → ${destinataires.length} convocations envoyées`)
        }
      }

      // ── J+1 : Post-match → bénévoles qui avaient dit OUI
      if (joursAvant === -1) {
        const { data: participants } = await sb
          .from('inscriptions')
          .select('*, benevoles(email, prenom, nom)')
          .eq('match_id', match.id)
          .eq('statut', 'disponible')

        const destinataires = participants
          ?.map((i: any) => i.benevoles)
          .filter(Boolean) || []

        if (destinataires.length) {
          await sendBulkEmail(destinataires, {
            subject: `🎉 Merci — Spacers vs ${match.adversaire} — Tes points ont été crédités`,
            type: 'post_match',
            match
          })
          // Créditer les points (+50 par participant)
          for (const p of participants || []) {
            await sb.from('points_log').insert({
              benevole_id: p.benevole_id,
              match_id: match.id,
              action: 'match_complete',
              points: 50,
              description: `Match vs ${match.adversaire}`
            })
            await sb.rpc('increment_points', {
              benv_id: p.benevole_id,
              pts: 50
            })
          }
          results.push(`J+1 → ${destinataires.length} post-match + points crédités`)

          // Fermer les inscriptions
          await sb.from('matchs')
            .update({ statut_inscriptions: 'archive' })
            .eq('id', match.id)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 })
  }
})

// ── Bénévoles sans réponse ───────────────────────────────────
async function getNonRepondants(matchId: string) {
  // Tous les actifs
  const { data: tous } = await sb
    .from('benevoles')
    .select('id, email, prenom, nom')
    .eq('statut_compte', 'actif')

  // Ceux qui ont déjà répondu (oui ou non)
  const { data: repondants } = await sb
    .from('inscriptions')
    .select('benevole_id')
    .eq('match_id', matchId)

  const repondantsIds = new Set(repondants?.map((r: any) => r.benevole_id) || [])

  return (tous || []).filter((b: any) => !repondantsIds.has(b.id))
}

// ── Envoi bulk Mailjet ───────────────────────────────────────
async function sendBulkEmail(
  destinataires: any[],
  { subject, type, match }: { subject: string, type: string, match: any }
) {
  const messages = destinataires.map(b => ({
    From: { Email: 'marketing@spacerstoulouse.fr', Name: "Spacer's Toulouse Volley" },
    To: [{ Email: b.email, Name: `${b.prenom || ''} ${b.nom || ''}`.trim() }],
    Subject: subject,
    HTMLPart: getEmailHTML(type, b, match),
  }))

  // Mailjet accepte max 50 messages par appel → on découpe
  const chunks = []
  for (let i = 0; i < messages.length; i += 50) {
    chunks.push(messages.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    const creds = btoa(`${MAILJET_KEY}:${MAILJET_SECRET}`)
    console.log(`Calling Mailjet with ${chunk.length} message(s)...`)
    console.log(`MAILJET_KEY defined: ${!!MAILJET_KEY}, MAILJET_SECRET defined: ${!!MAILJET_SECRET}`)

    try {
      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${creds}`
        },
        body: JSON.stringify({ Messages: chunk })
      })
      const responseText = await res.text()
      console.log(`Mailjet response status: ${res.status}`)
      console.log(`Mailjet response body: ${responseText}`)
      if (!res.ok) {
        throw new Error(`Mailjet error ${res.status}: ${responseText}`)
      }
    } catch (err) {
      console.error('Mailjet fetch failed:', (err as Error).message)
      throw err
    }
  }
}

// ── Templates HTML ───────────────────────────────────────────
function getEmailHTML(type: string, b: any, match: any): string {
  const prenom = b.prenom || 'Bénévole'
  const date = new Date(match.date_match).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
  const adversaire = match.adversaire
  const heure = match.heure || '17h00'
  const lieu = match.lieu || 'Palais des Sports'

  const base = `
    <div style="font-family:'Arial',sans-serif;max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#042C53,#185FA5);padding:28px 32px;text-align:center;">
        <div style="font-size:36px;margin-bottom:10px;">🏐</div>
        <div style="font-size:18px;font-weight:800;color:white;">Spacers vs ${adversaire}</div>
        <div style="font-size:12px;color:rgba(181,212,244,0.8);margin-top:4px;">${date} · ${heure} · ${lieu}</div>
      </div>
      <div style="padding:24px 32px;">
        <p style="font-size:15px;color:#1a1a18;">Bonjour <strong style="color:#185FA5;">${prenom}</strong>,</p>
        CONTENT
      </div>
      <div style="background:#042C53;padding:16px;text-align:center;">
        <p style="font-size:11px;color:rgba(181,212,244,0.5);margin:0;">Spacer's Toulouse Volley · Palais des Sports · Toulouse</p>
      </div>
    </div>`

  const contents: Record<string, string> = {
    ouverture: `
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">Les inscriptions pour le prochain match sont ouvertes. Indique ta disponibilité avant J-10 pour qu'on puisse construire l'équipe bénévole sereinement.</p>
        <div style="background:#E6F1FB;border-radius:12px;padding:14px;margin:16px 0;">
          <div style="font-size:12px;color:#0C447C;">📅 <strong>${date}</strong> · ${heure}<br>📍 ${lieu}</div>
        </div>
        <a href="https://spacers-benevoles.spacersytb.workers.dev" style="display:block;background:#185FA5;color:white;border-radius:50px;padding:13px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">Indiquer ma disponibilité →</a>`,

    relance_j10: `
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">On n'a pas encore reçu ta réponse pour ce match. Il reste des places — on compte sur toi pour te positionner rapidement.</p>
        <div style="background:#FEF3DC;border-radius:12px;padding:14px;margin:16px 0;border:1.5px solid #FAC775;">
          <div style="font-size:12px;color:#854F0B;">⏰ <strong>J-10</strong> — Réponds avant J-5 pour être convoqué</div>
        </div>
        <a href="https://spacers-benevoles.spacersytb.workers.dev" style="display:block;background:#185FA5;color:white;border-radius:50px;padding:13px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">Je réponds maintenant →</a>`,

    urgence_j5: `
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">Plus que 5 jours. On a encore besoin de toi pour ce match — c'est ta dernière chance de t'inscrire.</p>
        <div style="background:#FBEAF0;border-radius:12px;padding:14px;margin:16px 0;border:1.5px solid #F0A0BD;">
          <div style="font-size:12px;color:#993556;">🚨 <strong>J-5</strong> — Dernier appel</div>
        </div>
        <a href="https://spacers-benevoles.spacersytb.workers.dev" style="display:block;background:#993556;color:white;border-radius:50px;padding:13px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">Je me porte volontaire →</a>`,

    convocation_j1: `
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">Tu es <strong style="color:#3B6D11;">convoqué(e) pour demain</strong>. Merci pour ton engagement — voici les infos pratiques :</p>
        <div style="background:#EAF3DE;border-radius:12px;padding:14px;margin:16px 0;border:1.5px solid #C0DD97;">
          <div style="font-size:13px;color:#3B6D11;line-height:1.8;">
            📅 <strong>Demain</strong> · ${heure}<br>
            📍 ${lieu}<br>
            ⏰ Arrivée demandée <strong>30 min avant</strong><br>
            🪪 Ton accréditation te sera remise sur place
          </div>
        </div>
        <p style="font-size:12px;color:#5F5E5A;">En cas d'empêchement de dernière minute, préviens Clément directement.</p>`,

    post_match: `
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">Un grand merci pour ta présence hier soir. Grâce à toi, ce match a été une réussite côté coulisses.</p>
        <div style="background:#E6F1FB;border-radius:12px;padding:14px;margin:16px 0;text-align:center;">
          <div style="font-size:9px;color:#5F5E5A;letter-spacing:2px;margin-bottom:4px;">POINTS CRÉDITÉS</div>
          <div style="font-size:36px;font-weight:800;color:#F5C842;font-family:monospace;">+50</div>
          <div style="font-size:11px;color:#0C447C;margin-top:2px;">Présence confirmée</div>
        </div>
        <a href="https://spacers-benevoles.spacersytb.workers.dev" style="display:block;background:#185FA5;color:white;border-radius:50px;padding:13px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px;">Voir mes points →</a>`
  }

  return base.replace('CONTENT', contents[type] || '')
}
