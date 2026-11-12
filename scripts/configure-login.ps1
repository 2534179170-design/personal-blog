param([string]$Project = 'wind-journal-25341')
$ErrorActionPreference = 'Stop'
$settings = Join-Path $PSScriptRoot '../.local/login-config.json'
if (-not (Test-Path -LiteralPath $settings)) { throw '请先运行说明中的登录应用配置向导。' }
Get-Content -Raw -Encoding utf8 -LiteralPath $settings | pnpm.cmd dlx wrangler@4.160.0 pages secret bulk --project-name $Project
if ($LASTEXITCODE -ne 0) { throw '设置后台密钥失败。请检查托管平台登录状态。' }
pnpm.cmd build
if ($LASTEXITCODE -ne 0) { throw '网站构建失败。' }
pnpm.cmd dlx wrangler@4.160.0 pages deploy dist --project-name $Project --branch main
if ($LASTEXITCODE -ne 0) { throw '重新部署失败。' }
