Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# Ajoute l'option "Service Civique" au menu Type de contrat
#   - public\pilote.html   (select #emp-contrat)
#   - public\dashboard.html (select #prop-contrat)
# ---------------------------------------------------------------

$utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
$anchor = '<option>Bénévolat</option>'
$newOpt = '<option>Service Civique</option>'

$targets = @('public\pilote.html', 'public\dashboard.html')

foreach ($path in $targets) {

  Write-Host "`n=== $path ===" -ForegroundColor Cyan

  if (-not (Test-Path $path)) {
    Write-Host "ERREUR: $path introuvable. Lance depuis la racine du repo." -ForegroundColor Red
    exit 1
  }

  # Backup
  $backup = "$path.bak-service-civique"
  Copy-Item $path $backup -Force
  Write-Host "  Backup: $backup" -ForegroundColor Yellow

  # Lecture + detection LE
  $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $hasCRLF = $raw.Contains("`r`n")
  Write-Host ("  Line endings: " + $(if ($hasCRLF) {"CRLF"} else {"LF"})) -ForegroundColor DarkGray

  # Idempotence
  if ($raw.Contains($newOpt)) {
    Write-Host "  Deja patche, rien a faire." -ForegroundColor Green
    continue
  }

  # Normalisation LF
  $content = $raw.Replace("`r`n", "`n")

  # Verif ancre unique
  $count = ($content.Length - $content.Replace($anchor, '').Length) / $anchor.Length
  if ($count -ne 1) { throw "Ancre trouvee $count fois (attendu: 1)" }
  Write-Host "  Ancre OK (1 x)" -ForegroundColor DarkGray

  # Insertion (meme indentation que l'ancre : 10 espaces)
  $content = $content.Replace($anchor, ($anchor + "`n          " + $newOpt))

  # Restauration LE d'origine
  if ($hasCRLF) { $content = $content.Replace("`n", "`r`n") }

  [System.IO.File]::WriteAllText($path, $content, $utf8NoBOM)
  Write-Host "  OK - option ajoutee" -ForegroundColor Green
}

Write-Host "`nTermine. Verifie puis :" -ForegroundColor Cyan
Write-Host '  git add public\pilote.html public\dashboard.html' -ForegroundColor White
Write-Host '  git commit -m "feat(emploi): ajout du type de contrat Service Civique"' -ForegroundColor White
Write-Host '  git push' -ForegroundColor White
