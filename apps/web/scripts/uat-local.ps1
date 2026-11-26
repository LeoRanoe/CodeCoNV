param(
    [ValidateSet('Browser', 'Smoke')]
    [string]$Mode = 'Browser'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$web = Join-Path $repo 'apps/web'
$baseUrl = 'http://127.0.0.1:3090'
$cli = 'supabase@2.109.1'

function Assert-LastExit([string]$step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit $LASTEXITCODE)." }
}

function Import-FixtureVariables($lines) {
    foreach ($line in $lines) {
        if ($line -match '^(?:export )?(CODECO_E2E_[A-Z0-9_]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"').Trim("'"), 'Process')
        }
    }
}

Push-Location $repo
try {
    docker info --format '{{.ServerVersion}}' | Out-Null
    Assert-LastExit 'Docker check (start Docker Desktop first)'
    foreach ($port in 3090, 3490) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $listener.Start() } catch { throw "Local UAT port $port is busy. Stop its server before starting UAT." } finally { $listener.Stop() }
    }

    if (!(Test-Path (Join-Path $web 'node_modules/next/dist/bin/next'))) {
        Push-Location $web
        try { npm.cmd ci; Assert-LastExit 'Install web dependencies' } finally { Pop-Location }
    }

    # Capture the CLI output because it can contain development credentials.
    $supabaseStatus = & npx.cmd --yes $cli status -o env 2>$null
    if ($LASTEXITCODE -ne 0) {
        $null = & npx.cmd --yes $cli start -x studio,imgproxy,edge-runtime,functions,analytics,vector,inbucket,realtime
        Assert-LastExit 'Start local Supabase'
        $supabaseStatus = & npx.cmd --yes $cli status -o env
        Assert-LastExit 'Read local Supabase status'
    }

    $local = @{}
    foreach ($line in $supabaseStatus) {
        if ($line -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)="([^"]+)"$') { $local[$Matches[1]] = $Matches[2] }
    }
    if ($local.API_URL -ne 'http://127.0.0.1:54321' -or !$local.PUBLISHABLE_KEY -or !$local.SECRET_KEY) {
        throw 'Expected the repository Supabase stack at http://127.0.0.1:54321 with local fixture keys.'
    }
    & npx.cmd --yes $cli migration up --local
    Assert-LastExit 'Apply pending local migrations'

    $env:CODECO_E2E_SUPABASE_URL = $local.API_URL
    $env:CODECO_E2E_PUBLISHABLE_KEY = $local.PUBLISHABLE_KEY
    $env:CODECO_E2E_SECRET_KEY = $local.SECRET_KEY
    $env:NEXT_PUBLIC_SUPABASE_URL = $local.API_URL
    $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $local.PUBLISHABLE_KEY
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $local.PUBLISHABLE_KEY
    $env:SUPABASE_SECRET_KEY = $local.SECRET_KEY
    $env:NEXT_PUBLIC_SITE_URL = $baseUrl
    $env:CODECO_E2E_BASE_URL = $baseUrl
    $env:CODECO_E2E_FAKE_BLOB = '1'
    $env:CODECO_E2E_REQUIRED = '1'
    $env:CODECO_E2E_REUSE_SERVER = '0'
    $env:CODECO_E2E_CHANNEL = 'chromium'
    $env:CODECO_E2E_DEMO_DATA = if ($Mode -eq 'Browser') { '1' } else { '0' }
    $env:CODECO_E2E_STRESS = '0'
    $env:PORT = '3090'
    $env:FAKE_BLOB_PORT = '3490'
    $env:VERCEL_GIT_COMMIT_SHA = (git rev-parse HEAD).Trim()
    Assert-LastExit 'Read local Git revision'
    $env:VERCEL_GIT_COMMIT_REF = (git branch --show-current).Trim()
    $env:VERCEL_ENV = 'local'
    $env:VERCEL_DEPLOYMENT_ID = 'local-uat'

    # Empty process values override dotenv values for hosted service credentials.
    foreach ($name in 'RESEND_API_KEY', 'NOTIFICATION_FROM_EMAIL', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT', 'OPENAI_API_KEY', 'TRANSCRIPTION_API_KEY', 'TRANSCRIPTION_API_URL', 'GOOGLE_MAPS_API_KEY', 'CRON_SECRET', 'VERCEL_OIDC_TOKEN', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'BLOB_STORE_ID') {
        Set-Item "Env:$name" ''
    }

    Push-Location $web
    try {
        $fixtures = & node tests/e2e/seed-local-fixtures.mjs
        Assert-LastExit 'Seed local organizations and supervisors'
        Import-FixtureVariables $fixtures
        $roles = & node tests/e2e/seed-ui-demo-data.mjs
        Assert-LastExit 'Seed local client and contractor roles'
        Import-FixtureVariables $roles
        $media = & node tests/e2e/fake-blob/make-fixtures.mjs test-results/uat-fixtures
        Assert-LastExit 'Generate synthetic evidence files'
        Import-FixtureVariables $media

        if ($Mode -eq 'Browser') {
            Write-Host "Local UAT opens at $baseUrl/supervisie after the production build starts. Keep this terminal open."
            Write-Host "Fixture project: $env:CODECO_E2E_PROJECT"
            foreach ($role in '', 'CONTRACTOR_', 'CLIENT_PORTAL_', 'CLIENT_', 'SECOND_') {
                $email = [Environment]::GetEnvironmentVariable("CODECO_E2E_${role}EMAIL")
                $password = [Environment]::GetEnvironmentVariable("CODECO_E2E_${role}PASSWORD")
                Write-Host "Local fixture: $email / $password"
            }
            & node tests/e2e/fake-blob/run-stack.mjs start
            Assert-LastExit 'Local UAT app'
        } else {
            & node node_modules/@playwright/test/cli.js install chromium
            Assert-LastExit 'Install Playwright Chromium'
            & node node_modules/@playwright/test/cli.js test sheet-forms spec-registers inspection-workflow day-report-lifecycle contractor-submission rapid-verify-values word-17-journeys camera-capture role-views requirements-final ui-stability-audit --project=desktop-office --output=test-results/uat-automated --reporter=list
            Assert-LastExit 'Local automated UAT suite'
        }
    } finally { Pop-Location }
} finally { Pop-Location }
