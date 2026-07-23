/* ============================================================
   Planning nominatif (hub d'affectation + créneaux par bénévole) — Spacers
   Expose : window.SpacersPN
   - renderBenevole(container, sb, {matchId, benevoleId})  → "Mon planning"
   - renderPilote(container, sb, {matchId})                → hub pilote
   Principe : affecter = 1 clic (poste principal, tout le match). Le planning
   détaillé (bascules de poste) n'est saisi que pour les cas particuliers.
   La vue globale (Gantt + couverture) se dérive automatiquement.
   Données : match_planning (créneaux) + inscriptions.poste_id (poste principal).
   Charte : palette des créneaux existants. UTF-8 sans BOM.
   ============================================================ */
(function () {
  'use strict';

  var CATCOL = {
    accueil:'#F5C842', guichet:'#8B5CF6', scan:'#3B82F6', placement:'#22C55E',
    buvette:'#F97316', dota:'#EC4899', securite:'#64748B', autre:'#64748B'
  };
  var CATLAB = {
    accueil:'Accueil', guichet:'Guichet', scan:'Scan entrée', placement:'Placement',
    buvette:'Buvette', dota:'Dotations + Repas', securite:'Sécurité', autre:'Autre'
  };
  var PALETTE = ['#3B82F6','#22C55E','#F97316','#8B5CF6','#EC4899','#14B8A6','#F5C842','#EF4444','#0EA5E9','#84CC16'];
  var UI = { ganttOpen: false }; // timeline repliée par défaut (persiste entre re-rendus)

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
  function ini(n){ n=(n||'').trim(); var p=n.split(' '); return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase(); }
  function guessCat(lib){
    var l=(lib||'').toLowerCase();
    if(l.indexOf('accueil')>=0) return 'accueil';
    if(l.indexOf('guichet')>=0) return 'guichet';
    if(l.indexOf('scan')>=0) return 'scan';
    if(l.indexOf('placement')>=0||l.indexOf('placem')>=0) return 'placement';
    if(l.indexOf('buvette')>=0) return 'buvette';
    if(l.indexOf('dotation')>=0||l.indexOf('repas')>=0) return 'dota';
    if(l.indexOf('sécu')>=0||l.indexOf('secu')>=0||l.indexOf('surveil')>=0) return 'securite';
    return 'autre';
  }
  function posteColor(nom){ var c=guessCat(nom); if(c!=='autre') return CATCOL[c]; var h=0,s=nom||''; for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0; return PALETTE[h%PALETTE.length]; }

  function domainFrom(blocks, ke){
    var lo=null,hi=null;
    blocks.forEach(function(b){ var d=toMin(b.heure_debut), f=toMin(b.heure_fin); if(d!=null){lo=lo==null?d:Math.min(lo,d);hi=hi==null?d:Math.max(hi,d);} if(f!=null){hi=hi==null?f:Math.max(hi,f);} });
    if(lo==null){ lo=(ke!=null?ke-90:16*60); hi=(ke!=null?ke+120:20*60); }
    else if(ke!=null){ lo=Math.min(lo,ke-90); hi=Math.max(hi,ke+120); }
    lo=Math.floor(lo/60)*60; hi=Math.ceil(hi/60)*60; if(hi<=lo)hi=lo+60;
    return [lo,hi];
  }
  function pos(m,dom){ return (m-dom[0])/(dom[1]-dom[0])*100; }

  // ════════════ VUE BÉNÉVOLE : "Mon planning" ════════════
  async function renderBenevole(container, sb, opts){
    if(!container) return;
    opts=opts||{}; var mid=opts.matchId, bid=opts.benevoleId;
    if(!sb||!mid||!bid){ container.innerHTML=''; return; }
    try{
      var r=await sb.from('match_planning').select('*').eq('match_id',mid).eq('benevole_id',bid).order('heure_debut');
      var blocks=(r.data||[]).slice().sort(function(a,b){ return (toMin(a.heure_debut)||0)-(toMin(b.heure_debut)||0); });
      if(!blocks.length){ container.innerHTML=''; return; }
      var firstH=fmtH(toMin(blocks[0].heure_debut));
      var steps='';
      blocks.forEach(function(b,i){
        var c=colOf(b);
        steps+='<div style="display:flex;gap:11px;">'
          + '<div style="width:86px;flex-shrink:0;text-align:right;padding-top:2px;"><div style="font-size:15px;font-weight:800;color:var(--c-navy,#042C53);">'+fmtH(toMin(b.heure_debut))+'</div>'+(b.heure_fin?'<div style="font-size:10px;color:#8A9BAD;">→ '+fmtH(toMin(b.heure_fin))+'</div>':'')+'</div>'
          + '<div style="position:relative;width:18px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">'+(i<blocks.length-1?'<div style="position:absolute;top:10px;bottom:-14px;width:2px;background:#e0e7f0;"></div>':'')+'<div style="width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px '+c+';margin-top:3px;z-index:2;"></div></div>'
          + '<div style="flex:1;padding-bottom:16px;min-width:0;"><div style="border-radius:12px;padding:12px 14px;color:#fff;background:'+c+';">'
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

  // ════════════ VUE PILOTE : hub d'affectation ════════════
  async function renderPilote(container, sb, opts){
    if(!container) return;
    opts=opts||{}; var mid=opts.matchId;
    if(!sb||!mid){ container.innerHTML=''; return; }
    container.innerHTML='<div style="color:rgba(255,255,255,0.4);font-size:12px;padding:6px 0;">Chargement…</div>';
    try{
      var res=await Promise.all([
        sb.from('matchs').select('heure').eq('id',mid).maybeSingle(),
        sb.from('inscriptions').select('benevole_id, poste_id, benevoles!inscriptions_benevole_id_fkey(prenom,nom,postes_preferes)').eq('match_id',mid).eq('statut','disponible'),
        sb.from('postes').select('id,nom').eq('actif',true).order('nom'),
        sb.from('match_planning').select('*').eq('match_id',mid)
      ]);
      var match=(res[0]&&res[0].data)||{};
      var insc=(res[1]&&res[1].data)||[];
      var postes=(res[2]&&res[2].data)||[];
      var blocks=(res[3]&&res[3].data)||[];
      var ke=toMin(match.heure);

      var posteMap={}; postes.forEach(function(p){ posteMap[p.id]={nom:p.nom,col:posteColor(p.nom)}; });
      var benMap={};
      insc.forEach(function(i){ if(i.benevole_id && !benMap[i.benevole_id]){ var b=i.benevoles||{}; benMap[i.benevole_id]={id:i.benevole_id, nom:((b.prenom||'')+' '+(b.nom||'')).trim()||'Bénévole', posteId:i.poste_id||null, prefs:b.postes_preferes||''}; } });
      var bens=Object.keys(benMap).map(function(k){return benMap[k];}).sort(function(a,b){return a.nom.localeCompare(b.nom);});
      var blkByBen={}; blocks.forEach(function(b){ (blkByBen[b.benevole_id]=blkByBen[b.benevole_id]||[]).push(b); });
      Object.keys(blkByBen).forEach(function(k){ blkByBen[k].sort(function(a,b){return (toMin(a.heure_debut)||0)-(toMin(b.heure_debut)||0);}); });

      container._pn={ sb:sb, mid:mid, ke:ke };
      var dom=domainFrom(blocks, ke);

      function segmentsFor(bn){
        var bl=blkByBen[bn.id];
        if(bl && bl.length) return bl.map(function(b){ return { lib:b.libelle, col:colOf(b), d:toMin(b.heure_debut), f:toMin(b.heure_fin)||(toMin(b.heure_debut)+30), group:CATLAB[b.categorie]||b.libelle, timed:true }; });
        if(bn.posteId && posteMap[bn.posteId]) return [{ lib:posteMap[bn.posteId].nom, col:posteMap[bn.posteId].col, d:dom[0], f:dom[1], group:posteMap[bn.posteId].nom, timed:false }];
        return [];
      }

      var nbAff=bens.filter(function(b){ return b.posteId || (blkByBen[b.id]&&blkByBen[b.id].length); }).length;
      var html='';
      html+='<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:10px;">'+nbAff+' / '+bens.length+' bénévole'+(bens.length>1?'s':'')+' affecté'+(nbAff>1?'s':'')+(ke!=null?' · coup d\'envoi '+fmtH(ke):'')+'. Choisis un <b style="color:#fff;">poste</b> pour chacun (1 clic = tout le match). Découpe en horaires seulement pour les cas particuliers.</div>';

      var anySeg=bens.some(function(b){ return segmentsFor(b).length; });
      if(anySeg){
        var gchev=UI.ganttOpen?'▾':'▸';
        html+='<div class="pn-gantt-toggle" style="cursor:pointer;user-select:none;font-size:11px;font-weight:700;color:var(--c-blue-100,#B5D4F4);margin-bottom:8px;display:inline-block;">'+gchev+' Vue d\'ensemble (timeline + couverture des postes)</div>';
        html+='<div class="pn-gantt-body" style="display:'+(UI.ganttOpen?'block':'none')+';">';
        html+='<div style="overflow-x:auto;margin-bottom:14px;"><div style="min-width:620px;">';
        var ticks='';
        for(var t=dom[0];t<=dom[1];t+=60){ var l=pos(t,dom); ticks+='<div style="position:absolute;top:0;left:'+l+'%;font-size:10px;color:rgba(255,255,255,0.45);font-weight:600;transform:translateX(-2px);">'+fmtH(t)+'</div>'; if(t<dom[1])ticks+='<div style="position:absolute;top:0;bottom:0;left:'+l+'%;width:1px;background:rgba(255,255,255,0.06);"></div>'; }
        if(ke!=null) ticks+='<div style="position:absolute;top:0;bottom:0;left:'+pos(ke,dom)+'%;width:2px;background:#E24B4A;"></div><div style="position:absolute;top:-2px;left:'+pos(ke,dom)+'%;transform:translateX(-50%);background:#E24B4A;color:#fff;font-size:9px;font-weight:800;padding:1px 7px;border-radius:20px;white-space:nowrap;">🏐 '+fmtH(ke)+'</div>';
        html+='<div style="display:flex;"><div style="width:150px;flex-shrink:0;"></div><div style="position:relative;flex:1;height:18px;">'+ticks+'</div></div>';
        bens.forEach(function(bn,idx){
          var segs=segmentsFor(bn); if(!segs.length) return;
          var lane='';
          for(var tt=dom[0];tt<=dom[1];tt+=60){ lane+='<div style="position:absolute;top:0;bottom:0;left:'+pos(tt,dom)+'%;width:1px;background:rgba(255,255,255,0.05);"></div>'; }
          segs.forEach(function(s,j){
            var left=pos(s.d,dom), w=Math.max(5,pos(s.f,dom)-left);
            lane+='<div title="'+esc(s.lib)+' '+fmtH(s.d)+'–'+fmtH(s.f)+'" style="position:absolute;top:6px;bottom:6px;left:'+left+'%;width:'+w+'%;background:'+s.col+';border-radius:8px;display:flex;flex-direction:column;justify-content:center;padding:0 10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.28);'+(s.timed?'':'opacity:0.94;')+'"><span style="font-size:11px;font-weight:800;color:#fff;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.45);line-height:1.15;">'+esc(s.lib)+'</span><span style="font-size:9px;color:#fff;opacity:0.9;white-space:nowrap;line-height:1.1;">'+fmtH(s.d)+'–'+fmtH(s.f)+'</span></div>';
            if(j<segs.length-1){ lane+='<div style="position:absolute;top:20px;left:calc('+pos(s.f,dom)+'% - 5px);font-size:12px;color:#fff;z-index:3;text-shadow:0 1px 2px rgba(0,0,0,0.5);">➜</div>'; }
          });
          var rowBg=(idx%2===0)?'rgba(255,255,255,0.02)':'transparent';
          html+='<div style="display:flex;align-items:center;background:'+rowBg+';border-radius:6px;"><div style="width:150px;flex-shrink:0;display:flex;align-items:center;gap:7px;padding:5px 8px 5px 4px;"><div style="width:26px;height:26px;border-radius:50%;background:var(--c-navy-2,#0C447C);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">'+ini(bn.nom)+'</div><div style="font-size:11px;font-weight:700;color:#fff;line-height:1.1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(bn.nom)+'</div></div><div style="position:relative;flex:1;height:48px;">'+lane+'</div></div>';
        });
        html+='</div></div>';
        html+=coverageHtml(bens, segmentsFor, dom);
        html+='</div>';
      }

      html+='<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:14px 0 8px;">Affectation des bénévoles</div>';
      if(!bens.length){ html+='<div style="font-size:12px;color:rgba(255,255,255,0.4);">Aucun bénévole disponible pour ce match.</div>'; }
      bens.forEach(function(bn){
        var bl=blkByBen[bn.id]||[]; var hasTimed=bl.length>0;
        var prefsList=(bn.prefs||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
        var prefsHtml = prefsList.length? '<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:2px;">❤️ '+prefsList.map(esc).join(' · ')+'</div>':'';
        var posteOpts='<option value="">— non affecté —</option>'+postes.map(function(p){ return '<option value="'+p.id+'"'+(bn.posteId===p.id?' selected':'')+'>'+esc(p.nom)+'</option>'; }).join('');
        var chips = hasTimed ? bl.map(function(b){ return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#fff;background:'+colOf(b)+';border-radius:20px;padding:3px 6px 3px 10px;margin:2px 3px 2px 0;">'+esc(b.libelle)+' '+fmtH(toMin(b.heure_debut))+(b.heure_fin?'–'+fmtH(toMin(b.heure_fin)):'')+' <span data-del="'+b.id+'" style="cursor:pointer;background:rgba(0,0,0,0.25);border-radius:50%;width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">✕</span></span>'; }).join('') : '';
        var tplOpts=TEMPLATES.map(function(t){ return '<option value="'+t.key+'">'+esc(t.label)+'</option>'; }).join('');
        var manualPosteOpts='<option value="">— Poste / rôle —</option>'+postes.map(function(p){ return '<option value="'+p.id+'|'+esc(p.nom)+'">'+esc(p.nom)+'</option>'; }).join('')+'<option value="|Accueil des bénévoles">Accueil des bénévoles</option><option value="|Guichet — accréditations">Guichet — accréditations</option><option value="|Dotations + Repas">Dotations + Repas</option>';
        html+='<div class="pn-ben" data-ben="'+bn.id+'" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;margin-bottom:8px;">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--c-navy-2,#0C447C);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">'+ini(bn.nom)+'</div><div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#fff;">'+esc(bn.nom)+'</div>'+prefsHtml+'</div></div>'
          + (hasTimed
              ? '<div style="margin-bottom:6px;">'+chips+'</div><div style="font-size:10px;color:var(--c-gold-2,#FAC775);margin-bottom:6px;">⏱ Planning détaillé actif (remplace le poste principal).</div>'
              : '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:11px;color:rgba(255,255,255,0.6);white-space:nowrap;">Poste :</span><select class="pn-poste-main" style="flex:1;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:12px;">'+posteOpts+'</select></div>')
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;"><span class="pn-adv-toggle" style="cursor:pointer;font-size:10px;font-weight:700;color:var(--c-blue-100,#B5D4F4);">⏱ Planning détaillé (bascules de poste) ▾</span></div>'
          + '<div class="pn-adv" style="display:none;margin-top:8px;background:rgba(0,0,0,0.15);border-radius:8px;padding:8px;">'
          +   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;"><select class="pn-tpl" style="background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:6px 9px;color:#fff;font-size:11px;">'+tplOpts+'</select><button class="pn-apply" style="background:var(--c-action,#185FA5);color:#fff;border:none;border-radius:8px;padding:6px 11px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;">Appliquer le modèle</button></div>'
          +   '<select class="pn-poste" style="width:100%;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;margin-bottom:6px;">'+manualPosteOpts+'</select>'
          +   '<div style="display:flex;gap:6px;margin-bottom:6px;"><input class="pn-deb" type="time" style="flex:1;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;"><input class="pn-fin" type="time" style="flex:1;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;"></div>'
          +   '<input class="pn-cons" placeholder="Consigne (visible du bénévole)" style="width:100%;background:var(--c-ink-2,#2A2A28);border:1px solid var(--c-ink-3,#444441);border-radius:8px;padding:7px 9px;color:#fff;font-size:11px;margin-bottom:6px;">'
          +   '<button class="pn-add" style="width:100%;background:#1f6f43;color:#fff;border:none;border-radius:8px;padding:8px;font-family:inherit;font-weight:700;font-size:11px;cursor:pointer;">+ Ajouter un créneau horaire</button>'
          + '</div>'
          + '</div>';
      });

      container.innerHTML=html;
      wirePilote(container);
    }catch(e){ console.error('[PN] pilote',e); container.innerHTML='<div style="color:#F09595;font-size:12px;">Planning indisponible : '+esc(e.message||e)+'</div>'; }
  }

  function coverageHtml(bens, segmentsFor, dom){
    var groups={};
    bens.forEach(function(bn){ segmentsFor(bn).forEach(function(s){ if(!groups[s.group])groups[s.group]={col:s.col,lab:s.group,segs:[]}; groups[s.group].segs.push(s); }); });
    var keys=Object.keys(groups); if(!keys.length) return '';
    var rows=keys.sort().map(function(k){
      var g=groups[k], cells='';
      for(var t=dom[0];t<dom[1];t+=30){ var n=0; g.segs.forEach(function(s){ if(s.d<=t&&s.f>t)n++; }); if(n>0){ var op=0.4+Math.min(n,5)*0.12; cells+='<div style="position:absolute;top:3px;height:18px;left:'+pos(t,dom)+'%;width:'+(pos(t+30,dom)-pos(t,dom))+'%;background:'+g.col+';opacity:'+op+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">'+n+'</div>'; } }
      return '<div style="display:flex;align-items:center;margin-bottom:5px;"><div style="width:150px;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:2px;background:'+g.col+';flex-shrink:0;"></span>'+esc(g.lab)+'</div><div style="position:relative;flex:1;height:24px;background:rgba(255,255,255,0.04);border-radius:6px;">'+cells+'</div></div>';
    }).join('');
    return '<div style="margin:6px 0 4px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px;">📊 Couverture par poste (nb de bénévoles présents)</div>'+rows+'</div>';
  }

  function wirePilote(container){
    var st=container._pn;
    async function refresh(){ renderPilote(container, st.sb, { matchId:st.mid }); }
    // repli / dépli de la vue d'ensemble (timeline + couverture)
    var gt=container.querySelector('.pn-gantt-toggle');
    if(gt) gt.addEventListener('click', function(){
      UI.ganttOpen=!UI.ganttOpen;
      var body=container.querySelector('.pn-gantt-body');
      if(body) body.style.display=UI.ganttOpen?'block':'none';
      gt.textContent=(UI.ganttOpen?'▾':'▸')+' Vue d\'ensemble (timeline + couverture des postes)';
    });
    container.querySelectorAll('.pn-poste-main').forEach(function(sel){
      var bid=sel.closest('.pn-ben').getAttribute('data-ben');
      sel.addEventListener('change', async function(){
        var { error } = await st.sb.from('inscriptions').update({ poste_id: sel.value||null }).eq('benevole_id',bid).eq('match_id',st.mid);
        if(error){ if(window.showAlert) window.showAlert('alert-match','Erreur : '+error.message,'e'); return; }
        refresh();
      });
    });
    container.querySelectorAll('[data-del]').forEach(function(el){
      el.addEventListener('click', async function(e){ e.stopPropagation();
        var { error } = await st.sb.from('match_planning').delete().eq('id',el.getAttribute('data-del'));
        if(!error) refresh();
      });
    });
    container.querySelectorAll('.pn-ben').forEach(function(row){
      var bid=row.getAttribute('data-ben');
      var advT=row.querySelector('.pn-adv-toggle'), adv=row.querySelector('.pn-adv');
      if(advT&&adv) advT.addEventListener('click', function(){ adv.style.display = adv.style.display==='none'?'block':'none'; });
      var applyBtn=row.querySelector('.pn-apply'), tplSel=row.querySelector('.pn-tpl');
      if(applyBtn) applyBtn.addEventListener('click', async function(){
        var tpl=TEMPLATES.find(function(t){return t.key===tplSel.value;}); if(!tpl) return;
        if(st.ke==null){ if(window.showAlert) window.showAlert('alert-match','Renseigne l\'heure du match (onglet Calendrier) pour les modèles.','e'); return; }
        var rows=tpl.blocks.map(function(b,i){ return { match_id:st.mid, benevole_id:bid, libelle:b.lib, categorie:b.cat, couleur:CATCOL[b.cat]||CATCOL.autre, heure_debut:minToTime(st.ke+b.from), heure_fin:minToTime(st.ke+b.to), consigne:b.consigne||null, ordre:i }; });
        applyBtn.textContent='...'; applyBtn.disabled=true;
        var { error } = await st.sb.from('match_planning').insert(rows);
        if(error){ applyBtn.textContent='Appliquer le modèle'; applyBtn.disabled=false; if(window.showAlert) window.showAlert('alert-match','Erreur : '+error.message,'e'); return; }
        refresh();
      });
      var addBtn=row.querySelector('.pn-add');
      if(addBtn) addBtn.addEventListener('click', async function(){
        var pv=row.querySelector('.pn-poste').value||''; var parts=pv.split('|');
        var posteId=parts[0]||null, lib=parts[1]||'';
        var deb=row.querySelector('.pn-deb').value, fin=row.querySelector('.pn-fin').value;
        var cons=row.querySelector('.pn-cons').value.trim();
        if(!lib){ if(window.showAlert) window.showAlert('alert-match','Choisis un poste/rôle','e'); return; }
        if(!deb){ if(window.showAlert) window.showAlert('alert-match','Indique l\'heure de début','e'); return; }
        var cat=guessCat(lib);
        var rec={ match_id:st.mid, benevole_id:bid, poste_id:posteId||null, libelle:lib, categorie:cat, couleur:CATCOL[cat]||CATCOL.autre, heure_debut:(deb.length===5?deb+':00':deb), heure_fin:fin?(fin.length===5?fin+':00':fin):null, consigne:cons||null, ordre:0 };
        addBtn.textContent='...'; addBtn.disabled=true;
        var { error } = await st.sb.from('match_planning').insert(rec);
        if(error){ addBtn.textContent='+ Ajouter un créneau horaire'; addBtn.disabled=false; if(window.showAlert) window.showAlert('alert-match','Erreur : '+error.message,'e'); return; }
        refresh();
      });
    });
  }

  window.SpacersPN = { renderBenevole:renderBenevole, renderPilote:renderPilote };
})();
