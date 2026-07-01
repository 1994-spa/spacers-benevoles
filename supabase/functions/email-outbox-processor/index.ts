// ============================================================
// Edge Function : email-outbox-processor
// Projet  : spacers-benevoles (xphuolvbamdkizydveij)
// Version : 1.0
// Date    : 2026-05-04
// ============================================================
// Consomme la table public.email_outbox toutes les 5 minutes :
// - lit jusqu'à BATCH_SIZE emails 'pending'
// - envoie chacun via Resend API (POST /emails)
// - marque 'sent' / 'failed' avec gestion des retries (max 3 attempts)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── Constantes ────────────────────────────────────────────
const MAX_ATTEMPTS = 3
const BATCH_SIZE   = 50
const RESEND_URL   = "https://api.resend.com/emails"

// ─── Auth simple par secret partagé ───────────────────────
function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_SECRET")
  if (!secret) return false
  const provided = req.headers.get("X-Outbox-Secret")
  return provided === secret
}

// ─── Resend send ──────────────────────────────────────────
async function sendViaResend(args: {
  apiKey: string
  fromEmail: string
  fromName: string
  toEmail: string
  toName: string | null
  subject: string
  htmlPart: string
  textPart: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message: Record<string, unknown> = {
    from: `${args.fromName} <${args.fromEmail}>`,
    to: [args.toEmail],
    subject: args.subject,
    html: args.htmlPart,
  }
  if (args.textPart) message.text = args.textPart

  let response: Response
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)")
    return { ok: false, error: `Resend ${response.status}: ${body.slice(0, 500)}` }
  }

  // Resend renvoie un statut HTTP fiable + { id } en cas de succès
  return { ok: true }
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
  const resendKey       = Deno.env.get("RESEND_API_KEY")
  const fromEmail       = Deno.env.get("FROM_EMAIL") || "marketing@spacerstoulouse.fr"
  const fromName        = Deno.env.get("FROM_NAME")  || "Spacers Toulouse Volley"

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)" }),
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
    const result = await sendViaResend({
      apiKey:     resendKey,
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
