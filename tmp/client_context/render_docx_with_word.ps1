param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$resolvedSource = (Resolve-Path -LiteralPath $SourceDirectory).Path

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $word.Options.SaveNormalPrompt = $false

    foreach ($sourceFile in Get-ChildItem -LiteralPath $resolvedSource -Filter '*.docx' -File) {
        $document = $null
        try {
            $workingCopy = Join-Path $resolvedOutput ($sourceFile.BaseName + '-working.docx')
            Copy-Item -LiteralPath $sourceFile.FullName -Destination $workingCopy -Force
            Unblock-File -LiteralPath $workingCopy
            $document = $word.Documents.Open(
                $workingCopy,
                $false,
                $true,
                $false,
                '',
                '',
                $false,
                '',
                '',
                0,
                0,
                $false,
                $true,
                0,
                $true
            )
            $outputPdf = Join-Path $resolvedOutput ($sourceFile.BaseName + '.pdf')
            $document.ExportAsFixedFormat($outputPdf, 17)
            [pscustomobject]@{
                Source = $sourceFile.FullName
                Output = $outputPdf
                Pages  = $document.ComputeStatistics(2)
            }
        }
        finally {
            if ($null -ne $document) {
                $document.Close(0)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
            }
            if ($workingCopy -and (Test-Path -LiteralPath $workingCopy)) {
                Remove-Item -LiteralPath $workingCopy -Force
            }
        }
    }
}
finally {
    if ($null -ne $word) {
        $word.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
