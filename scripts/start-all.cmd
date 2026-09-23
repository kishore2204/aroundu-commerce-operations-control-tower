@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM  start-all.cmd - Starts the entire LBOS platform: Eureka, all six
REM  microservices, and the API Gateway.
REM
REM  Converted from start-all.ps1. Uses each module's own Maven wrapper
REM  (mvnw.cmd) - no globally installed Maven required. Starts each process
REM  detached (its own minimized console window - batch has no fully-hidden
REM  equivalent of PowerShell's -WindowStyle Hidden without extra tooling).
REM
REM  Each service's window runs mvnw through a PowerShell host and pipes its
REM  output through "ForEach-Object { $_; Add-Content ... }", so the output
REM  goes to BOTH places at once: the console window (restore it from the
REM  taskbar to watch a service live) AND logs\<module>.log (for tailing/
REM  grepping from outside, or reviewing after the window's gone). A plain
REM  "> logfile 2>&1" redirect - the original approach here - sends
REM  everything to the file only, which is why those windows always looked
REM  blank/idle even while the service was actively logging: nothing was
REM  left for the console to display.
REM
REM  Not "| Tee-Object -FilePath" (the obvious choice): Windows PowerShell
REM  5.1's Tee-Object has no -Encoding parameter and defaults to UTF-16LE for
REM  the file it writes - confirmed live, every log file came out as
REM  seemingly-space-doubled garbage to grep/tail/any UTF-8 reader. Add-Content
REM  DOES take -Encoding utf8, so piping through it directly gets a real
REM  UTF-8 log (with a leading BOM PS 5.1 can't turn off, which grep/tail
REM  tolerate fine) instead.
REM
REM  Unlike start-all.ps1, this does not capture/save PIDs at launch time:
REM  "wmic process call create" (the usual batch trick for getting a spawned
REM  process's PID back) launches the child through the WMI service, which
REM  does NOT reliably inherit the calling script's environment variables -
REM  it would silently break every DB_URL/JWT_SECRET/SPRING_PROFILES_ACTIVE
REM  override this script sets. So processes are launched with plain "start"
REM  (which DOES inherit the environment correctly), and stop-all.cmd finds
REM  them afterward by matching java.exe command lines against this repo's
REM  path - the same fallback start-all.ps1's companion stop-all.ps1 already
REM  used when its own PID file was missing, just promoted to the only
REM  mechanism here.
REM
REM  USAGE
REM    scripts\start-all.cmd [/skipbuild] [/offline] [/postgres]
REM                           [/dbhost:HOST] [/dbport:PORT]
REM                           [/dbusername:USER] [/dbpassword:PASS]
REM                           [/dbname:DBNAME]
REM
REM    /skipbuild      Skip the "mvnw compile" warm-up build before starting.
REM    /offline        Pass Maven's -o (--offline) flag to every build/run.
REM    /postgres       Activate the "postgres" Spring profile on every
REM                    service instead of the default embedded H2. See
REM                    docs\running-the-project.md section 4a.
REM    /dbhost:H       Point every service at a PostgreSQL server on a
REM                    different host. Implies /postgres. Each service
REM                    connects to its OWN database on that server
REM                    (lbos_platform, lbos_partner, ...) unless /dbname is
REM                    also given.
REM    /dbport:P       Port of the remote PostgreSQL server. Default 5432.
REM    /dbusername:U   Username for the remote server. Default "postgres".
REM    /dbpassword:P   Password for the remote server. Default "postgres".
REM    /dbname:N       Use ONE shared database for every service instead of
REM                    the six per-service databases - for a managed/
REM                    corporate PostgreSQL instance where you only have one
REM                    database provisioned. Safe: no two services share a
REM                    table name.
REM
REM  EXAMPLES
REM    scripts\start-all.cmd
REM    scripts\start-all.cmd /skipbuild
REM    scripts\start-all.cmd /postgres
REM    scripts\start-all.cmd /dbhost:192.168.1.50 /dbusername:lbos_app /dbpassword:Correct-Horse-1
REM    scripts\start-all.cmd /dbhost:10.23.240.29 /dbusername:my_db_user /dbpassword:my-password /dbname:my_single_db
REM ============================================================================

set "SKIPBUILD="
set "OFFLINE="
set "POSTGRES="
set "DBHOST="
set "DBPORT=5432"
set "DBUSERNAME=postgres"
set "DBPASSWORD=postgres"
set "DBNAME="

REM Capture this script's own directory BEFORE any "shift" below - shift
REM corrupts %~dp0/%0 resolution afterward (confirmed live: %~dp0 silently
REM becomes "C:\" instead of this script's real folder once shift has run).
set "REPOROOT=%~dp0.."
for %%I in ("%REPOROOT%") do set "REPOROOT=%%~fI"

:parse_args
if "%~1"=="" goto args_done
set "ARG=%~1"
if /i "%ARG%"=="/skipbuild" (
    set "SKIPBUILD=1"
    shift
    goto parse_args
)
if /i "%ARG%"=="/offline" (
    set "OFFLINE=1"
    shift
    goto parse_args
)
if /i "%ARG%"=="/postgres" (
    set "POSTGRES=1"
    shift
    goto parse_args
)
for /f "tokens=1* delims=:" %%K in ("%ARG%") do (
    if /i "%%K"=="/dbhost" (
        set "DBHOST=%%L"
        set "POSTGRES=1"
    )
    if /i "%%K"=="/dbport" set "DBPORT=%%L"
    if /i "%%K"=="/dbusername" set "DBUSERNAME=%%L"
    if /i "%%K"=="/dbpassword" set "DBPASSWORD=%%L"
    if /i "%%K"=="/dbname" set "DBNAME=%%L"
)
shift
goto parse_args
:args_done

if defined OFFLINE echo Offline mode active - Maven will use only what's already cached and fail fast instead of touching the network.

if defined POSTGRES (
    set "SPRING_PROFILES_ACTIVE=postgres"
    if defined DBHOST (
        if defined DBNAME (
            echo Postgres profile active - every service will connect to the SAME shared database "%DBNAME%" on %DBHOST%:%DBPORT% as "%DBUSERNAME%".
            echo ^(All six services' tables will coexist in this one database - no table-name collisions across services, verified safe.^)
        ) else (
            echo Postgres profile active - every service will connect to its own database on %DBHOST%:%DBPORT% as "%DBUSERNAME%".
            echo ^(Each service's DB_URL is built automatically below - one JDBC URL per service. Pass /dbname to use one shared database instead.^)
        )
    ) else (
        sc query state= all | findstr /i "postgresql" >nul 2>&1
        if errorlevel 1 (
            echo Postgres profile active - WARNING: no "postgresql*" Windows service was found running. Start your local PostgreSQL server before continuing.
        ) else (
            echo Postgres profile active - a local PostgreSQL Windows service was found.
        )
        echo Services will connect per their application-postgres.properties/.yml ^(localhost:5432 by default^). First time only: run scripts\init-postgres-databases.sql via psql to create the six databases.
    )
)

set "LOGSDIR=%REPOROOT%\logs"
if not exist "%LOGSDIR%" mkdir "%LOGSDIR%"

where java >nul 2>&1
if errorlevel 1 (
    echo ERROR: 'java' was not found on PATH. Install a JDK 17+ before running this script.
    exit /b 1
)
for /f "tokens=*" %%V in ('java -version 2^>^&1 ^| findstr /i "version"') do echo Java found: %%V

REM "&" is deliberately avoided in every display name below - it's a command
REM separator in batch and breaks parsing even inside quotes once a name is
REM re-used through "start" or another CALL (confirmed live: "S1 Platform &
REM Territory" made cmd.exe try to run "Territory" as its own command).
call :run_service eureka-server            "Eureka Server"                 8761 ""
call :run_service S1-platform-territory    "S1 Platform and Territory"     8081 lbos_platform
call :run_service S2-partner-verification  "S2 Partner Verification"       8082 lbos_partner
call :run_service S3-commerce-customer     "S3 Commerce and Customer"      8083 lbos_commerce
call :run_service S4-order-logistics       "S4 Order and Logistics"        8084 lbos_order
call :run_service S5-fleet-operations      "S5 Fleet Operations"           8085 lbos_fleet
call :run_service S6-finance-support       "S6 Finance and Support"        8086 lbos_finance
call :run_service api-gateway              "API Gateway"                   8080 ""

echo.
echo ==================== LBOS platform starting ====================
echo Each service's own window shows its live output - restore it from the
echo taskbar to watch it. The same output is also streamed to %LOGSDIR%\*.log
echo for tailing/grepping from outside.
echo Eureka dashboard: http://localhost:8761
echo Gateway:          http://localhost:8080
echo Use scripts\stop-all.cmd to stop everything this started.
echo This script does not block - services are still starting in the background.
echo ===================================================================
endlocal
exit /b 0


:run_service
REM %1=folder id  %2=display name (quoted)  %3=port  %4=this service's postgres db name (or "" if none)
set "SVC_ID=%~1"
set "SVC_NAME=%~2"
set "SVC_PORT=%~3"
set "SVC_DB=%~4"
set "SVC_DIR=%REPOROOT%\%SVC_ID%"
set "WRAPPER=%SVC_DIR%\mvnw.cmd"

if not exist "!WRAPPER!" (
    echo SKIP: !SVC_NAME! - no mvnw.cmd found at !WRAPPER!
    goto :eof
)

set "OFFLINEFLAG="
if defined OFFLINE set "OFFLINEFLAG=-o"

if not defined SKIPBUILD (
    echo Building %SVC_NAME%...
    pushd "%SVC_DIR%"
    call .\mvnw.cmd -q %OFFLINEFLAG% compile
    set "BUILDRC=%ERRORLEVEL%"
    popd
    if not "!BUILDRC!"=="0" (
        echo ERROR: build failed for %SVC_NAME% - not starting it. See output above.
        goto :eof
    )
)

set "LOGFILE=%LOGSDIR%\%SVC_ID%.log"

REM Each service needs its OWN DB_URL (different database name, unless
REM /dbname forces one shared database for all six) - set/clear before every
REM service so the process "start" launches next inherits the right
REM connection string via the environment block.
set "DB_URL="
set "DB_USERNAME="
set "DB_PASSWORD="
if defined DBHOST if not "!SVC_DB!"=="" (
    if defined DBNAME (
        set "DB_URL=jdbc:postgresql://!DBHOST!:!DBPORT!/!DBNAME!"
    ) else (
        set "DB_URL=jdbc:postgresql://!DBHOST!:!DBPORT!/!SVC_DB!"
    )
    set "DB_USERNAME=!DBUSERNAME!"
    set "DB_PASSWORD=!DBPASSWORD!"
    echo Starting !SVC_NAME! on port !SVC_PORT! -^> !DB_URL! ^(log: !LOGFILE!^)...
) else (
    echo Starting !SVC_NAME! on port !SVC_PORT! ^(log: !LOGFILE!^)...
)

REM ".\mvnw.cmd", not a bare "mvnw.cmd": NoDefaultCurrentDirectoryInExePath
REM (set on some Windows setups) stops cmd.exe from implicitly searching the
REM current directory for an executable - confirmed live, same issue
REM start-all.ps1 already documents fixing the same way.
REM
REM Launched through powershell (not cmd) so its output can be split to both
REM the console and the log file live, as it's produced - see the header
REM comment for why (and why this is Add-Content in a ForEach-Object rather
REM than Tee-Object). -NoExit keeps the window open after mvnw stops/crashes
REM so its last lines stay readable instead of the window vanishing
REM immediately. Single-quoted PowerShell strings for SVC_DIR/LOGFILE (not
REM double-quoted, which would clash with the batch-level double quotes this
REM whole -Command argument is already wrapped in).
start "!SVC_NAME!" /MIN powershell -NoLogo -NoProfile -NoExit -Command "Set-Location -LiteralPath '!SVC_DIR!'; & .\mvnw.cmd !OFFLINEFLAG! spring-boot:run 2>&1 | ForEach-Object { $_; Add-Content -LiteralPath '!LOGFILE!' -Value $_ -Encoding utf8 }"

REM "timeout" needs a real console input handle and fails outright ("Input
REM redirection is not supported") when run non-interactively (e.g. from a
REM CI job, a scheduled task, or any launcher that redirects stdin) -
REM confirmed live. "ping" needs no console handle at all and is the
REM standard portable batch sleep idiom; -n N+1 gives N seconds (the first
REM ping returns almost instantly).
if /i "%SVC_ID%"=="eureka-server" (
    echo Waiting 20s for Eureka to come up before starting dependent services...
    ping -n 21 127.0.0.1 >nul
) else (
    ping -n 4 127.0.0.1 >nul
)
goto :eof
