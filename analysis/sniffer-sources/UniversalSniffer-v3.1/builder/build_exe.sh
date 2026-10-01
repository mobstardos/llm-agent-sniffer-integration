#!/usr/bin/env bash
# Сборка одиночного исполняемого файла Universal Sniffer (Linux/macOS).
# Результат: dist/UniversalSniffer (на Windows через build_exe.bat — .exe)
set -e
cd "$(dirname "$0")/.."

if [ ! -d .venv-build ]; then
    echo "Создаю окружение .venv-build ..."
    python3 -m venv .venv-build
fi
. .venv-build/bin/activate
python -m pip install --upgrade pip pyinstaller -q

echo "Сборка ..."
python -m PyInstaller --noconfirm --clean builder/sniffer.spec

echo
echo "ГОТОВО: dist/UniversalSniffer"
