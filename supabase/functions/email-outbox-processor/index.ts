// ============================================================
// Edge Function : email-outbox-processor
// Projet  : spacers-benevoles (xphuolvbamdkizydveij)
// Version : 1.0
// Date    : 2026-05-04
// ============================================================
// Consomme la table public.email_outbox toutes les 5 minutes :
// - lit jusqu'à BATCH_SIZE emails 'pending'
// - envoie chacun via Mailjet Send API v3.1
// - marque 'sent' / 'failed' avec gestion des retries (max 3 attempts)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── Constantes ────────────────────────────────────────────
const MAX_ATTEMPTS = 3
const BATCH_SIZE   = 50
const MAILJET_URL  = "https://api.mailjet.com/v3.1/send"

// ─── Auth simple par secret partagé ───────────────────────
function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_SECRET")
  if (!secret) return false
  const provided = req.headers.get("X-Outbox-Secret")
  return provided === secret
}

// ─── Mailjet send ─────────────────────────────────────────
async function sendViaMailjet(args: {
  apiKey: string
  apiSecret: string
  fromEmail: string
  fromName: string
  toEmail: string
  toName: string | null
  subject: string
  htmlPart: string
  textPart: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = btoa(`${args.apiKey}:${args.apiSecret}`)

  const message: Record<string, unknown> = {
    From: { Email: args.fromEmail, Name: args.fromName },
    To: [{ Email: args.toEmail, Name: args.toName || args.toEmail }],
    Subject: args.subject,
    HTMLPart: args.htmlPart,
  }
  if (args.textPart) message.TextPart = args.textPart

  let response: Response
  try {
    response = await fetch(MAILJET_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Messages: [message] }),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)")
    return { ok: false, error: `Mailjet ${response.status}: ${body.slice(0, 500)}` }
  }

  // Mailjet retourne 200 même si l'envoi a échoué partiellement, on inspecte
  try {
    const json = await response.json()
    const status = json?.Messages?.[0]?.Status
    if (status === "success") return { ok: true }
    return { ok: false, error: `Mailjet status=${status}: ${JSON.stringify(json).slice(0, 500)}` }
  } catch (err) {
    return { ok: false, error: `Mailjet response parse: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ─── Handler principal ────────────────────────────────────
Deno.serve(async (req) => {
  // CORS pour healthcheck éventuel
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Outbox-Secret, Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // Auth
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Env vars
  const supabaseUrl     = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const mailjetKey      = Deno.env.get("MAILJET_API_KEY")
  const mailjetSecret   = Deno.env.get("MAILJET_SECRET_KEY")
  const fromEmail       = Deno.env.get("MAILJET_FROM_EMAIL") || "marketing@spacerstoulouse.fr"
  const fromName        = Deno.env.get("MAILJET_FROM_NAME")  || "Spacers Toulouse Volley"

  if (!supabaseUrl || !serviceRoleKey || !mailjetKey || !mailjetSecret) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAILJET_API_KEY, MAILJET_SECRET_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  // Client service-role (bypasse RLS)
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Pull une batch d'emails pending ──
  const { data: pending, error: pullErr } = await sb
    .from("email_outbox")
    .select("id, to_email, to_name, subject, body_html, body_text, attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (pullErr) {
    return new Response(
      JSON.stringify({ error: "DB pull error", details: pullErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  if (!pending || pending.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, sent: 0, failed: 0, message: "no pending emails" }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // ── Envoi un par un (séquentiel, plus simple à tracer) ──
  let sent = 0
  let failed = 0
  const results: Array<Record<string, unknown>> = []

  for (const row of pending) {
    const result = await sendViaMailjet({
      apiKey:     mailjetKey,
      apiSecret:  mailjetSecret,
      fromEmail,
      fromName,
      toEmail:    row.to_email,
      toName:     row.to_name,
      subject:    row.subject,
      htmlPart:   row.body_html,
      textPart:   row.body_text,
    })

    if (result.ok) {
      const { error } = await sb
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq("id", row.id)
      if (error) {
        results.push({ id: row.id, status: "sent_but_db_update_failed", error: error.message })
      } else {
        results.push({ id: row.id, status: "sent" })
      }
      sent++
    } else {
      const newAttempts = row.attempts + 1
      const finalStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending"
      await sb
        .from("email_outbox")
        .update({
          status: finalStatus,
          attempts: newAttempts,
          last_error: result.error.slice(0, 1000),
        })
        .eq("id", row.id)
      results.push({ id: row.id, status: finalStatus, attempts: newAttempts, error: result.error.slice(0, 200) })
      failed++
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: pending.length,
      sent,
      failed,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
