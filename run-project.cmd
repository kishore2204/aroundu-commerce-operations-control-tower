@echo off
setlocal
title AroundU - project launcher

rem ---------------------------------------------------------------------------
rem  Starts the whole project. Run it from the project root (double-click it, or
rem  run it in a command prompt opened in this folder).
rem
rem  Every part opens in its OWN command window and keeps running there, so this
rem  script never waits for one service to finish before starting the next.
rem  Close a service's window (or press Ctrl+C in it) to stop that service.
rem
rem  Order:  frontend -> eureka-server -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> api-gateway
rem
rem  Needs: Node.js + npm and a Java JDK. Uses "mvn" if it is on the PATH, otherwise the
rem  Maven wrapper (mvnw.cmd) inside each service folder.
rem  Database settings are read from each service's
rem  src\main\resources\application.properties (they can be overridden with the
rem  DB_URL, DB_USERNAME and DB_PASSWORD environment variables).
rem ---------------------------------------------------------------------------

cd /d "%~dp0"
set "ROOT=%~dp0"

rem ---- sanity checks ---------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found on the PATH. Install Node.js first.
    goto :fail
)
rem Uses "mvn" when it is installed; otherwise falls back to the Maven wrapper (mvnw.cmd) that
rem ships inside every service folder, so the script still works without a global Maven.
set "MVN=mvn"
where mvn >nul 2>&1
if errorlevel 1 (
    rem ".\mvnw.cmd", not a bare "mvnw.cmd": on machines with NoDefaultCurrentDirectoryInExePath set, cmd.exe does not
    rem look in the current directory for a bare name ("'mvnw.cmd' is not recognized").
    set "MVN=.\mvnw.cmd"
    echo [INFO] mvn was not found on the PATH - using each service's Maven wrapper ^(mvnw.cmd^) instead.
)
if not defined JAVA_HOME (
    echo [INFO] JAVA_HOME is not set. Maven needs a JDK: install one or set JAVA_HOME if a service fails to start.
)
for %%D in (frontend eureka-server S1-platform-territory S2-partner-verification S3-commerce-customer S4-order-logistics S5-fleet-operations S6-finance-support api-gateway) do (
    if not exist "%ROOT%%%D\" (
        echo [ERROR] Folder "%%D" was not found next to run-project.cmd. Run this script from the project root.
        goto :fail
    )
)

echo.
echo Starting the AroundU project - each part opens in its own window.
echo.

rem ---- 1. frontend: npm install, then npm start ------------------------------
echo [1/9] frontend            (npm install ^&^& npm start)
start "Frontend (Angular)" /d "%ROOT%frontend" cmd /k "npm install && npm start"

rem ---- 2. eureka-server (service registry - the services register with it) ---
echo [2/9] eureka-server       (port 8761)
start "Eureka Server" /d "%ROOT%eureka-server" cmd /k "%MVN% spring-boot:run"
echo       giving Eureka a moment to come up before the services start ...
timeout /t 20 /nobreak >nul

rem ---- 3. S1 - S6 ------------------------------------------------------------
echo [3/9] S1-platform-territory   (port 8081)
start "S1 - Platform and Territory" /d "%ROOT%S1-platform-territory" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

echo [4/9] S2-partner-verification (port 8082)
start "S2 - Partner Verification" /d "%ROOT%S2-partner-verification" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

echo [5/9] S3-commerce-customer    (port 8083)
start "S3 - Commerce and Customer" /d "%ROOT%S3-commerce-customer" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

echo [6/9] S4-order-logistics      (port 8084)
start "S4 - Order and Logistics" /d "%ROOT%S4-order-logistics" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

echo [7/9] S5-fleet-operations     (port 8085)
start "S5 - Fleet Operations" /d "%ROOT%S5-fleet-operations" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

echo [8/9] S6-finance-support      (port 8086)
start "S6 - Finance and Support" /d "%ROOT%S6-finance-support" cmd /k "%MVN% spring-boot:run"
timeout /t 5 /nobreak >nul

rem ---- 4. api-gateway (last) -------------------------------------------------
echo [9/9] api-gateway             (port 8080)
start "API Gateway" /d "%ROOT%api-gateway" cmd /k "%MVN% spring-boot:run"

echo.
echo All windows have been launched. The services need a minute or two to finish starting.
echo   Frontend:        http://localhost:4200   (after "npm install" finishes)
echo   Eureka console:  http://localhost:8761
echo   API gateway:     http://localhost:8080
echo.
echo You can close this window - the services keep running in their own windows.
endlocal
exit /b 0

:fail
echo.
pause
endlocal
exit /b 1
