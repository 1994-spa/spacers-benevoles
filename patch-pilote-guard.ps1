# ============================================================
# patch-pilote-guard.ps1
# ------------------------------------------------------------
# Finit le patch RGPD sur public/pilote.html UNIQUEMENT.
# (index.html et dashboard.html sont deja patches : NE PAS
#  relancer patch-rgpd-guards.ps1.)
#
# 3 patches sur pilote.html :
#   - const CONSENT_VERSION
#   - SELECT etendu (consent_version, statut_compte, deletion_requested_at)
#   - garde init() : ancre robuste sur "curPiloteId = profil.id"
#
# USAGE (racine du repo) :
#   .\patch-pilote-guard.ps1
#
# Backup .bak + rollback automatique si une ancre manque.
# ============================================================

$ErrorActionPreference = 'Stop'

function N([string]$s) { return ($s -replace "`r`n", "`n" -replace "`n", "`r`n") }

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

function Patch-File {
    param([string]$File, [scriptblock]$Body)
    if (-not (Test-Path $File)) {
        Write-Host "[SKIP] Fichier introuvable : $File" -ForegroundColor Yellow
        return
    }
    $backup = "$File.bak2"
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

    # Ancre robuste : la ligne d'affectation (unique, mono-ligne).
    # On insere la garde JUSTE AVANT.
    Apply-Patch -Name 'pilote: garde init()' -Anchor (N @'
  curPiloteId = profil.id
'@) -Replacement (N @'
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
Write-Host "TERMINE — pilote.html patche" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Verifie :  git diff public/pilote.html" -ForegroundColor Yellow
Write-Host "En cas de souci : copie public\pilote.html.bak2 par-dessus." -ForegroundColor Yellow
