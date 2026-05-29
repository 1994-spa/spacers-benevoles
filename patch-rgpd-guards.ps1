# ============================================================
# patch-rgpd-guards.ps1
# ------------------------------------------------------------
# Ajoute les gardes de consentement RGPD a l'entree de l'app.
# Ferme la faille : "abandonner l'ecran de consentement puis
# revenir" permettait d'entrer dans le dashboard sans avoir
# consenti (la session existe deja, et l'auto-redirection ne
# verifiait que pending_deletion).
#
# Fichiers patches (depuis la racine du repo) :
#   - public/index.html      (1 patch : auto-redirection consentement)
#   - public/dashboard.html  (2 patches : const + garde init)
#   - public/pilote.html     (3 patches : const + select + garde init)
#
# USAGE :
#   .\patch-rgpd-guards.ps1
#
# Securite : chaque fichier est sauvegarde en .bak AVANT edition.
# Si une ancre est introuvable, le fichier est restaure et le
# script s'arrete -> aucun fichier n'est jamais laisse a moitie patche.
# A lancer UNE fois sur des fichiers non encore patches.
# ============================================================

$ErrorActionPreference = 'Stop'

# Normalise les fins de ligne d'un here-string en CRLF (comme les fichiers)
function N([string]$s) { return ($s -replace "`r`n", "`n" -replace "`n", "`r`n") }

# Applique un patch sur $script:content et leve une erreur si l'ancre est absente/ambigue
function Apply-Patch {
    param([string]$Name, [string]$Anchor, [string]$Replacement)
    if (-not $script:content.Contains($Anchor)) {
        throw "Ancre introuvable pour le patch '$Name'. Fichier deja patche, ou original modifie ?"
    }
    if (($script:content -split [regex]::Escape($Anchor)).Length -gt 2) {
        throw "Ancre ambigue (plusieurs occurrences) pour le patch '$Name'."
    }
    $script:content = $script:content.Replace($Anchor, $Replacement)
    Write-Host "  [OK] $Name" -ForegroundColor Green
}

# Ouvre un fichier, applique le bloc de patches, sauvegarde / restaure si erreur
function Patch-File {
    param([string]$File, [scriptblock]$Body)
    if (-not (Test-Path $File)) {
        Write-Host "[SKIP] Fichier introuvable : $File" -ForegroundColor Yellow
        Write-Host "       Lance le script depuis la racine du repo." -ForegroundColor Yellow
        return
    }
    $backup = "$File.bak"
    Copy-Item $File $backup -Force
    Write-Host "Backup : $backup" -ForegroundColor DarkGray

    $resolved = (Resolve-Path $File).Path
    $script:content = [System.IO.File]::ReadAllText($resolved, [System.Text.UTF8Encoding]::new($false))
    $before = $script:content.Length

    try {
        & $Body
        [System.IO.File]::WriteAllText($resolved, $script:content, [System.Text.UTF8Encoding]::new($false))
        $delta = $script:content.Length - $before
        Write-Host ("[DONE] {0}  (+{1} octets)" -f $File, $delta) -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "[ERREUR] $_" -ForegroundColor Red
        Copy-Item $backup $File -Force
        Write-Host "  -> $File restaure depuis $backup" -ForegroundColor Yellow
        throw
    }
}

# ============================================================
# 1) public/index.html
#    Bloc d'auto-redirection : on ajoute consent_version /
#    onboarding_done au SELECT, et une garde qui renvoie vers
#    l'ecran de consentement au lieu du dashboard si non consenti.
# ============================================================
Write-Host "=== public/index.html ===" -ForegroundColor Cyan
Patch-File 'public\index.html' {

    Apply-Patch -Name 'index: garde consentement (auto-redirect)' -Anchor (N @'
    .select('prenom, nom, statut_compte, deletion_requested_at, deletion_scheduled_for')
    .eq('email', data.session.user.email)
    .single()
  if (profil && (profil.statut_compte === 'pending_deletion' || profil.deletion_requested_at)) {
    showRecoveryScreen(profil)
    return
  }
  window.location.href = 'dashboard.html'
})
'@) -Replacement (N @'
    .select('prenom, nom, statut_compte, deletion_requested_at, deletion_scheduled_for, consent_version, onboarding_done')
    .eq('email', data.session.user.email)
    .single()
  if (profil && (profil.statut_compte === 'pending_deletion' || profil.deletion_requested_at)) {
    showRecoveryScreen(profil)
    return
  }
  // Garde RGPD : session active mais consentement absent/obsolete -> on repasse par l'onboarding
  if (profil && profil.consent_version !== CONSENT_VERSION) {
    const prenom = profil.prenom || ''
    document.getElementById('ob-prenom').textContent = prenom ? 'Bienvenue ' + prenom + ' !' : '!'
    showOb(profil.onboarding_done ? 'consent' : 1)
    return
  }
  window.location.href = 'dashboard.html'
})
'@)
}

