param(
  [string]$ApiBaseUrl = "",
  [string]$AdminEmail = "anhnguyen8761@gmail.com",
  [bool]$UsePlusAlias = $true,
  [string]$AdminPassword = "Password1!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
  if ($env:API_BASE_URL) {
    $ApiBaseUrl = $env:API_BASE_URL
  } else {
    $ApiBaseUrl = "http://127.0.0.1:3000"
  }
}

$ApiBaseUrl = $ApiBaseUrl.TrimEnd("/")

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")] [string]$Method,
    [Parameter(Mandatory = $true)] [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{
    Uri         = $Url
    Method      = $Method
    Headers     = $Headers
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
    $params["ContentType"] = "application/json"
  }

  try {
    $response = Invoke-WebRequest @params
    $status = [int]$response.StatusCode
    $content = [string]$response.Content
    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      $parsed = $content | ConvertFrom-Json
    }

    return [pscustomobject]@{
      Status = $status
      Body   = $parsed
      Raw    = $content
    }
  } catch {
    if ($_.Exception.Response) {
      $httpResponse = $_.Exception.Response
      $status = [int]$httpResponse.StatusCode
      $stream = $httpResponse.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $content = $reader.ReadToEnd()
      $reader.Dispose()

      $parsed = $null
      if (-not [string]::IsNullOrWhiteSpace($content)) {
        try {
          $parsed = $content | ConvertFrom-Json
        } catch {
          $parsed = $null
        }
      }

      return [pscustomobject]@{
        Status = $status
        Body   = $parsed
        Raw    = $content
      }
    }

    throw
  }
}

function Assert-Status {
  param(
    [Parameter(Mandatory = $true)] [object]$Response,
    [Parameter(Mandatory = $true)] [int]$ExpectedStatus,
    [Parameter(Mandatory = $true)] [string]$Step
  )

  if ($Response.Status -ne $ExpectedStatus) {
    Write-Host ""
    Write-Host "[$Step] FAILED" -ForegroundColor Red
    Write-Host "Expected status: $ExpectedStatus"
    Write-Host "Actual status:   $($Response.Status)"
    if ($Response.Raw) {
      Write-Host "Response body:"
      Write-Host $Response.Raw
    }
    exit 1
  }
}

function Build-RunEmail {
  param(
    [Parameter(Mandatory = $true)] [string]$BaseEmail,
    [Parameter(Mandatory = $true)] [bool]$EnableAlias,
    [Parameter(Mandatory = $true)] [string]$Suffix
  )

  if (-not $EnableAlias) {
    return $BaseEmail.ToLowerInvariant()
  }

  if ($BaseEmail -match "^(?<local>[^@]+)@(?<domain>[^@]+)$") {
    $local = $Matches["local"]
    $domain = $Matches["domain"]
    return ("{0}+authlive_{1}@{2}" -f $local, $Suffix, $domain).ToLowerInvariant()
  }

  return $BaseEmail.ToLowerInvariant()
}

$suffix = "{0}_{1}" -f (Get-Date -Format "yyyyMMddHHmmss"), (Get-Random -Minimum 1000 -Maximum 9999)
$runEmail = Build-RunEmail -BaseEmail $AdminEmail -EnableAlias $UsePlusAlias -Suffix $suffix
$tenantCode = ("AUTHLIVE_{0}" -f $suffix).ToUpperInvariant()

$registerPayload = @{
  tenantName     = "Auth Live Tenant $suffix"
  tenantCode     = $tenantCode
  adminFullName  = "Auth Live Admin $suffix"
  adminEmail     = $runEmail
  adminPassword  = $AdminPassword
}

Write-Host "== Auth Live Success Flow (manual code) ==" -ForegroundColor Cyan
Write-Host "API_BASE_URL: $ApiBaseUrl"
Write-Host "Email run nay: $runEmail"
Write-Host ""

# 1) health
$health = Invoke-JsonRequest -Method "GET" -Url "$ApiBaseUrl/health"
Assert-Status -Response $health -ExpectedStatus 200 -Step "health"
Write-Host "[OK] health"

# 2) register
$register = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/register-tenant" -Body $registerPayload
Assert-Status -Response $register -ExpectedStatus 200 -Step "register-tenant"
$registrationId = [string]$register.Body.data.registrationId
if ([string]::IsNullOrWhiteSpace($registrationId)) {
  Write-Host "[register-tenant] FAILED: registrationId missing." -ForegroundColor Red
  exit 1
}
Write-Host "[OK] register-tenant"
Write-Host "registrationId: $registrationId"
Write-Host ""

# 3) wait for manual verification code
$verificationCode = Read-Host "Nhap verification code 6 so tu email"
if ($verificationCode -notmatch "^\d{6}$") {
  Write-Host "Verification code khong hop le. Yeu cau dung dinh dang 6 chu so." -ForegroundColor Red
  exit 1
}

# 4) verify registration
$verifyPayload = @{
  registrationId  = $registrationId
  verificationCode = $verificationCode
}
$verify = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/register-tenant/verify" -Body $verifyPayload
Assert-Status -Response $verify -ExpectedStatus 200 -Step "register-tenant/verify"
Write-Host "[OK] register-tenant/verify"

# 5) login
$loginPayload = @{
  email    = $runEmail
  password = $AdminPassword
}
$login = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/login" -Body $loginPayload
Assert-Status -Response $login -ExpectedStatus 200 -Step "login"
$accessToken = [string]$login.Body.data.accessToken
$refreshToken = [string]$login.Body.data.refreshToken
if ([string]::IsNullOrWhiteSpace($accessToken) -or [string]::IsNullOrWhiteSpace($refreshToken)) {
  Write-Host "[login] FAILED: accessToken/refreshToken missing." -ForegroundColor Red
  exit 1
}
Write-Host "[OK] login"

# 6) me
$meHeaders = @{
  Authorization = "Bearer $accessToken"
}
$me = Invoke-JsonRequest -Method "GET" -Url "$ApiBaseUrl/api/auth/me" -Headers $meHeaders
Assert-Status -Response $me -ExpectedStatus 200 -Step "me"
Write-Host "[OK] me"

# 7) refresh
$refreshPayload = @{
  refreshToken = $refreshToken
}
$refresh = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/refresh" -Body $refreshPayload
Assert-Status -Response $refresh -ExpectedStatus 200 -Step "refresh"
$rotatedRefreshToken = [string]$refresh.Body.data.refreshToken
if ([string]::IsNullOrWhiteSpace($rotatedRefreshToken)) {
  Write-Host "[refresh] FAILED: rotated refreshToken missing." -ForegroundColor Red
  exit 1
}
Write-Host "[OK] refresh"

# 8) logout with rotated refresh token
$logoutPayload = @{
  refreshToken = $rotatedRefreshToken
}
$logout = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/logout" -Body $logoutPayload
Assert-Status -Response $logout -ExpectedStatus 200 -Step "logout"
Write-Host "[OK] logout"

# 9) ensure logged-out token can no longer refresh
$refreshAfterLogout = Invoke-JsonRequest -Method "POST" -Url "$ApiBaseUrl/api/auth/refresh" -Body $logoutPayload
Assert-Status -Response $refreshAfterLogout -ExpectedStatus 401 -Step "refresh after logout"
Write-Host "[OK] refresh after logout returns UNAUTHORIZED"

Write-Host ""
Write-Host "=== SUCCESS: Live success-flow completed ===" -ForegroundColor Green
Write-Host "Email tested: $runEmail"
Write-Host "Tenant code:  $tenantCode"
