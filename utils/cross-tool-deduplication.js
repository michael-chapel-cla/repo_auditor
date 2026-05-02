#!/usr/bin/env node

/**
 * Cross-tool Deduplication Utility (Phase 1.4)
 * 
 * Merges findings from different tools that target the same code location.
 * Instead of showing separate findings from Claude AI and Semgrep for the same issue,
 * this combines them into a single finding with sources: ["ai", "semgrep"].
 * 
 * Deduplication criteria:
 * - Same file and line number
 * - Similar issue type (same CWE or related security category)
 * - Similar severity level (within 1 level difference)
 * 
 * Usage:
 *   node utils/cross-tool-deduplication.js <resultsPath>
 * 
 * Example:
 *   node utils/cross-tool-deduplication.js reports/owner_repo/audit-123/results.json
 */

import { readFile, writeFile } from 'fs/promises';
import crypto from 'crypto';

/**
 * Generate a deduplication key for a finding
 */
function generateDeduplicationKey(finding) {
  // Use file, line, and CWE/category to identify duplicates
  const parts = [
    finding.file || '',
    String(finding.line || 0),
    finding.cwe || finding.category || '',
    // Normalize titles to catch variations
    (finding.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
  ];
  
  return parts.join(':');
}

/**
 * Calculate similarity score between two findings (0-1)
 */
function calculateSimilarity(finding1, finding2) {
  let score = 0;
  
  // File match (required)
  if (finding1.file !== finding2.file) return 0;
  
  // Line proximity (within 3 lines)
  const lineDiff = Math.abs((finding1.line || 0) - (finding2.line || 0));
  if (lineDiff <= 3) score += 0.4;
  
  // CWE match
  if (finding1.cwe && finding2.cwe && finding1.cwe === finding2.cwe) {
    score += 0.3;
  }
  
  // Category match
  if (finding1.category === finding2.category) {
    score += 0.2;
  }
  
  // Title similarity
  if (finding1.title && finding2.title) {
    const title1 = finding1.title.toLowerCase();
    const title2 = finding2.title.toLowerCase();
    const words1 = new Set(title1.split(/\s+/));
    const words2 = new Set(title2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccard = intersection.size / union.size;
    score += jaccard * 0.1;
  }
  
  return score;
}

/**
 * Check if two severity levels are compatible for merging
 */
function areSeveritiesCompatible(sev1, sev2) {
  const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
  const idx1 = severityOrder.indexOf(sev1);
  const idx2 = severityOrder.indexOf(sev2);
  
  // Allow merging if within 1 severity level
  return Math.abs(idx1 - idx2) <= 1;
}

/**
 * Choose the higher severity between two findings
 */
function chooseHigherSeverity(sev1, sev2) {
  const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
  const idx1 = severityOrder.indexOf(sev1);
  const idx2 = severityOrder.indexOf(sev2);
  
  return idx1 > idx2 ? sev1 : sev2;
}

/**
 * Merge two similar findings into one
 */
function mergeFindings(primary, secondary) {
  // Create merged finding based on primary
  const merged = { ...primary };
  
  // Combine sources
  const primarySources = Array.isArray(primary.source) ? primary.source : [primary.source];
  const secondarySources = Array.isArray(secondary.source) ? secondary.source : [secondary.source];
  merged.sources = [...new Set([...primarySources, ...secondarySources])];
  
  // Update source field to indicate multiple sources
  merged.source = merged.sources.join('+');
  
  // Use higher severity
  merged.severity = chooseHigherSeverity(primary.severity, secondary.severity);
  
  // Combine titles and descriptions
  if (primary.title !== secondary.title) {
    merged.title = `${primary.title} (multiple detections)`;
    merged.description = `${primary.description}\n\nAlso detected by ${secondary.source}: ${secondary.description}`;
  }
  
  // Prefer the CWE from the more authoritative source
  if (!merged.cwe && secondary.cwe) {
    merged.cwe = secondary.cwe;
  }
  
  // Mark as deduplicated
  merged.deduplicated = {
    mergedFrom: [
      {
        source: primary.source,
        id: primary.id,
        severity: primary.severity,
        title: primary.title
      },
      {
        source: secondary.source,
        id: secondary.id,
        severity: secondary.severity,
        title: secondary.title
      }
    ],
    mergedAt: new Date().toISOString()
  };
  
  // Generate new ID that represents the merged finding
  merged.id = `merged-${crypto.randomUUID()}`;
  
  return merged;
}

/**
 * Apply cross-tool deduplication to findings
 */
async function applyCrossToolDeduplication(resultsPath) {
  console.log(`🔗 Applying cross-tool deduplication to ${resultsPath}`);
  
  // Read current results
  const data = JSON.parse(await readFile(resultsPath, 'utf8'));
  
  let totalOriginal = 0;
  let totalMerged = 0;
  let mergeOperations = [];
  
  // Process each category
  for (const result of data.results) {
    const originalFindings = [...result.findings];
    totalOriginal += originalFindings.length;
    
    const processedFindings = [];
    const processed = new Set();
    
    for (let i = 0; i < originalFindings.length; i++) {
      if (processed.has(i)) continue;
      
      const finding = originalFindings[i];
      let merged = false;
      
      // Look for similar findings to merge
      for (let j = i + 1; j < originalFindings.length; j++) {
        if (processed.has(j)) continue;
        
        const candidate = originalFindings[j];
        const similarity = calculateSimilarity(finding, candidate);
        
        // Merge if similarity is high and severities are compatible
        if (similarity >= 0.7 && areSeveritiesCompatible(finding.severity, candidate.severity)) {
          const mergedFinding = mergeFindings(finding, candidate);
          processedFindings.push(mergedFinding);
          
          processed.add(i);
          processed.add(j);
          
          mergeOperations.push({
            file: finding.file,
            line: finding.line,
            primarySource: finding.source,
            secondarySource: candidate.source,
            similarity: Math.round(similarity * 100)
          });
          
          merged = true;
          break;
        }
      }
      
      // If not merged, add original finding
      if (!merged) {
        processedFindings.push(finding);
        processed.add(i);
      }
    }
    
    result.findings = processedFindings;
    totalMerged += processedFindings.length;
  }
  
  const reductionCount = totalOriginal - totalMerged;
  console.log(`✅ Deduplication complete: reduced ${totalOriginal} → ${totalMerged} findings (-${reductionCount})`);
  
  // Update summary counts
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const categoryCounts = { security: 0, quality: 0, api: 0, db: 0, npm: 0, npq: 0 };
  
  for (const result of data.results) {
    for (const finding of result.findings) {
      severityCounts[finding.severity]++;
      categoryCounts[finding.category]++;
    }
  }
  
  data.summary.bySeverity = severityCounts;
  data.summary.byCategory = categoryCounts;
  data.summary.totalFindings = totalMerged;
  
  // Add deduplication summary
  data.summary.crossToolDeduplication = {
    originalFindings: totalOriginal,
    mergedFindings: totalMerged,
    reductionCount,
    mergeOperations: mergeOperations.slice(0, 10), // Keep first 10 for summary
    totalMergeOperations: mergeOperations.length
  };
  
  // Write updated results back
  await writeFile(resultsPath, JSON.stringify(data, null, 2));
  console.log(`💾 Updated results saved to ${resultsPath}`);
  
  return reductionCount;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath] = process.argv.slice(2);
  
  if (!resultsPath) {
    console.error('Usage: node cross-tool-deduplication.js <resultsPath>');
    process.exit(1);
  }
  
  try {
    await applyCrossToolDeduplication(resultsPath);
  } catch (error) {
    console.error('❌ Error applying cross-tool deduplication:', error.message);
    process.exit(1);
  }
}

export { applyCrossToolDeduplication, calculateSimilarity, mergeFindings };