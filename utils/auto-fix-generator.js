#!/usr/bin/env node

/**
 * Auto-fix Suggestions Generator (Phase 1.2)
 * 
 * Generates exact diff patches for simple, low-risk findings:
 * - Unused dependencies (package.json removal)
 * - console.log statements (removal)
 * - `: any` TypeScript types (suggest specific types)
 * - Missing semicolons (addition)
 * - Outdated npm dependencies (version updates)
 * 
 * Usage:
 *   node utils/auto-fix-generator.js <resultsPath> <workspaceDir>
 * 
 * Example:
 *   node utils/auto-fix-generator.js reports/owner_repo/audit-123/results.json workspace/owner_repo
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * Generate a unified diff patch string
 */
function generateUnifiedDiff(filePath, oldContent, newContent, context = 3) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Simple line-by-line diff for demonstration
  // In production, you'd want a more sophisticated diff algorithm
  const hunks = [];
  let i = 0, j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++; j++;
      continue;
    }
    
    // Found a difference - create a hunk
    const hunkStart = Math.max(0, i - context);
    const hunkEnd = Math.min(oldLines.length, i + context + 1);
    
    let hunk = `@@ -${hunkStart + 1},${hunkEnd - hunkStart} +${j + 1},${newLines.length - j} @@\n`;
    
    // Add context lines before
    for (let k = hunkStart; k < i; k++) {
      hunk += ` ${oldLines[k]}\n`;
    }
    
    // Add removed line
    if (i < oldLines.length) {
      hunk += `-${oldLines[i]}\n`;
      i++;
    }
    
    // Add added line
    if (j < newLines.length) {
      hunk += `+${newLines[j]}\n`;
      j++;
    }
    
    // Add context lines after
    const afterEnd = Math.min(oldLines.length, i + context);
    for (let k = i; k < afterEnd; k++) {
      hunk += ` ${oldLines[k]}\n`;
    }
    
    hunks.push(hunk);
    break; // Simplified - only handle one change per file for now
  }
  
  if (hunks.length === 0) return null;
  
  return `--- a/${filePath}\n+++ b/${filePath}\n${hunks.join('')}`;
}

/**
 * Generate auto-fix for console.log removal
 */
function generateConsoleLogFix(finding, fileContent) {
  if (!finding.line || !fileContent) return null;
  
  const lines = fileContent.split('\n');
  const targetLine = lines[finding.line - 1];
  
  if (!targetLine || !targetLine.includes('console.log')) return null;
  
  // Generate fix by removing the console.log line
  const newLines = [...lines];
  newLines.splice(finding.line - 1, 1);
  
  const patch = generateUnifiedDiff(finding.file, fileContent, newLines.join('\n'));
  
  return {
    type: 'diff',
    description: 'Remove console.log statement',
    patch
  };
}

/**
 * Generate auto-fix for unused dependencies
 */
function generateUnusedDepFix(finding, fileContent) {
  if (finding.file !== 'package.json' || !fileContent) return null;
  
  try {
    const pkg = JSON.parse(fileContent);
    const depName = finding.title.match(/Unused dependency: (.+)/)?.[1];
    
    if (!depName) return null;
    
    // Remove from dependencies or devDependencies
    const newPkg = { ...pkg };
    if (newPkg.dependencies?.[depName]) {
      delete newPkg.dependencies[depName];
    }
    if (newPkg.devDependencies?.[depName]) {
      delete newPkg.devDependencies[depName];
    }
    
    const newContent = JSON.stringify(newPkg, null, 2) + '\n';
    const patch = generateUnifiedDiff(finding.file, fileContent, newContent);
    
    return {
      type: 'diff',
      description: `Remove unused dependency: ${depName}`,
      patch
    };
  } catch {
    return null;
  }
}

/**
 * Generate auto-fix for `: any` types
 */
