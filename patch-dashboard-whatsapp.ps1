# ============================================================
# patch-dashboard-whatsapp.ps1
# ------------------------------------------------------------
# Ajoute un encart "Rejoins le groupe WhatsApp" visible sur
# le dashboard bénévole, entre la section Découverte et Actus
# club. Design accent WhatsApp (vert) qui tranche visuellement
# pour maximiser la conversion.
#
# USAGE :
#   powershell -ExecutionPolicy Bypass -File .\patch-dashboard-whatsapp.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$file = 'public\dashboard.html'

if (-not (Test-Path $file)) {
    Write-Host "ERREUR Fichier introuvable : $file" -ForegroundColor Red
    exit 1
}

$backup = "$file.bak"
Copy-Item $file $backup -Force
Write-Host "OK Backup cree : $backup" -ForegroundColor Green

$content = [System.IO.File]::ReadAllText((Resolve-Path $file), [System.Text.UTF8Encoding]::new($false))
$originalLength = $content.Length

# Detection LE
$crlfCount = ([regex]::Matches($content, "`r`n")).Count
$totalLF   = ([regex]::Matches($content, "`n")).Count
$hasCRLF   = $crlfCount -gt 0 -and ($crlfCount * 2 -ge $totalLF)
$leLabel   = if ($hasCRLF) {'CRLF'} else {'LF'}
Write-Host "  Fins de ligne detectees : $leLabel (CRLF=$crlfCount, LF total=$totalLF)" -ForegroundColor Cyan

# Normalisation LF
$content = $content -replace "`r`n", "`n"

function Apply-Patch {
    param([string]$Name, [string]$Anchor, [string]$Replacement)
    if (-not $script:content.Contains($Anchor)) {
        throw "Ancre introuvable pour le patch '$Name'."
    }
    if (($script:content -split [regex]::Escape($Anchor)).Length -gt 2) {
        throw "Ancre ambigue pour le patch '$Name'."
    }
    $script:content = $script:content.Replace($Anchor, $Replacement)
    Write-Host "  OK Patch '$Name' applique" -ForegroundColor Green
}

