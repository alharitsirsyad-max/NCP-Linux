#!/usr/bin/env bash
# ============================================================
# Network Control Panel — One-line Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/USERNAME/network-control-panel/main/scripts/install.sh | bash
# ============================================================

set -e

# ── Config ────────────────────────────────────────────────────
APP_NAME="network-control-panel"
APP_DISPLAY_NAME="Network Control Panel"
APP_VERSION="0.1.0"
GITHUB_REPO="alharitsirsyad-max/NCP-Linux"
GITHUB_RELEASE_URL="https://github.com/${GITHUB_REPO}/releases/latest/download"
INSTALL_DIR="${HOME}/.local/bin"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }
step()    { echo -e "\n${BOLD}==> $1${NC}"; }

# ── Detect distro ────────────────────────────────────────────
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    elif command -v pacman &>/dev/null; then
        echo "arch"
    elif command -v apt-get &>/dev/null; then
        echo "debian"
    elif command -v dnf &>/dev/null; then
        echo "fedora"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)
info "Detected distro: $DISTRO"

# ── Install system dependencies ──────────────────────────────
install_deps() {
    step "Installing system dependencies"

    case "$DISTRO" in
        arch|manjaro|endeavouros)
            DEPS="networkmanager iproute2 iputils wireshark-qt mtr whois traceroute bind"
            INSTALLED=()
            MISSING=()
            for pkg in $DEPS; do
                if pacman -Q "$pkg" &>/dev/null; then
                    INSTALLED+=("$pkg")
                else
                    MISSING+=("$pkg")
                fi
            done
            if [ ${#MISSING[@]} -gt 0 ]; then
                info "Installing: ${MISSING[*]}"
                sudo pacman -S --noconfirm --needed "${MISSING[@]}" || warn "Some packages failed to install"
            else
                success "All dependencies already installed"
            fi
            ;;
        ubuntu|debian|linuxmint|pop)
            DEPS="network-manager iproute2 iputils-ping wireshark mtr-tiny whois traceroute bind9-dnsutils"
            info "Updating package lists..."
            sudo apt-get update -qq
            sudo apt-get install -y $DEPS || warn "Some packages failed to install"
            ;;
        fedora|rhel|centos)
            DEPS="NetworkManager iproute iputils wireshark-cli mtr whois traceroute bind-utils"
            sudo dnf install -y $DEPS || warn "Some packages failed to install"
            ;;
        opensuse*)
            DEPS="NetworkManager iproute2 iputils wireshark mtr whois traceroute bind-utils"
            sudo zypper install -y $DEPS || warn "Some packages failed to install"
            ;;
        *)
            warn "Unknown distro '$DISTRO' — skipping dependency installation"
            warn "Please manually install: NetworkManager, iproute2, wireshark, mtr, whois, traceroute, dig"
            ;;
    esac

    success "Dependencies ready"
}

# ── Download and install application ─────────────────────────
install_app() {
    step "Downloading Network Control Panel"

    mkdir -p "$INSTALL_DIR"

    case "$DISTRO" in
        arch|manjaro|endeavouros)
            # Arch: download binary directly
            DOWNLOAD_URL="${GITHUB_RELEASE_URL}/${APP_NAME}"
            info "Downloading binary from GitHub..."
            curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${APP_NAME}" \
                || error "Download failed. Check your internet connection or GitHub release URL."
            chmod +x "${INSTALL_DIR}/${APP_NAME}"
            success "Binary installed to ${INSTALL_DIR}/${APP_NAME}"
            ;;
        ubuntu|debian|linuxmint|pop)
            # Debian/Ubuntu: download and install .deb
            DEB_FILE="/tmp/${APP_NAME}_${APP_VERSION}_amd64.deb"
            DOWNLOAD_URL="${GITHUB_RELEASE_URL}/${APP_NAME}_${APP_VERSION}_amd64.deb"
            info "Downloading .deb package from GitHub..."
            curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$DEB_FILE" \
                || error "Download failed."
            info "Installing .deb package..."
            sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
            rm -f "$DEB_FILE"
            success ".deb installed"
            return  # .deb already creates .desktop, skip manual creation
            ;;
        fedora|rhel|centos)
            # Fedora: download and install .rpm
            RPM_FILE="/tmp/${APP_NAME}_${APP_VERSION}_amd64.rpm"
            DOWNLOAD_URL="${GITHUB_RELEASE_URL}/${APP_NAME}_${APP_VERSION}-1.x86_64.rpm"
            info "Downloading .rpm package from GitHub..."
            curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$RPM_FILE" \
                || error "Download failed."
            sudo rpm -i "$RPM_FILE" || sudo dnf install -y "$RPM_FILE"
            rm -f "$RPM_FILE"
            success ".rpm installed"
            return
            ;;
        *)
            # Fallback: download binary
            DOWNLOAD_URL="${GITHUB_RELEASE_URL}/${APP_NAME}"
            info "Downloading binary..."
            curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${APP_NAME}" \
                || error "Download failed."
            chmod +x "${INSTALL_DIR}/${APP_NAME}"
            success "Binary installed to ${INSTALL_DIR}/${APP_NAME}"
            ;;
    esac
}

