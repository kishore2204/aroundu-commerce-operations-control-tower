@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM  stop-all.cmd - Stops every LBOS platform process started by
REM  start-all.cmd.
REM
REM  Converted from stop-all.ps1. That script's PRIMARY mechanism (a PID file
REM  written by start-all.ps1's Start-Process -PassThru) has no batch
REM  equivalent that inherits the environment correctly (see start-all.cmd's
REM  header comment for why "wmic process call create" can't be used to
REM  launch and capture a PID at once) - so this uses stop-all.ps1's FALLBACK
REM  mechanism as the only mechanism: match java.exe processes by command
REM  line against this repo's path, not a blanket "kill all java.exe" (which
REM  would also kill unrelated Java processes on the machine).
REM
REM  Two wmic quirks, both confirmed live, that make the line below the only
REM  combination that actually works:
REM   - The comma in the GET clause needs the caret. Without it, wmic
REM     reports "Invalid GET Expression" through this backtick-command-
REM     substitution path (an unescaped comma is fine typed directly at a
REM     prompt - it only matters going through this specific path).
REM   - wmic's output must be consumed live via this backtick form, not
REM     redirected to a file first: wmic writes file output as UTF-16LE
REM     (every other byte a null), which silently breaks every findstr
REM     match below on a plain byte-for-byte read. Output consumed through
REM     a live pipe/backtick like this doesn't have that problem.
REM ============================================================================

set "REPOROOT=%~dp0.."
for %%I in ("%REPOROOT%") do set "REPOROOT=%%~fI"

echo Looking for java.exe processes whose command line references %REPOROOT% ...
echo.

set "FOUND=0"
set "PENDING_MATCH=0"

REM wmic's /format:list output alphabetizes properties within each instance
REM block, so "CommandLine=..." always appears immediately before
REM "ProcessId=..." for the same process - track a match flag across the two
REM lines rather than trying to parse a single CSV line (which breaks if the
REM command line itself contains a comma).
for /f "usebackq delims=" %%L in (`wmic process where "Name='java.exe'" get CommandLine^,ProcessId /format:list 2^>nul`) do (
    set "LINE=%%L"
    call :handle_line
)

if "%FOUND%"=="0" (
    echo No matching java.exe processes found. Nothing to stop.
) else (
    echo.
    echo All matched LBOS java.exe processes stopped.
)
endlocal
exit /b 0


:handle_line
REM Reads the global LINE variable directly rather than taking it as a %1
REM argument - LINE holds a raw java.exe command line full of embedded
REM double quotes (paths, -D properties), and passing that through a call's
REM own argument-quoting would misparse at the first embedded quote.
if "!LINE!"=="" goto :eof

echo !LINE! | findstr /b /i "CommandLine=" >nul
if not errorlevel 1 (
    echo !LINE! | findstr /i /c:"%REPOROOT%" >nul
    if not errorlevel 1 (
        set "PENDING_MATCH=1"
    ) else (
        set "PENDING_MATCH=0"
    )
    goto :eof
)

echo !LINE! | findstr /b /i "ProcessId=" >nul
if not errorlevel 1 (
    if "%PENDING_MATCH%"=="1" (
        REM Two steps, not one: batch substitution "!VAR:search=replace!"
        REM delimits search/replace on the FIRST "=", so a search text that
        REM itself needs to end in "=" (to strip "ProcessId=" whole) can't
        REM be written directly - "*ProcessId==" parses as search="*ProcessId"
        REM /replace="=", which put an EXTRA "=" back in (confirmed live:
        REM produced "PID ==9076"). Strip the word "ProcessId" first (an
        REM unambiguous search with no "=" in it), leaving "=9076", then
        REM drop that one leftover leading character with a substring.
        set "PID=!LINE:ProcessId=!"
        set "PID=!PID:~1!"
        set "PID=!PID: =!"
        REM wmic's piped/backtick output leaves a stray trailing CR embedded
        REM as literal data on each line (a well-known wmic quirk - the CR
        REM is invisible in a terminal, even wrapped in brackets, since it
        REM just returns the cursor to column 0 rather than printing
        REM anything) - confirmed live: taskkill reported "process ... not
        REM found" for a PID tasklist had just shown as running, and an
        REM exact string comparison against the same-looking value failed.
        REM Trimming the known-present trailing character fixes it.
        set "PID=!PID:~0,-1!"
        echo Stopping java.exe ^(PID !PID!^) and its child processes...
        taskkill /F /T /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   Could not stop PID !PID! - it may have already exited.
        ) else (
            echo   Stopped PID !PID!.
        )
        set "FOUND=1"
    )
    set "PENDING_MATCH=0"
)
goto :eof
