@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM  test-api.cmd - Live smoke test of the running LBOS platform (Eureka,
REM  Gateway, and a representative call into each business service).
REM
REM  Converted from test-api.ps1. Uses curl.exe (built into Windows 10 1803+
REM  and Windows 11) instead of Invoke-RestMethod, and hand-rolled text
REM  extraction instead of real JSON parsing - batch has no JSON parser.
REM  Every response this script reads is single-line (curl -s output, never
REM  pretty-printed), so extraction just reads the one line and strips up to
REM  a "field":"value" or "field":number marker with delayed-expansion
REM  substitution. Embedding a literal double-quote inside a batch
REM  substitution pattern needs care: findstr-with-backslash-escaped-quotes
REM  (the natural instinct coming from JSON/C string literals) is NOT valid
REM  cmd.exe syntax and silently breaks everything downstream - confirmed
REM  live. What actually works: a literal `"` typed directly into a
REM  `!VAR:*"field":"=!` substitution pattern is fine (also confirmed live);
REM  the one place a *runtime* quote character is needed (cutting a value
REM  off at its closing quote) uses a `set QUOTE="` variable expanded via
REM  %QUOTE% - see :extract_string_field below.
REM
REM  Assumes the platform is already running (see start-all.cmd).
REM  Unauthenticated checks (Eureka, Gateway reachability, "unauthenticated
REM  request is rejected") always run. Authenticated checks require a real
REM  login - pass /email:.../password:... for an existing, active account; if
REM  omitted, every check needing a token is SKIPPED (not silently PASS/FAIL).
REM
REM  USAGE
REM    scripts\test-api.cmd [/gateway:URL] [/eureka:URL] [/email:E] [/password:P]
REM
REM  EXAMPLES
REM    scripts\test-api.cmd
REM    scripts\test-api.cmd /email:admin@example.com /password:Correct-Horse-1
REM ============================================================================

set QUOTE="
REM A literal backslash-quote pair: needed only when building a value that
REM will itself be passed as a QUOTED ARGUMENT TO ANOTHER PROGRAM (curl) -
REM curl's own argv parser (the standard Windows convention, unrelated to
REM cmd.exe's own quoting rules) treats \" as a literal embedded quote and
REM bare " as a mode-toggle it strips. Confirmed live: LOGIN_BODY built with
REM raw %QUOTE% instead of this came out of curl.exe as
REM {email:admin@x,password:y} - EVERY quote silently stripped, invalid
REM JSON, 400 from the server. %QUOTE% alone (no backslash) is still correct
REM for the :extract_string_field/:extract_number_field helpers below, since
REM those only ever substitute inside cmd's OWN delayed-expansion string
REM handling, never through a second program's argv parser.
set BSQ=\%QUOTE%
set "GATEWAYBASEURL=http://localhost:8080"
set "EUREKABASEURL=http://localhost:8761"
set "EMAIL="
set "PASSWORD="

:parse_args
if "%~1"=="" goto args_done
set "ARG=%~1"
for /f "tokens=1* delims=:" %%K in ("%ARG%") do (
    if /i "%%K"=="/gateway" set "GATEWAYBASEURL=%%L"
    if /i "%%K"=="/eureka" set "EUREKABASEURL=%%L"
    if /i "%%K"=="/email" set "EMAIL=%%L"
    if /i "%%K"=="/password" set "PASSWORD=%%L"
)
shift
goto parse_args
:args_done

where curl >nul 2>&1
if errorlevel 1 (
    echo ERROR: curl was not found on PATH. Windows 10 1803+/Windows 11 ship it at C:\Windows\System32\curl.exe - check your PATH.
    exit /b 1
)

set "TMP_DIR=%TEMP%\lbos-test-api"
if not exist "%TMP_DIR%" mkdir "%TMP_DIR%" >nul 2>&1
set "FAILCOUNT=0"

REM ---- 1. Eureka health ----
curl -s -o "%TMP_DIR%\eureka-health.json" -w "%%{http_code}" "%EUREKABASEURL%/actuator/health" > "%TMP_DIR%\eureka-status.txt" 2>nul
set /p EUREKA_STATUS=<"%TMP_DIR%\eureka-status.txt"
if "%EUREKA_STATUS%"=="200" (
    set "EUREKA_HEALTH_STATUS="
    call :extract_string_field "%TMP_DIR%\eureka-health.json" status EUREKA_HEALTH_STATUS
    if "!EUREKA_HEALTH_STATUS!"=="UP" (
        call :report PASS "Eureka health" "status=UP"
    ) else (
        call :report FAIL "Eureka health" "200 but status=!EUREKA_HEALTH_STATUS!"
    )
) else (
    call :report FAIL "Eureka health" "HTTP %EUREKA_STATUS%"
)

REM ---- 2. Gateway reachable + unauthenticated request correctly rejected ----
REM /api/v1/cart, not /api/v1/products: product browsing is intentionally
REM public (no token needed) per the Gateway's own route rules - cart access
REM always requires a CUSTOMER token, so it reliably 401s with none.
curl -s -o nul -w "%%{http_code}" "%GATEWAYBASEURL%/api/v1/cart" > "%TMP_DIR%\unauth-status.txt" 2>nul
set /p UNAUTH_STATUS=<"%TMP_DIR%\unauth-status.txt"
if "%UNAUTH_STATUS%"=="401" (
    call :report PASS "Gateway rejects unauthenticated request" "401 as expected"
) else (
    call :report FAIL "Gateway rejects unauthenticated request" "expected 401, got %UNAUTH_STATUS%"
)

if "%EMAIL%"=="" goto no_login
if "%PASSWORD%"=="" goto no_login
goto do_login

:no_login
call :report SKIP "Login" "no /email:/password: supplied; all authenticated checks below are skipped, not failed"
call :report SKIP "S3 product listing" "requires login"
call :report SKIP "S4 order listing" "requires login"
call :report SKIP "S5 vehicle availability" "requires login"
call :report SKIP "S6 payment listing" "requires login"
call :report SKIP "Cross-service flow (product detail via S3)" "requires login"
goto summary

:do_login
REM Built with %BSQ% (a literal \" so curl's OWN argv parser keeps the quote
REM instead of stripping it as a mode-toggle - see the header comment).
REM Originally written with literal \" typed directly in this set statement,
REM which cmd.exe's OWN parser choked on: an unbalanced-looking quote count
REM on that line threw off cmd's quote-balance state for the whole rest of
REM the file, traced live to :summary's block printing once, oddly early,
REM then again correctly at the real end (FAILCOUNT/exit code were
REM unaffected, but the output was confusing). %BSQ%/%QUOTE% sidestep that
REM because the SOURCE line itself has no literal " beyond the set "..."
REM wrapper - the backslash and quote only appear after percent-expansion.
set "LOGIN_BODY={%BSQ%email%BSQ%:%BSQ%%EMAIL%%BSQ%,%BSQ%password%BSQ%:%BSQ%%PASSWORD%%BSQ%}"
curl -s -o "%TMP_DIR%\login.json" -w "%%{http_code}" -X POST "%GATEWAYBASEURL%/api/v1/auth/login" -H "Content-Type: application/json" -d "%LOGIN_BODY%" > "%TMP_DIR%\login-status.txt" 2>nul
set /p LOGIN_STATUS=<"%TMP_DIR%\login-status.txt"

set "ACCESSTOKEN="
set "ROLE="
if "%LOGIN_STATUS%"=="200" (
    call :extract_string_field "%TMP_DIR%\login.json" accessToken ACCESSTOKEN
    call :extract_string_field "%TMP_DIR%\login.json" role ROLE
)

if defined ACCESSTOKEN (
    call :report PASS "Login" "role=!ROLE!"
) else (
    call :report FAIL "Login" "HTTP %LOGIN_STATUS%, no accessToken in response"
    goto summary
)

REM ---- 3. S3 product listing ----
curl -s -o "%TMP_DIR%\products.json" -w "%%{http_code}" "%GATEWAYBASEURL%/api/v1/products?page=0&size=5" -H "Authorization: Bearer !ACCESSTOKEN!" > "%TMP_DIR%\products-status.txt" 2>nul
set /p PRODUCTS_STATUS=<"%TMP_DIR%\products-status.txt"
set "FIRSTPRODUCTID="
if "%PRODUCTS_STATUS%"=="200" (
    call :report PASS "S3 product listing" "call succeeded"
    call :extract_number_field "%TMP_DIR%\products.json" id FIRSTPRODUCTID
) else if "%PRODUCTS_STATUS%"=="403" (
    call :report SKIP "S3 product listing" "403 - this account's role cannot browse products (expected for some roles)"
) else (
    call :report FAIL "S3 product listing" "HTTP %PRODUCTS_STATUS%"
)

REM ---- 4. S4 order/logistics listing ----
curl -s -o nul -w "%%{http_code}" "%GATEWAYBASEURL%/api/orders" -H "Authorization: Bearer !ACCESSTOKEN!" > "%TMP_DIR%\orders-status.txt" 2>nul
set /p ORDERS_STATUS=<"%TMP_DIR%\orders-status.txt"
if "%ORDERS_STATUS%"=="200" (
    call :report PASS "S4 order listing" "call succeeded"
) else if "%ORDERS_STATUS%"=="403" (
    call :report SKIP "S4 order listing" "403 - this account's role cannot list orders (expected for some roles)"
) else (
    call :report FAIL "S4 order listing" "HTTP %ORDERS_STATUS%"
)

REM ---- 5. S5 vehicle availability ----
curl -s -o nul -w "%%{http_code}" "%GATEWAYBASEURL%/api/vehicles/available" -H "Authorization: Bearer !ACCESSTOKEN!" > "%TMP_DIR%\vehicles-status.txt" 2>nul
set /p VEHICLES_STATUS=<"%TMP_DIR%\vehicles-status.txt"
if "%VEHICLES_STATUS%"=="200" (
    call :report PASS "S5 vehicle availability" "call succeeded"
) else if "%VEHICLES_STATUS%"=="403" (
    call :report SKIP "S5 vehicle availability" "403 - this account's role is not FLEET_MANAGER/SUPER_ADMIN (expected for most roles)"
) else (
    call :report FAIL "S5 vehicle availability" "HTTP %VEHICLES_STATUS%"
)

REM ---- 6. S6 payment listing ----
curl -s -o nul -w "%%{http_code}" "%GATEWAYBASEURL%/api/payment-transactions" -H "Authorization: Bearer !ACCESSTOKEN!" > "%TMP_DIR%\payments-status.txt" 2>nul
set /p PAYMENTS_STATUS=<"%TMP_DIR%\payments-status.txt"
if "%PAYMENTS_STATUS%"=="200" (
    call :report PASS "S6 payment listing" "call succeeded"
) else if "%PAYMENTS_STATUS%"=="403" (
    call :report SKIP "S6 payment listing" "403 - this account's role cannot list payments (expected for some roles)"
) else (
    call :report FAIL "S6 payment listing" "HTTP %PAYMENTS_STATUS%"
)

REM ---- 7. Cross-service flow: use a product this run actually discovered ----
if defined FIRSTPRODUCTID (
    curl -s -o "%TMP_DIR%\product-detail.json" -w "%%{http_code}" "%GATEWAYBASEURL%/api/v1/products/!FIRSTPRODUCTID!" -H "Authorization: Bearer !ACCESSTOKEN!" > "%TMP_DIR%\product-detail-status.txt" 2>nul
    set /p DETAIL_STATUS=<"%TMP_DIR%\product-detail-status.txt"
    if "!DETAIL_STATUS!"=="200" (
        set "PRODNAME="
        call :extract_string_field "%TMP_DIR%\product-detail.json" name PRODNAME
        call :report PASS "Cross-service flow (product detail via S3)" "productId=!FIRSTPRODUCTID!, name=!PRODNAME!"
    ) else (
        call :report FAIL "Cross-service flow (product detail via S3)" "HTTP !DETAIL_STATUS!"
    )
) else (
    call :report SKIP "Cross-service flow (product detail via S3)" "no product id discovered by the earlier product-listing check (empty catalogue, or that check was skipped/failed)"
)

:summary
echo.
echo ==================== Summary ====================
if "%FAILCOUNT%"=="0" (
    echo No failures ^(some checks may have been SKIPPED - see above^).
    endlocal
    exit /b 0
) else (
    echo %FAILCOUNT% check^(s^) FAILED.
    endlocal
    exit /b 1
)


:report
REM %1=status(PASS/FAIL/SKIP) %2=check name %3=detail
echo [%~1] %~2 - %~3
if /i "%~1"=="FAIL" set /a FAILCOUNT+=1
goto :eof


:extract_string_field
REM %1=json file  %2=field name (bare, no quotes)  %3=output variable name
REM Finds the FIRST "<field>":"<value>" occurrence in the (single-line) file.
set "EJF_FIELD=%~2"
set "EJF_LINE="
set /p EJF_LINE=<"%~1"
set "EJF_AFTER=!EJF_LINE:*"%EJF_FIELD%":"=!"
if "!EJF_AFTER!"=="!EJF_LINE!" (
    set "%~3="
    goto :eof
)
set "EJF_MARKED=!EJF_AFTER:%QUOTE%=~!"
for /f "tokens=1 delims=~" %%V in ("!EJF_MARKED!") do set "%~3=%%V"
goto :eof


:extract_number_field
REM %1=json file  %2=field name (bare, no quotes)  %3=output variable name
REM Finds the FIRST "<field>":<number> occurrence (no quotes around the
REM value) in the (single-line) file.
set "ENF_FIELD=%~2"
set "ENF_LINE="
set /p ENF_LINE=<"%~1"
set "ENF_AFTER=!ENF_LINE:*"%ENF_FIELD%":=!"
if "!ENF_AFTER!"=="!ENF_LINE!" (
    set "%~3="
    goto :eof
)
for /f "tokens=1 delims=,}" %%V in ("!ENF_AFTER!") do set "%~3=%%V"
goto :eof