# ── Download icon ─────────────────────────────────────────────
install_icon() {
    step "Installing icon"
    mkdir -p "${ICON_DIR}/128x128/apps" "${ICON_DIR}/32x32/apps"

    # Try release asset first, then raw GitHub
    ICON_URL="${GITHUB_RELEASE_URL}/icon-128x128.png"
    ICON_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main/src-tauri/icons/128x128.png"

    if curl -fsSL "$ICON_URL" -o "${ICON_DIR}/128x128/apps/${APP_NAME}.png" 2>/dev/null; then
        success "Icon installed"
    elif curl -fsSL "$ICON_RAW" -o "${ICON_DIR}/128x128/apps/${APP_NAME}.png" 2>/dev/null; then
        success "Icon installed from source"
    else
        warn "Could not download icon (non-critical) — app will use default icon"
    fi
}

# ── Create .desktop file ──────────────────────────────────────
create_desktop_entry() {
    step "Creating desktop entry"
    mkdir -p "$DESKTOP_DIR"

    cat > "${DESKTOP_DIR}/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=${APP_DISPLAY_NAME}
GenericName=Network Manager
Comment=Network configuration, monitoring, and diagnostics for Linux
Exec=${INSTALL_DIR}/${APP_NAME}
Icon=${APP_NAME}
Terminal=false
Categories=Network;System;Settings;
Keywords=network;adapter;ip;dns;ping;traceroute;diagnostics;
StartupNotify=true
EOF

    chmod 644 "${DESKTOP_DIR}/${APP_NAME}.desktop"

    # Update desktop database
    if command -v update-desktop-database &>/dev/null; then
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    fi

    success "Desktop entry created at ${DESKTOP_DIR}/${APP_NAME}.desktop"
}

# ── Add to PATH if needed ─────────────────────────────────────
setup_path() {
    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        warn "${INSTALL_DIR} is not in your PATH"
        info "Adding to PATH in ~/.bashrc and ~/.zshrc..."
        
        for rcfile in ~/.bashrc ~/.zshrc ~/.profile; do
            if [ -f "$rcfile" ]; then
                if ! grep -q "${INSTALL_DIR}" "$rcfile"; then
                    echo "" >> "$rcfile"
                    echo "# Network Control Panel" >> "$rcfile"
                    echo "export PATH=\"\$PATH:${INSTALL_DIR}\"" >> "$rcfile"
                fi
            fi
        done

        export PATH="$PATH:${INSTALL_DIR}"
        success "PATH updated — restart your terminal or run: source ~/.bashrc"
    fi
}

# ── NetworkManager enable ─────────────────────────────────────
ensure_networkmanager() {
    if command -v systemctl &>/dev/null; then
        if ! systemctl is-active --quiet NetworkManager 2>/dev/null; then
            info "Enabling NetworkManager..."
            sudo systemctl enable --now NetworkManager 2>/dev/null \
                && success "NetworkManager enabled" \
                || warn "Could not enable NetworkManager automatically"
        else
            success "NetworkManager is already running"
        fi
    fi
}

# ── Main ──────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║      Network Control Panel — Installer           ║${NC}"
    echo -e "${BOLD}║      Version ${APP_VERSION}                               ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    install_deps
    install_app
    install_icon
    create_desktop_entry
    setup_path
    ensure_networkmanager

    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC}"
    echo ""
    echo -e "  Launch from app menu: search for '${APP_DISPLAY_NAME}'"
    echo -e "  Or from terminal:     ${APP_NAME}"
    echo ""
    echo -e "  Required tools (install if missing):"
    echo -e "    • wireshark    — packet capture"
    echo -e "    • mtr          — MTR diagnostics"
    echo -e "    • whois        — domain lookup"
    echo -e "    • dig          — DNS lookup"
    echo ""
}

main "$@"