function generateAnyTypeFix(finding, fileContent) {
  if (!finding.line || !fileContent || !finding.file.endsWith('.ts')) return null;
  
  const lines = fileContent.split('\n');
  const targetLine = lines[finding.line - 1];
  
  if (!targetLine || !targetLine.includes(': any')) return null;
  
  // Suggest common type replacements
  const suggestions = {
    'params': 'Record<string, unknown>',
    'props': 'Record<string, unknown>',
    'config': 'Record<string, unknown>',
    'options': 'Record<string, unknown>',
    'data': 'Record<string, unknown>',
    'response': 'unknown',
    'error': 'Error | unknown',
    'event': 'Event',
    'callback': '() => void',
    'handler': '(event: Event) => void'
  };
  
  // Find the variable name
  const varMatch = targetLine.match(/(\w+)\s*:\s*any/);
  if (!varMatch) return null;
  
  const varName = varMatch[1];
  const suggestedType = suggestions[varName.toLowerCase()] || 'unknown';
  
  const newLine = targetLine.replace(': any', `: ${suggestedType}`);
  const newLines = [...lines];
  newLines[finding.line - 1] = newLine;
  
  const patch = generateUnifiedDiff(finding.file, fileContent, newLines.join('\n'));
  
  return {
    type: 'diff',
    description: `Replace ': any' with ': ${suggestedType}'`,
    patch,
    confidence: 'medium' // Since type suggestion might not be perfect
  };
}

/**
 * Generate auto-fix for outdated dependencies
 */
function generateOutdatedDepFix(finding) {
  const match = finding.description.match(/Update (.+) from (.+) to (.+)/);
  if (!match) return null;
  
  const [, depName, currentVersion, latestVersion] = match;
  
  return {
    type: 'command',
    description: `Update ${depName} to ${latestVersion}`,
    command: `npm install ${depName}@${latestVersion}`,
    confidence: 'high'
  };
}

/**
 * Apply auto-fix generation to all eligible findings
 */
async function generateAutoFixes(resultsPath, workspaceDir) {
  console.log(`🔧 Generating auto-fixes for ${resultsPath}`);
  
  // Read current results
  const data = JSON.parse(await readFile(resultsPath, 'utf8'));
  
  let fixableCount = 0;
  
  // Process each finding
  for (const result of data.results) {
    for (const finding of result.findings) {
      let autofix = null;
      let fileContent = null;
      
      // Read file content if needed
      if (finding.file && workspaceDir) {
        try {
          fileContent = await readFile(join(workspaceDir, finding.file), 'utf8');
        } catch {
          // File not accessible, skip
        }
      }
      
      // Generate fix based on finding type
      if (finding.title?.includes('console.log')) {
        autofix = generateConsoleLogFix(finding, fileContent);
      } else if (finding.title?.startsWith('Unused dependency:')) {
        autofix = generateUnusedDepFix(finding, fileContent);
      } else if (finding.title?.includes(': any')) {
        autofix = generateAnyTypeFix(finding, fileContent);
      } else if (finding.title?.includes('outdated') && finding.description?.includes('Update')) {
        autofix = generateOutdatedDepFix(finding);
      }
      
      // Add autofix to finding
      if (autofix) {
        finding.autofix = autofix;
        fixableCount++;
      }
    }
  }
  
  console.log(`✅ Generated auto-fixes for ${fixableCount} findings`);
  
  // Update summary
  data.summary.autoFixSuggestions = {
    totalFixable: fixableCount,
    generated: true
  };
  
  // Write updated results back
  await writeFile(resultsPath, JSON.stringify(data, null, 2));
  console.log(`💾 Updated results saved to ${resultsPath}`);
  
  return fixableCount;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath, workspaceDir] = process.argv.slice(2);
  
  if (!resultsPath) {
    console.error('Usage: node auto-fix-generator.js <resultsPath> [workspaceDir]');
    process.exit(1);
  }
  
  try {
    await generateAutoFixes(resultsPath, workspaceDir);
  } catch (error) {
    console.error('❌ Error generating auto-fixes:', error.message);
    process.exit(1);
  }
}

export { generateAutoFixes };