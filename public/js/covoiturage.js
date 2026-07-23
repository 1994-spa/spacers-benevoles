/* ============================================================
   Mobilité douce (Tisséo) + Covoiturage — Spacers Bénévoles
   Expose : window.SpacersCovoit
   - renderBenevole(container, sb, {matchId, benevoleId, lieu})
   - renderPilote(container, sb, {matchId})
   Données : table `inscriptions` (transport_mode, covoit_*) + vue `v_match_covoiturage`.
   Fichier autonome — UTF-8 sans BOM.
   ============================================================ */
(function () {
  'use strict';

  var MODES = [
    ['tisseo', '🚌', 'Tisséo'],
    ['velo', '🚲', 'Vélo'],
    ['pied', '🚶', 'À pied'],
    ['voiture', '🚗', 'Voiture'],
    ['covoiturage', '🤝', 'Covoiturage']
  ];
  function modeLabel(m){ var f=MODES.find(function(x){return x[0]===m;}); return f?(f[1]+' '+f[2]):''; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function waLink(tel, msg){
    if(!tel) return null;
    var d=String(tel).replace(/\D/g,'');
    if(d.indexOf('0')===0) d='33'+d.slice(1);
    else if(d.indexOf('33')!==0 && d.length===9) d='33'+d;
    return 'https://wa.me/'+d+(msg?('?text='+encodeURIComponent(msg)):'');
  }

  // ── Bloc info Tisséo (mobilité douce) ──
  function tisseoBlock(theme){
    var dark = theme==='dark';
    var calc = 'https://www.tisseo.fr/calculateur';
    var qpark = 'https://www.q-park.fr/fr-fr/events/palais-des-sports-toulouse/';
    var card = dark ? 'background:rgba(24,95,165,0.12);border:1px solid rgba(24,95,165,0.3);' : 'background:#EAF2FB;border:1px solid #CFE0F5;';
    var txt = dark ? 'color:rgba(255,255,255,0.9);' : 'color:#1B3A5B;';
    var sub = dark ? 'color:rgba(255,255,255,0.6);' : 'color:#5A7291;';
    var linkC = dark ? 'var(--c-blue-100,#B5D4F4)' : '#185FA5';
    var head = function(t){ return '<div style="font-size:10px;font-weight:800;letter-spacing:0.5px;'+txt+'margin-top:9px;">'+t+'</div>'; };
    var line = function(t){ return '<div style="font-size:11px;'+sub+'line-height:1.5;">'+t+'</div>'; };
    var detail = head('🚇 MÉTRO')
      + line('Ligne <b>B</b>, station <b>Compans-Caffarelli</b> (~5 min à pied) ou <b>Canal du Midi</b> (devant le Conseil départemental). Accessible aux personnes à mobilité réduite.')
      + head('🚌 BUS')
      + line('Lignes <b>L1, 16, 45, 70, 71</b> — arrêt Compans Caffarelli. Pensez à vérifier vos horaires de retour.')
      + head('🚗 VOITURE & PARKING')
      + line('Sortie rocade <b>Ponts Jumeaux</b>, direction centre-ville. Parking <b>Q-Park Compans Caffarelli</b> (3 min à pied). Forfait Sport : <b>5 €</b> de 18h30 à 23h30 les soirs de match. <a href="'+qpark+'" target="_blank" rel="noopener" style="color:'+linkC+';font-weight:700;">Réserver →</a>')
      + head('🚲 VÉLO')
      + line('VélÔToulouse : <b>Station 20</b> (M° Canal du Midi) · <b>Station 12</b> (M° Compans).');
    return '<div style="'+card+'border-radius:12px;padding:12px 14px;">'
      + '<div style="font-size:12px;font-weight:800;'+txt+'display:flex;align-items:center;gap:6px;">🌿 Venir en mobilité douce</div>'
      + '<div style="font-size:11px;'+sub+'margin-top:5px;line-height:1.5;">Un soir de match, privilégiez le <b>métro</b> : le plus simple, et pas de galère de stationnement.<br>Palais des Sports André-Brouat · 3 rue Pierre Laplace</div>'
      + '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:11px;font-weight:700;color:'+linkC+';list-style:none;">➕ Voir tous les accès (métro, bus, parking, vélo)</summary>'
      +   '<div style="margin-top:4px;">'+detail+'</div>'
      + '</details>'
      + '<a href="'+calc+'" target="_blank" rel="noopener" style="display:inline-block;margin-top:9px;font-size:11px;font-weight:700;color:'+linkC+';text-decoration:underline;">🚌 Calculer mon itinéraire Tisséo →</a>'
      + '</div>';
  }

  // ── Vue bénévole : déclaration + bourse ──
  async function renderBenevole(container, sb, opts){
    if(!container) return;
    opts = opts || {};
    var mid = opts.matchId, bid = opts.benevoleId;
    if(!sb || !mid || !bid){ container.innerHTML=''; return; }
    try {
      var r = await Promise.all([
        sb.from('inscriptions').select('transport_mode,covoit_role,covoit_secteur,covoit_places,covoit_note').eq('benevole_id',bid).eq('match_id',mid).maybeSingle(),
        sb.from('v_match_covoiturage').select('*').eq('match_id',mid)
      ]);
      var mine = (r[0] && r[0].data) || {};
      var bourse = (r[1] && r[1].data) || [];
      container._covoit = { sb:sb, mid:mid, bid:bid, mine:mine };

      var chips = MODES.map(function(m){
        var on = mine.transport_mode===m[0];
        return '<div class="covoit-mode" data-m="'+m[0]+'" style="cursor:pointer;font-size:12px;font-weight:700;padding:7px 12px;border-radius:20px;'
          + (on?'background:var(--c-green,#3B6D11);color:#fff;':'background:#fff;color:#1B3A5B;border:1px solid #CFE0F5;')+'">'+m[1]+' '+m[2]+'</div>';
      }).join('');

      var showForm = (mine.transport_mode==='voiture' || mine.transport_mode==='covoiturage');
      var isCond = mine.covoit_role==='conducteur';
      var form = !showForm ? '' :
        '<div style="margin-top:10px;background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #E1E9F2;">'
        + '<div style="display:flex;gap:6px;margin-bottom:8px;">'
        +   '<div class="covoit-role" data-r="conducteur" style="flex:1;text-align:center;cursor:pointer;font-size:11px;font-weight:700;padding:7px;border-radius:8px;'+(isCond?'background:var(--c-green,#3B6D11);color:#fff;':'background:#F1F5FA;color:#1B3A5B;')+'">🚗 Je peux emmener</div>'
        +   '<div class="covoit-role" data-r="passager" style="flex:1;text-align:center;cursor:pointer;font-size:11px;font-weight:700;padding:7px;border-radius:8px;'+(mine.covoit_role==='passager'?'background:var(--c-action,#185FA5);color:#fff;':'background:#F1F5FA;color:#1B3A5B;')+'">🙋 Je cherche une place</div>'
        + '</div>'
        + '<input id="covoit-secteur" placeholder="Secteur de départ (ex. Blagnac, Rangueil...)" value="'+esc(mine.covoit_secteur||'')+'" style="width:100%;box-sizing:border-box;font-size:12px;padding:8px 10px;border:1px solid #D3D1C7;border-radius:8px;margin-bottom:6px;">'
        + '<div id="covoit-places-wrap" style="'+(isCond?'':'display:none;')+'margin-bottom:6px;"><input id="covoit-places" type="number" min="1" max="8" placeholder="Nombre de places" value="'+(mine.covoit_places||'')+'" style="width:100%;box-sizing:border-box;font-size:12px;padding:8px 10px;border:1px solid #D3D1C7;border-radius:8px;"></div>'
        + '<input id="covoit-note" placeholder="Précision (horaire, point de RDV...)" value="'+esc(mine.covoit_note||'')+'" style="width:100%;box-sizing:border-box;font-size:12px;padding:8px 10px;border:1px solid #D3D1C7;border-radius:8px;margin-bottom:8px;">'
        + '<button id="covoit-save" style="width:100%;background:var(--c-action,#185FA5);color:#fff;border:none;border-radius:8px;padding:9px;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer;">Enregistrer mon covoiturage</button>'
        + '<div id="covoit-msg" style="font-size:11px;text-align:center;margin-top:6px;"></div>'
        + '</div>';

      var conducteurs = bourse.filter(function(x){return x.covoit_role==='conducteur';});
      var passagers = bourse.filter(function(x){return x.covoit_role==='passager';});
      function bourseRow(x, withWa){
        var wa = (withWa && x.telephone) ? waLink(x.telephone, 'Bonjour '+(x.prenom||'')+', pour le covoiturage au match Spacers ?') : null;
        var places = x.covoit_places ? (' · '+x.covoit_places+' place'+(x.covoit_places>1?'s':'')) : '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #EEF2F6;">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#1B3A5B;">'+esc(x.prenom||'')+' '+esc(x.nom_initiale||'')+'.'+places+'</div>'
          + (x.covoit_secteur?'<div style="font-size:11px;color:#5A7291;">📍 '+esc(x.covoit_secteur)+(x.covoit_note?(' · '+esc(x.covoit_note)):'')+'</div>':'')+'</div>'
          + (wa?'<a href="'+wa+'" target="_blank" rel="noopener" style="flex-shrink:0;background:#25D366;color:#fff;font-size:11px;font-weight:700;padding:5px 10px;border-radius:20px;text-decoration:none;">📱 Contacter</a>':'')
          + '</div>';
      }
      var bourseHtml = '<div style="margin-top:12px;">'
        + '<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#8A9BAD;margin-bottom:6px;">🤝 Covoiturage du match</div>'
        + '<div style="font-size:11px;font-weight:700;color:#1B3A5B;margin:4px 0 2px;">🚗 Conducteurs</div>'
        + (conducteurs.length?conducteurs.map(function(x){return bourseRow(x,true);}).join(''):'<div style="font-size:11px;color:#8A9BAD;padding:4px 0;">Personne ne propose de trajet pour l\'instant.</div>')
        + '<div style="font-size:11px;font-weight:700;color:#1B3A5B;margin:8px 0 2px;">🙋 Cherchent une place</div>'
        + (passagers.length?passagers.map(function(x){return bourseRow(x,false);}).join(''):'<div style="font-size:11px;color:#8A9BAD;padding:4px 0;">Personne ne cherche de place pour l\'instant.</div>')
        + '</div>';

      container.innerHTML = '<div style="background:#F4F7FB;border-radius:12px;padding:12px;margin-top:10px;">'
        + tisseoBlock('light')
        + '<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#8A9BAD;margin:12px 0 6px;">🚦 Comment viens-tu ?</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+chips+'</div>'
        + '<div id="covoit-form">'+form+'</div>'
        + bourseHtml
        + '</div>';

      wireBenevole(container);
    } catch(e){
      console.error('[covoit] benevole', e);
      container.innerHTML = '<div style="font-size:11px;color:#B04;padding:6px;">Covoiturage indisponible : '+esc(e.message||e)+'</div>';
    }
  }

  function wireBenevole(container){
    var st = container._covoit;
    async function saveField(patch){
      st.mine = Object.assign(st.mine||{}, patch);
      var { error } = await st.sb.from('inscriptions').update(patch).eq('benevole_id',st.bid).eq('match_id',st.mid);
      return !error;
    }
    // choix du mode de transport
    container.querySelectorAll('.covoit-mode').forEach(function(el){
      el.addEventListener('click', async function(){
        var m = el.getAttribute('data-m');
        await saveField({ transport_mode:m });
        renderBenevole(container, st.sb, { matchId:st.mid, benevoleId:st.bid });
      });
    });
    // choix du rôle
    container.querySelectorAll('.covoit-role').forEach(function(el){
      el.addEventListener('click', function(){
        st.mine.covoit_role = el.getAttribute('data-r');
        var pw = container.querySelector('#covoit-places-wrap');
        if(pw) pw.style.display = (st.mine.covoit_role==='conducteur')?'block':'none';
        container.querySelectorAll('.covoit-role').forEach(function(x){
          var on = x.getAttribute('data-r')===st.mine.covoit_role;
          x.style.background = on ? (st.mine.covoit_role==='conducteur'?'var(--c-green,#3B6D11)':'var(--c-action,#185FA5)') : '#F1F5FA';
          x.style.color = on ? '#fff' : '#1B3A5B';
        });
      });
    });
    // enregistrement du covoiturage
    var save = container.querySelector('#covoit-save');
    if(save) save.addEventListener('click', async function(){
      var role = st.mine.covoit_role || null;
      var sect = (container.querySelector('#covoit-secteur')||{}).value || null;
      var placesEl = container.querySelector('#covoit-places');
      var places = (role==='conducteur' && placesEl && placesEl.value) ? parseInt(placesEl.value,10) : null;
      var note = (container.querySelector('#covoit-note')||{}).value || null;
      var msg = container.querySelector('#covoit-msg');
      if(!role){ if(msg){msg.textContent='Choisis conducteur ou passager.';msg.style.color='#B04';} return; }
      save.textContent='...'; save.disabled=true;
      var ok = await saveField({ covoit_role:role, covoit_secteur:sect, covoit_places:places, covoit_note:note });
      if(ok){ renderBenevole(container, st.sb, { matchId:st.mid, benevoleId:st.bid }); }
      else { save.textContent='Enregistrer mon covoiturage'; save.disabled=false; if(msg){msg.textContent='Erreur, réessaie.';msg.style.color='#B04';} }
    });
  }

  // ── Vue pilote : synthèse transport + covoiturage ──
  async function renderPilote(container, sb, opts){
    if(!container) return;
    opts = opts || {};
    var mid = opts.matchId;
    if(!sb || !mid){ container.innerHTML=''; return; }
    try {
      var r = await Promise.all([
        sb.from('inscriptions').select('transport_mode').eq('match_id',mid).eq('statut','disponible'),
        sb.from('v_match_covoiturage').select('*').eq('match_id',mid)
      ]);
      var insc = (r[0] && r[0].data) || [];
      var bourse = (r[1] && r[1].data) || [];
      var counts = {}; MODES.forEach(function(m){counts[m[0]]=0;});
      insc.forEach(function(i){ if(i.transport_mode && counts[i.transport_mode]!==undefined) counts[i.transport_mode]++; });
      var recap = MODES.map(function(m){
        return '<div style="text-align:center;padding:6px 10px;background:rgba(255,255,255,0.05);border-radius:8px;min-width:52px;"><div style="font-size:15px;font-weight:800;color:#fff;">'+counts[m[0]]+'</div><div style="font-size:9px;color:rgba(255,255,255,0.45);">'+m[1]+' '+m[2]+'</div></div>';
      }).join('');
      var cond = bourse.filter(function(x){return x.covoit_role==='conducteur';});
      var pass = bourse.filter(function(x){return x.covoit_role==='passager';});
      function row(x, wa){
        var link = (wa && x.telephone) ? waLink(x.telephone,'Bonjour '+(x.prenom||'')+', pour le covoiturage au match Spacers ?') : null;
        var places = x.covoit_places ? (' · '+x.covoit_places+' pl.') : '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #333;">'
          + '<div style="flex:1;min-width:0;"><span style="font-size:12px;font-weight:700;color:#fff;">'+esc(x.prenom||'')+' '+esc(x.nom_initiale||'')+'.'+places+'</span>'
          + (x.covoit_secteur?'<span style="font-size:11px;color:rgba(255,255,255,0.5);"> · 📍 '+esc(x.covoit_secteur)+(x.covoit_note?(' · '+esc(x.covoit_note)):'')+'</span>':'')+'</div>'
          + (link?'<a href="'+link+'" target="_blank" rel="noopener" style="flex-shrink:0;background:#25D366;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;text-decoration:none;">📱</a>':'')
          + '</div>';
      }
      container.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">'+recap+'</div>'
        + '<div style="font-size:11px;font-weight:700;color:var(--c-green-light,#C0DD97);margin:4px 0 2px;">🚗 Conducteurs ('+cond.length+')</div>'
        + (cond.length?cond.map(function(x){return row(x,true);}).join(''):'<div style="font-size:11px;color:rgba(255,255,255,0.4);padding:3px 0;">Aucun.</div>')
        + '<div style="font-size:11px;font-weight:700;color:var(--c-gold-2,#FAC775);margin:8px 0 2px;">🙋 Cherchent une place ('+pass.length+')</div>'
        + (pass.length?pass.map(function(x){return row(x,false);}).join(''):'<div style="font-size:11px;color:rgba(255,255,255,0.4);padding:3px 0;">Aucun.</div>')
        + '<div style="margin-top:10px;">'+tisseoBlock('dark')+'</div>';
    } catch(e){
      console.error('[covoit] pilote', e);
      container.innerHTML = '<div style="font-size:12px;color:#F09595;">Covoiturage indisponible : '+esc(e.message||e)+'</div>';
    }
  }

  window.SpacersCovoit = { renderBenevole: renderBenevole, renderPilote: renderPilote };
})();
