@echo off
REM ============================================================================
REM  start-and-test.cmd - Runs the full test suite (test-all.cmd) and, only
REM  if everything passes, starts the whole platform (start-all.cmd).
REM  Convenience wrapper for "make sure it's green, then run it" in one
REM  command.
REM
REM  Converted from start-and-test.ps1.
REM
REM  USAGE
REM    scripts\start-and-test.cmd
REM ============================================================================

set "SCRIPTDIR=%~dp0"

call "%SCRIPTDIR%test-all.cmd"
set "TESTRC=%ERRORLEVEL%"

if not "%TESTRC%"=="0" (
    echo Tests failed - not starting the platform. Fix the failures first.
    exit /b %TESTRC%
)

echo.
echo All tests passed - starting the platform now.
call "%SCRIPTDIR%start-all.cmd" /skipbuild
exit /b %ERRORLEVEL%
