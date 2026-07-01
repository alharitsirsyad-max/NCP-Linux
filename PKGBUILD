# Maintainer: Your Name <your@email.com>
pkgname=network-control-panel
pkgver=0.1.0
pkgrel=1
pkgdesc="Linux network configuration and diagnostics GUI — Tauri v2 + React"
arch=('x86_64')
url="https://github.com/alharitsirsyad-max/NCP-Linux"
license=('MIT')
depends=(
  'webkit2gtk'
  'networkmanager'
  'iproute2'
  'iputils'
  'bind-tools'
  'traceroute'
)
makedepends=(
  'rust'
  'cargo'
  'nodejs'
  'pnpm'
  'base-devel'
)
source=("$pkgname-$pkgver.tar.gz::$url/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
  cd "$srcdir/$pkgname-$pkgver"
  pnpm install --frozen-lockfile
  pnpm tauri build
}

package() {
  cd "$srcdir/$pkgname-$pkgver"

  # Install binary
  install -Dm755 "src-tauri/target/release/$pkgname" \
    "$pkgdir/usr/bin/$pkgname"

  # Install desktop entry
  install -Dm644 "src-tauri/target/release/bundle/deb/data/usr/share/applications/$pkgname.desktop" \
    "$pkgdir/usr/share/applications/$pkgname.desktop" 2>/dev/null || true

  # Install icons
  for size in 32x32 128x128; do
    install -Dm644 "src-tauri/icons/$size.png" \
      "$pkgdir/usr/share/icons/hicolor/$size/apps/$pkgname.png" 2>/dev/null || true
  done

  # Install license
  install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE" 2>/dev/null || true
}
