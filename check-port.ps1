try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 9222)
    $tcp.Close()
    Write-Host "SUCCESS: Port 9222 is open!"
} catch {
    Write-Host "FAILED: Port 9222 is NOT open."
}
