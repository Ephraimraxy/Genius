$content = Get-Content 'd:\Junks\TODAY\Publish AI\server.ts'
$newFunc = Get-Content 'd:\Junks\TODAY\Publish AI\tmp\new_func.ts'

# Line 4421 is index 4420. Before is 0..4419.
$before = $content[0..4419]
$after = $content[4430..($content.Length-1)]

$newContent = $before + $newFunc + $after
$newContent | Set-Content 'd:\Junks\TODAY\Publish AI\server.ts'

# Refresh content for next fix
$content = Get-Content 'd:\Junks\TODAY\Publish AI\server.ts'

# Line 4091 is index 4090.
if ($content[4090] -like "*volRes*") {
    $fixedLog = '    console.log(`[DEBUG] Formatting paper ${id}: PaperVol=${paper.volume}, FinalVol=${branding.volume}`);'
    if ($content[4091] -like "*SettingVol=*") {
        $beforeVol = $content[0..4089]
        $afterVol = $content[4092..($content.Length-1)]
        $newContent = $beforeVol + $fixedLog + $afterVol
        $newContent | Set-Content 'd:\Junks\TODAY\Publish AI\server.ts'
    } else {
        $content[4090] = $fixedLog
        $content | Set-Content 'd:\Junks\TODAY\Publish AI\server.ts'
    }
}
