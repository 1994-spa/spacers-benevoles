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

  // ---------- styles de l'écran Tickie (charte de l'app) ----------
  function styles() {
    if (document.getElementById('tk-css')) return
    var css = document.createElement('style'); css.id = 'tk-css'
    css.textContent = [
      '#tk-ov{position:fixed;inset:0;z-index:9998;background:rgba(6,14,26,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;font-family:Sora,sans-serif;color:#fff;display:none}',
      '#tk-ov .tk-sheet{max-width:560px;margin:0 auto;min-height:100%;background:#0C1B2E;padding:18px 16px 90px;box-sizing:border-box}',
      '#tk-ov .tk-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}',
      '#tk-ov .tk-logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#F5C842,#FAC775);color:#042C53;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}',
      '#tk-ov .tk-title{font-size:16px;font-weight:800;line-height:1.2}',
      '#tk-ov .tk-sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px}',
      '#tk-ov .tk-x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:16px;cursor:pointer}',
      '#tk-ov .tk-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin-bottom:12px}',
      '#tk-ov .tk-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:8px}',
      '#tk-ov .tk-row{display:flex;align-items:center;gap:10px}',
      '#tk-ov .tk-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px}',
      '#tk-ov .tk-ok{background:rgba(95,211,154,.14);color:#5fd39a}',
      '#tk-ov .tk-warn{background:rgba(245,200,66,.14);color:#F5C842}',
      '#tk-ov .tk-ko{background:rgba(226,75,74,.16);color:#ff8a8a}',
      '#tk-ov .tk-mut{background:rgba(255,255,255,.07);color:rgba(255,255,255,.55)}',
      '#tk-ov .tk-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '#tk-ov .tk-b{border:none;border-radius:50px;padding:9px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.09);color:#fff}',
      '#tk-ov .tk-b:disabled{opacity:.45;cursor:default}',
      '#tk-ov .tk-gold{background:#F5C842;color:#042C53}',
      '#tk-ov .tk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}',
      '#tk-ov .tk-stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:10px 4px;text-align:center}',
      '#tk-ov .tk-n{font-size:20px;font-weight:800}',
      '#tk-ov .tk-l{font-size:9.5px;color:rgba(255,255,255,.5);margin-top:2px;line-height:1.25}',
      '#tk-ov .tk-p{font-size:12px;color:rgba(255,255,255,.65);line-height:1.5}',
      '#tk-ov .tk-list{display:flex;flex-direction:column}',
      '#tk-ov .tk-li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}',
      '#tk-ov .tk-li:first-child{border-top:none}',
      '#tk-ov .tk-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '#tk-ov .tk-name{flex:1;font-size:13px;min-width:0}',
      '#tk-ov .tk-err{font-size:10.5px;color:#ff8a8a;margin-top:2px}',
      '#tk-ov .tk-time{font-size:11px;color:rgba(255,255,255,.45)}',
      '#tk-ov select{width:100%;background:#16263b;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;font-family:inherit;font-size:12px;color:#fff;margin-top:6px;box-sizing:border-box}',
      '#tk-ov .tk-f{font-size:11px;color:rgba(255,255,255,.55);display:block;margin-top:10px}',
      '#tk-ov .tk-filtre{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}',
      '#tk-ov .tk-filtre button{border:none;border-radius:50px;padding:5px 11px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}',
      '#tk-ov .tk-filtre button.on{background:#F5C842;color:#042C53}',
      '#tk-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,140%);z-index:10000;width:min(92vw,420px);box-sizing:border-box;padding:12px 18px;border-radius:16px;font-family:Sora,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.45);opacity:0;transition:transform .35s ease,opacity .35s ease;cursor:pointer}',
      '#tk-toast.show{transform:translate(-50%,0);opacity:1}',
      '#tk-toast.ok{background:#2f7a4a}#tk-toast.ko{background:#c0393b}#tk-toast.info{background:#1d3654}',
      '#tk-toast .t1{font-size:13px;font-weight:700}#tk-toast .t2{font-size:11px;opacity:.88;margin-top:3px;line-height:1.45}'
    ].join('')
    document.head.appendChild(css)
  }

  // Notification qui s'efface : verte si tout va bien, rouge s'il y a un souci
  function toast(type, titre, detail) {
    styles()
    var el = document.getElementById('tk-toast')
    if (!el) { el = document.createElement('div'); el.id = 'tk-toast'; document.body.appendChild(el); el.onclick = function () { el.classList.remove('show') } }
    el.className = type
    el.innerHTML = '<div class="t1">' + titre + '</div>' + (detail ? '<div class="t2">' + detail + '</div>' : '')
    void el.offsetWidth
    el.classList.add('show')
    clearTimeout(el._t)
    if (type !== 'info') el._t = setTimeout(function () { el.classList.remove('show') }, type === 'ko' ? 7000 : 4000)
  }
  var court = function (m) { return esc(String(m || '').replace(/^(GET|POST|PUT) \S+ /, '').slice(0, 140)) }

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

  // statut -> [libellé, couleur du point, chip]
  var ST = {
    sent: ['Compté', '#5fd39a', 'tk-ok'], pending: ['En cours', '#8fc3ff', 'tk-mut'], checkout_pending: ['Sortie en cours', '#8fc3ff', 'tk-mut'],
    checked_out: ['Sorti', 'rgba(255,255,255,.3)', 'tk-mut'], annule: ['Annulé', 'rgba(255,255,255,.3)', 'tk-mut'],
    no_config: ['Match non relié', '#F5C842', 'tk-warn'], no_ticket: ['Billet indisponible', '#F5C842', 'tk-warn'],
    failed: ['Erreur', '#ff6b6b', 'tk-ko'], absent_file: ['En cours', '#8fc3ff', 'tk-mut']
  }
  var filtre = 'tous', derniereDonnee = null

  function overlay() {
    styles()
    var ov = document.getElementById('tk-ov')
    if (ov) return ov
    ov = document.createElement('div'); ov.id = 'tk-ov'
    ov.innerHTML = '<div class="tk-sheet"><div class="tk-head"><div class="tk-logo">🎟️</div><div><div class="tk-title">Tickie</div>'
      + '<div class="tk-sub" id="tk-sub"></div></div><button class="tk-x" id="tk-close" aria-label="Fermer">✕</button></div><div id="tk-body"></div></div>'
    document.body.appendChild(ov)
    document.getElementById('tk-close').onclick = function () { ov.style.display = 'none' }
    return ov
  }

  async function ouvrir() {
    var m = piloteMatch()
    if (!m) { toast('ko', 'Ouvre d\'abord un match'); return }
    var ov = overlay(); ov.style.display = 'block'; ov.scrollTop = 0
    document.getElementById('tk-sub').textContent = 'Bénévoles dans l\'affluence · Spacers vs ' + (m.adversaire || '')
    await rendre()
  }

  function stat(v, l, c) { return '<div class="tk-stat"><div class="tk-n"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</div><div class="tk-l">' + l + '</div></div>' }

  async function rendre() {
    var m = piloteMatch(); var c = client()
    var body = document.getElementById('tk-body')
    if (!derniereDonnee) body.innerHTML = '<div class="tk-p">Chargement…</div>'
    var r = await c.rpc('tickie_rapprochement', { p_match_id: m.id })
    if (r.error) { toast('ko', 'Lecture impossible', court(r.error.message)); return }
    var d = derniereDonnee = r.data || {}
    var h = ''

    // Réglage
    h += '<div class="tk-card"><div class="tk-lbl">Réglage du match</div><div class="tk-row">'
      + (d.configure ? '<span class="tk-chip tk-ok">● Relié</span><span class="tk-p" style="color:#fff;font-weight:600;">' + esc(d.vivenu_ticket_type_nom || 'Billet bénévole') + '</span>'
                     : '<span class="tk-chip tk-warn">● À relier</span><span class="tk-p">Les pointages attendent le réglage.</span>')
      + '</div>' + (d.configure ? '<div class="tk-p" style="margin-top:6px;font-size:11px;">' + d.billets_total + ' billet' + (d.billets_total > 1 ? 's' : '') + ' nominatif' + (d.billets_total > 1 ? 's' : '') + ' émis · sans envoi de mail</div>' : '')
      + '<div id="tk-cfg"></div><div class="tk-btns">'
      + '<button class="tk-b' + (d.configure ? '' : ' tk-gold') + '" id="tk-regler">' + (d.configure ? 'Modifier' : 'Relier à Tickie') + '</button>'
      + (d.configure ? '<button class="tk-b" id="tk-test">Tester la connexion</button><button class="tk-b" id="tk-essai">Essai d\'émission</button>' : '')
      + '</div></div>'

    // Chiffres
    h += '<div class="tk-stats">' + stat(d.pointes + '<span style="font-size:12px;opacity:.5;">/' + d.inscrits + '</span>', 'pointés')
      + stat(d.comptes, 'comptés Tickie', '#5fd39a') + stat(d.en_attente, 'en cours', '#8fc3ff')
      + stat(d.erreurs, 'en erreur', d.erreurs ? '#ff6b6b' : null) + '</div>'

    // Abonnés
    h += '<div class="tk-card"><div class="tk-row"><div style="flex:1;"><div class="tk-lbl" style="margin:0;">Bénévoles abonnés présents</div>'
      + '<div class="tk-p" style="font-size:11px;margin-top:4px;">' + (d.abonnes_verifies_le ? 'Vérifié le ' + new Date(d.abonnes_verifies_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Jamais vérifié') + ' · risque de double comptage</div></div>'
      + '<div class="tk-n" style="color:#F5C842;">' + d.abonnes_presents + '</div></div>'
      + '<div class="tk-btns"><button class="tk-b" id="tk-abo">Vérifier les abonnés</button></div></div>'

    // Liste
    var lignes = (d.lignes || []).filter(function (l) {
      if (filtre === 'pointes') return l.present
      if (filtre === 'souci') return ['failed', 'no_ticket', 'no_config'].indexOf(l.statut_tickie) >= 0 || !!l.erreur
      return true
    })
    var nbSouci = (d.lignes || []).filter(function (l) { return ['failed', 'no_ticket', 'no_config'].indexOf(l.statut_tickie) >= 0 || !!l.erreur }).length
    h += '<div class="tk-card"><div class="tk-row" style="margin-bottom:8px;"><div class="tk-lbl" style="margin:0;flex:1;">Rapprochement</div>'
      + (d.erreurs ? '<button class="tk-b tk-gold" id="tk-relancer" style="padding:6px 12px;">Relancer les erreurs</button>' : '')
      + '<button class="tk-b" id="tk-refresh" style="padding:6px 12px;">↻</button></div>'
      + '<div class="tk-filtre">'
      + ['tous|Tous', 'pointes|Pointés', 'souci|Soucis' + (nbSouci ? ' (' + nbSouci + ')' : '')].map(function (x) { var k = x.split('|'); return '<button data-f="' + k[0] + '" class="' + (filtre === k[0] ? 'on' : '') + '">' + k[1] + '</button>' }).join('')
      + '</div><div class="tk-list">'
      + (lignes.length ? lignes.map(function (l) {
          var s = ST[l.statut_tickie] || (l.present ? ST.pending : null)
          return '<div class="tk-li"><span class="tk-dot" style="background:' + (s ? s[1] : 'rgba(255,255,255,.15)') + '"></span>'
            + '<div class="tk-name">' + esc(l.prenom) + ' ' + esc(l.nom) + (l.est_abonne ? ' <span title="abonné">⭐</span>' : '')
            + (l.erreur ? '<div class="tk-err">' + esc(l.erreur) + '</div>' : '') + '</div>'
            + (l.pointe_le ? '<span class="tk-time">' + new Date(l.pointe_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>' : '')
            + (s ? '<span class="tk-chip ' + s[2] + '">' + s[0] + '</span>' : '<span class="tk-chip tk-mut">Non pointé</span>') + '</div>'
        }).join('') : '<div class="tk-p">Personne dans ce filtre.</div>')
      + '</div></div>'

    body.innerHTML = h
    document.getElementById('tk-regler').onclick = regler
    var bt = document.getElementById('tk-test'); if (bt) bt.onclick = tester
    var be = document.getElementById('tk-essai'); if (be) be.onclick = essai
    document.getElementById('tk-abo').onclick = abonnes
    document.getElementById('tk-refresh').onclick = rendre
    var br = document.getElementById('tk-relancer'); if (br) br.onclick = relancer
    Array.prototype.forEach.call(body.querySelectorAll('.tk-filtre button'), function (b) { b.onclick = function () { filtre = b.getAttribute('data-f'); rendre() } })
  }

  async function occupe(btn, fn) {
    if (btn) { btn.disabled = true; btn._t = btn.textContent; btn.textContent = '…' }
    try { await fn() } finally { if (btn) { btn.disabled = false; btn.textContent = btn._t } }
  }

  async function regler() {
    var zone = document.getElementById('tk-cfg')
    zone.innerHTML = '<div class="tk-p" style="margin-top:10px;">Chargement des événements…</div>'
    try {
      var ev = await appel('events')
      var m = piloteMatch()
      zone.innerHTML = '<label class="tk-f">Événement Tickie</label><select id="tk-ev"><option value="">Choisir…</option>'
        + (ev.events || []).map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.nom) + (e.date ? ' — ' + new Date(e.date).toLocaleDateString('fr-FR') : '') + '</option>' }).join('')
        + '</select><label class="tk-f">Billet des bénévoles</label><select id="tk-type" disabled><option>Choisis d\'abord l\'événement</option></select>'
        + '<div id="tk-type-info" class="tk-p" style="font-size:11px;margin-top:6px;"></div>'
        + '<div class="tk-btns"><button class="tk-b tk-gold" id="tk-save" disabled>Enregistrer</button></div>'
      var sel = document.getElementById('tk-ev')
      if (m && m.date_match) {
        var jour = String(m.date_match).slice(0, 10)
        for (var i = 0; i < (ev.events || []).length; i++) if (String(ev.events[i].date || '').slice(0, 10) === jour) { sel.value = ev.events[i].id; break }
      }
      sel.onchange = chargerTypes
      if (sel.value) chargerTypes()
    } catch (e) { zone.innerHTML = ''; toast('ko', 'Tickie injoignable', court(e.message)) }
  }

  async function chargerTypes() {
    var ev = document.getElementById('tk-ev').value
    var ts = document.getElementById('tk-type'), save = document.getElementById('tk-save'), info = document.getElementById('tk-type-info')
    ts.disabled = true; save.disabled = true; info.innerHTML = ''
    if (!ev) return
    ts.innerHTML = '<option>Chargement…</option>'
    try {
      var d = await appel('event_types', { event_id: ev })
      var gratuits = (d.types || []).filter(function (t) { return !t.prix })
      ts.innerHTML = '<option value="">Choisir…</option>' + gratuits.map(function (t) {
        var shop = (t.shops && t.shops[0]) ? t.shops[0].id : ''
        return '<option value="' + esc(t.id) + '" data-nom="' + esc(t.nom) + '" data-shop="' + esc(shop) + '" data-place="' + (t.place ? '1' : '') + '" data-shops="' + esc((t.shops || []).map(function (x) { return x.nom }).join(', ')) + '">'
          + esc(t.nom) + ' · ' + esc(t.categorie || '') + '</option>'
      }).join('')
      // présélection : le type « bénévoles » non placé
      var cand = gratuits.filter(function (t) { return /b[ée]n[ée]vole/i.test(t.nom) })
      var best = cand.filter(function (t) { return !t.place })[0] || cand[0]
      if (best) ts.value = best.id
      ts.disabled = false
      var maj = function () {
        save.disabled = !ts.value
        var o = ts.options[ts.selectedIndex]
        if (!ts.value || !o) { info.innerHTML = ''; return }
        var w = []
        w.push(o.getAttribute('data-place') ? '<span class="tk-chip tk-ko">Catégorie placée : l\'émission échouera</span>' : '<span class="tk-chip tk-ok">Sans siège</span>')
        w.push(o.getAttribute('data-shops') ? '<span class="tk-chip tk-ok">' + esc(o.getAttribute('data-shops')) + '</span>' : '<span class="tk-chip tk-warn">Dans aucun secret shop</span>')
        info.innerHTML = w.join(' ')
      }
      ts.onchange = maj; maj()
      save.onclick = function () { occupe(save, enregistrer) }
    } catch (e) { toast('ko', 'Types de billets indisponibles', court(e.message)) }
  }

  async function enregistrer() {
    var m = piloteMatch(); var ts = document.getElementById('tk-type'); var o = ts.options[ts.selectedIndex]
    var r = await client().rpc('set_match_vivenu', { p_match_id: m.id, p_event_id: document.getElementById('tk-ev').value, p_ticket_type_id: ts.value,
      p_ticket_type_nom: o ? o.getAttribute('data-nom') : null, p_under_shop_id: (o && o.getAttribute('data-shop')) || null })
    if (r.error) { toast('ko', 'Réglage non enregistré', court(r.error.message)); return }
    toast('ok', 'Match relié à Tickie', r.data && r.data.relances ? r.data.relances + ' pointage(s) en attente relancé(s)' : '')
    rendre()
  }

  async function tester() {
    await occupe(document.getElementById('tk-test'), async function () {
      try {
        var d = await appel('test', { match_id: piloteMatch().id })
        var okB = String(d.api_billetterie || '').indexOf('ok') === 0, okA = d.api_controle_acces === 'ok'
        if (okB && okA) toast('ok', 'Connexion Tickie OK', 'Billetterie et contrôle d\'accès répondent')
        else toast('ko', 'Connexion Tickie incomplète', (okB ? '' : 'Billetterie : ' + court(d.api_billetterie) + '<br>') + (okA ? '' : 'Contrôle d\'accès : ' + court(d.api_controle_acces)))
      } catch (e) { toast('ko', 'Test impossible', court(e.message)) }
    })
  }

  async function essai() {
    if (!confirm('Essai : billet à TON nom sur ce match (sans mail), puis entrée et sortie au contrôle d\'accès (solde nul). Continuer ?')) return
    await occupe(document.getElementById('tk-essai'), async function () {
      try {
        var d = await appel('essai', { match_id: piloteMatch().id })
        var e = d.etapes || {}
        if (d.ok) {
          var nomOk = String(e.nom || '').indexOf('ok') === 0
          toast(nomOk ? 'ok' : 'ko', nomOk ? 'Essai réussi' : 'Essai réussi, sauf le nom sur le billet',
            'Billet ' + esc(d.barcode || '') + ' au nom de ' + esc(d.nom || '') + ', tag « bénévoles », entrée comptée.'
            + (nomOk ? '' : '<br>' + court(e.nom))
            + '<br>Pense à invalider ce billet d\'essai dans Tickie.')
        } else {
          var etape = ['client', 'billet', 'controle_acces'].filter(function (k) { return String(e[k] || '').indexOf('ok') !== 0 })[0]
          var lib = { client: 'Fiche client', billet: 'Émission du billet', controle_acces: 'Contrôle d\'accès' }[etape] || 'Essai'
          toast('ko', 'Essai en échec : ' + lib, court(e[etape]))
        }
      } catch (e2) { toast('ko', 'Essai impossible', court(e2.message)) }
    })
  }

  async function relancer() {
    var r = await client().rpc('tickie_relancer', { p_match_id: piloteMatch().id })
    if (r.error) { toast('ko', 'Relance impossible', court(r.error.message)); return }
    toast('ok', r.data + ' envoi(s) relancé(s)')
    setTimeout(rendre, 2500)
  }

  async function abonnes() {
    await occupe(document.getElementById('tk-abo'), async function () {
      try {
        var d = await appel('sync_abonnes')
        toast('ok', d.abonnes + ' bénévole(s) abonné(s)', 'sur ' + d.benevoles + ' bénévoles vérifiés')
      } catch (e) { toast('ko', 'Vérification impossible', court(e.message)) }
    })
    rendre()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injecterBouton)
  else injecterBouton()
})()
