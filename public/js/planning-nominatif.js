/* ============================================================
   Planning nominatif (créneaux horaires par bénévole) — Spacers
   Expose : window.SpacersPN
   - renderBenevole(container, sb, {matchId, benevoleId})  → "Mon planning"
   - renderPilote(container, sb, {matchId})                → constructeur
   Données : table match_planning + matchs + inscriptions + postes.
   Charte : palette des créneaux existants. UTF-8 sans BOM.
   ============================================================ */
(function () {
  'use strict';

  // Couleurs par catégorie de rôle (cohérentes avec la charte créneaux)
  var CATCOL = {
    accueil:'#F5C842', guichet:'#8B5CF6', scan:'#3B82F6', placement:'#22C55E',
    buvette:'#F97316', dota:'#EC4899', securite:'#64748B', autre:'#64748B'
  };
  var CATLAB = {
    accueil:'Accueil', guichet:'Guichet', scan:'Scan entrée', placement:'Placement',
    buvette:'Buvette', dota:'Dotations + Repas', securite:'Sécurité', autre:'Autre'
  };

  // Modèles de rôle réutilisables (offsets en minutes autour du coup d'envoi)
  var TEMPLATES = [
    { key:'accueil_scan',  label:'Accueil → Scan', blocks:[
      { cat:'accueil', lib:'Accueil des bénévoles', from:-120, to:-30, consigne:'Accueillir et pointer les bénévoles à leur arrivée, distribuer les gilets.' },
      { cat:'scan',    lib:'Scan entrée',           from:-30,  to:120, consigne:'Scan des billets. Renfort à l\'affluence.' } ] },
    { key:'accueil_place', label:'Accueil → Placement', blocks:[
      { cat:'accueil',   lib:'Accueil des bénévoles', from:-120, to:-30, consigne:'Accueillir et pointer les bénévoles, distribuer les gilets.' },
      { cat:'placement', lib:'Placement public',       from:-30,  to:120, consigne:'Placer et orienter le public.' } ] },
    { key:'guichet', label:'Guichet accréditations', blocks:[
      { cat:'guichet', lib:'Guichet — accréditations', from:-120, to:0, consigne:'Distribuer les accréditations aux bénévoles / staff.' } ] },
    { key:'renfort', label:'Renfort affluence', blocks:[
      { cat:'scan', lib:'Renfort', from:-30, to:120, consigne:'Rejoint le poste à −30 min pour absorber l\'affluence.' } ] },
    { key:'fin_dota', label:'Fin : Dotations + Repas', blocks:[
      { cat:'dota', lib:'Dotations + Repas', from:120, to:180, consigne:'Retour dotations puis gestion et distribution des repas.' } ] }
  ];

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function toMin(hhmm){ if(!hhmm) return null; var p=String(hhmm).split(':'); var h=parseInt(p[0],10),m=parseInt(p[1]||'0',10); if(isNaN(h))return null; return h*60+(isNaN(m)?0:m); }
  function fmtH(min){ if(min==null)return ''; var h=Math.floor(min/60),m=((min%60)+60)%60; return h+'h'+(m<10?'0'+m:m); }
  function minToTime(min){ var h=Math.floor(min/60),m=((min%60)+60)%60; return (h<10?'0'+h:h)+':'+(m<10?'0'+m:m)+':00'; }
  function colOf(b){ return b.couleur || CATCOL[b.categorie] || CATCOL.autre; }

  function domainFrom(blocks, ke){
    var lo=null,hi=null;
    blocks.forEach(function(b){ var d=toMin(b.heure_debut), f=toMin(b.heure_fin); if(d!=null){lo=lo==null?d:Math.min(lo,d);hi=hi==null?d:Math.max(hi,d);} if(f!=null){hi=hi==null?f:Math.max(hi,f);} });
    if(lo==null){ lo=(ke!=null?ke-120:16*60); hi=(ke!=null?ke+180:21*60); }
    else { if(ke!=null){lo=Math.min(lo,ke-120);hi=Math.max(hi,ke+120);} }
    lo=Math.floor(lo/60)*60; hi=Math.ceil(hi/60)*60; if(hi<=lo)hi=lo+60;
    return [lo,hi];
  }
  function pos(m,dom){ return (m-dom[0])/(dom[1]-dom[0])*100; }
  function ini(n){ n=(n||'').trim(); var p=n.split(' '); return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase(); }

  // ════════════════ VUE BÉNÉVOLE : "Mon planning" ════════════════
  async function renderBenevole(container, sb, opts){
    if(!container) return;
    opts=opts||{}; var mid=opts.matchId, bid=opts.benevoleId;
    if(!sb||!mid||!bid){ container.innerHTML=''; return; }
    try{
      var r=await sb.from('match_planning').select('*').eq('match_id',mid).eq('benevole_id',bid).order('heure_debut');
      var blocks=(r.data||[]).slice().sort(function(a,b){ return (toMin(a.heure_debut)||0)-(toMin(b.heure_debut)||0); });
      if(!blocks.length){ container.innerHTML=''; return; } // pas de planning nominatif → on laisse la frise standard
      var firstH=fmtH(toMin(blocks[0].heure_debut));
      var steps='';
      blocks.forEach(function(b,i){
        var c=colOf(b);
        steps+='<div style="display:flex;gap:11px;">'
          + '<div style="width:78px;flex-shrink:0;text-align:right;padding-top:2px;"><div style="font-size:14px;font-weight:800;color:var(--c-navy,#042C53);">'+fmtH(toMin(b.heure_debut))+'</div>'+(b.heure_fin?'<div style="font-size:10px;color:#8A9BAD;">→ '+fmtH(toMin(b.heure_fin))+'</div>':'')+'</div>'
          + '<div style="position:relative;width:18px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">'+(i<blocks.length-1?'<div style="position:absolute;top:10px;bottom:-14px;width:2px;background:#e0e7f0;"></div>':'')+'<div style="width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px '+c+';margin-top:3px;z-index:2;"></div></div>'
          + '<div style="flex:1;padding-bottom:14px;min-width:0;"><div style="border-radius:12px;padding:10px 12px;color:#fff;background:'+c+';">'
          +   '<div style="font-size:14px;font-weight:800;">'+esc(b.libelle)+(i===0?' <span style="font-size:9px;font-weight:800;background:rgba(0,0,0,0.25);border-radius:20px;padding:2px 7px;margin-left:4px;">1er poste</span>':'')+'</div>'
          +   '<div style="font-size:11px;opacity:0.95;margin-top:1px;">'+fmtH(toMin(b.heure_debut))+(b.heure_fin?' – '+fmtH(toMin(b.heure_fin)):'')+'</div>'
          +   (b.consigne?'<div style="font-size:11px;background:rgba(255,255,255,0.2);border-radius:8px;padding:5px 9px;margin-top:6px;">📋 '+esc(b.consigne)+'</div>':'')
          + '</div></div></div>';
        if(i<blocks.length-1){ steps+='<div style="font-size:10px;color:#8A9BAD;font-style:italic;margin:0 0 4px 96px;">↓ puis tu bascules à '+fmtH(toMin(b.heure_fin))+'</div>'; }
      });
      container.innerHTML='<div style="background:#F4F7FB;border-radius:12px;padding:12px 14px;margin-top:8px;">'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8A9BAD;margin-bottom:4px;">🕐 Ton planning du match</div>'
        + '<div style="font-size:11px;color:#5A7291;margin-bottom:12px;">Tu es attendu dès <b>'+firstH+'</b>. Tu enchaînes '+blocks.length+' poste'+(blocks.length>1?'s':'')+' — tout est indiqué ci-dessous.</div>'
        + steps + '</div>';
    }catch(e){ console.error('[PN] benevole',e); container.innerHTML=''; }
  }

  // ════════════════ VUE PILOTE : constructeur ════════════════
  async function renderPilote(container, sb, opts){
    if(!container) return;
    opts=opts||{}; var mid=opts.matchId;
    if(!sb||!mid){ container.innerHTML=''; return; }
    container.innerHTML='<div style="color:rgba(255,255,255,0.4);font-size:12px;padding:6px 0;">Chargement du planning…</div>';
    try{
      var res=await Promise.all([
        sb.from('matchs').select('heure,adversaire').eq('id',mid).maybeSingle(),
        sb.from('inscriptions').select('benevole_id, benevoles!inscriptions_benevole_id_fkey(prenom,nom)').eq('match_id',mid).eq('statut','disponible'),
        sb.from('postes').select('id,nom').eq('actif',true).order('nom'),
        sb.from('match_planning').select('*').eq('match_id',mid)
      ]);
      var match=(res[0]&&res[0].data)||{};
      var insc=(res[1]&&res[1].data)||[];
      var postes=(res[2]&&res[2].data)||[];
      var blocks=(res[3]&&res[3].data)||[];
      var ke=toMin(match.heure);

      // bénévoles disponibles (dédup)
      var benMap={};
      insc.forEach(function(i){ if(i.benevole_id && !benMap[i.benevole_id]){ var b=i.benevoles||{}; benMap[i.benevole_id]={id:i.benevole_id, nom:((b.prenom||'')+' '+(b.nom||'')).trim()||'Bénévole'}; } });
      var bens=Object.keys(benMap).map(function(k){return benMap[k];}).sort(function(a,b){return a.nom.localeCompare(b.nom);});
      var blkByBen={}; blocks.forEach(function(b){ (blkByBen[b.benevole_id]=blkByBen[b.benevole_id]||[]).push(b); });
      Object.keys(blkByBen).forEach(function(k){ blkByBen[k].sort(function(a,b){return (toMin(a.heure_debut)||0)-(toMin(b.heure_debut)||0);}); });

      container._pn={ sb:sb, mid:mid, ke:ke, postes:postes, bens:bens };
      var dom=domainFrom(blocks, ke);

      var html='';
      // en-tête
      var nbPlan=Object.keys(blkByBen).length;
      html+='<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:10px;">'+nbPlan+' / '+bens.length+' bénévole'+(bens.length>1?'s':'')+' planifié'+(nbPlan>1?'s':'')+(ke!=null?' · coup d\'envoi '+fmtH(ke):'')+'. Applique un <b style="color:#fff;">modèle de rôle</b> ou ajoute un créneau manuel à chaque bénévole ci-dessous.</div>';

      // Gantt (visualisation)
      if(blocks.length){
        html+='<div style="overflow-x:auto;margin-bottom:12px;"><div style="min-width:560px;">';
        // axe
        var ticks='';
        for(var t=dom[0];t<=dom[1];t+=60){ var l=pos(t,dom); ticks+='<div style="position:absolute;top:0;left:'+l+'%;font-size:9px;color:rgba(255,255,255,0.4);font-weight:600;transform:translateX(-2px);">'+fmtH(t)+'</div>'; if(t<dom[1])ticks+='<div style="position:absolute;top:0;bottom:0;left:'+l+'%;width:1px;background:rgba(255,255,255,0.06);"></div>'; }
        if(ke!=null) ticks+='<div style="position:absolute;top:0;bottom:0;left:'+pos(ke,dom)+'%;width:2px;background:#E24B4A;"></div><div style="position:absolute;top:-2px;left:'+pos(ke,dom)+'%;transform:translateX(-50%);background:#E24B4A;color:#fff;font-size:8px;font-weight:800;padding:1px 6px;border-radius:20px;white-space:nowrap;">🏐 '+fmtH(ke)+'</div>';
        html+='<div style="display:flex;"><div style="width:120px;flex-shrink:0;"></div><div style="position:relative;flex:1;height:16px;">'+ticks+'</div></div>';
        // lignes
        bens.forEach(function(bn){
          var bl=blkByBen[bn.id]||[]; if(!bl.length) return;
          var lane='';
          bl.forEach(function(b,j){
            var d=toMin(b.heure_debut), f=toMin(b.heure_fin)||(d+30); var left=pos(d,dom), w=Math.max(4,pos(f,dom)-left);
            lane+='<div title="'+esc(b.libelle)+' '+fmtH(d)+'–'+fmtH(f)+'" style="position:absolute;top:4px;bottom:4px;left:'+left+'%;width:'+w+'%;background:'+colOf(b)+';border-radius:6px;display:flex;align-items:center;padding:0 7px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3);"><span style="font-size:10px;font-weight:700;color:#fff;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.4);">'+esc(b.libelle)+'</span></div>';
            if(j<bl.length-1){ lane+='<div style="position:absolute;top:8px;left:calc('+pos(f,dom)+'% - 5px);font-size:11px;color:#fff;z-index:3;">➜</div>'; }
          });
          lane+=(function(){ var g=''; for(var t=dom[0];t<=dom[1];t+=60){ g+='<div style="position:absolute;top:0;bottom:0;left:'+pos(t,dom)+'%;width:1px;background:rgba(255,255,255,0.05);"></div>'; } return g; })();
          html+='<div style="display:flex;align-items:center;border-top:1px solid rgba(255,255,255,0.06);"><div style="width:120px;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;padding:6px 8px 6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(bn.nom)+'</div><div style="position:relative;flex:1;height:34px;">'+lane+'</div></div>';
        });
        html+='</div></div>';
        // couverture
        html+=coverageHtml(blocks, dom);
      }

      // Liste éditable par bénévole
      html+='<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:14px 0 8px;">Bénévoles à planifier</div>';
      if(!bens.length){ html+='<div style="font-size:12px;color:rgba(255,255,255,0.4);">Aucun bénévole disponible affecté pour ce match.</div>'; }
      bens.forEach(function(bn,idx){
        var bl=blkByBen[bn.id]||[];
        var chips=bl.map(function(b){ return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#fff;background:'+colOf(b)+';border-radius:20px;padding:3px 6px 3px 10px;margin:2px 3px 2px 0;">'+esc(b.libelle)+' '+fmtH(toMin(b.heure_debut))+(b.heure_fin?'–'+fmtH(toMin(b.heure_fin)):'')+' <span data-del="'+b.id+'" style="cursor:pointer;background:rgba(0,0,0,0.25);border-radius:50%;width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">✕</span></span>'; }).join('') || '<span style="font-size:11px;color:rgba(255,255,255,0.35);">Aucun créneau.</span>';
        var tplOpts=TEMPLATES.map(function(t){ return '<option value="'+t.key+'">'+esc(t.label)+'</option>'; }).join('');
        var posteOpts='<option value="">— Poste / rôle —</option>'+postes.map(function(p){ return '<option value="'+p.id+'|'+esc(p.nom)+'">'+esc(p.nom)+'</option>'; }).join('')+'<option value="|Accueil des bénévoles">Accueil des bénévoles</option><option value="|Guichet — accréditations">Guichet — accréditations</option><option value="|Dotations + Repas">Dotations + Repas</option>';
        html+='<div class="pn-ben" data-ben="'+bn.id+'" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;margin-bottom:8px;">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--c-navy-2,#0C447C);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">'+ini(bn.nom)+'</div><div style="font-size:13px;font-weight:700;color:#fff;">'+esc(bn.nom)+'</div></div>'
          + '<div style="margin-bottom:8px;">'+chips+'</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
          +   '<select class="pn-tpl" style="background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:6px 9px;color:#fff;font-size:11px;">'+tplOpts+'</select>'
          +   '<button class="pn-apply" style="background:var(--c-action,#185FA5);color:#fff;border:none;border-radius:8px;padding:6px 11px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;">Appliquer le modèle</button>'
          +   '<button class="pn-toggle" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 11px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;">+ Créneau manuel</button>'
          + '</div>'
          + '<div class="pn-manual" style="display:none;margin-top:8px;background:rgba(0,0,0,0.15);border-radius:8px;padding:8px;">'
          +   '<select class="pn-poste" style="width:100%;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;margin-bottom:6px;">'+posteOpts+'</select>'
          +   '<div style="display:flex;gap:6px;margin-bottom:6px;"><input class="pn-deb" type="time" style="flex:1;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;"><input class="pn-fin" type="time" style="flex:1;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;"></div>'
          +   '<input class="pn-cons" placeholder="Consigne (visible du bénévole)" style="width:100%;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;margin-bottom:6px;">'
          +   '<button class="pn-add" style="width:100%;background:#1f6f43;color:#fff;border:none;border-radius:8px;padding:8px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;">Ajouter le créneau</button>'
          + '</div>'
          + '</div>';
      });

      container.innerHTML=html;
      wirePilote(container);
    }catch(e){ console.error('[PN] pilote',e); container.innerHTML='<div style="color:#F09595;font-size:12px;">Planning indisponible : '+esc(e.message||e)+'</div>'; }
  }

  function coverageHtml(blocks, dom){
    // regroupe par catégorie/libellé de base, compte sur tranches 30 min
    var groups={}; blocks.forEach(function(b){ var k=b.categorie||b.libelle||'autre'; if(!groups[k])groups[k]={col:colOf(b),lab:CATLAB[b.categorie]||b.libelle||'Autre',blocks:[]}; groups[k].blocks.push(b); });
    var keys=Object.keys(groups); if(!keys.length) return '';
    var rows=keys.map(function(k){
      var g=groups[k], segs='';
      for(var t=dom[0];t<dom[1];t+=30){ var n=0; g.blocks.forEach(function(b){ var d=toMin(b.heure_debut),f=toMin(b.heure_fin)||(d+30); if(d<=t&&f>t)n++; }); if(n>0){ var op=0.35+Math.min(n,5)*0.13; segs+='<div style="position:absolute;top:2px;height:14px;left:'+pos(t,dom)+'%;width:'+(pos(t+30,dom)-pos(t,dom))+'%;background:'+g.col+';opacity:'+op+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;">'+n+'</div>'; } }
      return '<div style="display:flex;align-items:center;margin-bottom:4px;"><div style="width:120px;flex-shrink:0;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:2px;background:'+g.col+';"></span>'+esc(g.lab)+'</div><div style="position:relative;flex:1;height:18px;background:rgba(255,255,255,0.04);border-radius:5px;">'+segs+'</div></div>';
    }).join('');
    return '<div style="margin:6px 0 4px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px;">📊 Couverture par poste (nb de bénévoles présents)</div>'+rows+'</div>';
  }

  function wirePilote(container){
    var st=container._pn;
    async function refresh(){ renderPilote(container, st.sb, { matchId:st.mid }); }
    // supprimer un bloc
    container.querySelectorAll('[data-del]').forEach(function(el){
      el.addEventListener('click', async function(){
        var id=el.getAttribute('data-del');
        var { error } = await st.sb.from('match_planning').delete().eq('id',id);
        if(!error) refresh();
      });
    });
    container.querySelectorAll('.pn-ben').forEach(function(row){
      var bid=row.getAttribute('data-ben');
      var applyBtn=row.querySelector('.pn-apply'), tplSel=row.querySelector('.pn-tpl');
      var toggle=row.querySelector('.pn-toggle'), manual=row.querySelector('.pn-manual'), addBtn=row.querySelector('.pn-add');
      if(toggle) toggle.addEventListener('click', function(){ manual.style.display = manual.style.display==='none'?'block':'none'; });
      if(applyBtn) applyBtn.addEventListener('click', async function(){
        var tpl=TEMPLATES.find(function(t){return t.key===tplSel.value;}); if(!tpl) return;
        if(st.ke==null){ if(window.showAlert) window.showAlert('alert-match','Renseigne l\'heure du match (onglet Calendrier) pour utiliser les modèles.','e'); return; }
        var rows=tpl.blocks.map(function(b,i){ return { match_id:st.mid, benevole_id:bid, libelle:b.lib, categorie:b.cat, couleur:CATCOL[b.cat]||CATCOL.autre, heure_debut:minToTime(st.ke+b.from), heure_fin:minToTime(st.ke+b.to), consigne:b.consigne||null, ordre:i }; });
        applyBtn.textContent='...'; applyBtn.disabled=true;
        var { error } = await st.sb.from('match_planning').insert(rows);
        if(error){ applyBtn.textContent='Appliquer le modèle'; applyBtn.disabled=false; if(window.showAlert) window.showAlert('alert-match','Erreur : '+error.message,'e'); return; }
        refresh();
      });
      if(addBtn) addBtn.addEventListener('click', async function(){
        var pv=row.querySelector('.pn-poste').value||''; var parts=pv.split('|');
        var posteId=parts[0]||null; var lib=parts[1]||'';
        var deb=row.querySelector('.pn-deb').value, fin=row.querySelector('.pn-fin').value;
        var cons=row.querySelector('.pn-cons').value.trim();
        if(!lib){ if(window.showAlert) window.showAlert('alert-match','Choisis un poste/rôle','e'); return; }
        if(!deb){ if(window.showAlert) window.showAlert('alert-match','Indique l\'heure de début','e'); return; }
        var cat=guessCat(lib);
        var rec={ match_id:st.mid, benevole_id:bid, poste_id:posteId||null, libelle:lib, categorie:cat, couleur:CATCOL[cat]||CATCOL.autre, heure_debut:(deb.length===5?deb+':00':deb), heure_fin:fin?(fin.length===5?fin+':00':fin):null, consigne:cons||null, ordre:0 };
        addBtn.textContent='...'; addBtn.disabled=true;
        var { error } = await st.sb.from('match_planning').insert(rec);
        if(error){ addBtn.textContent='Ajouter le créneau'; addBtn.disabled=false; if(window.showAlert) window.showAlert('alert-match','Erreur : '+error.message,'e'); return; }
        refresh();
      });
    });
  }
  function guessCat(lib){
    var l=(lib||'').toLowerCase();
    if(l.indexOf('accueil')>=0) return 'accueil';
    if(l.indexOf('guichet')>=0) return 'guichet';
    if(l.indexOf('scan')>=0) return 'scan';
    if(l.indexOf('placement')>=0||l.indexOf('placem')>=0) return 'placement';
    if(l.indexOf('buvette')>=0) return 'buvette';
    if(l.indexOf('dotation')>=0||l.indexOf('repas')>=0) return 'dota';
    if(l.indexOf('sécu')>=0||l.indexOf('secu')>=0) return 'securite';
    return 'autre';
  }

  window.SpacersPN = { renderBenevole:renderBenevole, renderPilote:renderPilote };
})();
