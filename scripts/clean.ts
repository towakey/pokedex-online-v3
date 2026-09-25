import { readdirSync, rmSync, unlinkSync, lstatSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function cleanDirectory(dirPath: string) {
  if (!existsSync(dirPath)) return

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name)
      if (entry.isDirectory()) {
        cleanDirectory(fullPath)
        try {
          rmSync(fullPath, { recursive: true, force: true })
        }
        catch {
        }
      }
      else {
        try {
          unlinkSync(fullPath)
        }
        catch {
        }
      }
    }
    rmSync(dirPath, { recursive: true, force: true })
  }
  catch {
  }
}

const distPath = resolve(process.cwd(), 'dist')
if (existsSync(distPath)) {
  try {
    const stat = lstatSync(distPath)
    if (stat.isSymbolicLink()) {
      unlinkSync(distPath)
    }
    else {
      cleanDirectory(distPath)
    }
  }
  catch {
  }
}

const outputPath = resolve(process.cwd(), '.output')
cleanDirectory(outputPath)
