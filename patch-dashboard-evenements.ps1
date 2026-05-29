# ============================================================
# patch-dashboard-evenements.ps1
# ------------------------------------------------------------
# Applique les 6 modifications de la fonctionnalité Événements
# sur public/dashboard.html.
#
# USAGE (depuis la racine du repo spacers-benevoles) :
#   .\patch-dashboard-evenements.ps1
#
# Le script :
#   1. Sauvegarde public/dashboard.html en .bak
#   2. Applique les 6 patches (CSS, carte découverte, écran,
#      modales, JS, hook bSwitch)
#   3. Écrit le résultat dans public/dashboard.html
#   4. Si une étape échoue (ancre introuvable), il arrête tout
#      et restaure le .bak — ton fichier n'est jamais cassé.
# ============================================================

$ErrorActionPreference = 'Stop'

$file = 'public\dashboard.html'

if (-not (Test-Path $file)) {
    Write-Host "❌ Fichier introuvable : $file" -ForegroundColor Red
    Write-Host "   Lance le script depuis la racine du repo." -ForegroundColor Yellow
    exit 1
}

# Backup
$backup = "$file.bak"
Copy-Item $file $backup -Force
Write-Host "✓ Backup créé : $backup" -ForegroundColor Green

# Lecture du fichier (UTF-8, conserve les fins de ligne)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file), [System.Text.UTF8Encoding]::new($false))
$originalLength = $content.Length

# Fonction utilitaire : applique un patch et lève une erreur si l'ancre n'existe pas
function Apply-Patch {
    param([string]$Name, [string]$Anchor, [string]$Replacement)
    if (-not $script:content.Contains($Anchor)) {
        throw "Ancre introuvable pour le patch '$Name'. Le fichier a peut-etre deja ete patche, ou l'original a ete modifie."
    }
    if (($script:content -split [regex]::Escape($Anchor)).Length -gt 2) {
        throw "Ancre ambigue (plusieurs occurrences) pour le patch '$Name'."
    }
    $script:content = $script:content.Replace($Anchor, $Replacement)
    Write-Host "  ✓ Patch '$Name' applique" -ForegroundColor Green
}

