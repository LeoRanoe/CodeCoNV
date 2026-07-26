param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path

$workingCopy = Join-Path $resolvedOutput ([IO.Path]::GetFileName($resolvedSource))
Copy-Item -LiteralPath $resolvedSource -Destination $workingCopy -Force
Unblock-File -LiteralPath $workingCopy

$excel = $null
$workbook = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false
    $excel.EnableEvents = $false

    $workbook = $excel.Workbooks.Open(
        $workingCopy,
        0,
        $true,
        5,
        '',
        '',
        $true
    )

    $xlsxPath = Join-Path $resolvedOutput ([IO.Path]::GetFileNameWithoutExtension($resolvedSource) + '.xlsx')
    $pdfPath = Join-Path $resolvedOutput ([IO.Path]::GetFileNameWithoutExtension($resolvedSource) + '.pdf')
    $workbook.SaveAs($xlsxPath, 51)
    $workbook.ExportAsFixedFormat(0, $pdfPath)

    [pscustomobject]@{
        Source = $resolvedSource
        Xlsx   = $xlsxPath
        Pdf    = $pdfPath
        Sheets = $workbook.Worksheets.Count
    }
}
finally {
    if ($null -ne $workbook) {
        $workbook.Close($false)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
    }
    if ($null -ne $excel) {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
