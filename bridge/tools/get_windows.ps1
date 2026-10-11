$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
$tasks = tasklist /v /fo csv | ConvertFrom-Csv | Where-Object {
    $_.'Window Title' -and 
    $_.'Window Title' -ne 'N/A' -and 
    $_.'Window Title' -ne '' -and
    $_.'Window Title' -notmatch '^(OleMainThreadWndName|OLEChannelWnd|BroadcastListenerWindow|DWM Notification Window|Task Host Window|Settings|Default IME|MSCTFIME UI)$' -and
    $_.'Window Title' -notmatch '^\.NET-BroadcastEvent' -and
    $_.'Window Title' -notmatch '^\{[0-9A-Fa-f-]+\}'
}

$results = @()
foreach ($t in $tasks) {
    $img = $t.'Image Name'
    $title = $t.'Window Title'
    if ($img -match '^(svchost|dllhost|conhost|unsecapp|SearchHost|StartMenuExperienceHost|ShellExperienceHost|RuntimeBroker)\.exe$') {
        continue
    }
    $results += "$img | $title"
}

$results | Out-String
