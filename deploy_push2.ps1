# Publish webapp files to GitHub using the Contents API (works on empty repos,
# and goes through api.github.com which the proxy allows — unlike git push:443).
$ErrorActionPreference = "Stop"
$repo = "thehartfordindia/medguard-care"
$branch = "main"
$root = (Get-Location).Path

$files = Get-ChildItem -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  ($rel -notmatch '(^|\\)\.git(\\|$)') -and
  ($rel -notmatch '(^|\\)node_modules(\\|$)') -and
  ($rel -notmatch '(^|\\)backend\\data\\') -and
  ($_.Name -ne 'deploy_push.ps1')
}

Write-Host "Publishing $($files.Count) files to $repo ..."
foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))

  $sha = $null
  try { $sha = gh api "repos/$repo/contents/$rel?ref=$branch" --jq '.sha' 2>$null } catch { $sha = $null }

  $payload = @{ message = "Deploy: $rel"; content = $b64; branch = $branch }
  if ($sha) { $payload.sha = $sha }
  $body = $payload | ConvertTo-Json -Compress
  $tmp = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
  $res = gh api "repos/$repo/contents/$rel" -X PUT --input $tmp --jq '.content.path' 2>&1
  Remove-Item $tmp -Force
  Write-Host "  ok: $res"
}
Write-Host "DONE -> https://github.com/$repo"
