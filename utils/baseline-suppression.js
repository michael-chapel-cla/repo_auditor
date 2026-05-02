#!/usr/bin/env node

/**
 * Baseline Suppression Utility (Phase 1.1)
 * 
 * Compares current audit findings against the most recent previous audit
 * for the same repository. Marks each finding as "new" or "existing".
 * 
 * Usage:
 *   node utils/baseline-suppression.js <currentResultsPath> <reportsDir>
 * 
 * Example:
 *   node utils/baseline-suppression.js reports/owner_repo/audit-123/results.json reports/
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname, basename } from 'path';

/**
 * Generate a stable fingerprint for a finding to enable comparison
 * across audit runs. Uses file, line, rule, and normalized title.
 */
function generateFindingFingerprint(finding) {
  // Normalize title to handle minor variations
  const normalizedTitle = finding.title
    .toLowerCase()
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim();
    
  return `${finding.file || ''}:${finding.line || 0}:${finding.rule || ''}:${normalizedTitle}`;
}

/**
 * Find the most recent previous audit for the same repository
 */
async function findPreviousAudit(currentAuditPath, reportsDir) {
  const currentAuditId = basename(dirname(currentAuditPath));
  const repoSlug = basename(dirname(dirname(currentAuditPath)));
  const repoDir = join(reportsDir, repoSlug);
  
  try {
    const auditIds = await readdir(repoDir);
    const sortedIds = auditIds
      .filter(id => id !== currentAuditId && id !== '.gitkeep')
      .sort()
      .reverse(); // Most recent first
    
    if (sortedIds.length === 0) {
      return null; // No previous audit
    }
    
    // Find the most recent audit with valid results.json
    for (const auditId of sortedIds) {
      const resultsPath = join(repoDir, auditId, 'results.json');
      try {
        await readFile(resultsPath);
        return resultsPath;
      } catch {
        continue; // Skip invalid/missing results
      }
    }
    
    return null;
  } catch {
    return null; // Repo directory doesn't exist
  }
}

/**
 * Apply baseline suppression to current audit results
 */
async function applyBaselineSuppression(currentResultsPath, reportsDir) {
  console.log(`🔍 Applying baseline suppression to ${currentResultsPath}`);
  
  // Read current results
  const currentData = JSON.parse(await readFile(currentResultsPath, 'utf8'));
  
  // Find previous audit
  const previousResultsPath = await findPreviousAudit(currentResultsPath, reportsDir);
  
  if (!previousResultsPath) {
    console.log('📝 No previous audit found - marking all findings as "new"');
    
    // Mark all findings as new
    for (const result of currentData.results) {
      for (const finding of result.findings) {
        finding.status = 'new';
      }
    }
    
    // Update summary
    currentData.summary.baselineComparison = {
      previousAuditFound: false,
      newFindings: currentData.summary.totalFindings,
      existingFindings: 0
    };
  } else {
    console.log(`📊 Comparing against previous audit: ${previousResultsPath}`);
    
    // Read previous results
    const previousData = JSON.parse(await readFile(previousResultsPath, 'utf8'));
    
    // Build fingerprint map from previous findings
    const previousFingerprints = new Set();
    for (const result of previousData.results) {
      for (const finding of result.findings) {
        previousFingerprints.add(generateFindingFingerprint(finding));
      }
    }
    
    // Compare current findings
    let newCount = 0;
    let existingCount = 0;
    
    for (const result of currentData.results) {
      for (const finding of result.findings) {
        const fingerprint = generateFindingFingerprint(finding);
        
        if (previousFingerprints.has(fingerprint)) {
          finding.status = 'existing';
          existingCount++;
        } else {
          finding.status = 'new';
          newCount++;
        }
      }
    }
    
    console.log(`✅ Baseline comparison complete: ${newCount} new, ${existingCount} existing`);
    
    // Update summary
    currentData.summary.baselineComparison = {
      previousAuditFound: true,
      previousAuditId: basename(dirname(previousResultsPath)),
      newFindings: newCount,
      existingFindings: existingCount
    };
  }
  
  // Write updated results back
  await writeFile(currentResultsPath, JSON.stringify(currentData, null, 2));
  console.log(`💾 Updated results saved to ${currentResultsPath}`);
  
  return currentData.summary.baselineComparison;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [currentResultsPath, reportsDir] = process.argv.slice(2);
  
  if (!currentResultsPath || !reportsDir) {
    console.error('Usage: node baseline-suppression.js <currentResultsPath> <reportsDir>');
    process.exit(1);
  }
  
  try {
    await applyBaselineSuppression(currentResultsPath, reportsDir);
  } catch (error) {
    console.error('❌ Error applying baseline suppression:', error.message);
    process.exit(1);
  }
}

export { applyBaselineSuppression, generateFindingFingerprint };