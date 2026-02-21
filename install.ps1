# Damie Code - Windows Installation Script
# Usage: irm https://raw.githubusercontent.com/damoojeje/damie-code/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO_URL = "https://github.com/damoojeje/damie-code.git"
$INSTALL_DIR = if ($env:DAMIE_INSTALL_DIR) { $env:DAMIE_INSTALL_DIR } else { "$HOME\.damie-code" }
$BIN_DIR = if ($env:DAMIE_BIN_DIR) { $env:DAMIE_BIN_DIR } else { "$HOME\.local\bin" }
$MIN_NODE_VERSION = 20
$BRANCH = if ($env:DAMIE_BRANCH) { $env:DAMIE_BRANCH } else { "main" }

function Write-Header {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "         Damie Code Installer (Windows)        " -ForegroundColor Green
    Write-Host "   AI-Powered CLI Coding Assistant              " -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host ""
}

function Write-Info($msg)  { Write-Host "[info]  $msg" -ForegroundColor Blue }
function Write-OK($msg)    { Write-Host "[ok]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[warn]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[error] $msg" -ForegroundColor Red }

function Test-Command($cmd) {
    $null = Get-Command $cmd -ErrorAction SilentlyContinue
    return $?
}

function Check-Node {
    if (-not (Test-Command "node")) {
        Write-Err "Node.js is not installed. Please install Node.js ${MIN_NODE_VERSION}+ first:"
        Write-Err "https://nodejs.org/"
        exit 1
    }
    $version = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
    if ([int]$version -lt $MIN_NODE_VERSION) {
        Write-Err "Node.js ${MIN_NODE_VERSION}+ required. You have $(node -v)."
        exit 1
    }
    Write-OK "Node.js $(node -v)"
}

function Check-Git {
    if (-not (Test-Command "git")) {
        Write-Err "Git is not installed. Please install Git first:"
        Write-Err "https://git-scm.com/"
        exit 1
    }
    Write-OK "Git $(git --version)"
}

function Install-DamieCode {
    if (Test-Path $INSTALL_DIR) {
        Write-Info "Existing installation found. Updating..."
        Push-Location $INSTALL_DIR
        git fetch origin $BRANCH --quiet
        git checkout $BRANCH --quiet
        git reset --hard "origin/$BRANCH" --quiet
        Pop-Location
        Write-OK "Updated to latest"
    } else {
        Write-Info "Cloning Damie Code..."
        git clone --depth 1 --branch $BRANCH $REPO_URL $INSTALL_DIR --quiet
        Write-OK "Cloned to $INSTALL_DIR"
    }

    Push-Location $INSTALL_DIR

    Write-Info "Installing dependencies (this may take a few minutes)..."
    & npm install --ignore-scripts --no-audit --no-fund 2>&1 | Out-Null
    Write-OK "Dependencies installed"

    Write-Info "Building Damie Code..."
    & npm run bundle 2>&1 | Out-Null
    if (Test-Path "$INSTALL_DIR\dist\cli.js") {
        Write-OK "Build complete"
    } else {
        Write-Warn "Bundle not created, trying standard build..."
        & npm run build 2>&1 | Out-Null
        if (Test-Path "$INSTALL_DIR\dist\cli.js") {
            Write-OK "Build complete"
        } else {
            Write-Err "Build failed. dist/cli.js not found."
            Pop-Location
            exit 1
        }
    }

    Pop-Location
}

function Create-Commands {
    New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

    # Create batch files for Windows
    @"
@echo off
node "%USERPROFILE%\.damie-code\dist\cli.js" %*
"@ | Set-Content "$BIN_DIR\damie.cmd" -Encoding ASCII

    @"
@echo off
node "%USERPROFILE%\.damie-code\dist\cli.js" %*
"@ | Set-Content "$BIN_DIR\damie-code.cmd" -Encoding ASCII

    Write-OK "Created commands: damie, damie-code"
}

function Check-Path {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$BIN_DIR*") {
        Write-Warn "$BIN_DIR is not in your PATH"
        Write-Host ""
        Write-Info "Adding to user PATH..."
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$BIN_DIR;$currentPath",
            "User"
        )
        $env:Path = "$BIN_DIR;$env:Path"
        Write-OK "Added $BIN_DIR to user PATH"
        Write-Warn "Restart your terminal for PATH changes to take effect"
    }
}

function Verify-Install {
    $version = cmd /c "node `"$INSTALL_DIR\dist\cli.js`" --version 2>nul"
    if ($version -match '^\d') {
        Write-OK "Damie Code v$version installed successfully"
    } else {
        Write-Err "Installation verification failed"
        exit 1
    }
}

function Show-NextSteps {
    Write-Host ""
    Write-Host "Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Get started (restart terminal first):"
    Write-Host "    damie                  # Start interactive mode"
    Write-Host "    damie --help           # Show all options"
    Write-Host "    damie --version        # Show version"
    Write-Host ""
    Write-Host "  Set up an API provider:"
    Write-Host '    $env:DEEPSEEK_API_KEY = "your_key"    # DeepSeek'
    Write-Host '    $env:OPENAI_API_KEY = "your_key"      # OpenAI'
    Write-Host '    $env:ANTHROPIC_API_KEY = "your_key"   # Anthropic'
    Write-Host ""
    Write-Host "  Docs: https://github.com/damoojeje/damie-code" -ForegroundColor Blue
    Write-Host ""
}

# --- Main ---

Write-Header
Write-Info "Checking prerequisites..."
Check-Node
Check-Git
Write-Host ""

Install-DamieCode
Create-Commands
Write-Host ""

Check-Path
Verify-Install
Show-NextSteps
