# ============================================================
# patch-pilote-evenements.ps1  (v2 — LE-agnostic)
# ------------------------------------------------------------
# Detecte les fins de ligne du fichier (LF ou CRLF), normalise
# en LF pour appliquer les 5 patches, puis restaure le format.
#
# USAGE :
#   powershell -ExecutionPolicy Bypass -File .\patch-pilote-evenements.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$file = 'public\pilote.html'

if (-not (Test-Path $file)) {
    Write-Host "ERREUR Fichier introuvable : $file" -ForegroundColor Red
    Write-Host "   Lance le script depuis la racine du repo." -ForegroundColor Yellow
    exit 1
}

# Backup
$backup = "$file.bak"
Copy-Item $file $backup -Force
Write-Host "OK Backup cree : $backup" -ForegroundColor Green

# Lecture (UTF-8)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file), [System.Text.UTF8Encoding]::new($false))
$originalLength = $content.Length

# Detection du line ending
$crlfCount = ([regex]::Matches($content, "`r`n")).Count
$totalLF   = ([regex]::Matches($content, "`n")).Count
$hasCRLF   = $crlfCount -gt 0 -and ($crlfCount * 2 -ge $totalLF)
$leLabel   = if ($hasCRLF) {'CRLF'} else {'LF'}
Write-Host "  Fins de ligne detectees : $leLabel (CRLF=$crlfCount, LF total=$totalLF)" -ForegroundColor Cyan

# Normalisation en LF pour le traitement
$content = $content -replace "`r`n", "`n"

function Apply-Patch {
    param([string]$Name, [string]$Anchor, [string]$Replacement)
    if (-not $script:content.Contains($Anchor)) {
        throw "Ancre introuvable pour le patch '$Name'."
    }
    if (($script:content -split [regex]::Escape($Anchor)).Length -gt 2) {
        throw "Ancre ambigue (plusieurs occurrences) pour le patch '$Name'."
    }
    $script:content = $script:content.Replace($Anchor, $Replacement)
    Write-Host "  OK Patch '$Name' applique" -ForegroundColor Green
}