try {
    # ========================================================
    # PATCH 1 : CSS Événements — avant </style>
    # ========================================================
    $css_anchor = ".spi-empty{grid-column:1/-1;color:#5F5E5A;text-align:center;padding:24px 0;font-size:11px;}`r`n</style>"
    $css_new = @'
.spi-empty{grid-column:1/-1;color:#5F5E5A;text-align:center;padding:24px 0;font-size:11px;}

/* -- ÉVÉNEMENTS BÉNÉVOLES -- */
.ev-card{background:white;border-radius:14px;overflow:hidden;margin-bottom:10px;cursor:pointer;border:2px solid transparent;transition:all .15s;}
.ev-card:active{border-color:#185FA5;}
.ev-img{height:110px;position:relative;}
.ev-img .ev-cat{position:absolute;top:10px;left:10px;}
.ev-hero{width:calc(100% + 44px);margin:-22px -22px 14px -22px;height:150px;display:flex;align-items:flex-end;padding:14px;}
.ev-content{padding:12px;}
.ev-cat{font-size:9px;font-weight:700;padding:2px 8px;border-radius:50px;display:inline-block;}
.cat-convivial{background:#E6F1FB;color:#185FA5;}
.cat-sportif{background:#EAF3DE;color:#3B6D11;}
.cat-formation{background:#FEF3C7;color:#C9821A;}
.cat-sortie{background:#EDE9FE;color:#533BB7;}
.evph-convivial{background:linear-gradient(135deg,#0C447C,#185FA5);}
.evph-sportif{background:linear-gradient(135deg,#1a3d2e,#3B6D11);}
.evph-formation{background:linear-gradient(135deg,#9B6B3A,#C9821A);}
.evph-sortie{background:linear-gradient(135deg,#3a1a5e,#533BB7);}
.ev-titre{font-size:14px;font-weight:800;color:#0C447C;margin-top:6px;line-height:1.3;}
.ev-meta{font-size:11px;color:#5F5E5A;margin-top:4px;}
.ev-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #F1EFE8;}
.ev-org{font-size:11px;font-weight:700;color:#185FA5;}
.ev-myitem{background:white;border-radius:12px;padding:13px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;}
.ev-mytitre{font-size:13px;font-weight:700;color:#0C447C;}
.ev-mymeta{font-size:11px;color:#5F5E5A;margin-top:3px;}
.ev-st{font-size:9px;font-weight:700;padding:3px 9px;border-radius:50px;white-space:nowrap;}
.ev-st-draft{background:#FEF3C7;color:#C9821A;}
.ev-st-published{background:#EAF3DE;color:#3B6D11;}
.ev-st-hidden{background:#F1EFE8;color:#5F5E5A;}
.ev-st-past{background:#E6F1FB;color:#0C447C;}
.ev-interet-bar{display:flex;align-items:center;justify-content:space-between;background:#F1EFE8;border-radius:12px;padding:11px 14px;margin:14px 0;}
.ev-heart{border:1.5px solid #B5D4F4;background:white;border-radius:50px;padding:8px 16px;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;color:#185FA5;cursor:pointer;}
.ev-heart.on{background:#185FA5;color:white;border-color:#185FA5;}
</style>
'@
    # Normalise les CRLF du here-string
    $css_new = $css_new -replace "`r`n", "`n" -replace "`n", "`r`n"
    Apply-Patch -Name 'CSS' -Anchor $css_anchor -Replacement $css_new

    # ========================================================
    # PATCH 2 : carte 'Événements' dans renderDecouverteSection
    # ========================================================
    $card_anchor = @'
      <div class="decouv-card" onclick="bSwitch('toulouse')">
        <div class="decouv-icon">🌹</div>
        <div class="decouv-title">Toulouse</div>
        <div class="decouv-sub">Bons plans bénévoles</div>
      </div>
    </div>`
'@
    $card_anchor = $card_anchor -replace "`r`n", "`n" -replace "`n", "`r`n"

    $card_new = @'
      <div class="decouv-card" onclick="bSwitch('toulouse')">
        <div class="decouv-icon">🌹</div>
        <div class="decouv-title">Toulouse</div>
        <div class="decouv-sub">Bons plans bénévoles</div>
      </div>
      <div class="decouv-card" onclick="bSwitch('evenements')">
        <div class="decouv-icon">🎉</div>
        <div class="decouv-title">Événements</div>
        <div class="decouv-sub">Sorties & afterworks</div>
      </div>
    </div>`
'@
    $card_new = $card_new -replace "`r`n", "`n" -replace "`n", "`r`n"
    Apply-Patch -Name 'Carte Decouverte' -Anchor $card_anchor -Replacement $card_new

    # ========================================================
    # PATCH 3 : Écran bs-evenements — avant </div><!-- /app -->
    # ========================================================
    $screen_anchor = "</div><!-- /app -->"
    $screen_new = @'
  <!-- -- ÉVÉNEMENTS BÉNÉVOLES -- -->
  <div class="bscreen" id="bs-evenements">
    <button class="back-btn" onclick="bSwitch('home')">← Retour</button>
    <div class="sec">🎉 Événements bénévoles</div>
    <div style="font-size:11px;color:rgba(181,212,244,0.6);margin-bottom:12px;line-height:1.5;">
      Propose et rejoins les événements de la tribu — afterworks, sorties, formations, tournois internes.
    </div>

    <button class="btn btn-blue" style="width:100%;font-size:13px;margin-bottom:12px;background:linear-gradient(135deg,#185FA5,#0C447C);" onclick="openCreateEv()">
      ✍️ Proposer un événement
    </button>

    <div style="display:flex;gap:6px;margin-bottom:10px;">
      <button class="seg-b on" data-ev-view="decouvrir" onclick="setEvView(this)">Découvrir</button>
      <button class="seg-b" data-ev-view="mesevents" onclick="setEvView(this)">Mes événements</button>
    </div>

    <div id="ev-decouvrir">
      <div style="display:flex;gap:6px;margin-bottom:8px;overflow-x:auto;">
        <button class="seg-b on" data-ev-cat="tous" onclick="setEvCat(this)">Tous</button>
        <button class="seg-b" data-ev-cat="convivial" onclick="setEvCat(this)">😄 Convivial</button>
        <button class="seg-b" data-ev-cat="sportif" onclick="setEvCat(this)">🏐 Sportif</button>
        <button class="seg-b" data-ev-cat="formation" onclick="setEvCat(this)">🎓 Formation</button>
        <button class="seg-b" data-ev-cat="sortie" onclick="setEvCat(this)">🌳 Sortie</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button class="seg-b on" data-ev-time="avenir" onclick="setEvTime(this)">À venir</button>
        <button class="seg-b" data-ev-time="passes" onclick="setEvTime(this)">Passés</button>
      </div>
      <div id="ev-grid"><div style="text-align:center;color:rgba(181,212,244,0.5);padding:30px;font-size:12px;">Chargement...</div></div>
    </div>

    <div id="ev-mesevents" style="display:none;">
      <div style="font-size:11px;color:rgba(181,212,244,0.6);margin-bottom:12px;">Tes événements proposés et leur statut de validation.</div>
      <div id="ev-mylist"></div>
    </div>
  </div>

</div><!-- /app -->
'@
    $screen_new = $screen_new -replace "`r`n", "`n" -replace "`n", "`r`n"
    Apply-Patch -Name 'Ecran bs-evenements' -Anchor $screen_anchor -Replacement $screen_new

    # ========================================================
    # PATCH 4 : Deux modales — avant <!-- MODAL CHANGEMENT PROFIL
    # ========================================================
    $modals_anchor = "<!-- MODAL CHANGEMENT PROFIL (PRÉNOMS SUPPRIMÉS) -->"
    $modals_new = @'
<!-- MODAL CRÉATION ÉVÉNEMENT -->
<div class="modal-ov" id="modal-ev-create" style="display:none;" onclick="if(event.target.id==='modal-ev-create')closeCreateEv()">
  <div class="modal" style="max-height:90vh;overflow-y:auto;max-width:480px;">
    <h2 style="font-size:16px;font-weight:800;color:#0C447C;margin-bottom:4px;">✍️ Proposer un événement</h2>
    <div style="font-size:11px;color:#5F5E5A;margin-bottom:14px;line-height:1.5;">Ta proposition sera examinée par un pilote avant publication.</div>

    <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Titre *</label>
    <input id="ev-f-titre" type="text" placeholder="Afterwork bénévoles post-match" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;margin-bottom:10px;">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Date *</label>
        <input id="ev-f-date" type="date" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;margin-bottom:10px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Lieu</label>
        <input id="ev-f-lieu" type="text" placeholder="Brasserie, gymnase…" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;margin-bottom:10px;">
      </div>
    </div>

    <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Catégorie *</label>
    <select id="ev-f-cat" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;margin-bottom:10px;">
      <option value="convivial">😄 Convivial</option>
      <option value="sportif">🏐 Sportif</option>
      <option value="formation">🎓 Formation</option>
      <option value="sortie">🌳 Sortie</option>
    </select>

    <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Description *</label>
    <textarea id="ev-f-desc" rows="3" placeholder="De quoi s'agit-il ?" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;resize:vertical;margin-bottom:10px;"></textarea>

    <label style="font-size:11px;font-weight:600;color:#0C447C;display:block;margin-bottom:4px;">Lien d'inscription (optionnel)</label>
    <input id="ev-f-form" type="url" placeholder="https://forms.gle/…" style="width:100%;padding:10px;border:1.5px solid #D3D1C7;border-radius:9px;font-family:'Sora',sans-serif;font-size:13px;outline:none;margin-bottom:10px;">

    <div style="background:#E6F1FB;color:#0C447C;border-radius:8px;padding:10px;font-size:11px;line-height:1.6;margin-bottom:12px;">
      ⓘ Ton événement part en <b style="color:#185FA5;">attente de validation</b> pilote. 3 brouillons max en attente.
    </div>

    <div style="display:flex;gap:8px;">
      <button class="btn btn-blue" style="flex:1;font-size:13px;" onclick="soumettreEvenement()">📤 Soumettre</button>
      <button class="btn btn-ghost" style="flex:1;font-size:13px;margin-top:0;" onclick="closeCreateEv()">Annuler</button>
    </div>
    <div style="font-size:9px;color:#5F5E5A;text-align:center;margin-top:12px;font-style:italic;">* Champs obligatoires</div>
  </div>
</div>

<!-- MODAL DÉTAIL ÉVÉNEMENT -->
<div class="modal-ov" id="modal-ev-detail" style="display:none;" onclick="if(event.target.id==='modal-ev-detail')closeEvDetail()">
  <div class="modal" style="max-height:90vh;overflow-y:auto;max-width:480px;">
    <div id="modal-ev-detail-content"></div>
  </div>
</div>

<!-- MODAL CHANGEMENT PROFIL (PRÉNOMS SUPPRIMÉS) -->
'@
    $modals_new = $modals_new -replace "`r`n", "`n" -replace "`n", "`r`n"
    Apply-Patch -Name 'Modales Evenements' -Anchor $modals_anchor -Replacement $modals_new

    # ========================================================
    # PATCH 5 : Bloc JS Événements — après closeToulouseDetail
    # ========================================================
    $js_anchor = @'
function closeToulouseDetail() {
  document.getElementById('modal-toulouse').style.display = 'none'
}
'@
    $js_anchor = $js_anchor -replace "`r`n", "`n" -replace "`n", "`r`n"

    $js_new = @'
function closeToulouseDetail() {
  document.getElementById('modal-toulouse').style.display = 'none'
}

// ============================================================
// ÉVÉNEMENTS BÉNÉVOLES (V1 gradients)
// ============================================================
let evData = null
let evInterets = {}
let evMoi = new Set()
let evCat = 'tous', evTime = 'avenir'

const EV_CATLBL = { convivial:'😄 Convivial', sportif:'🏐 Sportif', formation:'🎓 Formation', sortie:'🌳 Sortie' }
const EV_PH = { convivial:'evph-convivial', sportif:'evph-sportif', formation:'evph-formation', sortie:'evph-sortie' }

async function loadEvenements() {
  const el = document.getElementById('ev-grid')
  if (!el) return
  try {
    const { data: events, error } = await sb.from('events_benevoles')
      .select('*')
      .eq('statut', 'published')
      .order('date_event', { ascending: true })
    if (error) throw error
    evData = events || []

    const orgIds = [...new Set(evData.map(e => e.organisateur_id).filter(Boolean))]
    if (orgIds.length) {
      const { data: orgs } = await sb.from('benevoles_public').select('id, prenom, nom').in('id', orgIds)
      const map = {}
      ;(orgs || []).forEach(o => { map[o.id] = ((o.prenom || '') + ' ' + ((o.nom || '')[0] || '') + '.').trim() })
      evData.forEach(e => { e.organisateur_nom = map[e.organisateur_id] || 'Bénévole' })
    }

    const ids = evData.map(e => e.id)
    evInterets = {}; evMoi = new Set()
    if (ids.length) {
      const { data: ints } = await sb.from('events_interets').select('event_id, benevole_id').in('event_id', ids)
      ;(ints || []).forEach(i => {
        evInterets[i.event_id] = (evInterets[i.event_id] || 0) + 1
        if (i.benevole_id === CP.id) evMoi.add(i.event_id)
      })
    }
    renderEvenements()
  } catch (err) {
    console.error('[evenements]', err)
    el.innerHTML = '<div class="alert alert-e">❌ Erreur de chargement : ' + (err.message || err) + '</div>'
  }
}

function renderEvenements() {
  const el = document.getElementById('ev-grid')
  const now = new Date()
  let list = (evData || []).filter(e => evCat === 'tous' || e.categorie === evCat)
  list = list.filter(e => evTime === 'avenir' ? new Date(e.date_event) >= now : new Date(e.date_event) < now)
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;color:rgba(181,212,244,0.5);padding:36px 20px;font-size:12px;">Aucun événement dans cette catégorie pour l\'instant.</div>'
    return
  }
  el.innerHTML = list.map(e => {
    const cnt = evInterets[e.id] || 0
    return `
      <div class="ev-card" onclick="openEvDetail('${e.id}')">
        <div class="ev-img ${EV_PH[e.categorie] || 'evph-convivial'}"><span class="ev-cat cat-${e.categorie}">${EV_CATLBL[e.categorie] || escapeHtml(e.categorie)}</span></div>
        <div class="ev-content">
          <div class="ev-titre">${escapeHtml(e.titre)}</div>
          <div class="ev-meta">📅 ${formatDate(e.date_event)}</div>
          ${e.lieu ? `<div class="ev-meta">📍 ${escapeHtml(e.lieu)}</div>` : ''}
          <div class="ev-foot">
            <span class="ev-meta" style="margin:0;">👤 ${escapeHtml(e.organisateur_nom || 'Bénévole')}</span>
            <span class="ev-org">✦ ${cnt} intéressé${cnt > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>`
  }).join('')
}

async function loadMesEvenements() {
  const el = document.getElementById('ev-mylist')
  if (!el || !CP) return
  const { data, error } = await sb.from('events_benevoles')
    .select('id, titre, categorie, date_event, statut, pilote_message')
    .eq('organisateur_id', CP.id)
    .order('created_at', { ascending: false })
  if (error) { el.innerHTML = '<div class="alert alert-e">❌ ' + error.message + '</div>'; return }
  if (!data || !data.length) {
    el.innerHTML = '<div style="color:rgba(181,212,244,0.5);font-size:12px;text-align:center;padding:30px;">Tu n\'as encore rien proposé.</div>'
    return
  }
  el.innerHTML = data.map(e => {
    const lbl = { draft:'⏳ En attente', published:'✓ Publié', hidden:'Masqué', past:'Passé' }[e.statut] || e.statut
    return `<div class="ev-myitem">
      <div style="flex:1;min-width:0;">
        <div class="ev-mytitre">${escapeHtml(e.titre)}</div>
        <div class="ev-mymeta">${EV_CATLBL[e.categorie] || ''} · ${formatDate(e.date_event)}</div>
        ${e.pilote_message ? `<div style="font-size:10px;color:#993556;margin-top:3px;font-style:italic;">"${escapeHtml(e.pilote_message)}"</div>` : ''}
      </div>
      <span class="ev-st ev-st-${e.statut}">${lbl}</span>
    </div>`
  }).join('')
}

function setEvView(btn) {
  document.querySelectorAll('[data-ev-view]').forEach(b => b.classList.remove('on'))
  btn.classList.add('on')
  const v = btn.dataset.evView
  document.getElementById('ev-decouvrir').style.display = v === 'decouvrir' ? 'block' : 'none'
  document.getElementById('ev-mesevents').style.display = v === 'mesevents' ? 'block' : 'none'
  if (v === 'mesevents') loadMesEvenements()
}
function setEvCat(b)  { document.querySelectorAll('[data-ev-cat]').forEach(x => x.classList.remove('on')); b.classList.add('on'); evCat = b.dataset.evCat; renderEvenements() }
function setEvTime(b) { document.querySelectorAll('[data-ev-time]').forEach(x => x.classList.remove('on')); b.classList.add('on'); evTime = b.dataset.evTime; renderEvenements() }

function openEvDetail(id) {
  const e = (evData || []).find(x => x.id === id)
  if (!e) return
  const cnt = evInterets[id] || 0
  const moi = evMoi.has(id)
  document.getElementById('modal-ev-detail-content').innerHTML = `
    <div class="ev-hero ${EV_PH[e.categorie] || 'evph-convivial'}"><span class="ev-cat cat-${e.categorie}">${EV_CATLBL[e.categorie] || escapeHtml(e.categorie)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;">
      <div style="font-size:18px;font-weight:800;color:#0C447C;line-height:1.3;flex:1;">${escapeHtml(e.titre)}</div>
      <button onclick="closeEvDetail()" style="border:none;background:#F1EFE8;width:32px;height:32px;border-radius:50%;font-size:14px;cursor:pointer;flex-shrink:0;">✕</button>
    </div>
    <div class="ev-meta" style="font-size:12px;">📅 ${formatDate(e.date_event)}</div>
    ${e.lieu ? `<div class="ev-meta" style="font-size:12px;">📍 ${escapeHtml(e.lieu)}</div>` : ''}
    <div class="ev-meta" style="font-size:12px;margin-bottom:12px;">👤 Proposé par ${escapeHtml(e.organisateur_nom || 'Bénévole')}</div>
    ${e.description ? `<p style="font-size:13px;line-height:1.7;color:#1a1a18;">${escapeHtml(e.description)}</p>` : ''}
    <div class="ev-interet-bar">
      <span style="font-size:13px;font-weight:700;color:#0C447C;">✦ <span id="ev-cnt">${cnt}</span> intéressé${cnt > 1 ? 's' : ''}</span>
      <button class="ev-heart ${moi ? 'on' : ''}" id="ev-heart" onclick="toggleEvInteret('${e.id}')">${moi ? '✓ Intéressé(e)' : "Ça m'intéresse"}</button>
    </div>
    ${e.google_form_url ? `<a class="btn btn-blue" style="display:block;text-align:center;text-decoration:none;font-size:13px;margin-bottom:8px;" href="${escapeHtml(e.google_form_url)}" target="_blank" rel="noopener">🔗 Lien d'inscription</a>` : ''}
    <button class="btn btn-ghost" style="font-size:13px;" onclick="closeEvDetail()">Fermer</button>
  `
  document.getElementById('modal-ev-detail').style.display = 'flex'
}
function closeEvDetail() { document.getElementById('modal-ev-detail').style.display = 'none' }

async function toggleEvInteret(id) {
  if (!CP) return
  const has = evMoi.has(id)
  try {
    if (has) {
      const { error } = await sb.from('events_interets').delete().eq('event_id', id).eq('benevole_id', CP.id)
      if (error) throw error
      evMoi.delete(id); evInterets[id] = Math.max(0, (evInterets[id] || 1) - 1)
    } else {
      const { error } = await sb.from('events_interets').insert({ event_id: id, benevole_id: CP.id })
      if (error) throw error
      evMoi.add(id); evInterets[id] = (evInterets[id] || 0) + 1
    }
    const cntEl = document.getElementById('ev-cnt')
    const heart = document.getElementById('ev-heart')
    if (cntEl) cntEl.textContent = evInterets[id]
    if (heart) {
      heart.classList.toggle('on', evMoi.has(id))
      heart.textContent = evMoi.has(id) ? '✓ Intéressé(e)' : "Ça m'intéresse"
    }
    renderEvenements()
  } catch (err) {
    showToast('Erreur : ' + (err.message || err), 'error')
  }
}

function openCreateEv() {
  ;['ev-f-titre','ev-f-date','ev-f-lieu','ev-f-desc','ev-f-form'].forEach(i => { const x = document.getElementById(i); if (x) x.value = '' })
  document.getElementById('ev-f-cat').value = 'convivial'
  document.getElementById('modal-ev-create').style.display = 'flex'
}
function closeCreateEv() { document.getElementById('modal-ev-create').style.display = 'none' }

async function soumettreEvenement() {
  if (!CP) return showToast('Pas connecté', 'error')
  const titre = document.getElementById('ev-f-titre').value.trim()
  const date  = document.getElementById('ev-f-date').value
  const desc  = document.getElementById('ev-f-desc').value.trim()
  if (!titre || !date || !desc) return showToast('Titre, date et description obligatoires', 'error')

  const row = {
    titre,
    description: desc,
    date_event: date,
    lieu: document.getElementById('ev-f-lieu').value.trim() || null,
    categorie: document.getElementById('ev-f-cat').value,
    google_form_url: document.getElementById('ev-f-form').value.trim() || null,
    organisateur_id: CP.id,
    statut: 'draft',
  }
  const { error } = await sb.from('events_benevoles').insert(row)
  if (error) {
    if ((error.message || '').includes('draft_limit_reached'))
      return showToast('Tu as déjà 3 événements en attente', 'error')
    return showToast('Erreur : ' + error.message, 'error')
  }
  closeCreateEv()
  showToast('🎉 Proposition envoyée au pilote !', 'success')
  document.querySelectorAll('[data-ev-view]').forEach(b => b.classList.toggle('on', b.dataset.evView === 'mesevents'))
  document.getElementById('ev-decouvrir').style.display = 'none'
  document.getElementById('ev-mesevents').style.display = 'block'
  loadMesEvenements()
}
'@
    $js_new = $js_new -replace "`r`n", "`n" -replace "`n", "`r`n"
    Apply-Patch -Name 'Bloc JS Evenements' -Anchor $js_anchor -Replacement $js_new

    # ========================================================
    # PATCH 6 : Hook bSwitch — ajouter ligne evenements
    # ========================================================
    $hook_anchor = "  if(name==='toulouse')loadToulouse()`r`n  if(name==='profil'){"
    $hook_new    = "  if(name==='toulouse')loadToulouse()`r`n  if(name==='evenements')loadEvenements()`r`n  if(name==='profil'){"
    Apply-Patch -Name 'Hook bSwitch' -Anchor $hook_anchor -Replacement $hook_new

    # ========================================================
    # Écriture du fichier
    # ========================================================
    [System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.UTF8Encoding]::new($false))
    $newLength = $content.Length
    $delta = $newLength - $originalLength

    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "SUCCES — 6 patches appliques" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "  Fichier original  : $originalLength octets"
    Write-Host "  Fichier modifie   : $newLength octets"
    Write-Host "  Ajout net         : +$delta octets"
    Write-Host "  Backup conserve   : $backup"
    Write-Host ""
    Write-Host "Etape suivante : git diff public/dashboard.html" -ForegroundColor Yellow
    Write-Host "Si tout est OK, deploie. Si bug, copie $backup vers $file." -ForegroundColor Yellow

} catch {
    Write-Host ""
    Write-Host "❌ ERREUR : $_" -ForegroundColor Red
    Write-Host "Restauration du backup..." -ForegroundColor Yellow
    Copy-Item $backup $file -Force
    Write-Host "✓ Fichier original restaure depuis $backup" -ForegroundColor Green
    exit 1
}
