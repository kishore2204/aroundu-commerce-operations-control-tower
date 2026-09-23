# PowerShell startup script for LBOS microservices
$repoRoot = Resolve-Path "$PSScriptRoot\.."
$env:SPRING_PROFILES_ACTIVE = "postgres"

Write-Host "Starting Eureka Server..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$repoRoot\eureka-server`" && .\mvnw.cmd spring-boot:run > `"$repoRoot\logs\eureka-server.log`" 2>&1" -WindowStyle Hidden

Start-Sleep -Seconds 10

$services = @(
    @{ Name = "S1-platform-territory"; Port = 8081 },
    @{ Name = "S2-partner-verification"; Port = 8082 },
    @{ Name = "S3-commerce-customer"; Port = 8083 },
    @{ Name = "S4-order-logistics"; Port = 8084 },
    @{ Name = "S5-fleet-operations"; Port = 8085 },
    @{ Name = "S6-finance-support"; Port = 8086 },
    @{ Name = "api-gateway"; Port = 8080 }
)

foreach ($svc in $services) {
    $svcName = $svc.Name
    Write-Host "Starting $svcName..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$repoRoot\$svcName`" && .\mvnw.cmd -Dspring.profiles.active=postgres spring-boot:run > `"$repoRoot\logs\$svcName.log`" 2>&1" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

Write-Host "All background processes spawned successfully!"