try {
    # ========================================================
    # PATCH 1 : Onglet Events
    # ========================================================
    $p1_anchor = @'
<button class="tab"    id="tab-notes"       onclick="switchTab('notes')">📖 Mémoire</button>
'@
    $p1_anchor = ($p1_anchor -replace "`r`n", "`n").TrimEnd("`n")

    $p1_new = @'
<button class="tab"    id="tab-evenements"  onclick="switchTab('evenements')">🎉 Events<span class="bdg-num" id="bdg-evenements" style="display:none;"></span></button>
  <button class="tab"    id="tab-notes"       onclick="switchTab('notes')">📖 Mémoire</button>
'@
    $p1_new = ($p1_new -replace "`r`n", "`n").TrimEnd("`n")
    Apply-Patch -Name 'Onglet Events' -Anchor $p1_anchor -Replacement $p1_new

    # ========================================================
    # PATCH 2 : Ecran modération Events
    # ========================================================
    $p2_anchor = "<!-- MÉMOIRE -->"
    $p2_new = @'
<!-- ÉVÉNEMENTS BÉNÉVOLES (modération pilote) -->
<div class="screen" id="screen-evenements">
  <div id="alert-evenements"></div>

  <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr;">
    <div class="kpi"><div class="kpi-val a" id="ev-kpi-att">—</div><div class="kpi-lbl">En attente</div></div>
    <div class="kpi"><div class="kpi-val g" id="ev-kpi-pub">—</div><div class="kpi-lbl">Publiés à venir</div></div>
    <div class="kpi"><div class="kpi-val" id="ev-kpi-tot">—</div><div class="kpi-lbl">Total</div></div>
  </div>

  <div class="sec">📨 Propositions en attente</div>
  <div id="ev-pilote-att"></div>

  <div class="sec">📋 Événements publiés</div>
  <div style="margin-bottom:8px;">
    <div class="seg-group" id="ev-list-filter">
      <button class="seg on" data-ev-list-filter="avenir" onclick="setEvListFilter('avenir',this)">À venir</button>
      <button class="seg" data-ev-list-filter="passes" onclick="setEvListFilter('passes',this)">Passés</button>
      <button class="seg" data-ev-list-filter="masques" onclick="setEvListFilter('masques',this)">Masqués</button>
    </div>
  </div>
  <div id="ev-pilote-list"></div>
</div>

<!-- MÉMOIRE -->
'@
    $p2_new = ($p2_new -replace "`r`n", "`n").TrimEnd("`n")
    Apply-Patch -Name 'Ecran Events' -Anchor $p2_anchor -Replacement $p2_new

    # ========================================================
    # PATCH 3 : Bloc JS Events
    # ========================================================
    $p3_anchor = @'
    .replace(/'/g, '&#039;')
}

// ─────────────────────────────────────────────────
// TABS + UTILS
'@
    $p3_anchor = ($p3_anchor -replace "`r`n", "`n").TrimEnd("`n")

    $p3_new = @'
    .replace(/'/g, '&#039;')
}

// ─────────────────────────────────────────────────
// ÉVÉNEMENTS BÉNÉVOLES (modération pilote)
// ─────────────────────────────────────────────────
let evPiloteData = []
let evPiloteListFilter = 'avenir'

const EV_CATLBL_PILOTE = {
  convivial:'😄 Convivial', sportif:'🏐 Sportif',
  formation:'🎓 Formation', sortie:'🌳 Sortie'
}

async function loadEvenementsPilote() {
  const { data, error } = await sb.from('events_benevoles')
    .select(`*, benevoles!events_benevoles_organisateur_id_fkey(prenom, nom, photo_path)`)
    .order('date_event', { ascending: true })
  if (error) {
    showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
    return
  }
  evPiloteData = data || []
  await resolvePhotosInList(evPiloteData, e => e.benevoles)
  updateEvPiloteKPIs()
  renderEvPiloteAtt()
  renderEvPiloteList()
}

function updateEvPiloteKPIs() {
  const now = new Date()
  const att = evPiloteData.filter(e => e.statut === 'draft').length
  const pub = evPiloteData.filter(e => e.statut === 'published' && new Date(e.date_event) >= now).length
  const tot = evPiloteData.length
  const elAtt = document.getElementById('ev-kpi-att')
  const elPub = document.getElementById('ev-kpi-pub')
  const elTot = document.getElementById('ev-kpi-tot')
  if (elAtt) elAtt.textContent = att
  if (elPub) elPub.textContent = pub
  if (elTot) elTot.textContent = tot

  const bdg = document.getElementById('bdg-evenements')
  if (bdg) {
    if (att > 0) {
      bdg.textContent = att > 99 ? '99+' : String(att)
      bdg.style.display = 'flex'
    } else {
      bdg.style.display = 'none'
    }
  }
}

function renderEvPiloteAtt() {
  const att = evPiloteData.filter(e => e.statut === 'draft')
  const el = document.getElementById('ev-pilote-att')
  if (!el) return
  if (att.length === 0) {
    el.innerHTML = '<div style="background:rgba(59,109,17,0.1);border:1px solid rgba(59,109,17,0.2);border-radius:10px;padding:12px;font-size:12px;color:#C0DD97;">✓ Aucune proposition en attente</div>'
    return
  }
  el.innerHTML = att.map(e => {
    const b = e.benevoles || {}
    return `
      <div class="demande-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          ${b._signedUrl ? `<img src="${b._signedUrl}" class="bav">` : `<div class="bav-ph">${ini(b)}</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:white;">${escapeHtmlPilote((b.prenom||'') + ' ' + (b.nom||''))}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5);">Proposé ${formatRelativeDate(e.created_at)}</div>
          </div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:10px;margin-bottom:10px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <span class="s-badge" style="background:rgba(24,95,165,0.2);color:#B5D4F4;">${EV_CATLBL_PILOTE[e.categorie] || escapeHtmlPilote(e.categorie)}</span>
            <span class="s-badge" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);">📅 ${formatDate(e.date_event)}</span>
            ${e.lieu ? `<span class="s-badge" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);">📍 ${escapeHtmlPilote(e.lieu)}</span>` : ''}
          </div>
          <div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;">${escapeHtmlPilote(e.titre)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);line-height:1.5;white-space:pre-line;">${escapeHtmlPilote(e.description||'')}</div>
          ${e.google_form_url ? `<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:6px;">🔗 ${escapeHtmlPilote(e.google_form_url)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-green btn-sm" style="flex:1;" onclick="validerEvenement('${e.id}')">✓ Valider et publier</button>
          <button class="btn btn-red btn-sm" onclick="refuserEvenement('${e.id}')">✗ Refuser</button>
        </div>
      </div>`
  }).join('')
}

function renderEvPiloteList() {
  const now = new Date()
  let list = evPiloteData.filter(e => e.statut !== 'draft')
  if (evPiloteListFilter === 'avenir') {
    list = list.filter(e => e.statut === 'published' && new Date(e.date_event) >= now)
  } else if (evPiloteListFilter === 'passes') {
    list = list.filter(e => (e.statut === 'published' || e.statut === 'past') && new Date(e.date_event) < now)
  } else if (evPiloteListFilter === 'masques') {
    list = list.filter(e => e.statut === 'hidden')
  }

  const el = document.getElementById('ev-pilote-list')
  if (!el) return
  if (list.length === 0) {
    el.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px;padding:10px 0;font-style:italic;">Aucun événement dans cette catégorie.</div>'
    return
  }

  el.innerHTML = list.map(e => {
    const b = e.benevoles || {}
    const isHidden = e.statut === 'hidden'
    const isPast = new Date(e.date_event) < now
    let statut
    if (isHidden) statut = '<span class="s-badge" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);">⏸ Masqué</span>'
    else if (isPast) statut = '<span class="s-badge" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);">Passé</span>'
    else statut = '<span class="s-badge" style="background:rgba(59,109,17,0.15);color:#C0DD97;">● Publié</span>'

    const opacity = (isHidden || isPast) ? '0.6' : '1'

    return `
      <div class="card" style="opacity:${opacity};">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <span class="s-badge" style="background:rgba(24,95,165,0.2);color:#B5D4F4;">${EV_CATLBL_PILOTE[e.categorie] || escapeHtmlPilote(e.categorie)}</span>
          ${statut}
        </div>
        <div style="font-size:13px;font-weight:700;color:white;margin-bottom:3px;">${escapeHtmlPilote(e.titre)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:6px;">
          📅 ${formatDate(e.date_event)}${e.lieu ? ' · 📍 ' + escapeHtmlPilote(e.lieu) : ''} · 👤 ${escapeHtmlPilote(((b.prenom||'') + ' ' + (b.nom||'')).trim() || 'Bénévole')}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6);line-height:1.5;margin-bottom:10px;white-space:pre-line;">${escapeHtmlPilote(e.description||'')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${!isHidden
            ? `<button class="btn btn-ghost btn-sm" onclick="masquerEvenement('${e.id}')">⏸ Masquer</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="republierEvenement('${e.id}')">▶ Republier</button>`}
          <button class="btn btn-red btn-sm" onclick="supprimerEvenement('${e.id}')">🗑 Supprimer</button>
        </div>
      </div>`
  }).join('')
}

function setEvListFilter(f, btn) {
  evPiloteListFilter = f
  document.querySelectorAll('#ev-list-filter .seg').forEach(s => s.classList.remove('on'))
  btn.classList.add('on')
  renderEvPiloteList()
}

async function validerEvenement(id) {
  const ok = await confirmModal({
    icon: '✓',
    title: 'Valider et publier ?',
    message: 'L\'événement sera visible par tous les bénévoles.',
    confirmText: 'Publier',
    confirmStyle: 'green',
  })
  if (!ok) return
  const { error } = await sb.from('events_benevoles').update({
    statut: 'published',
    pilote_modere_par: curPiloteId,
    pilote_modere_le: new Date().toISOString(),
    pilote_message: null,
  }).eq('id', id)
  if (error) return showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
  showAlert('alert-evenements', '✓ Événement publié', 's')
  loadEvenementsPilote()
}

async function refuserEvenement(id) {
  const msg = await promptModal({
    icon: '✗',
    title: 'Refuser cette proposition',
    message: 'Indique une raison (visible par le bénévole).',
    placeholder: 'Événement déjà existant, date non dispo, hors-sujet…',
    confirmText: 'Refuser',
    confirmStyle: 'red',
  })
  if (msg === null) return
  const { error } = await sb.from('events_benevoles').update({
    statut: 'hidden',
    pilote_modere_par: curPiloteId,
    pilote_modere_le: new Date().toISOString(),
    pilote_message: msg || null,
  }).eq('id', id)
  if (error) return showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
  showAlert('alert-evenements', '✗ Proposition refusée', 's')
  loadEvenementsPilote()
}

async function masquerEvenement(id) {
  const ok = await confirmModal({
    icon: '⏸',
    title: 'Masquer cet événement ?',
    message: 'Il ne sera plus visible par les bénévoles. Tu pourras le republier plus tard.',
    confirmText: 'Masquer',
    confirmStyle: 'blue',
  })
  if (!ok) return
  const { error } = await sb.from('events_benevoles').update({
    statut: 'hidden',
    pilote_modere_par: curPiloteId,
    pilote_modere_le: new Date().toISOString(),
  }).eq('id', id)
  if (error) return showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
  showAlert('alert-evenements', '⏸ Événement masqué', 's')
  loadEvenementsPilote()
}

async function republierEvenement(id) {
  const { error } = await sb.from('events_benevoles').update({
    statut: 'published',
    pilote_modere_par: curPiloteId,
    pilote_modere_le: new Date().toISOString(),
  }).eq('id', id)
  if (error) return showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
  showAlert('alert-evenements', '▶ Événement republié', 's')
  loadEvenementsPilote()
}

async function supprimerEvenement(id) {
  const ok = await confirmModal({
    icon: '🗑',
    title: 'Supprimer cet événement ?',
    message: 'Action irréversible. Les marques d\'intérêt seront aussi supprimées.',
    confirmText: 'Supprimer',
    confirmStyle: 'red',
  })
  if (!ok) return
  const { error } = await sb.from('events_benevoles').delete().eq('id', id)
  if (error) return showAlert('alert-evenements', '❌ Erreur : ' + error.message, 'e')
  showAlert('alert-evenements', '🗑 Événement supprimé', 's')
  loadEvenementsPilote()
}

// ─────────────────────────────────────────────────
// TABS + UTILS
'@
    $p3_new = ($p3_new -replace "`r`n", "`n").TrimEnd("`n")
    Apply-Patch -Name 'Bloc JS Events pilote' -Anchor $p3_anchor -Replacement $p3_new

    # ========================================================
    # PATCH 4 : Hook switchTab
    # ========================================================
    $p4_anchor = "  if (n === 'emploi') loadEmploi()`n}"
    $p4_new    = "  if (n === 'emploi') loadEmploi()`n  if (n === 'evenements') loadEvenementsPilote()`n}"
    Apply-Patch -Name 'Hook switchTab' -Anchor $p4_anchor -Replacement $p4_new

    # ========================================================
    # PATCH 5 : Hook loadAll
    # ========================================================
    $p5_anchor = "  await loadEmploi()`n}"
    $p5_new    = "  await loadEmploi()`n  await loadEvenementsPilote()`n}"
    Apply-Patch -Name 'Hook loadAll' -Anchor $p5_anchor -Replacement $p5_new

    # ========================================================
    # Restore le line ending d'origine + ecriture
    # ========================================================
    if ($hasCRLF) {
        $content = $content -replace "`n", "`r`n"
    }

    [System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.UTF8Encoding]::new($false))
    $newLength = $content.Length
    $delta = $newLength - $originalLength

    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "SUCCES - 5 patches appliques" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "  Fichier original  : $originalLength octets"
    Write-Host "  Fichier modifie   : $newLength octets"
    Write-Host "  Ajout net         : +$delta octets"
    Write-Host "  Line ending       : $leLabel (preserve)"
    Write-Host "  Backup conserve   : $backup"
    Write-Host ""
    Write-Host "Etape suivante : git diff public/pilote.html" -ForegroundColor Yellow

} catch {
    Write-Host ""
    Write-Host "ERREUR : $_" -ForegroundColor Red
    Write-Host "Restauration du backup..." -ForegroundColor Yellow
    Copy-Item $backup $file -Force
    Write-Host "OK Fichier original restaure depuis $backup" -ForegroundColor Green
    exit 1
}
