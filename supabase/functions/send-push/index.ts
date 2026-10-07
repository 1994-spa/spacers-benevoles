// ============================================================
// send-push — Spacers Bénévoles
// Consomme public.push_outbox (status = 'pending') et envoie les
// notifications Web Push à tous les appareils du bénévole
// (public.push_subscriptions). Appelée :
//   - immédiatement par public.queue_push() (pg_net)
//   - toutes les 5 min par le cron 'push-outbox-secours'
// Secrets requis : VAPID_PRIVATE_KEY (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY fournis par Supabase)
// Déploiement : npx supabase functions deploy send-push --no-verify-jwt
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BOkGfTMtsiqrpUaw_2ISBgbR8jczKUORmQ4bEpV54_ZZn7mvv6CRbtK2hQKD_yplvCMzR4kJ9VU_VLQTMCuBZk4"
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@spacerstoulouse.fr"
const MAX_ATTEMPTS = 3

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok")
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")
  if (!url || !key || !priv) {
    return new Response(JSON.stringify({ error: "Secrets manquants (VAPID_PRIVATE_KEY ?)" }), { status: 500 })
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, priv)
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: rows, error } = await sb.from("push_outbox")
    .select("id, benevole_id, title, body, url, tag, attempts")
    .eq("status", "pending").order("created_at").limit(50)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const results: unknown[] = []
  for (const row of rows || []) {
    const { data: subs } = await sb.from("push_subscriptions")
      .select("endpoint, p256dh, auth").eq("benevole_id", row.benevole_id)
    if (!subs || subs.length === 0) {
      await sb.from("push_outbox").update({ status: "no_device", attempts: row.attempts + 1 }).eq("id", row.id)
      results.push({ id: row.id, status: "no_device" })
      continue
    }
    const payload = JSON.stringify({ title: row.title, body: row.body || "", url: row.url || "/dashboard.html", tag: row.tag || "spacers" })
    let ok = 0
    let lastErr = ""
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })
        ok++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        lastErr = String((e as Error).message || e).slice(0, 300)
        // abonnement expiré / révoqué : on le supprime
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint)
      }
    }
    const attempts = row.attempts + 1
    const status = ok > 0 ? "sent" : (attempts >= MAX_ATTEMPTS ? "failed" : "pending")
    await sb.from("push_outbox").update({
      status, attempts, last_error: ok > 0 ? null : lastErr,
      sent_at: ok > 0 ? new Date().toISOString() : null,
    }).eq("id", row.id)
    results.push({ id: row.id, status, devices: ok })
  }
  return new Response(JSON.stringify({ processed: results.length, results }), { headers: { "Content-Type": "application/json" } })
})
