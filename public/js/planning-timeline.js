/* ============================================================
   Planning thermomètre — Spacers Bénévoles
   Vue timeline "remplissage par poste" inspirée de Qoezion.
   - Axe vertical  = postes
   - Axe horizontal = heures du match (calé sur les créneaux)
   - Couleur des barres = ratio affectés / besoin (thermomètre)
   Expose : window.SpacersPlanning
   Fichier autonome — encodage UTF-8 (sans BOM), à charger tel quel.
   ============================================================ */
(function () {
  'use strict';

  // ── Palette statut de remplissage (thermomètre, façon Qoezion) ──
  // rouge < 50 %  ·  orange 50–99 %  ·  vert 100 %  ·  violet > 100 %  ·  bleu = pas de minimum
  var STATUS = {
    urgent: { c: '#E24B4A', bg: 'rgba(226,75,74,0.16)',  label: 'URGENT' },        // aucun affecté
    low:    { c: '#E24B4A', bg: 'rgba(226,75,74,0.16)',  label: 'Critique' },      // < 50 %
    mid:    { c: '#C9821A', bg: 'rgba(201,130,26,0.18)', label: 'Incomplet' },     // 50–99 %
    full:   { c: '#3B6D11', bg: 'rgba(59,109,17,0.20)',  label: 'Complet' },       // 100 %
    over:   { c: '#533BB7', bg: 'rgba(83,59,183,0.18)',  label: 'Sur-effectif' },  // > 100 %
    nomin:  { c: '#185FA5', bg: 'rgba(24,95,165,0.16)',  label: 'Sans minimum' }   // besoin non défini
  };

  function statusFor(aff, besoin) {
    if (besoin === null || besoin === undefined || besoin <= 0) return STATUS.nomin;
    if (aff <= 0) return STATUS.urgent;
    if (aff < besoin) return (aff / besoin < 0.5) ? STATUS.low : STATUS.mid;
    if (aff === besoin) return STATUS.full;
    return STATUS.over; // aff > besoin
  }

  // ── Catégories de créneaux (mêmes couleurs que l'app) ──
  var CR = {
    arrivee:        ['#3B82F6', 'Arrivée / accueil'],
    mise_en_place:  ['#8B5CF6', 'Mise en place'],
    en_position:    ['#22C55E', 'En position'],
    match:          ['#042C53', 'Match'],
    repas:          ['#F5C842', 'Repas'],
    desinstallation:['#F97316', 'Désinstallation'],
    autre:          ['#9CA3AF', 'Autre']
  };
  function crColor(cat) { return (CR[cat] || CR.autre)[0]; }
  function crLabel(cat) { return (CR[cat] || CR.autre)[1]; }

  // ── Helpers temps ──
  function toMin(hhmm) {
    if (!hhmm) return null;
    var p = String(hhmm).split(':');
    var h = parseInt(p[0], 10), m = parseInt(p[1] || '0', 10);
    if (isNaN(h)) return null;
    return h * 60 + (isNaN(m) ? 0 : m);
  }
  function fmtH(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return m === 0 ? (h + 'h') : (h + 'h' + (m < 10 ? '0' + m : m));
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Domaine temporel [min, max] à partir de la liste de créneaux
  function timeDomain(creneaux) {
    var lo = null, hi = null;
    creneaux.forEach(function (c) {
      var d = toMin(c.heure_debut);
      var f = toMin(c.heure_fin);
      if (d != null) { lo = (lo == null) ? d : Math.min(lo, d); hi = (hi == null) ? d : Math.max(hi, d); }
      if (f != null) { hi = (hi == null) ? f : Math.max(hi, f); }
      if (d != null && f == null) { hi = Math.max(hi, d + 60); } // créneau sans fin → +1 h visuel
    });
    if (lo == null) return null;
    if (hi <= lo) hi = lo + 60;
    // arrondit à l'heure pleine pour un axe propre
    lo = Math.floor(lo / 60) * 60;
    hi = Math.ceil(hi / 60) * 60;
    return [lo, hi];
  }

  function pctPos(min, dom) { return ((min - dom[0]) / (dom[1] - dom[0]) * 100); }

  // ── Rendu de l'axe des heures (graduations) ──
  function axisHtml(dom) {
    var marks = '';
    for (var t = dom[0]; t <= dom[1]; t += 60) {
      var left = pctPos(t, dom);
      marks += '<div style="position:absolute;top:0;bottom:0;left:' + left + '%;width:1px;background:rgba(255,255,255,0.07);"></div>'
             + '<div style="position:absolute;top:0;left:' + left + '%;transform:translateX(-50%);font-size:9px;color:rgba(255,255,255,0.4);font-weight:600;">' + fmtH(t) + '</div>';
    }
    return '<div style="position:relative;height:16px;margin-bottom:2px;">' + marks + '</div>';
  }

  // Grille verticale (réutilisée derrière chaque lane)
  function gridHtml(dom) {
    var g = '';
    for (var t = dom[0]; t <= dom[1]; t += 60) {
      g += '<div style="position:absolute;top:0;bottom:0;left:' + pctPos(t, dom) + '%;width:1px;background:rgba(255,255,255,0.06);"></div>';
    }
    return g;
  }

  // ── Légende thermomètre ──
  function legendHtml() {
    var items = [
      ['#E24B4A', 'Manque (< 50 %)'],
      ['#C9821A', 'Incomplet (50–99 %)'],
      ['#3B6D11', 'Complet (100 %)'],
      ['#533BB7', 'Sur-effectif'],
      ['#185FA5', 'Sans minimum']
    ];
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:2px 0 12px;">' +
      items.map(function (it) {
        return '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(255,255,255,0.6);">' +
          '<span style="width:10px;height:10px;border-radius:3px;background:' + it[0] + ';flex-shrink:0;"></span>' + it[1] + '</div>';
      }).join('') + '</div>';
  }

  var LABEL_W = 148; // largeur colonne de gauche (nom du poste + jauge)
  var UI = { collapsed: false }; // état de repli (persistant entre re-rendus)

  // ── Bande "Tous postes" : créneaux transversaux (poste_id null) ──
  function bandeTousHtml(globalCr, dom) {
    if (!globalCr.length) return '';
    var bars = globalCr.map(function (c) {
      var d = toMin(c.heure_debut);
      var f = toMin(c.heure_fin) || (d + 45);
      var left = pctPos(d, dom), w = Math.max(2, pctPos(f, dom) - left);
      var lab = c.libelle ? esc(c.libelle) : crLabel(c.categorie);
      return '<div title="' + fmtH(d) + ' · ' + lab + '" style="position:absolute;top:3px;bottom:3px;left:' + left + '%;width:' + w + '%;background:' + crColor(c.categorie) + ';border-radius:5px;display:flex;align-items:center;padding:0 6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);">' +
        '<span style="font-size:9px;font-weight:700;color:#fff;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.5);">' + lab + '</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:stretch;margin-bottom:6px;">' +
      '<div style="width:' + LABEL_W + 'px;flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);display:flex;align-items:center;">Tous postes</div>' +
      '<div style="position:relative;flex:1;height:30px;background:rgba(255,255,255,0.03);border-radius:6px;">' + gridHtml(dom) + bars + '</div></div>';
  }

  // ── Ligne poste : jauge + barre thermomètre sur la timeline ──
  function posteRowHtml(p, aff, besoin, dom, posteCr, idx) {
    var st = statusFor(aff, besoin);
    var pctFill = besoin > 0 ? Math.min(100, Math.round(aff / besoin * 100)) : (aff > 0 ? 100 : 0);
    var manque = besoin > 0 ? Math.max(0, besoin - aff) : 0;
    var badgeTxt = aff + (besoin > 0 ? ' / ' + besoin : '');

    // Le besoin/remplissage est global au match : la barre couvre toute la durée.
    // Les créneaux propres au poste (réassort, etc.) sont surlignés par-dessus.
    var left = 0, w = 100;

    // sous-note de statut
    var note = st === STATUS.full ? 'Complet' :
               st === STATUS.over ? ('+' + (aff - besoin) + ' en renfort') :
               st === STATUS.nomin ? 'Pas de minimum' :
               aff === 0 ? 'Personne d\'affecté' : (manque + ' manquant' + (manque > 1 ? 's' : ''));

    // heure de présence propre au poste (si créneaux spécifiques définis) — heures exactes
    var timeBadge = '';
    if (posteCr.length) {
      var rLo = null, rHi = null;
      posteCr.forEach(function (c) {
        var d = toMin(c.heure_debut), f = toMin(c.heure_fin);
        if (d != null) { rLo = (rLo == null) ? d : Math.min(rLo, d); rHi = (rHi == null) ? d : Math.max(rHi, d); }
        if (f != null) { rHi = (rHi == null) ? f : Math.max(rHi, f); }
      });
      if (rLo != null) timeBadge = '<span style="font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,0.32);border-radius:20px;padding:2px 8px;white-space:nowrap;flex-shrink:0;">&#128336; ' + fmtH(rLo) + '&ndash;' + fmtH(rHi) + '</span>';
    }

    // segments de créneaux spécifiques au poste (au-dessus de la barre)
    var segs = posteCr.map(function (c) {
      var d = toMin(c.heure_debut), f = toMin(c.heure_fin) || (d + 45);
      var l = pctPos(d, dom), sw = Math.max(1.5, pctPos(f, dom) - l);
      return '<div title="' + fmtH(d) + ' · ' + (c.libelle ? esc(c.libelle) : crLabel(c.categorie)) + '" style="position:absolute;top:2px;height:5px;left:' + l + '%;width:' + sw + '%;background:' + crColor(c.categorie) + ';border-radius:3px;"></div>';
    }).join('');

    // colonne gauche : nom + mini-jauge
    var labelCol =
      '<div style="width:' + LABEL_W + 'px;flex-shrink:0;padding-right:10px;">' +
        '<div style="font-size:12px;font-weight:700;color:#fff;line-height:1.2;">' + esc(p.nom) + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">' +
          '<div style="flex:1;height:6px;border-radius:99px;background:rgba(255,255,255,0.1);overflow:hidden;">' +
            '<div style="height:100%;width:' + pctFill + '%;background:' + st.c + ';border-radius:99px;"></div></div>' +
          '<span style="font-size:10px;font-weight:800;color:' + st.c + ';white-space:nowrap;">' + badgeTxt + '</span>' +
        '</div>' +
      '</div>';

    // barre thermomètre sur la timeline
    var bar =
      '<div style="position:relative;flex:1;height:38px;background:rgba(255,255,255,0.03);border-radius:6px;">' +
        gridHtml(dom) +
        '<div class="thermo-bar" data-poste="' + idx + '" style="position:absolute;top:0;bottom:0;left:' + left + '%;width:' + w + '%;background:' + st.bg + ';border:1px solid ' + st.c + ';border-left:4px solid ' + st.c + ';border-radius:6px;cursor:pointer;display:flex;align-items:center;padding:0 9px;overflow:hidden;">' +
          segs +
          '<div style="display:flex;align-items:center;gap:7px;min-width:0;">' +
            '<span style="font-size:13px;font-weight:800;color:#fff;">' + badgeTxt + '</span>' +
            '<span style="font-size:10px;font-weight:600;color:' + st.c + ';white-space:nowrap;filter:brightness(1.4);">' + note + '</span>' +
            timeBadge +
          '</div>' +
        '</div>' +
      '</div>';

    return '<div style="display:flex;align-items:stretch;margin-bottom:6px;">' + labelCol + bar + '</div>' +
           '<div id="thermo-detail-' + idx + '" style="display:none;margin:-2px 0 8px ' + LABEL_W + 'px;"></div>';
  }

  // ── Rendu principal (vue pilote) ──
  // renderThermoPilote(container, sb, matchId)
  async function renderThermoPilote(container, sb, matchId) {
    if (!container) return;
    if (!sb || !matchId) { container.innerHTML = ''; return; }
    container.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;padding:6px 0;">Chargement du planning…</div>';

    try {
      var res = await Promise.all([
        sb.from('postes').select('id,nom,benevoles_max_match,actif').eq('actif', true).order('nom'),
        sb.from('inscriptions')
          .select('poste_id, benevoles!inscriptions_benevole_id_fkey(prenom,nom)')
          .eq('match_id', matchId).eq('statut', 'disponible'),
        sb.from('match_postes_besoins').select('poste_id,besoin').eq('match_id', matchId),
        sb.from('match_creneaux').select('*').eq('match_id', matchId).order('ordre').order('heure_debut')
      ]);

      var postes = res[0].data || [];
      var insc   = res[1].data || [];
      var mpb    = res[2].data || [];
      var creneaux = res[3].data || [];

      // affectés par poste
      var affMap = {};   // poste_id -> [ {prenom,nom} ]
      insc.forEach(function (i) {
        if (!i.poste_id) return;
        (affMap[i.poste_id] = affMap[i.poste_id] || []).push(i.benevoles || {});
      });
      // besoin override
      var besMap = {};
      mpb.forEach(function (o) { besMap[o.poste_id] = o.besoin; });

      if (!postes.length) { container.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;">Aucun poste actif.</div>'; return; }

      var dom = timeDomain(creneaux);
      var noTime = !dom;
      if (noTime) dom = [15 * 60, 22 * 60]; // fallback si aucun créneau

      var globalCr = creneaux.filter(function (c) { return !c.poste_id; });
      var crByPoste = {};
      creneaux.forEach(function (c) { if (c.poste_id) (crByPoste[c.poste_id] = crByPoste[c.poste_id] || []).push(c); });

      // stocke les affectés pour le toggle détail
      container._thermoData = postes.map(function (p) { return { poste: p, aff: (affMap[p.id] || []) }; });

      // ── récap global (compteur en tête) ──
      var totAff = 0, totBesoin = 0, incomplets = 0;
      postes.forEach(function (p) {
        var a = (affMap[p.id] || []).length;
        var b = (besMap[p.id] !== undefined) ? besMap[p.id] : (p.benevoles_max_match || 0);
        totAff += a;
        if (b > 0) { totBesoin += b; if (a < b) incomplets++; }
      });
      var recapTxt = '<span style="color:#fff;">' + totAff + '/' + totBesoin + ' bénévoles affectés</span>'
        + ' <span style="color:rgba(255,255,255,0.3);">·</span> '
        + (incomplets === 0
            ? '<span style="color:#A7D77C;">tous les postes complets ✓</span>'
            : '<span style="color:#FAC775;">' + incomplets + ' poste' + (incomplets > 1 ? 's' : '') + ' à compléter</span>');

      var chevron = UI.collapsed ? '▸' : '▾';

      var body = '';
      body += legendHtml();
      if (noTime) {
        body += '<div style="font-size:10px;color:var(--c-gold-2,#FAC775);margin-bottom:8px;">Aucun créneau défini — ajoute des créneaux ci-dessous pour caler la timeline sur les vraies heures.</div>';
      }
      body += '<div style="overflow-x:auto;"><div style="min-width:520px;">';
      body += '<div style="display:flex;"><div style="width:' + LABEL_W + 'px;flex-shrink:0;"></div><div style="flex:1;">' + axisHtml(dom) + '</div></div>';
      body += bandeTousHtml(globalCr, dom);
      body += postes.map(function (p, idx) {
        var aff = (affMap[p.id] || []).length;
        var besoin = (besMap[p.id] !== undefined) ? besMap[p.id] : (p.benevoles_max_match || 0);
        return posteRowHtml(p, aff, besoin, dom, crByPoste[p.id] || [], idx);
      }).join('');
      body += '</div></div>';

      container.innerHTML =
        '<div class="thermo-head" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;padding:2px 0 10px;" title="Cliquer pour replier / déplier">' +
          '<span class="thermo-chevron" style="font-size:12px;color:rgba(255,255,255,0.6);width:12px;text-align:center;">' + chevron + '</span>' +
          '<span style="font-size:12px;font-weight:700;">' + recapTxt + '</span>' +
        '</div>' +
        '<div class="thermo-body" style="display:' + (UI.collapsed ? 'none' : 'block') + ';">' + body + '</div>';

      // repli / dépli au clic sur l'en-tête
      var head = container.querySelector('.thermo-head');
      if (head) head.addEventListener('click', function () {
        UI.collapsed = !UI.collapsed;
        var b = container.querySelector('.thermo-body');
        var ch = container.querySelector('.thermo-chevron');
        if (b) b.style.display = UI.collapsed ? 'none' : 'block';
        if (ch) ch.textContent = UI.collapsed ? '▸' : '▾';
      });

      // toggle détail des bénévoles affectés au clic sur une barre
      container.querySelectorAll('.thermo-bar').forEach(function (bar) {
        bar.addEventListener('click', function () {
          var idx = bar.getAttribute('data-poste');
          var d = container.querySelector('#thermo-detail-' + idx);
          if (!d) return;
          if (d.style.display === 'block') { d.style.display = 'none'; return; }
          var data = (container._thermoData || [])[idx];
          var noms = (data && data.aff) || [];
          d.innerHTML = noms.length
            ? '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;display:flex;flex-wrap:wrap;gap:6px;">' +
                noms.map(function (b) {
                  return '<span style="font-size:11px;color:#fff;background:rgba(255,255,255,0.08);border-radius:99px;padding:3px 9px;">' + esc((b.prenom || '') + ' ' + (b.nom || '')) + '</span>';
                }).join('') + '</div>'
            : '<div style="font-size:11px;color:rgba(255,255,255,0.4);padding:4px 2px;">Aucun bénévole affecté à ce poste.</div>';
          d.style.display = 'block';
        });
      });
    } catch (e) {
      console.error('[thermo] render', e);
      container.innerHTML = '<div style="color:#F09595;font-size:12px;">Erreur chargement planning : ' + esc(e.message || e) + '</div>';
    }
  }

  // ── Frise horizontale (vue bénévole) ──
  // friseHtml(creneaux, monPoste) -> string HTML  (remplace la frise verticale existante)
  function friseHtml(creneaux, monPoste) {
    if (!creneaux || !creneaux.length) return '';
    var list = creneaux.filter(function (c) { return !c.poste_id || c.poste_id === monPoste; });
    if (!list.length) return '';
    var dom = timeDomain(list);
    if (!dom) return '';

    // graduations claires (fond clair côté bénévole)
    var marks = '';
    for (var t = dom[0]; t <= dom[1]; t += 60) {
      var lp = pctPos(t, dom);
      marks += '<div style="position:absolute;top:0;bottom:14px;left:' + lp + '%;width:1px;background:rgba(0,0,0,0.06);"></div>' +
               '<div style="position:absolute;bottom:0;left:' + lp + '%;transform:translateX(-50%);font-size:9px;color:#8A9BAD;font-weight:600;">' + fmtH(t) + '</div>';
    }
    var bars = list.map(function (c) {
      var d = toMin(c.heure_debut), f = toMin(c.heure_fin) || (d + 45);
      var left = pctPos(d, dom), w = Math.max(3, pctPos(f, dom) - left);
      var mine = c.poste_id === monPoste;
      var lab = c.libelle ? esc(c.libelle) : crLabel(c.categorie);
      return '<div title="' + fmtH(d) + ' · ' + lab + '" style="position:absolute;top:2px;bottom:16px;left:' + left + '%;width:' + w + '%;background:' + crColor(c.categorie) + ';border-radius:5px;display:flex;align-items:center;padding:0 6px;overflow:hidden;' + (mine ? 'box-shadow:0 0 0 2px #042C53;' : '') + '">' +
        '<span style="font-size:9px;font-weight:700;color:#fff;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.4);">' + lab + '</span></div>';
    }).join('');

    return '<div style="background:#F4F7FB;border-radius:10px;padding:10px 12px 8px;margin-top:8px;">' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8A9BAD;margin-bottom:8px;">&#128336; Ton planning</div>' +
      '<div style="position:relative;height:52px;">' + marks + bars + '</div></div>';
  }

  window.SpacersPlanning = {
    renderThermoPilote: renderThermoPilote,
    friseHtml: friseHtml,
    statusFor: statusFor
  };
})();
