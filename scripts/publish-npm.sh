#!/bin/bash
# npm Publish Script for Damie Code v1.0.0
# This script prepares and publishes the package to npm

set -e

echo "==================================="
echo "Damie Code v1.0.0 - npm Publish"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Pre-publish checks
echo "Step 1: Running pre-publish checks..."
echo "-------------------------------------"

# Check Node version
NODE_VERSION=$(node -v)
log_info "Node version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm -v)
log_info "npm version: $NPM_VERSION"

# Verify we're on the release branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $CURRENT_BRANCH"

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    log_warn "Working directory is not clean. Please commit or stash changes."
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        log_error "Aborting publish"
        exit 1
    fi
fi

echo ""
echo "Step 2: Installing dependencies..."
echo "-----------------------------------"
npm ci

echo ""
echo "Step 3: Running tests..."
echo "------------------------"
npm run test || {
    log_error "Tests failed. Aborting publish."
    exit 1
}

echo ""
echo "Step 4: Building package..."
echo "---------------------------"
npm run build || {
    log_error "Build failed. Aborting publish."
    exit 1
}

echo ""
echo "Step 5: Running lint..."
echo "-----------------------"
npm run lint || {
    log_error "Lint failed. Aborting publish."
    exit 1
}

echo ""
echo "Step 6: Verifying package..."
echo "-----------------------------"
npm pack --dry-run

echo ""
echo "Step 7: Checking npm authentication..."
echo "--------------------------------------"
npm whoami || {
    log_error "Not logged in to npm. Please run: npm login"
    exit 1
}

echo ""
echo "Step 8: Publishing to npm..."
echo "-----------------------------"
log_warn "This will publish @damie-code/damie-code to npm"
read -p "Are you sure you want to continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    log_error "Publish cancelled"
    exit 1
fi

# Publish the package
npm publish --access public

echo ""
echo "Step 9: Verifying publication..."
echo "---------------------------------"
npm view @damie-code/damie-code version

echo ""
echo "==================================="
log_info "Publish successful! 🎉"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Verify on npmjs.com: https://www.npmjs.com/package/@damie-code/damie-code"
echo "2. Test installation: npm install -g @damie-code/damie-code"
echo "3. Create GitHub release"
echo ""
