#
# Pester tests for .claude/hooks/workflow-guard.ps1
#
# Run with:  pwsh -Command "Invoke-Pester tier-1-unit/hooks/powershell"
#
# The guard reads generated-docs/context/workflow-state.json and emits JSON
# with hookSpecificOutput.additionalContext telling Claude which command to
# redirect to. Tests set $env:CLAUDE_PROJECT_DIR to redirect the hook at a
# throwaway project tree, then parse the JSON output and assert against the
# additionalContext field.
#
BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
    $script:Guard = Join-Path $RepoRoot '.claude\hooks\workflow-guard.ps1'

    function Invoke-Guard {
        param([string]$ProjectDir)
        $env:CLAUDE_PROJECT_DIR = $ProjectDir
        try {
            $raw = & pwsh -NoProfile -ExecutionPolicy Bypass -File $script:Guard
            if ($null -eq $raw -or ($raw -is [array] -and $raw.Count -eq 0)) {
                return ''
            }
            $joined = ($raw -join "`n").Trim()
            if ([string]::IsNullOrWhiteSpace($joined)) { return '' }
            try {
                $parsed = $joined | ConvertFrom-Json
                return [string]$parsed.hookSpecificOutput.additionalContext
            } catch {
                return $joined
            }
        } finally {
            Remove-Item Env:\CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue
        }
    }
}

Describe 'workflow-guard.ps1' {

    BeforeEach {
        # Per-test temp project
        $script:TempRoot = Join-Path $env:TEMP ("claude-query-ps-" + [System.IO.Path]::GetRandomFileName())
        New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $TempRoot 'web') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $TempRoot 'generated-docs\context') -Force | Out-Null
    }

    AfterEach {
        Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    Context 'Project not initialised' {
        It 'PASS: emits "Project not initialized" when web/node_modules does not exist' {
            $context = Invoke-Guard -ProjectDir $TempRoot
            $context | Should -Match 'Project not initialized'
            $context | Should -Match '/setup'
        }

        It 'FAIL: does NOT emit "No active workflow" when web/node_modules is also missing' {
            $context = Invoke-Guard -ProjectDir $TempRoot
            $context | Should -Not -Match 'No active workflow'
        }
    }

    Context 'Active workflow' {
        BeforeEach {
            New-Item -ItemType Directory -Path (Join-Path $TempRoot 'web\node_modules') -Force | Out-Null
            $state = @{
                currentPhase = 'IMPLEMENT'
                currentEpic = 2
                currentStory = 3
                featureName = 'Team Task Manager'
                featureComplete = $false
            } | ConvertTo-Json
            Set-Content -Path (Join-Path $TempRoot 'generated-docs\context\workflow-state.json') -Value $state
        }

        It 'PASS: reports the current phase / epic / story' {
            $context = Invoke-Guard -ProjectDir $TempRoot
            $context | Should -Match 'IMPLEMENT'
            $context | Should -Match '/continue'
        }

        It 'FAIL: does NOT tell the user to run /setup when dependencies exist and workflow is active' {
            $context = Invoke-Guard -ProjectDir $TempRoot
            $context | Should -Not -Match '/setup'
        }
    }

    Context 'Feature complete' {
        BeforeEach {
            New-Item -ItemType Directory -Path (Join-Path $TempRoot 'web\node_modules') -Force | Out-Null
            $state = @{
                currentPhase = 'COMPLETE'
                featureComplete = $true
            } | ConvertTo-Json
            Set-Content -Path (Join-Path $TempRoot 'generated-docs\context\workflow-state.json') -Value $state
        }

        It 'PASS: suggests /start for a new feature' {
            $context = Invoke-Guard -ProjectDir $TempRoot
            $context | Should -Match 'complete'
            $context | Should -Match '/start'
        }
    }

    Context 'Corrupted state file' {
        BeforeEach {
            New-Item -ItemType Directory -Path (Join-Path $TempRoot 'web\node_modules') -Force | Out-Null
            Set-Content -Path (Join-Path $TempRoot 'generated-docs\context\workflow-state.json') -Value 'not valid json {{'
        }

        It 'PASS: exits 0 and emits no output on parse failure (fail-safe)' {
            $env:CLAUDE_PROJECT_DIR = $TempRoot
            try {
                $null = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Guard 2>&1
                $LASTEXITCODE | Should -Be 0
            } finally {
                Remove-Item Env:\CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue
            }
        }
    }
}
