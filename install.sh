#!/usr/bin/env bash
set -euo pipefail

# Damie Code - Installation Script
# Usage: curl -sSL https://raw.githubusercontent.com/damoojeje/damie-code/main/install.sh | bash

REPO_URL="https://github.com/damoojeje/damie-code.git"
INSTALL_DIR="${DAMIE_INSTALL_DIR:-$HOME/.damie-code}"
BIN_DIR="${DAMIE_BIN_DIR:-$HOME/.local/bin}"
MIN_NODE_VERSION=20
BRANCH="${DAMIE_BRANCH:-main}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
fatal() { error "$*"; exit 1; }

header() {
  echo ""
  echo -e "${GREEN}================================================${NC}"
  echo -e "${GREEN}          Damie Code Installer                  ${NC}"
  echo -e "${GREEN}    AI-Powered CLI Coding Assistant              ${NC}"
  echo -e "${GREEN}================================================${NC}"
  echo ""
}

check_node() {
  if ! command -v node &>/dev/null; then
    fatal "Node.js is not installed. Please install Node.js ${MIN_NODE_VERSION}+ first:
    https://nodejs.org/"
  fi
  local node_version
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt "$MIN_NODE_VERSION" ]; then
    fatal "Node.js ${MIN_NODE_VERSION}+ is required. You have $(node -v)."
  fi
  ok "Node.js $(node -v)"
}

check_git() {
  if ! command -v git &>/dev/null; then
    fatal "Git is not installed. Please install Git first:
    https://git-scm.com/"
  fi
  ok "Git $(git --version | awk '{print $3}')"
}

clone_repo() {
  if [ -d "$INSTALL_DIR" ]; then
    info "Existing installation found at $INSTALL_DIR"
    info "Updating..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH" --quiet
    git checkout "$BRANCH" --quiet
    git reset --hard "origin/$BRANCH" --quiet
    ok "Updated to latest"
  else
    info "Cloning Damie Code..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" --quiet
    ok "Cloned to $INSTALL_DIR"
  fi
}

install_deps() {
  info "Installing dependencies (this may take a few minutes)..."
  cd "$INSTALL_DIR"
  npm install --ignore-scripts --no-audit --no-fund 2>&1 | tail -3
  ok "Dependencies installed"
}

build_project() {
  info "Building Damie Code..."
  cd "$INSTALL_DIR"
  npm run bundle 2>&1 | tail -3
  if [ -f "$INSTALL_DIR/dist/cli.js" ]; then
    ok "Build complete"
  else
    warn "Bundle not created, trying standard build..."
    npm run build 2>&1 | tail -3
    if [ -f "$INSTALL_DIR/dist/cli.js" ]; then
      ok "Build complete"
    else
      fatal "Build failed. dist/cli.js not found."
    fi
  fi
}

create_symlinks() {
  mkdir -p "$BIN_DIR"

  cat > "$BIN_DIR/damie" << 'WRAPPER'
#!/usr/bin/env bash
exec node "${DAMIE_INSTALL_DIR:-$HOME/.damie-code}/dist/cli.js" "$@"
WRAPPER
  chmod +x "$BIN_DIR/damie"

  cat > "$BIN_DIR/damie-code" << 'WRAPPER'
#!/usr/bin/env bash
exec node "${DAMIE_INSTALL_DIR:-$HOME/.damie-code}/dist/cli.js" "$@"
WRAPPER
  chmod +x "$BIN_DIR/damie-code"

  ok "Created commands: damie, damie-code"
}

check_path() {
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "$BIN_DIR is not in your PATH"
    echo ""
    local shell_name
    shell_name=$(basename "$SHELL" 2>/dev/null || echo "bash")
    local profile_file
    case "$shell_name" in
      zsh)  profile_file="$HOME/.zshrc" ;;
      fish) profile_file="$HOME/.config/fish/config.fish" ;;
      *)    profile_file="$HOME/.bashrc" ;;
    esac
    info "Add to PATH:"
    echo ""
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> $profile_file"
    echo "  source $profile_file"
    echo ""
  fi
}

verify_install() {
  local version
  version=$(node "$INSTALL_DIR/dist/cli.js" --version 2>/dev/null || echo "")
  if [ -n "$version" ]; then
    ok "Damie Code v${version} installed successfully"
  else
    error "Installation verification failed"
    return 1
  fi
}

print_next_steps() {
  echo ""
  echo -e "${GREEN}Installation complete!${NC}"
  echo ""
  echo "  Get started:"
  echo "    damie                  # Start interactive mode"
  echo "    damie --help           # Show all options"
  echo "    damie --version        # Show version"
  echo ""
  echo "  Set up an API provider:"
  echo "    export DEEPSEEK_API_KEY=\"your_key\"    # DeepSeek"
  echo "    export OPENAI_API_KEY=\"your_key\"      # OpenAI"
  echo "    export ANTHROPIC_API_KEY=\"your_key\"   # Anthropic"
  echo ""
  echo -e "  Docs: ${BLUE}https://github.com/damoojeje/damie-code${NC}"
  echo ""
}

uninstall() {
  info "Uninstalling Damie Code..."
  rm -f "$BIN_DIR/damie" "$BIN_DIR/damie-code"
  rm -rf "$INSTALL_DIR"
  ok "Damie Code has been uninstalled"
  exit 0
}

main() {
  header

  if [[ "${1:-}" == "--uninstall" ]]; then
    uninstall
  fi

  info "Checking prerequisites..."
  check_node
  check_git
  echo ""

  clone_repo
  install_deps
  build_project
  create_symlinks
  echo ""

  check_path
  verify_install
  print_next_steps
}

main "$@"
