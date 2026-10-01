/*
 * UniversalSniffer launcher — нативный лаунчер портативной сборки.
 *
 * Запускает runtime\python.exe app\sniffer.py из папки, где лежит сам exe.
 * Без аргументов добавляет --open-browser (автооткрытие веб-панели).
 * Все аргументы лаунчера передаются снифферу как есть.
 *
 * Сборка (кросс-компиляция из Linux):  zig cc -target x86_64-windows-gnu ...
 * Сборка на Windows (MinGW):           gcc -O2 -municode? нет, обычный main
 */
#include <windows.h>
#include <stdio.h>
#include <string.h>

static char exe_dir[MAX_PATH];

static void set_exe_dir(void)
{
    DWORD n = GetModuleFileNameA(NULL, exe_dir, MAX_PATH);
    if (n == 0 || n >= MAX_PATH) {
        lstrcpyA(exe_dir, ".");
        return;
    }
    char *p = strrchr(exe_dir, '\\');
    if (p) *p = 0;
}

int main(int argc, char **argv)
{
    set_exe_dir();
    /* корень портативной сборки: сниффер сложит capture/, найдёт config.json */
    SetEnvironmentVariableA("USNIFF_ROOT", exe_dir);

    char py[MAX_PATH], script[MAX_PATH];
    lstrcpyA(py, exe_dir);     lstrcatA(py, "\\runtime\\python.exe");
    lstrcpyA(script, exe_dir); lstrcatA(script, "\\app\\sniffer.py");

    if (GetFileAttributesA(py) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxA(NULL,
            "Не найден runtime\\python.exe.\n\n"
            "Распакуйте архив сборки ЦЕЛИКОМ: лаунчер UniversalSniffer.exe, "
            "папки runtime\\ и app\\ должны оставаться рядом.",
            "Universal Sniffer", MB_ICONERROR);
        return 2;
    }
    if (GetFileAttributesA(script) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxA(NULL, "Не найден app\\sniffer.py — архив распакован не полностью.",
                    "Universal Sniffer", MB_ICONERROR);
        return 2;
    }

    /* командная строка: "python.exe" "sniffer.py" [args...] */
    static char cmd[32768];
    _snprintf(cmd, sizeof(cmd) - 1, "\"%s\" \"%s\"", py, script);
    cmd[sizeof(cmd) - 1] = 0;
    if (argc <= 1) {
        lstrcatA(cmd, " --open-browser");
    } else {
        int i;
        for (i = 1; i < argc; i++) {
            if (lstrlenA(cmd) + lstrlenA(argv[i]) + 8 >= (int)sizeof(cmd)) break;
            lstrcatA(cmd, " \"");
            lstrcatA(cmd, argv[i]);
            lstrcatA(cmd, "\"");
        }
    }

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si)); si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    if (!CreateProcessA(NULL, cmd, NULL, NULL, TRUE, 0, NULL, exe_dir, &si, &pi)) {
        MessageBoxA(NULL, "Не удалось запустить runtime\\python.exe.",
                    "Universal Sniffer", MB_ICONERROR);
        return 3;
    }
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return (int)code;
}
