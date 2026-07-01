// ────────────────────────────────────────────────────────────────────
// welcome-email - Envoi de l'email de bienvenue aux nouveaux bénévoles
// ────────────────────────────────────────────────────────────────────
// Déclenché par un Database Webhook Supabase sur INSERT dans `benevoles`
// Transport : Resend API (https://api.resend.com/emails)
// ────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'marketing@spacerstoulouse.fr'
const FROM_NAME      = Deno.env.get('FROM_NAME')  || "Spacer's Toulouse Volley"
const APP_URL        = Deno.env.get('APP_URL')    || 'https://benevoles.spacerstoulouse.fr'
const WEBHOOK_SECRET = Deno.env.get('WELCOME_WEBHOOK_SECRET') || null

Deno.serve(async (req: Request) => {
  try {
    // ── Vérification secret webhook (si configuré) ──
    if (WEBHOOK_SECRET) {
      const provided = req.headers.get('x-webhook-secret')
      if (provided !== WEBHOOK_SECRET) {
        console.warn('Unauthorized webhook attempt')
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
    }

    // ── Parser le payload du webhook Supabase ──
    // Format : { type: 'INSERT', table: 'benevoles', record: {...}, old_record: null, schema: 'public' }
    const payload = await req.json()
    const benevole = payload?.record

    if (!benevole?.email) {
      return new Response(
        JSON.stringify({ error: 'No email in record', payload }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Filtre : ne pas envoyer aux comptes anonymisés ou désactivés ──
    if (benevole.email.includes('@spacers-deleted.local')) {
      return new Response('Skipped (anonymized)', { status: 200 })
    }
    if (benevole.statut_compte && benevole.statut_compte !== 'actif') {
      return new Response('Skipped (not active)', { status: 200 })
    }

    // ── Envoyer l'email via Resend ──
    console.log(`Sending welcome email to ${benevole.email}...`)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [benevole.email],
        subject: `Bienvenue chez les Spacers, ${benevole.prenom || ''} !`,
        html: getWelcomeHTML(benevole),
      }),
    })

    const responseText = await res.text()
    console.log(`Resend response status: ${res.status}`)

    if (!res.ok) {
      console.error('Resend error:', res.status, responseText)
      return new Response(
        JSON.stringify({ error: 'Resend failed', status: res.status, detail: responseText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Welcome email sent successfully to ${benevole.email}`)
    return new Response(
      JSON.stringify({ success: true, email: benevole.email }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('welcome-email error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ────────────────────────────────────────────────────────────────────
// Template HTML  (inchangé)
// ────────────────────────────────────────────────────────────────────
function getWelcomeHTML(b: any): string {
  const prenom = b.prenom || 'Bénévole'
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#042C53,#185FA5);padding:32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🏐</div>
        <div style="font-size:22px;font-weight:800;color:white;">Bienvenue dans la tribu !</div>
        <div style="font-size:13px;color:rgba(181,212,244,0.85);margin-top:6px;">Spacer's Toulouse Volley</div>
      </div>
      <div style="padding:28px 32px;">
        <p style="font-size:16px;color:#1a1a18;">Bonjour <strong style="color:#185FA5;">${prenom}</strong>,</p>
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">
          Bienvenue parmi les bénévoles des Spacers ! Tu fais désormais partie de la tribu qui fait vivre les soirées de matchs au Palais des Sports.
        </p>
        <p style="color:#5F5E5A;font-size:14px;line-height:1.7;">
          Pour bien démarrer, voici les premières étapes :
        </p>
        <div style="background:#E6F1FB;border-radius:12px;padding:16px;margin:18px 0;">
          <div style="font-size:13px;color:#0C447C;line-height:1.9;">
            ✅ <strong>Complète ton profil</strong> (téléphone, photo)<br>
            🏐 <strong>Découvre les postes</strong> bénévoles disponibles<br>
            📅 <strong>Indique tes disponibilités</strong> pour les prochains matchs<br>
            👥 <strong>Rencontre ton référent</strong> pour bien démarrer
          </div>
        </div>
        <a href="${APP_URL}" style="display:block;background:#185FA5;color:white;border-radius:50px;padding:14px;text-align:center;font-weight:700;font-size:14px;text-decoration:none;margin-top:20px;">
          Accéder à mon espace →
        </a>

        <!-- ── Installation PWA ── -->
        <div style="background:#FFF7E6;border:1px solid #F5D78A;border-radius:12px;padding:16px;margin:22px 0 4px;">
          <div style="font-size:14px;font-weight:700;color:#0C447C;margin-bottom:8px;">📲 Installe l'appli sur ton téléphone</div>
          <div style="font-size:13px;color:#5F5E5A;line-height:1.8;">
            Pour retrouver ton espace en un seul tap, comme une vraie application (et recevoir les notifications) :<br><br>
            <strong>📱 iPhone / iPad (Safari)</strong><br>
            Ouvre le site, touche le bouton <strong>Partager</strong> (le carré avec la flèche ⬆️ en bas de l'écran), puis choisis <strong>« Sur l'écran d'accueil »</strong>.<br><br>
            <strong>🤖 Android (Chrome)</strong><br>
            Ouvre le site, touche le menu <strong>⋮</strong> (en haut à droite), puis <strong>« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »).<br><br>
            L'icône Spacers apparaîtra alors sur ton écran d'accueil. 🏐
          </div>
        </div>

        <p style="font-size:12px;color:#888;margin-top:24px;text-align:center;">
          Une question ? Réponds simplement à cet email, on est là pour toi.
        </p>
      </div>
      <div style="background:#042C53;padding:16px;text-align:center;">
        <p style="font-size:11px;color:rgba(181,212,244,0.5);margin:0;">Spacer's Toulouse Volley · Palais des Sports André Brouat · Toulouse</p>
      </div>
    </div>`
}
