$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '需要 Windows .NET Framework 4.x C# compiler。' }
$nodePath = (Get-Command node.exe).Source
$version = (& $nodePath --version).TrimStart('v')
if ([version]$version -lt [version]'22.14.0') { throw '需要 Node.js 22.14 以上。' }
$outputRoot = Join-Path $projectRoot ('dist/build-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$bundle = Join-Path $outputRoot 'FishFlavorDemo'
$appDir = Join-Path $bundle 'app'
$runtimeDir = Join-Path $bundle 'runtime'
New-Item -ItemType Directory -Path $appDir,$runtimeDir -Force | Out-Null
# Explicit allowlist: .env, .data, private knowledge and artifacts cannot enter the package.
foreach ($name in @('src','public','scripts')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $appDir -Recurse }
New-Item -ItemType Directory -Path (Join-Path $appDir 'knowledge') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'knowledge/demo') -Destination (Join-Path $appDir 'knowledge') -Recurse
foreach ($name in @('server.js','package.json','package-lock.json','.env.example','README.md','PINECONE.md','NUTRITION-SOURCES.md','DEMO.md')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $appDir }
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $runtimeDir 'node.exe')
$license = Join-Path $PSScriptRoot 'NODE-LICENSE.txt'
if (!(Test-Path -LiteralPath $license)) { throw '缺少 Node.js 授權文件 desktop/NODE-LICENSE.txt。' }
Copy-Item -LiteralPath $license -Destination $runtimeDir
Copy-Item -LiteralPath (Join-Path $projectRoot 'DEMO.md') -Destination (Join-Path $bundle '使用說明.md')
Push-Location $appDir
try { & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } } finally { Pop-Location }
& $compiler /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/out:' + (Join-Path $bundle 'FishFlavorDemo.exe')) (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw '編譯啟動器失敗。' }
try {
    Copy-Item -LiteralPath (Join-Path $bundle 'FishFlavorDemo.exe') -Destination (Join-Path $projectRoot 'FishFlavorDemo.exe') -Force
} catch [System.IO.IOException] {
    Write-Warning 'Local launcher is in use; preserved the running executable. The portable bundle contains the newly compiled launcher.'
}
Write-Output ('BUNDLE=' + $bundle)
& $nodePath (Join-Path $PSScriptRoot 'verify-bundle.js') $bundle
if ($LASTEXITCODE -ne 0) { throw 'Portable verification failed. ZIP not created.' }
$zipPath = Join-Path $outputRoot 'FishFlavorDemo-win-x64.zip'
Compress-Archive -LiteralPath $bundle -DestinationPath $zipPath
Write-Output ('ZIP=' + $zipPath)
