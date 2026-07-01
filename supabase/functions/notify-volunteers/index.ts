// supabase/functions/notify-volunteers/index.ts
// Edge Function : envoi d'emails à la demande depuis le dashboard pilote
// 3 modes : 'affectes' | 'relance_globale' | 'relance_individuelle'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = 'marketing@spacerstoulouse.fr'
const FROM_NAME = "Spacer's Toulouse Volley"

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

async function sendEmail(to: { Email: string; Name: string }[], subject: string, html: string) {
  const messages = to.map(t => ({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [t.Email],
    subject: subject,
    html: html,
  }))
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(messages),
  })
  const body = await res.text()
  console.log('Resend status:', res.status, 'body:', body.substring(0, 500))
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${body}`)
  return res.status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    const { match_id, mode, benevole_id, heure_rdv, point_particulier } = body

    if (!match_id || !mode) {
      return new Response(JSON.stringify({ error: 'match_id et mode requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Charger le match
    const { data: match, error: mErr } = await sb
      .from('matchs').select('*').eq('id', match_id).single()
    if (mErr || !match) {
      return new Response(JSON.stringify({ error: 'Match introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let recipients: { email: string; prenom: string; nom: string; poste_nom?: string }[] = []
    let subject = ''
    let buildHtml: (r: typeof recipients[0]) => string

    // ─────────────────────────────────────────────────
    // MODE 1 : AFFECTÉS (notifAll)
    // ─────────────────────────────────────────────────
    if (mode === 'affectes') {
      const { data: insc } = await sb.from('inscriptions')
        .select('benevole_id, poste_id, benevoles(email, prenom, nom), postes(nom)')
        .eq('match_id', match_id)
        .eq('statut', 'disponible')
        .not('poste_id', 'is', null)

      recipients = (insc || []).map((i: any) => ({
        email: i.benevoles?.email,
        prenom: i.benevoles?.prenom || '',
        nom: i.benevoles?.nom || '',
        poste_nom: i.postes?.nom || 'Poste à confirmer',
      })).filter(r => r.email)

      subject = `📢 Infos pratiques — Match vs ${match.adversaire} ${fmtDate(match.date_match)}`

      buildHtml = (r) => `
        <div style="font-family:Sora,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f7f7f5;">
          <h2 style="color:#0C447C;">Bonjour ${r.prenom},</h2>
          <p style="color:#1a1a18;font-size:14px;line-height:1.7;">
            Voici les infos pratiques pour le match à venir :
          </p>
          <div style="background:white;border-radius:12px;padding:20px;margin:18px 0;">
            <p style="margin:6px 0;"><strong>🏐 Match :</strong> Spacers vs ${match.adversaire}</p>
            <p style="margin:6px 0;"><strong>📍 Lieu :</strong> ${match.lieu || 'Palais des Sports'}</p>
            <p style="margin:6px 0;"><strong>🕐 Heure de RDV :</strong> ${heure_rdv || (match.heure || '')}</p>
            <p style="margin:6px 0;"><strong>🎯 Ton poste :</strong> ${r.poste_nom}</p>
          </div>
          ${point_particulier ? `
          <div style="background:#FAC775;border-radius:12px;padding:16px;margin:18px 0;">
            <p style="margin:0;color:#1a1a18;font-size:13px;line-height:1.7;">
              <strong>⚠️ Point particulier :</strong><br>${point_particulier}
            </p>
          </div>` : ''}
          <p style="color:#1a1a18;font-size:14px;">Merci pour ton engagement, à très vite au Palais.</p>
          <p style="color:#5F5E5A;font-size:12px;margin-top:24px;">L'équipe Spacer's Toulouse Volley</p>
        </div>`
    }

    // ─────────────────────────────────────────────────
    // MODE 2 : RELANCE GLOBALE (relancer())
    // ─────────────────────────────────────────────────
    else if (mode === 'relance_globale') {
      // Bénévoles actifs qui n'ont AUCUNE inscription pour ce match
      const { data: actifs } = await sb.from('benevoles')
        .select('id, email, prenom, nom').eq('statut_compte', 'actif')

      const { data: inscritsList } = await sb.from('inscriptions')
        .select('benevole_id').eq('match_id', match_id)
      const inscritsSet = new Set((inscritsList || []).map((i: any) => i.benevole_id))

      recipients = (actifs || []).filter((b: any) => !inscritsSet.has(b.id) && b.email)
        .map((b: any) => ({ email: b.email, prenom: b.prenom || '', nom: b.nom || '' }))

      subject = `⚡ Tu n'as pas encore répondu — Match vs ${match.adversaire}`

      buildHtml = (r) => `
        <div style="font-family:Sora,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f7f7f5;">
          <h2 style="color:#993556;">Bonjour ${r.prenom},</h2>
          <p style="color:#1a1a18;font-size:14px;line-height:1.7;">
            On manque encore de bénévoles pour le prochain match :
          </p>
          <div style="background:white;border-radius:12px;padding:20px;margin:18px 0;">
            <p style="margin:6px 0;"><strong>📅 ${fmtDate(match.date_match)}</strong></p>
            <p style="margin:6px 0;"><strong>🏐 Spacers vs ${match.adversaire}</strong></p>
            <p style="margin:6px 0;"><strong>📍 ${match.lieu || 'Palais des Sports'}</strong></p>
          </div>
          <p style="color:#1a1a18;font-size:14px;line-height:1.7;">
            Connecte-toi pour indiquer ta disponibilité. Merci d'avance pour ton retour.
          </p>
          <a href="https://spacers-benevoles.spacersytb.workers.dev/dashboard" 
             style="display:inline-block;background:#185FA5;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:12px;">
            👉 Répondre au match
          </a>
          <p style="color:#5F5E5A;font-size:12px;margin-top:30px;">L'équipe Spacer's Toulouse Volley</p>
        </div>`
    }

    // ─────────────────────────────────────────────────
    // MODE 3 : RELANCE INDIVIDUELLE
    // ─────────────────────────────────────────────────
    else if (mode === 'relance_individuelle') {
      if (!benevole_id) {
        return new Response(JSON.stringify({ error: 'benevole_id requis pour relance_individuelle' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { data: b } = await sb.from('benevoles')
        .select('email, prenom, nom').eq('id', benevole_id).single()
      if (!b || !b.email) {
        return new Response(JSON.stringify({ error: 'Bénévole introuvable ou sans email' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      recipients = [{ email: b.email, prenom: b.prenom || '', nom: b.nom || '' }]

      subject = `⚡ Petit rappel personnel — Match vs ${match.adversaire}`

      buildHtml = (r) => `
        <div style="font-family:Sora,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f7f7f5;">
          <h2 style="color:#0C447C;">Bonjour ${r.prenom},</h2>
          <p style="color:#1a1a18;font-size:14px;line-height:1.7;">
            On compte sur toi pour le match du <strong>${fmtDate(match.date_match)}</strong> 
            (Spacers vs ${match.adversaire}). Tu peux te positionner en 1 clic :
          </p>
          <a href="https://spacers-benevoles.spacersytb.workers.dev/dashboard" 
             style="display:inline-block;background:#185FA5;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin-top:12px;">
            👉 Répondre au match
          </a>
          <p style="color:#5F5E5A;font-size:12px;margin-top:30px;">L'équipe Spacer's Toulouse Volley</p>
        </div>`
    }
    else {
      return new Response(JSON.stringify({ error: 'mode invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Aucun destinataire ?
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: 'Aucun destinataire' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Envoi par batchs de 100 (limite Resend /emails/batch par requête)
    const BATCH = 100
    let totalSent = 0
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH)
      // Resend : un message par destinataire pour personnaliser le HTML
      const messages = batch.map(r => ({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [r.email],
        subject: subject,
        html: buildHtml(r),
      }))
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify(messages),
      })
      const respBody = await res.text()
      console.log('Resend batch', i / BATCH, 'status:', res.status, 'body:', respBody.substring(0, 300))
      if (res.ok) totalSent += batch.length
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, mode }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Erreur:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
