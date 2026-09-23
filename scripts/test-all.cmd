@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM  test-all.cmd - Builds all eight modules, runs every test suite, and
REM  prints a running summary. Exits non-zero if any module's tests fail.
REM
REM  Converted from test-all.ps1. Two differences, both due to batch's
REM  limits compared to PowerShell:
REM    - JaCoCo line-coverage percentage isn't computed here (batch has no
REM      XML parser, unlike PowerShell's built-in [xml] cast). Coverage
REM      reports are still generated as normal at
REM      target\site\jacoco\index.html per module - open that directly.
REM    - Results print progressively as each module finishes, rather than as
REM      one final table (PowerShell's Format-Table needs structured
REM      objects; batch has no equivalent, and building then re-parsing one
REM      long delimited string back into rows is fragile in practice).
REM
REM  USAGE
REM    scripts\test-all.cmd
REM ============================================================================

set "REPOROOT=%~dp0.."
for %%I in ("%REPOROOT%") do set "REPOROOT=%%~fI"

set MODULES=eureka-server api-gateway S1-platform-territory S2-partner-verification S3-commerce-customer S4-order-logistics S5-fleet-operations S6-finance-support

set "ANYFAILURE=0"
set "TOTALTESTS=0"

echo.
echo ==================== Module ^| Tests summary ^| Status ====================

for %%M in (%MODULES%) do (
    set "MODDIR=%REPOROOT%\%%M"
    set "WRAPPER=!MODDIR!\mvnw.cmd"

    if not exist "!WRAPPER!" (
        echo %%M ^| SKIPPED - no mvnw.cmd found
    ) else (
        echo.
        echo ---- Testing %%M ----
        pushd "!MODDIR!"
        set "OUTFILE=%TEMP%\lbos-test-%%M.log"
        call .\mvnw.cmd clean test > "!OUTFILE!" 2>&1
        set "TESTRC=!ERRORLEVEL!"
        popd
        type "!OUTFILE!"

        set "SUMMARYLINE="
        for /f "delims=" %%S in ('findstr /r /c:"^\[INFO\] Tests run: [0-9]*, Failures: [0-9]*, Errors: [0-9]*, Skipped: [0-9]*$" "!OUTFILE!" 2^>nul') do (
            set "SUMMARYLINE=%%S"
        )

        REM SUMMARYLINE looks like "[INFO] Tests run: 42, Failures: 0, Errors: 0, Skipped: 0" -
        REM splitting on :, space, and comma (runs of delimiters collapse to one boundary) gives
        REM token4 = the tests-run count: [INFO](1) Tests(2) run(3) 42(4) Failures(5) 0(6) ...
        set "TESTSRUN="
        if defined SUMMARYLINE (
            for /f "tokens=4 delims=:, " %%N in ("!SUMMARYLINE!") do set "TESTSRUN=%%N"
        )
        if defined TESTSRUN (
            set /a TOTALTESTS+=!TESTSRUN! >nul 2>&1
        )

        if "!TESTRC!"=="0" (
            echo %%M ^| !SUMMARYLINE! ^| PASS
        ) else (
            echo %%M ^| !SUMMARYLINE! ^| FAIL
            set "ANYFAILURE=1"
        )
        del /f /q "!OUTFILE!" >nul 2>&1
    )
)

echo.
echo ==================== Summary ====================
echo Total tests executed across all modules: %TOTALTESTS%
echo Full per-module JaCoCo coverage: open each module's target\site\jacoco\index.html

if "%ANYFAILURE%"=="1" (
    echo One or more modules FAILED. See output above.
    endlocal
    exit /b 1
) else (
    echo All modules PASSED.
    endlocal
    exit /b 0
)
