/* ============================================================
   tickie.js — Spacers Bénévoles
   Lien pointage bénévoles -> affluence Tickie (vivenu)
   - pilote.html : bouton « 🎟️ Tickie » sous les actions du match
                   (réglage, test, essai d'émission, rapprochement,
                   relance des erreurs, indicateur abonnés)
                   + compteur Tickie dans l'écran de scan du pilote
   - scan.html   : compteur Tickie sous le compteur de pointage
   Chargé après le script principal de la page (utilise sb, curMatch / match).
   ============================================================ */
(function () {
  'use strict'
  var FN = 'tickie-checkin'

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function client() { try { return sb } catch (e) { return null } }
  function piloteMatch() { try { return curMatch } catch (e) { return null } }
  function scanMatch() { try { return match } catch (e) { return null } }

  async function appel(action, extra) {
    var c = client()
    var r = await c.functions.invoke(FN, { body: Object.assign({ action: action }, extra || {}) })
    if (r.error) {
      var msg = r.error.message || String(r.error)
      try { var b = await r.error.context.json(); if (b && b.error) msg = b.error } catch (e) {}
      throw new Error(msg)
    }
    if (r.data && r.data.error) throw new Error(r.data.error)
    return r.data
  }

  // ---------- ligne compteur Tickie (écrans de scan) ----------
  async function ligneCompteur(matchId, afterId) {
    var c = client(); if (!c || !matchId) return
    var host = document.getElementById(afterId); if (!host) return
    var el = document.getElementById('tickie-count')
    if (!el) {
      el = document.createElement('div'); el.id = 'tickie-count'
      el.style.cssText = 'text-align:center;font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px;'
      host.parentNode.insertBefore(el, host.nextSibling)
    }
    try {
      var r = await c.rpc('tickie_compteur', { p_match_id: matchId })
      var d = r.data
      if (!d) { el.textContent = ''; return }
      if (!d.configure) { el.textContent = '🎟️ Tickie : match pas encore relié'; return }
      var t = '🎟️ ' + d.comptes + ' compté' + (d.comptes > 1 ? 's' : '') + ' dans l\'affluence Tickie'
      if (d.en_attente) t += ' · ' + d.en_attente + ' en cours'
      if (d.erreurs) t += ' · ⚠️ ' + d.erreurs + ' en erreur'
      el.textContent = t
    } catch (e) { el.textContent = '' }
  }

  // ---------- écran scan.html ----------
  if (typeof window.compteur === 'function' && document.getElementById('count') && !document.getElementById('screen-match')) {
    var orig = window.compteur
    window.compteur = async function () {
      var res = await orig.apply(this, arguments)
      var m = scanMatch()
      if (m) {
        ligneCompteur(m.id, 'count')
        setTimeout(function () { ligneCompteur(m.id, 'count') }, 4000) // laisse le temps au check-in de partir
      }
      return res
    }
    return
  }

  // ---------- pilote.html ----------
  if (!document.getElementById('screen-match')) return

  if (typeof window._scanCount === 'function') {
    var origScan = window._scanCount
    window._scanCount = async function () {
      var res = await origScan.apply(this, arguments)
      var m = piloteMatch()
      if (m) {
        ligneCompteur(m.id, 'scan-count')
        setTimeout(function () { ligneCompteur(m.id, 'scan-count') }, 4000)
      }
      return res
    }
  }

  function injecterBouton() {
    if (document.getElementById('tickie-btn')) return
    var scanBtn = document.querySelector('#screen-match button[onclick="openScanner()"]')
    if (!scanBtn || !scanBtn.parentNode) return
    var row = document.createElement('div')
    row.style.cssText = 'margin:0 0 4px;'
    row.innerHTML = '<button id="tickie-btn" class="btn btn-blue btn-sm" style="width:100%;padding:10px 4px;">🎟️ Tickie — bénévoles dans l\'affluence</button>'
    scanBtn.parentNode.parentNode.insertBefore(row, scanBtn.parentNode.nextSibling)
    document.getElementById('tickie-btn').onclick = ouvrir
  }

  var ST = {
    sent: ['✅ Compté', '#1f6f43'], pending: ['⏳ En cours', '#1d4f7a'], checkout_pending: ['⏳ Sortie en cours', '#1d4f7a'],
    checked_out: ['↩️ Sorti', '#3a3f4a'], annule: ['— Annulé', '#3a3f4a'], no_config: ['⚙️ Match non relié', '#8a5a12'],
    no_ticket: ['🎟️ Plus de billet', '#8a5a12'], failed: ['⚠️ Erreur', '#5c1f2b'], absent_file: ['⏳ En cours', '#1d4f7a']
  }

  function overlay() {
    var ov = document.getElementById('tickie-ov')
    if (ov) return ov
    ov = document.createElement('div'); ov.id = 'tickie-ov'
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,12,22,0.92);z-index:9998;overflow:auto;padding:14px;font-family:Sora,sans-serif;color:white;'
    ov.innerHTML = '<div style="max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px;">'
      + '<div style="display:flex;align-items:center;gap:10px;"><div style="flex:1;"><div style="font-size:15px;font-weight:800;">🎟️ Tickie — bénévoles dans l\'affluence</div>'
      + '<div id="tickie-sub" style="font-size:11px;color:rgba(255,255,255,0.5);"></div></div>'
      + '<button class="btn btn-ghost btn-sm" id="tickie-close">Fermer</button></div>'
      + '<div id="tickie-msg"></div><div id="tickie-body"></div></div>'
    document.body.appendChild(ov)
    document.getElementById('tickie-close').onclick = function () { ov.style.display = 'none' }
    return ov
  }
  function msg(txt, type) {
    var bg = type === 'e' ? '#5c1f2b' : type === 'ok' ? '#1f6f43' : '#1d4f7a'
    document.getElementById('tickie-msg').innerHTML = txt
      ? '<div style="background:' + bg + ';border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;">' + txt + '</div>' : ''
  }
  function carte(html) {
    return '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;">' + html + '</div>'
  }
  function tuile(v, l, c) {
    return '<div style="background:rgba(255,255,255,0.06);border-radius:10px;padding:10px 6px;text-align:center;">'
      + '<div style="font-size:20px;font-weight:800;color:' + (c || 'white') + ';">' + v + '</div>'
      + '<div style="font-size:10px;color:rgba(255,255,255,0.55);line-height:1.3;">' + l + '</div></div>'
  }
  var selStyle = 'width:100%;background:#16263b;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:9px 10px;font-family:inherit;font-size:12px;color:white;margin-top:6px;'

  async function ouvrir() {
    var m = piloteMatch()
    if (!m) { try { showAlert('alert-match', 'Ouvre d\'abord un match', 'e') } catch (e) {} return }
    var ov = overlay(); ov.style.display = 'block'
    document.getElementById('tickie-sub').textContent = 'Spacers vs ' + (m.adversaire || '')
    msg('')
    await rendre()
  }

  async function rendre() {
    var m = piloteMatch(); var c = client()
    var body = document.getElementById('tickie-body')
    body.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.5);">Chargement…</div>'
    var r = await c.rpc('tickie_rapprochement', { p_match_id: m.id })
    if (r.error) { body.innerHTML = ''; msg(esc(r.error.message), 'e'); return }
    var d = r.data || {}
    var h = ''

    // Réglage
    h += carte('<div style="font-size:12px;font-weight:700;margin-bottom:4px;">⚙️ Réglage du match</div>'
      + (d.configure
        ? '<div style="font-size:12px;line-height:1.6;">Relié à Tickie · billet <b>' + esc(d.vivenu_ticket_type_nom || d.vivenu_ticket_type_id) + '</b><br>'
          + '<span style="color:rgba(255,255,255,0.5);font-size:11px;">' + d.billets_total + ' billet(s) nominatif(s) émis pour ce match · sans envoi de mail</span></div>'
        : '<div style="font-size:12px;color:#F5C842;">Ce match n\'est pas encore relié à Tickie : les pointages sont gardés en attente et partiront dès le réglage.</div>')
      + '<div id="tickie-cfg" style="margin-top:8px;"></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="tk-regler">' + (d.configure ? 'Modifier le réglage' : 'Relier à Tickie') + '</button>'
      + (d.configure ? '<button class="btn btn-ghost btn-sm" id="tk-test">🔌 Tester la connexion</button><button class="btn btn-ghost btn-sm" id="tk-essai">🧪 Essai d\'émission</button>' : '')
      + '</div>')

    // Chiffres
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">'
      + tuile(d.pointes + '<span style="font-size:12px;opacity:0.6;"> / ' + d.inscrits + '</span>', 'pointés / inscrits')
      + tuile(d.comptes, 'comptés dans Tickie', '#5fd39a')
      + tuile(d.en_attente, 'en cours', '#8fc3ff')
      + tuile(d.erreurs, 'en erreur', d.erreurs ? '#ff8a8a' : 'white')
      + '</div>'
    if (d.pointes !== d.comptes + d.en_attente + d.erreurs) {
      h += '<div style="font-size:11px;color:rgba(255,255,255,0.55);">Écart pointés / Tickie : vérifie la liste ci-dessous.</div>'
    }

    // Abonnés
    h += carte('<div style="font-size:12px;font-weight:700;">⭐ Bénévoles abonnés présents : ' + d.abonnes_presents + '</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.5;margin-top:4px;">Si un bénévole abonné entre aussi avec sa carte d\'abonnement, il est compté deux fois dans l\'affluence : retire au plus ce nombre du total Tickie.'
      + (d.abonnes_verifies_le ? ' Dernière vérification : ' + new Date(d.abonnes_verifies_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '.' : ' Jamais vérifié.')
      + '</div><div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" id="tk-abo">🔄 Vérifier les abonnés</button></div>')

    // Liste
    var lignes = d.lignes || []
    var tab = lignes.map(function (l) {
      var s = ST[l.statut_tickie] || (l.present ? ST.pending : null)
      var badge = s ? '<span style="background:' + s[1] + ';border-radius:20px;padding:2px 8px;font-size:10px;white-space:nowrap;">' + s[0] + '</span>'
                    : '<span style="font-size:10px;color:rgba(255,255,255,0.35);">non pointé</span>'
      return '<tr><td style="padding:6px 4px;font-size:12px;">' + esc(l.prenom) + ' ' + esc(l.nom) + (l.est_abonne ? ' ⭐' : '') + '</td>'
        + '<td style="padding:6px 4px;font-size:11px;color:rgba(255,255,255,0.6);">' + (l.pointe_le ? new Date(l.pointe_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '') + '</td>'
        + '<td style="padding:6px 4px;text-align:right;">' + badge + (l.erreur ? '<div style="font-size:10px;color:#ff8a8a;margin-top:2px;">' + esc(l.erreur) + '</div>' : '') + '</td></tr>'
    }).join('')
    h += carte('<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="flex:1;font-size:12px;font-weight:700;">📋 Rapprochement</div>'
      + (d.erreurs ? '<button class="btn btn-orange btn-sm" id="tk-relancer">↻ Relancer les erreurs</button>' : '')
      + '<button class="btn btn-ghost btn-sm" id="tk-refresh">Actualiser</button></div>'
      + (lignes.length ? '<table style="width:100%;border-collapse:collapse;">' + tab + '</table>' : '<div style="font-size:12px;color:rgba(255,255,255,0.5);">Aucun bénévole inscrit.</div>'))

    body.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' + h + '</div>'

    document.getElementById('tk-regler').onclick = regler
    var be = document.getElementById('tk-essai'); if (be) be.onclick = essai
    var bt = document.getElementById('tk-test'); if (bt) bt.onclick = tester
    document.getElementById('tk-abo').onclick = abonnes
    document.getElementById('tk-refresh').onclick = function () { msg(''); rendre() }
    var br = document.getElementById('tk-relancer'); if (br) br.onclick = relancer
  }

  async function regler() {
    var zone = document.getElementById('tickie-cfg')
    zone.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,0.5);">Chargement des événements Tickie…</div>'
    try {
      var ev = await appel('events')
      var m = piloteMatch()
      var opts = (ev.events || []).map(function (e) {
        return '<option value="' + esc(e.id) + '">' + esc(e.nom) + (e.date ? ' — ' + new Date(e.date).toLocaleDateString('fr-FR') : '') + '</option>'
      }).join('')
      zone.innerHTML = '<label style="font-size:11px;color:rgba(255,255,255,0.6);">Événement Tickie</label>'
        + '<select id="tk-ev" style="' + selStyle + '"><option value="">— Choisir —</option>' + opts + '</select>'
        + '<label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-top:8px;">Type de billet réservé aux bénévoles</label>'
        + '<select id="tk-type" style="' + selStyle + '" disabled><option value="">Choisis d\'abord l\'événement</option></select>'
        + '<button class="btn btn-green btn-sm" id="tk-save" style="width:100%;margin-top:8px;" disabled>Enregistrer</button>'
      var sel = document.getElementById('tk-ev')
      // présélection : même date que le match
      if (m && m.date_match) {
        var jour = String(m.date_match).slice(0, 10)
        for (var i = 0; i < (ev.events || []).length; i++) {
          if (String(ev.events[i].date || '').slice(0, 10) === jour) { sel.value = ev.events[i].id; break }
        }
      }
      sel.onchange = chargerTypes
      if (sel.value) chargerTypes()
    } catch (e) { zone.innerHTML = ''; msg('Tickie injoignable : ' + esc(e.message), 'e') }
  }

  async function chargerTypes() {
    var ev = document.getElementById('tk-ev').value
    var ts = document.getElementById('tk-type'), save = document.getElementById('tk-save')
    ts.disabled = true; save.disabled = true
    if (!ev) { ts.innerHTML = '<option value="">Choisis d\'abord l\'événement</option>'; return }
    ts.innerHTML = '<option>Chargement…</option>'
    try {
      var d = await appel('event_types', { event_id: ev })
      var gratuits = (d.types || []).filter(function (t) { return !t.prix })
      var autres = (d.types || []).filter(function (t) { return t.prix })
      var opt = function (t) {
        var shop = (t.shops && t.shops[0]) ? t.shops[0].id : ''
        return '<option value="' + esc(t.id) + '" data-nom="' + esc(t.nom) + '" data-shop="' + esc(shop) + '" data-place="' + (t.place ? '1' : '') + '" data-shops="' + esc((t.shops || []).map(function (x) { return x.nom }).join(', ')) + '">'
          + esc(t.nom) + ' · ' + esc(t.categorie || '') + ' · ' + (t.prix ? t.prix + ' €' : 'gratuit') + (t.actif_public ? '' : ' · hors vente') + '</option>' }
      ts.innerHTML = '<option value="">— Choisir —</option>' + gratuits.map(opt).join('') + (autres.length ? '<optgroup label="Payants">' + autres.map(opt).join('') + '</optgroup>' : '')
      for (var i = 0; i < gratuits.length; i++) { if (/b[ée]n[ée]vole/i.test(gratuits[i].nom)) { ts.value = gratuits[i].id; break } }
      ts.disabled = false
      var info = document.getElementById('tk-type-info')
      if (!info) { info = document.createElement('div'); info.id = 'tk-type-info'; info.style.cssText = 'font-size:11px;line-height:1.5;margin-top:6px;'; ts.parentNode.insertBefore(info, save) }
      var maj = function () {
        save.disabled = !ts.value
        var o = ts.options[ts.selectedIndex]
        if (!ts.value || !o) { info.innerHTML = ''; return }
        var w = []
        if (o.getAttribute('data-place')) w.push('<span style="color:#ff8a8a;">⚠️ Catégorie placée : passe ce type sur une catégorie non placée (debout / staff), sinon l\'émission échouera.</span>')
        w.push(o.getAttribute('data-shops') ? '<span style="color:rgba(255,255,255,0.55);">Secret shop : ' + esc(o.getAttribute('data-shops')) + '</span>' : '<span style="color:#F5C842;">Ce type n\'est dans aucun secret shop actif : ajoute-le à « Invités – 26/27 ».</span>')
        info.innerHTML = w.join('<br>')
      }
      ts.onchange = maj
      maj()
      save.onclick = enregistrer
    } catch (e) { msg(esc(e.message), 'e') }
  }

  async function enregistrer() {
    var m = piloteMatch(); var c = client()
    var ts = document.getElementById('tk-type')
    var nom = ts.options[ts.selectedIndex] ? ts.options[ts.selectedIndex].getAttribute('data-nom') : null
    var shop = ts.options[ts.selectedIndex] ? ts.options[ts.selectedIndex].getAttribute('data-shop') : null
    var r = await c.rpc('set_match_vivenu', { p_match_id: m.id, p_event_id: document.getElementById('tk-ev').value, p_ticket_type_id: ts.value, p_ticket_type_nom: nom, p_under_shop_id: shop || null })
    if (r.error) { msg(esc(r.error.message), 'e'); return }
    msg('Match relié à Tickie.' + (r.data && r.data.relances ? ' ' + r.data.relances + ' pointage(s) en attente relancé(s).' : ''), 'ok')
    rendre()
  }

  async function essai() {
    if (!confirm('Émettre un billet test à TON nom sur ce match (sans mail, sans entrée), puis l\'annuler aussitôt ?')) return
    msg('Essai en cours…')
    try {
      var d = await appel('essai', { match_id: piloteMatch().id })
      var e = d.etapes || {}
      msg('Client Tickie : ' + esc(e.client) + '<br>Billet : ' + esc(e.billet) + '<br>Annulation : ' + esc(e.annulation)
        + (d.ok ? '<br><span style="opacity:0.8;">Vérifie dans Tickie que le client ' + esc(d.email) + ' porte bien le tag et qu\'aucun mail n\'est parti.</span>' : ''), d.ok ? 'ok' : 'e')
    } catch (e) { msg('Essai en échec : ' + esc(e.message), 'e') }
  }

  async function tester() {
    msg('Test en cours (aucune écriture chez Tickie)…')
    try {
      var d = await appel('test', { match_id: piloteMatch().id })
      var ok = String(d.api_billetterie || '').indexOf('ok') === 0 && d.api_controle_acces === 'ok'
      msg('Billetterie : ' + esc(d.api_billetterie) + '<br>Contrôle d\'accès : ' + esc(d.api_controle_acces)
        + (d.scans_existants != null ? ' (' + d.scans_existants + ' scan(s) déjà sur l\'événement)' : ''), ok ? 'ok' : 'e')
    } catch (e) { msg(esc(e.message), 'e') }
  }

  async function relancer() {
    var r = await client().rpc('tickie_relancer', { p_match_id: piloteMatch().id })
    if (r.error) { msg(esc(r.error.message), 'e'); return }
    msg(r.data + ' envoi(s) relancé(s).', 'ok')
    setTimeout(rendre, 2500)
  }

  async function abonnes() {
    msg('Vérification des abonnés dans Tickie…')
    try {
      var d = await appel('sync_abonnes')
      msg(d.abonnes + ' bénévole(s) abonné(s) sur ' + d.benevoles + '.', 'ok')
    } catch (e) { msg(esc(e.message), 'e') }
    rendre()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injecterBouton)
  else injecterBouton()
})()