# ============================================================
# 2) public/dashboard.html
#    - constante CONSENT_VERSION (elle n'existait que dans index.html)
#    - garde dans init() : pas d'acces sans consentement a jour
# ============================================================
Write-Host "=== public/dashboard.html ===" -ForegroundColor Cyan
Patch-File 'public\dashboard.html' {

    Apply-Patch -Name 'dashboard: const CONSENT_VERSION' -Anchor (N @'
const PHOTOS_BUCKET = 'photos-benevoles'
'@) -Replacement (N @'
const PHOTOS_BUCKET = 'photos-benevoles'
const CONSENT_VERSION = '1.0'  // doit rester synchro avec index.html
'@)

    Apply-Patch -Name 'dashboard: garde init()' -Anchor (N @'
  if (!p) { window.location.href = 'index.html'; return }
'@) -Replacement (N @'
  if (!p) { window.location.href = 'index.html'; return }
  // Garde RGPD : pas d'acces au dashboard sans consentement a jour (ni en suppression)
  if (p.statut_compte === 'pending_deletion' || p.deletion_requested_at) {
    window.location.href = 'index.html'; return
  }
  if (p.consent_version !== CONSENT_VERSION) {
    window.location.href = 'index.html'; return
  }
'@)
}

# ============================================================
# 3) public/pilote.html
#    - constante CONSENT_VERSION
#    - SELECT etendu (consent_version, statut_compte, deletion_requested_at)
#    - garde dans init() apres le controle de role
# ============================================================
Write-Host "=== public/pilote.html ===" -ForegroundColor Cyan
Patch-File 'public\pilote.html' {

    Apply-Patch -Name 'pilote: const CONSENT_VERSION' -Anchor (N @'
const PHOTOS_BUCKET = 'photos-benevoles'
'@) -Replacement (N @'
const PHOTOS_BUCKET = 'photos-benevoles'
const CONSENT_VERSION = '1.0'  // doit rester synchro avec index.html
'@)

    Apply-Patch -Name 'pilote: SELECT consent_version' -Anchor (N @'
    .select('id, role, prenom, nom')
'@) -Replacement (N @'
    .select('id, role, prenom, nom, consent_version, statut_compte, deletion_requested_at')
'@)

    Apply-Patch -Name 'pilote: garde init()' -Anchor (N @'
  if (!profil || (profil.role !== 'admin' && profil.role !== 'pilote')) {
    document.getElementById('access-denied').classList.add('show')
    return
  }

  curPiloteId = profil.id
'@) -Replacement (N @'
  if (!profil || (profil.role !== 'admin' && profil.role !== 'pilote')) {
    document.getElementById('access-denied').classList.add('show')
    return
  }

  // Garde RGPD : meme un pilote doit avoir consenti (et ne pas etre en suppression)
  if (profil.statut_compte === 'pending_deletion' || profil.deletion_requested_at) {
    window.location.href = 'index.html'; return
  }
  if (profil.consent_version !== CONSENT_VERSION) {
    window.location.href = 'index.html'; return
  }

  curPiloteId = profil.id
'@)
}

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "TERMINE — gardes RGPD en place sur les 3 fichiers" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Verifie :  git diff public/" -ForegroundColor Yellow
Write-Host "En cas de souci : copie les .bak par-dessus les .html" -ForegroundColor Yellow
