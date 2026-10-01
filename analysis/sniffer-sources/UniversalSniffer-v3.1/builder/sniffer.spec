# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec: сборка Universal Sniffer в одиночный исполняемый файл.

Сборка (из корня проекта):
    python -m PyInstaller --noconfirm --clean builder/sniffer.spec

Результат: dist/UniversalSniffer.exe (Windows) или dist/UniversalSniffer (Linux/macOS).
Рядом с готовым exe создаются: config.json (копия), capture/, plugins/.
"""
import os

SPEC_DIR = os.path.abspath(SPECPATH)
PROJECT = os.path.dirname(SPEC_DIR)
if not os.path.exists(os.path.join(PROJECT, "sniffer.py")):
    PROJECT = SPEC_DIR  # spec лежит в корне проекта


a = Analysis(
    [os.path.join(PROJECT, "sniffer.py")],
    pathex=[PROJECT],
    binaries=[],
    datas=[
        # веб-панель попадает внутрь exe (распаковывается во временный каталог)
        (os.path.join(PROJECT, "webui"), "webui"),
        # шаблон конфига рядом с кодом (frozen-режим ищет его рядом с exe)
        (os.path.join(PROJECT, "config.json"), "."),
    ],
    hiddenimports=[
        # парсеры импортируются динамически — PyInstaller сам их не увидит
        "parsers.remote_server",
        "parsers.thrift",
        "parsers.json_http",
        "parsers.modbus",
        "parsers.hexdump",
        # служба Windows подключается по --service (ленивый импорт)
        "sniffcore.winservice",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="UniversalSniffer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(PROJECT, "assets", "sniffer.ico"),
)
