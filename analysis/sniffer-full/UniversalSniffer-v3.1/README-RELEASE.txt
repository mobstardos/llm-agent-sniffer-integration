Universal Sniffer 3.1 — полный комплект (исходники + релизы)
================================================================

ПРИМЕЧАНИЕ О СОСТАВЕ
  Linux-сборка вынесена из этого архива в отдельный файл
  UniversalSniffer-linux64.zip (лежит рядом) — чтобы размер архива
  оставался достаточно малым для скачивания.

СОСТАВ
  UniversalSniffer-win64-portable.zip
      ГОТОВЫЙ РЕЛИЗ для Windows x64, ничего не требует (Python внутри).
      Распакуйте ЦЕЛИКОМ в одну папку и запустите UniversalSniffer.exe.
      Панель: http://127.0.0.1:9500/
      Служба Windows (автозапуск): service.bat install — права администратора
      запросятся автоматически; удаление — service.bat remove; после правки
      config.json — service.bat restart.
      Порты по умолчанию: 9000->9001, 9010->9011. Меняются в config.json или
      ключом --ports 3003:3004,10010:10011 (панель — --web-port 8080).

  sources/
      Полные исходники проекта: sniffer.py, sniffcore/ (движок, экспорт,
      тревоги, веб-сервер, winservice), parsers/ (плагины-парсеры),
      webui/ (панель), builder/ (сборка своего exe: build_exe.bat,
      sniffer.spec, лаунчер, иконка), README.md с полной документацией
      (раздел 11 — systemd-юнит для Linux, раздел про службу Windows).
      Запуск из исходников: python3 sniffer.py --help (нужен только Python 3.7+).

  UniversalSniffer-linux64.zip (отдельный файл рядом с этим архивом)
      Одиночный исполняемый файл для Linux x86-64 (собран PyInstaller).
      Распакуйте: chmod +x UniversalSniffer-linux64 && ./UniversalSniffer-linux64
      config.json и capture/ создаются рядом с бинарником.

ЧТО НОВОГО В 3.1
  * Служба Windows без зависимостей: --service install/remove/start/stop/
    restart/status — автозапуск при загрузке, автоперезапуск при сбоях,
    логи capture\service.log; service.bat в портативной сборке.
  * Новые порты по умолчанию 9000->9001, 9010->9011, панель 9500 —
    порты настраиваются в config.json, ключами --ports/--web-port
    или (для службы) с последующим service.bat restart.
  * Системные требования прежние: чистая стандартная библиотека Python,
    ноль внешних зависимостей, Windows 7+ / Linux.

КОНТРОЛЬНЫЕ СУММЫ (SHA-256)
  UniversalSniffer-win64-portable.zip : b3a3cfe10c1da3a5c6a06cb68d7238cf1c1f480e7d9fc3e9cd01b5c0c26016d2
  UniversalSniffer-linux64.zip        : 18ac11585515c0fac7a077c8a902ce71e3a9b3abbe50fd73def4b94b014e88ff  (отдельный файл)
