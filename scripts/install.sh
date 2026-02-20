#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}[info]${RESET} $*"; }
done_() { echo -e "${GREEN}[done]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[warn]${RESET} $*"; }
fail()  { echo -e "${RED}[fail]${RESET} $*"; exit 1; }

echo -e "\n${BOLD}yep installer${RESET}\n"

# --- Check git ---
if ! command -v git &>/dev/null; then
  fail "git is required. Install it first."
fi
done_ "git found"

# --- Detect repo root or clone ---
YEP_HOME="${YEP_HOME:-$HOME/.yep}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd 2>/dev/null || echo "")"
CANDIDATE_ROOT="${SCRIPT_DIR:+$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd 2>/dev/null || echo "")}"

if [ -n "$CANDIDATE_ROOT" ] && [ -f "$CANDIDATE_ROOT/package.json" ]; then
  REPO_ROOT="$CANDIDATE_ROOT"
else
  if [ -d "$YEP_HOME/.git" ]; then
    info "Updating existing installation at $YEP_HOME..."
    git -C "$YEP_HOME" pull --ff-only
  else
    info "Cloning yep into $YEP_HOME..."
    git clone https://github.com/balkhaev/yep.git "$YEP_HOME"
  fi
  REPO_ROOT="$YEP_HOME"
fi
info "Repo root: $REPO_ROOT"

# --- Check / install bun ---
if command -v bun &>/dev/null; then
  done_ "bun found ($(bun --version))"
else
  info "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  done_ "bun installed ($(bun --version))"
fi

# --- Check / install entire ---
if command -v entire &>/dev/null; then
  done_ "entire found ($(entire version 2>/dev/null | head -1))"
else
  info "Installing entire CLI..."
  OS="$(uname -s)"
  case "$OS" in
    Darwin)
      if command -v brew &>/dev/null; then
        brew install entireio/tap/entire
      else
        curl -fsSL https://entire.io/install.sh | bash
      fi
      ;;
    Linux)
      curl -fsSL https://entire.io/install.sh | bash
      ;;
    *)
      warn "Unsupported OS: $OS — install entire manually: https://docs.entire.io/quickstart"
      ;;
  esac

  if command -v entire &>/dev/null; then
    done_ "entire installed"
  else
    warn "Could not install entire automatically. Install manually:"
    warn "  brew install entireio/tap/entire"
    warn "  curl -fsSL https://entire.io/install.sh | bash"
  fi
fi

# --- Install dependencies ---
info "Installing dependencies..."
cd "$REPO_ROOT"
bun install --silent 2>/dev/null || bun install
done_ "Dependencies installed"

# --- Symlink yep to PATH ---
YEP_BIN="$REPO_ROOT/bin/yep"
INSTALL_DIR=""

if [ -d "$HOME/.local/bin" ]; then
  INSTALL_DIR="$HOME/.local/bin"
elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  mkdir -p "$HOME/.local/bin"
  INSTALL_DIR="$HOME/.local/bin"
fi

LINK_PATH="$INSTALL_DIR/yep"

if [ -L "$LINK_PATH" ] || [ -f "$LINK_PATH" ]; then
  rm -f "$LINK_PATH"
fi

ln -s "$YEP_BIN" "$LINK_PATH"
done_ "Linked yep → $LINK_PATH"

# --- Check PATH ---
if ! echo "$PATH" | tr ':' '\n' | grep -q "^$INSTALL_DIR$"; then
  warn "$INSTALL_DIR is not in your PATH. Add it:"
  echo ""
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
  SHELL_NAME="$(basename "$SHELL")"
  case "$SHELL_NAME" in
    zsh)  echo "  # Add to ~/.zshrc" ;;
    bash) echo "  # Add to ~/.bashrc" ;;
  esac
  echo ""
fi

# --- Done ---
echo ""
echo -e "${GREEN}${BOLD}Installation complete!${RESET}"
echo ""
echo "  Next steps:"
echo ""
echo "    cd your-project"
echo "    yep enable        # Activate Entire + vector memory"
echo "    yep sync          # Index checkpoints"
echo "    yep search \"...\"  # Search past solutions"
echo ""