try {
    # ========================================================
    # PATCH UNIQUE : encart WhatsApp après la grille Decouverte
    # Ancre : la fermeture de la grille decouv-grid, juste apres
    # la carte "Boite a idees"
    # ========================================================
    $anchor = @'
      <div class="decouv-card" onclick="bSwitch('idees')">
        <div class="decouv-icon">💡</div>
        <div class="decouv-title">Boîte à idées</div>
        <div class="decouv-sub">Suggestions club & app</div>
      </div>
    </div>`
'@
    $anchor = ($anchor -replace "`r`n", "`n").TrimEnd("`n")

    $replacement = @'
      <div class="decouv-card" onclick="bSwitch('idees')">
        <div class="decouv-icon">💡</div>
        <div class="decouv-title">Boîte à idées</div>
        <div class="decouv-sub">Suggestions club & app</div>
      </div>
    </div>

    <div class="sec">💬 Communauté</div>
    <div class="whatsapp-card" onclick="openWhatsAppGroup()">
      <div class="whatsapp-icon">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </div>
      <div class="whatsapp-body">
        <div class="whatsapp-title">Rejoins le groupe WhatsApp</div>
        <div class="whatsapp-sub">Communication rapide entre bénévoles, infos de dernière minute avant chaque match</div>
      </div>
      <div class="whatsapp-cta">Rejoindre →</div>
    </div>`
'@
    $replacement = ($replacement -replace "`r`n", "`n").TrimEnd("`n")

    Apply-Patch -Name 'Encart WhatsApp' -Anchor $anchor -Replacement $replacement

    # ========================================================
    # PATCH CSS : styles whatsapp-* injectes dans le <style>
    # Ancre : la fin de la definition .decouv-sub (stable)
    # ========================================================
    $cssAnchorCandidates = @(
      ".decouv-sub{",
      ".decouv-sub {",
      ".decouv-card .decouv-sub"
    )
    $cssAnchor = $null
    foreach ($c in $cssAnchorCandidates) {
      if ($content.Contains($c)) { $cssAnchor = $c; break }
    }
    if (-not $cssAnchor) {
      Write-Host "  ATTENTION : ancre CSS .decouv-sub introuvable, ajout du CSS en fin de <style>" -ForegroundColor Yellow
      $cssAnchor = "</style>"
      $cssReplacement = @'
.whatsapp-card{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:14px;padding:16px;cursor:pointer;box-shadow:0 4px 16px rgba(37,211,102,0.25);transition:transform 0.15s,box-shadow 0.15s;margin-bottom:14px}
.whatsapp-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(37,211,102,0.35)}
.whatsapp-icon{flex-shrink:0;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;display:flex;align-items:center;justify-content:center}
.whatsapp-body{flex:1;min-width:0}
.whatsapp-title{color:#fff;font-weight:700;font-size:14px;line-height:1.3;margin-bottom:4px}
.whatsapp-sub{color:rgba(255,255,255,0.85);font-size:11px;line-height:1.4}
.whatsapp-cta{flex-shrink:0;background:rgba(255,255,255,0.2);color:#fff;font-weight:600;font-size:12px;padding:8px 12px;border-radius:8px;white-space:nowrap}
</style>
'@
      $cssReplacement = ($cssReplacement -replace "`r`n", "`n").TrimEnd("`n")
      Apply-Patch -Name 'Styles WhatsApp (fin style)' -Anchor $cssAnchor -Replacement $cssReplacement
    } else {
      # On insere le CSS APRES la regle .decouv-sub (on remplace l'ancre par elle-meme + le CSS additionnel)
      # Pour ca on cherche la fin de la regle .decouv-sub (le "}" apres)
      # Plus sur : on insere juste apres l'ancre en la reintegrant
      $cssReplacement = @"
$cssAnchor
"@
      # Trick : on va utiliser une autre approche - inserer avant </style> pour rester safe
      $cssAnchor = "</style>"
      $cssReplacement = @'
.whatsapp-card{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:14px;padding:16px;cursor:pointer;box-shadow:0 4px 16px rgba(37,211,102,0.25);transition:transform 0.15s,box-shadow 0.15s;margin-bottom:14px}
.whatsapp-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(37,211,102,0.35)}
.whatsapp-icon{flex-shrink:0;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;display:flex;align-items:center;justify-content:center}
.whatsapp-body{flex:1;min-width:0}
.whatsapp-title{color:#fff;font-weight:700;font-size:14px;line-height:1.3;margin-bottom:4px}
.whatsapp-sub{color:rgba(255,255,255,0.85);font-size:11px;line-height:1.4}
.whatsapp-cta{flex-shrink:0;background:rgba(255,255,255,0.2);color:#fff;font-weight:600;font-size:12px;padding:8px 12px;border-radius:8px;white-space:nowrap}
</style>
'@
      $cssReplacement = ($cssReplacement -replace "`r`n", "`n").TrimEnd("`n")
      Apply-Patch -Name 'Styles WhatsApp' -Anchor $cssAnchor -Replacement $cssReplacement
    }

    # ========================================================
    # PATCH JS : fonction openWhatsAppGroup()
    # Ancre : une fonction stable qu'on trouve toujours dans dashboard.html
    # ========================================================
    $jsAnchor = "function renderDecouverteSection() {"
    $jsReplacement = @'
function openWhatsAppGroup() {
  window.open('https://chat.whatsapp.com/JZBB5746965BqiHlgFBPJS', '_blank', 'noopener,noreferrer')
}

function renderDecouverteSection() {
'@
    $jsReplacement = ($jsReplacement -replace "`r`n", "`n").TrimEnd("`n")
    Apply-Patch -Name 'Function openWhatsAppGroup' -Anchor $jsAnchor -Replacement $jsReplacement

    # ========================================================
    # Restauration des fins de ligne d'origine
    # ========================================================
    if ($hasCRLF) {
      $content = $content -replace "`n", "`r`n"
      Write-Host "  Fins de ligne restaurees en CRLF" -ForegroundColor Cyan
    }

    [System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.UTF8Encoding]::new($false))
    $newLength = (Get-Item $file).Length
    $delta = $newLength - $originalLength
    Write-Host ""
    Write-Host "SUCCES Patch applique. Taille : $originalLength -> $newLength (+$delta octets)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifier visuellement le rendu, puis :" -ForegroundColor Yellow
    Write-Host "  git add public/dashboard.html" -ForegroundColor Gray
    Write-Host "  git commit -m 'feat: encart WhatsApp dans dashboard benevole'" -ForegroundColor Gray
    Write-Host "  git push" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "ECHEC : $_" -ForegroundColor Red
    Write-Host "Restauration du backup..." -ForegroundColor Yellow
    Copy-Item $backup $file -Force
    Write-Host "OK dashboard.html restaure depuis $backup" -ForegroundColor Green
    exit 1
}
