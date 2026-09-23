pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(false)
    }

    environment {
        FRONTEND_PORT = '4200'

        EUREKA_PORT = '8761'
        S1_PORT = '8081'
        S2_PORT = '8082'
        S3_PORT = '8083'
        S4_PORT = '8084'
        S5_PORT = '8085'
        S6_PORT = '8086'
        GATEWAY_PORT = '8080'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Source code has already been checked out by Jenkins.'
            }
        }

        stage('Stop Old Applications') {
            steps {
                powershell '''
                    Write-Host "=========================================="
                    Write-Host "STOPPING OLD APPLICATIONS"
                    Write-Host "=========================================="

                    $ports = @(
                        8761,
                        8081,
                        8082,
                        8083,
                        8084,
                        8085,
                        8086,
                        8080,
                        4200
                    )

                    foreach ($port in $ports) {

                        $connections = Get-NetTCPConnection `
                            -LocalPort $port `
                            -State Listen `
                            -ErrorAction SilentlyContinue

                        foreach ($connection in $connections) {

                            $processId = $connection.OwningProcess

                            if ($processId -and $processId -ne 0) {

                                Write-Host "Stopping process $processId on port $port"

                                Stop-Process `
                                    -Id $processId `
                                    -Force `
                                    -ErrorAction SilentlyContinue
                            }
                        }
                    }

                    Start-Sleep -Seconds 3

                    Write-Host "Old applications stopped."
                '''
            }
        }

        stage('Configure Java Environment') {
            steps {
                powershell '''
                    Write-Host "=========================================="
                    Write-Host "CONFIGURING JAVA ENVIRONMENT"
                    Write-Host "=========================================="

                    $javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue

                    if (-not $javaCommand) {
                        Write-Error "java.exe was not found in PATH."
                        exit 1
                    }

                    $javaExe = $javaCommand.Source
                    $javaBin = Split-Path $javaExe -Parent
                    $javaHome = Split-Path $javaBin -Parent

                    $env:JAVA_HOME = $javaHome

                    Write-Host "Java executable:"
                    Write-Host $javaExe

                    Write-Host ""
                    Write-Host "JAVA_HOME:"
                    Write-Host $env:JAVA_HOME

                    Write-Host ""
                    Write-Host "Java version:"

                    & $javaExe -version 2>&1 |
                        ForEach-Object {
                            Write-Host $_
                        }

                    Write-Host ""
                    Write-Host "Checking Maven..."

                    $mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue

                    if (-not $mavenCommand) {
                        $mavenCommand = Get-Command mvn.exe -ErrorAction SilentlyContinue
                    }

                    if (-not $mavenCommand) {
                        Write-Error "Maven was not found in PATH."
                        exit 1
                    }

                    Write-Host "Maven executable:"
                    Write-Host $mavenCommand.Source

                    mvn -version

                    if ($LASTEXITCODE -ne 0) {
                        Write-Error "Maven validation failed."
                        exit 1
                    }

                    Write-Host ""
                    Write-Host "Java and Maven environment configured successfully."
                '''
            }
        }

        stage('Validate Environment') {
            steps {
                powershell '''
                    Write-Host "=========================================="
                    Write-Host "VALIDATING ENVIRONMENT"
                    Write-Host "=========================================="

                    if (-not (Get-Command java.exe -ErrorAction SilentlyContinue)) {
                        Write-Error "Java is not available."
                        exit 1
                    }

                    if (-not (Get-Command mvn.cmd -ErrorAction SilentlyContinue)) {
                        Write-Error "Maven is not available."
                        exit 1
                    }

                    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
                        Write-Error "Node.js is not available."
                        exit 1
                    }

                    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
                        Write-Error "NPM is not available."
                        exit 1
                    }

                    Write-Host ""
                    Write-Host "Java:"
                    java -version 2>&1 |
                        ForEach-Object {
                            Write-Host $_
                        }

                    Write-Host ""
                    Write-Host "Maven:"
                    mvn -version

                    if ($LASTEXITCODE -ne 0) {
                        Write-Error "Maven validation failed."
                        exit 1
                    }

                    Write-Host ""
                    Write-Host "Node:"
                    node --version

                    if ($LASTEXITCODE -ne 0) {
                        Write-Error "Node validation failed."
                        exit 1
                    }

                    Write-Host ""
                    Write-Host "NPM:"
                    npm --version

                    if ($LASTEXITCODE -ne 0) {
                        Write-Error "NPM validation failed."
                        exit 1
                    }

                    Write-Host ""
                    Write-Host "=========================================="
                    Write-Host "ENVIRONMENT VALIDATION SUCCESSFUL"
                    Write-Host "=========================================="
                '''
            }
        }

        // Frontend and backend are built independently of each other - neither reads the
        // other's build output at build time - so they run as two parallel branches instead
        // of one after another. Each branch keeps its own sub-stages sequential internally
        // (e.g. backend must Validate before it Builds), since only the FRONTEND-vs-BACKEND
        // ordering was ever incidental, not a real dependency.
        stage('Build Frontend & Backend') {
            parallel {
                stage('Frontend Build') {
                    stages {
                        stage('Frontend Install') {
                            steps {
                                dir('frontend') {
                                    powershell '''
                                        Write-Host "=========================================="
                                        Write-Host "INSTALLING FRONTEND DEPENDENCIES"
                                        Write-Host "=========================================="

                                        if (-not (Test-Path "package.json")) {
                                            Write-Error "frontend/package.json was not found."
                                            exit 1
                                        }

                                        if (Test-Path "package-lock.json") {

                                            Write-Host "Running npm ci..."

                                            npm ci --loglevel=error

                                            if ($LASTEXITCODE -ne 0) {
                                                Write-Error "npm ci failed."
                                                exit 1
                                            }

                                        } else {

                                            Write-Host "Running npm install..."

                                            npm install --loglevel=error

                                            if ($LASTEXITCODE -ne 0) {
                                                Write-Error "npm install failed."
                                                exit 1
                                            }
                                        }

                                        Write-Host ""
                                        Write-Host "Installing http-server..."

                                        npm install --no-save http-server --loglevel=error

                                        if ($LASTEXITCODE -ne 0) {
                                            Write-Error "http-server installation failed."
                                            exit 1
                                        }

                                        Write-Host ""
                                        Write-Host "Frontend dependencies installed successfully."
                                    '''
                                }
                            }
                        }

                        stage('Frontend Production Build') {
                            steps {
                                dir('frontend') {
                                    powershell '''
                                        Write-Host "=========================================="
                                        Write-Host "BUILDING ANGULAR FRONTEND"
                                        Write-Host "=========================================="

                                        npm run build

                                        if ($LASTEXITCODE -ne 0) {
                                            Write-Error "Angular production build failed."
                                            exit 1
                                        }

                                        $distPath = Join-Path `
                                            (Get-Location) `
                                            "dist\\frontend"

                                        if (-not (Test-Path $distPath)) {
                                            Write-Error "Frontend build directory was not created: $distPath"
                                            exit 1
                                        }

                                        Write-Host ""
                                        Write-Host "Frontend build directory:"
                                        Write-Host $distPath

                                        Write-Host ""
                                        Write-Host "Frontend production build completed successfully."
                                    '''
                                }
                            }
                        }
                    }
                }

                stage('Backend Build') {
                    stages {
                        stage('Validate Backend Structure') {
                            steps {
                                powershell '''
                                    Write-Host "=========================================="
                                    Write-Host "VALIDATING BACKEND STRUCTURE"
                                    Write-Host "=========================================="

                                    # Services live directly at the repo root in this layout (no "backend"
                                    # subdirectory) - this used to point at a "backend" folder that no longer
                                    # exists, which would fail this stage on a fresh checkout.
                                    $backendPath = (Get-Location).Path

                                    if (-not (Test-Path $backendPath)) {
                                        Write-Error "backend directory was not found: $backendPath"
                                        exit 1
                                    }

                                    $services = @(
                                        "eureka-server",
                                        "S1-platform-territory",
                                        "S2-partner-verification",
                                        "S3-commerce-customer",
                                        "S4-order-logistics",
                                        "S5-fleet-operations",
                                        "S6-finance-support",
                                        "api-gateway"
                                    )

                                    foreach ($service in $services) {

                                        $servicePath = Join-Path `
                                            $backendPath `
                                            $service

                                        $pomPath = Join-Path `
                                            $servicePath `
                                            "pom.xml"

                                        Write-Host ""
                                        Write-Host "Checking: $service"

                                        if (-not (Test-Path $servicePath)) {
                                            Write-Error "Service directory not found: $servicePath"
                                            exit 1
                                        }

                                        if (-not (Test-Path $pomPath)) {
                                            Write-Error "pom.xml not found: $pomPath"
                                            exit 1
                                        }

                                        Write-Host "Service directory: $servicePath"
                                        Write-Host "POM: $pomPath"
                                    }

                                    Write-Host ""
                                    Write-Host "=========================================="
                                    Write-Host "BACKEND STRUCTURE VALIDATED"
                                    Write-Host "=========================================="
                                '''
                            }
                        }

                        stage('Backend Build All Services') {
                            steps {
                                powershell '''
                                    Write-Host "=========================================="
                                    Write-Host "BUILDING ALL BACKEND SERVICES"
                                    Write-Host "=========================================="

                                    # Services live directly at the repo root in this layout (no "backend"
                                    # subdirectory) - this used to point at a "backend" folder that no longer
                                    # exists, which would fail this stage on a fresh checkout.
                                    $backendPath = (Get-Location).Path

                                    $services = @(
                                        "eureka-server",
                                        "S1-platform-territory",
                                        "S2-partner-verification",
                                        "S3-commerce-customer",
                                        "S4-order-logistics",
                                        "S5-fleet-operations",
                                        "S6-finance-support",
                                        "api-gateway"
                                    )

                                    foreach ($service in $services) {

                                        $servicePath = Join-Path `
                                            $backendPath `
                                            $service

                                        Write-Host ""
                                        Write-Host "=========================================="
                                        Write-Host "BUILDING $service"
                                        Write-Host "=========================================="

                                        Push-Location $servicePath

                                        try {

                                            mvn clean package -DskipTests

                                            if ($LASTEXITCODE -ne 0) {
                                                Write-Error "$service build failed."
                                                exit 1
                                            }

                                        }
                                        finally {
                                            Pop-Location
                                        }

                                        Write-Host ""
                                        Write-Host "$service build completed successfully."
                                    }

                                    Write-Host ""
                                    Write-Host "=========================================="
                                    Write-Host "ALL BACKEND SERVICES BUILT SUCCESSFULLY"
                                    Write-Host "=========================================="
                                '''
                            }
                        }

                        stage('Verify Build Outputs') {
                            steps {
                                powershell '''
                                    Write-Host "=========================================="
                                    Write-Host "VERIFYING BUILD OUTPUTS"
                                    Write-Host "=========================================="

                                    # Services live directly at the repo root in this layout (no "backend"
                                    # subdirectory) - this used to point at a "backend" folder that no longer
                                    # exists, which would fail this stage on a fresh checkout.
                                    $backendPath = (Get-Location).Path

                                    $services = @(
                                        "eureka-server",
                                        "S1-platform-territory",
                                        "S2-partner-verification",
                                        "S3-commerce-customer",
                                        "S4-order-logistics",
                                        "S5-fleet-operations",
                                        "S6-finance-support",
                                        "api-gateway"
                                    )

                                    foreach ($service in $services) {

                                        $targetPath = Join-Path `
                                            (Join-Path $backendPath $service) `
                                            "target"

                                        Write-Host ""
                                        Write-Host "Checking JAR for $service..."

                                        if (-not (Test-Path $targetPath)) {
                                            Write-Error "Target directory not found: $targetPath"
                                            exit 1
                                        }

                                        $jar = Get-ChildItem `
                                            -Path $targetPath `
                                            -Filter "*.jar" `
                                            -File |
                                            Where-Object {
                                                $_.Name -notlike "*sources*" -and
                                                $_.Name -notlike "*javadoc*"
                                            } |
                                            Select-Object -First 1

                                        if (-not $jar) {
                                            Write-Error "No executable JAR found for $service."
                                            exit 1
                                        }

                                        Write-Host "JAR found:"
                                        Write-Host $jar.FullName
                                    }

                                    Write-Host ""
                                    Write-Host "=========================================="
                                    Write-Host "ALL JAR FILES VERIFIED SUCCESSFULLY"
                                    Write-Host "=========================================="
                                '''
                            }
                        }
                    }
                }
            }
        }

        stage('Start Backend Services') {
            steps {
                powershell '''
                    Write-Host "=========================================="
                    Write-Host "STARTING BACKEND SERVICES"
                    Write-Host "=========================================="

                    # Detach applications from Jenkins process cleanup.
                    $env:JENKINS_NODE_COOKIE = "AROUNDU_BACKEND"
                    $env:JENKINS_SERVER_COOKIE = "AROUNDU_BACKEND"

                    # Services live directly at the repo root in this layout (no "backend"
                    # subdirectory) - this used to point at a "backend" folder that no longer
                    # exists, which would fail this stage on a fresh checkout.
                    $backendPath = (Get-Location).Path

                    $javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue

                    if (-not $javaCommand) {
                        Write-Error "java.exe was not found."
                        exit 1
                    }

                    $javaExe = $javaCommand.Source

                    function Start-JavaService {

                        param(
                            [string]$ServiceName,
                            [string]$JarPath,
                            [int]$Port
                        )

                        Write-Host ""
                        Write-Host "=========================================="
                        Write-Host "STARTING $ServiceName"
                        Write-Host "PORT: $Port"
                        Write-Host "=========================================="

                        if (-not (Test-Path $JarPath)) {
                            Write-Error "JAR not found: $JarPath"
                            exit 1
                        }

                        $serviceDirectory = Split-Path `
                            $JarPath `
                            -Parent

                        $logDirectory = Join-Path `
                            $serviceDirectory `
                            "jenkins-logs"

                        New-Item `
                            -ItemType Directory `
                            -Path $logDirectory `
                            -Force |
                            Out-Null

                        $outputLog = Join-Path `
                            $logDirectory `
                            "$ServiceName-out.log"

                        $errorLog = Join-Path `
                            $logDirectory `
                            "$ServiceName-error.log"

                        $pidFile = Join-Path `
                            $logDirectory `
                            "$ServiceName.pid"

                        Remove-Item $outputLog -Force -ErrorAction SilentlyContinue
                        Remove-Item $errorLog -Force -ErrorAction SilentlyContinue
                        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

                        Write-Host "Java:"
                        Write-Host $javaExe

                        Write-Host "JAR:"
                        Write-Host $JarPath

                        Write-Host "Starting application..."

                        # Started via WMI (Win32_Process.Create), not Start-Process. A
                        # Start-Process child inherits this whole PowerShell process's handles
                        # (Windows CreateProcess does this by default once any std stream is
                        # redirected) - harmless for a short-lived child, but these services are
                        # meant to keep running well past this step. Jenkins' own durable-task
                        # wrapper for a `powershell` step nests a SECOND powershell.exe inside
                        # the first (see the generated powershellWrapper.ps1); a Start-Process
                        # child launched from that inner process ends up holding a handle into
                        # the wrapper's own output pipe, which then never reaches EOF as long as
                        # the service keeps running - so the step never reports back to Jenkins,
                        # even after everything printed successfully. This is exactly what left
                        # the pipeline stuck here. WMI process creation goes through a separate
                        # OS process (the WMI provider host) and inherits nothing from us,
                        # sidestepping the problem entirely. Confirmed by reproducing the hang in
                        # isolation (nested powershell.exe + Start-Process child that outlives the
                        # step) and confirming this WMI-based replacement resolves it, before
                        # applying it here.
                        $innerCommand = '"' + $javaExe + '" -jar "' + $JarPath + '" > "' + $outputLog + '" 2> "' + $errorLog + '"'
                        $commandLine = 'cmd.exe /c "' + $innerCommand + '"'

                        $result = Invoke-CimMethod `
                            -ClassName Win32_Process `
                            -MethodName Create `
                            -Arguments @{
                                CommandLine = $commandLine
                                CurrentDirectory = $serviceDirectory
                            }

                        if ($result.ReturnValue -ne 0) {
                            Write-Error "Failed to start $ServiceName (WMI ReturnValue=$($result.ReturnValue))."
                            exit 1
                        }

                        $processId = $result.ProcessId

                        $processId |
                            Out-File `
                                -FilePath $pidFile `
                                -Encoding ascii

                        Write-Host "$ServiceName started."
                        Write-Host "PID: $processId"

                        Write-Host ""
                        Write-Host "Waiting for port $Port..."

                        $maxAttempts = 90

                        for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {

                            Start-Sleep -Seconds 2

                            $connection = Get-NetTCPConnection `
                                -LocalPort $Port `
                                -State Listen `
                                -ErrorAction SilentlyContinue

                            if ($connection) {

                                Write-Host ""
                                Write-Host "$ServiceName is RUNNING on port $Port."

                                return
                            }

                            $runningProcess = Get-Process `
                                -Id $processId `
                                -ErrorAction SilentlyContinue

                            if (-not $runningProcess) {

                                Write-Host ""
                                Write-Host "$ServiceName FAILED TO START"

                                Write-Host ""
                                Write-Host "ERROR LOG:"
                                Write-Host "------------------------------------------"

                                if (Test-Path $errorLog) {
                                    Get-Content $errorLog -Tail 100
                                }

                                Write-Host ""
                                Write-Host "APPLICATION LOG:"
                                Write-Host "------------------------------------------"

                                if (Test-Path $outputLog) {
                                    Get-Content $outputLog -Tail 100
                                }

                                Write-Error "$ServiceName stopped before opening port $Port."
                                exit 1
                            }

                            Write-Host "Waiting for $ServiceName... $attempt/$maxAttempts"
                        }

                        Write-Host ""
                        Write-Host "$ServiceName STARTUP TIMEOUT"

                        Write-Host ""
                        Write-Host "ERROR LOG:"
                        Write-Host "------------------------------------------"

                        if (Test-Path $errorLog) {
                            Get-Content $errorLog -Tail 100
                        }

                        Write-Host ""
                        Write-Host "APPLICATION LOG:"
                        Write-Host "------------------------------------------"

                        if (Test-Path $outputLog) {
                            Get-Content $outputLog -Tail 100
                        }

                        Write-Error "$ServiceName did not open port $Port."
                        exit 1
                    }

                    $services = @(
                        @{
                            Name = "eureka-server"
                            Port = 8761
                        },
                        @{
                            Name = "S1-platform-territory"
                            Port = 8081
                        },
                        @{
                            Name = "S2-partner-verification"
                            Port = 8082
                        },
                        @{
                            Name = "S3-commerce-customer"
                            Port = 8083
                        },
                        @{
                            Name = "S4-order-logistics"
                            Port = 8084
                        },
                        @{
                            Name = "S5-fleet-operations"
                            Port = 8085
                        },
                        @{
                            Name = "S6-finance-support"
                            Port = 8086
                        },
                        @{
                            Name = "api-gateway"
                            Port = 8080
                        }
                    )

                    foreach ($service in $services) {

                        $servicePath = Join-Path `
                            $backendPath `
                            $service.Name

                        $targetPath = Join-Path `
                            $servicePath `
                            "target"

                        $jar = Get-ChildItem `
                            -Path $targetPath `
                            -Filter "*.jar" `
                            -File |
                            Where-Object {
                                $_.Name -notlike "*sources*" -and
                                $_.Name -notlike "*javadoc*"
                            } |
                            Select-Object -First 1

                        if (-not $jar) {
                            Write-Error "JAR not found for $($service.Name)."
                            exit 1
                        }

                        Start-JavaService `
                            -ServiceName $service.Name `
                            -JarPath $jar.FullName `
                            -Port $service.Port
                    }

                    Write-Host ""
                    Write-Host "=========================================="
                    Write-Host "ALL BACKEND SERVICES STARTED SUCCESSFULLY"
                    Write-Host "=========================================="

                    # Deliberately NOT calling `exit 0` here (falling off the end of the script
                    # naturally is what every other stage in this file already does). This alone
                    # turned out not to be the actual cause of this stage hanging - see the WMI
                    # comment inside Start-JavaService above for the real root cause and fix -
                    # but an explicit `exit` still isn't worth the risk: it terminates this
                    # step's powershell.exe immediately, which can skip the durable-task plugin's
                    # own completion bookkeeping that normally runs after the script returns.
                '''
            }
        }

        stage('Start Angular Frontend') {
            steps {
                dir('frontend') {
                    powershell '''
                        Write-Host "=========================================="
                        Write-Host "STARTING ANGULAR FRONTEND"
                        Write-Host "=========================================="

                        $env:JENKINS_NODE_COOKIE = "AROUNDU_FRONTEND"
                        $env:JENKINS_SERVER_COOKIE = "AROUNDU_FRONTEND"

                        $distDirectory = Join-Path `
                            (Get-Location) `
                            "dist\\frontend"

                        if (-not (Test-Path $distDirectory)) {
                            Write-Error "Frontend dist directory not found: $distDirectory"
                            exit 1
                        }

                        $browserDirectory = Join-Path `
                            $distDirectory `
                            "browser"

                        if (Test-Path (Join-Path $browserDirectory "index.html")) {
                            $distDirectory = $browserDirectory
                            Write-Host "Angular browser output detected."
                        }

                        $indexFile = Join-Path `
                            $distDirectory `
                            "index.html"

                        if (-not (Test-Path $indexFile)) {
                            Write-Error "index.html not found in $distDirectory"
                            exit 1
                        }

                        $httpServerCmd = Join-Path `
                            (Get-Location) `
                            "node_modules\\.bin\\http-server.cmd"

                        if (-not (Test-Path $httpServerCmd)) {
                            Write-Error "http-server.cmd not found: $httpServerCmd"
                            exit 1
                        }

                        $logDirectory = Join-Path `
                            (Get-Location) `
                            "jenkins-logs"

                        New-Item `
                            -ItemType Directory `
                            -Path $logDirectory `
                            -Force |
                            Out-Null

                        $outputLog = Join-Path `
                            $logDirectory `
                            "frontend-out.log"

                        $errorLog = Join-Path `
                            $logDirectory `
                            "frontend-error.log"

                        $pidFile = Join-Path `
                            $logDirectory `
                            "frontend.pid"

                        Remove-Item $outputLog -Force -ErrorAction SilentlyContinue
                        Remove-Item $errorLog -Force -ErrorAction SilentlyContinue
                        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

                        Write-Host ""
                        Write-Host "Frontend directory:"
                        Write-Host $distDirectory

                        Write-Host ""
                        Write-Host "Starting http-server on port 4200..."

                        # Started via WMI, not Start-Process - see the matching comment in
                        # Start-JavaService (the "Start Backend Services" stage) for why: a
                        # Start-Process child here would inherit a handle into the durable-task
                        # wrapper's own output pipe, which then never reaches EOF for as long as
                        # this long-running http-server keeps serving, silently stranding this
                        # step even after it printed success.
                        $innerCommand = '"' + $httpServerCmd + '" "' + $distDirectory + '" -p 4200 -c-1 --silent > "' + $outputLog + '" 2> "' + $errorLog + '"'
                        $commandLine = 'cmd.exe /c "' + $innerCommand + '"'

                        $result = Invoke-CimMethod `
                            -ClassName Win32_Process `
                            -MethodName Create `
                            -Arguments @{
                                CommandLine = $commandLine
                                CurrentDirectory = (Get-Location).Path
                            }

                        if ($result.ReturnValue -ne 0) {
                            Write-Error "Failed to start Angular frontend (WMI ReturnValue=$($result.ReturnValue))."
                            exit 1
                        }

                        $frontendProcessId = $result.ProcessId

                        $frontendProcessId |
                            Out-File `
                                -FilePath $pidFile `
                                -Encoding ascii

                        Write-Host ""
                        Write-Host "Angular frontend started."
                        Write-Host "PID: $frontendProcessId"

                        Write-Host ""
                        Write-Host "Waiting for port 4200..."

                        # Set on success and checked after the loop below, instead of calling
                        # `exit 0` from inside the loop - avoids terminating this step's
                        # powershell.exe before the durable-task plugin's own completion
                        # bookkeeping runs (see the "Start Backend Services" stage for more).
                        $frontendReady = $false

                        for ($attempt = 1; $attempt -le 60; $attempt++) {

                            Start-Sleep -Seconds 2

                            $connection = Get-NetTCPConnection `
                                -LocalPort 4200 `
                                -State Listen `
                                -ErrorAction SilentlyContinue

                            if ($connection) {

                                Write-Host ""
                                Write-Host "=========================================="
                                Write-Host "ANGULAR FRONTEND IS RUNNING ON PORT 4200"
                                Write-Host "=========================================="

                                $frontendReady = $true
                                break
                            }

                            $runningProcess = Get-Process `
                                -Id $frontendProcessId `
                                -ErrorAction SilentlyContinue

                            if (-not $runningProcess) {

                                Write-Host ""
                                Write-Host "FRONTEND ERROR LOG:"
                                Write-Host "------------------------------------------"

                                if (Test-Path $errorLog) {
                                    Get-Content $errorLog -Tail 100
                                }

                                Write-Host ""
                                Write-Host "FRONTEND OUTPUT LOG:"
                                Write-Host "------------------------------------------"

                                if (Test-Path $outputLog) {
                                    Get-Content $outputLog -Tail 100
                                }

                                Write-Error "Frontend stopped before opening port 4200."
                                exit 1
                            }

                            Write-Host "Waiting for frontend... $attempt/60"
                        }

                        if (-not $frontendReady) {

                            Write-Host ""
                            Write-Host "FRONTEND STARTUP TIMEOUT"

                            Write-Host ""
                            Write-Host "FRONTEND ERROR LOG:"
                            Write-Host "------------------------------------------"

                            if (Test-Path $errorLog) {
                                Get-Content $errorLog -Tail 100
                            }

                            Write-Host ""
                            Write-Host "FRONTEND OUTPUT LOG:"
                            Write-Host "------------------------------------------"

                            if (Test-Path $outputLog) {
                                Get-Content $outputLog -Tail 100
                            }

                            Write-Error "Angular frontend did not open port 4200."
                            exit 1
                        }
                    '''
                }
            }
        }

        stage('Final Service Verification') {
            steps {
                powershell '''
                    Write-Host "=========================================="
                    Write-Host "FINAL SERVICE VERIFICATION"
                    Write-Host "=========================================="

                    $ports = @(
                        8761,
                        8081,
                        8082,
                        8083,
                        8084,
                        8085,
                        8086,
                        8080,
                        4200
                    )

                    $allRunning = $true

                    foreach ($port in $ports) {

                        $connection = Get-NetTCPConnection `
                            -LocalPort $port `
                            -State Listen `
                            -ErrorAction SilentlyContinue

                        if ($connection) {
                            Write-Host "Port $port : RUNNING"
                        }
                        else {
                            Write-Host "Port $port : NOT RUNNING"
                            $allRunning = $false
                        }
                    }

                    Write-Host ""

                    if (-not $allRunning) {
                        Write-Error "One or more required services are not running."
                        exit 1
                    }

                    Write-Host "=========================================="
                    Write-Host "ALL SERVICES ARE RUNNING"
                    Write-Host "=========================================="
                '''
            }
        }
    }

    post {

        always {

            powershell '''
                Write-Host ""
                Write-Host "=========================================="
                Write-Host "COLLECTING SERVICE LOGS"
                Write-Host "=========================================="

                $logDirectories = @(
                    "eureka-server\\jenkins-logs",
                    "S1-platform-territory\\jenkins-logs",
                    "S2-partner-verification\\jenkins-logs",
                    "S3-commerce-customer\\jenkins-logs",
                    "S4-order-logistics\\jenkins-logs",
                    "S5-fleet-operations\\jenkins-logs",
                    "S6-finance-support\\jenkins-logs",
                    "api-gateway\\jenkins-logs",
                    "frontend\\jenkins-logs"
                )

                foreach ($directory in $logDirectories) {

                    if (Test-Path $directory) {
                        Write-Host "Logs available: $directory"
                    }
                    else {
                        Write-Host "No logs found: $directory"
                    }
                }

                Write-Host ""
                Write-Host "Log collection completed."
            '''

            archiveArtifacts(
                artifacts: '**/jenkins-logs/*.log,**/jenkins-logs/*.pid',
                allowEmptyArchive: true,
                fingerprint: true
            )
        }

        success {
            echo '=========================================='
            echo 'AROUNDU CI/CD PIPELINE COMPLETED SUCCESSFULLY'
            echo '=========================================='
        }

        failure {
            echo 'AROUNDU CI/CD PIPELINE FAILED. CHECK THE STAGE LOGS.'
        }
    }
}