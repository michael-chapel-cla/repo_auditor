#!/usr/bin/env node

/**
 * Phase 1 Enhancement Runner
 * 
 * Orchestrates all Phase 1 "Richer Findings" enhancements:
 * 1.1 - Baseline suppression (new vs existing findings)
 * 1.2 - Auto-fix suggestions with diffs
 * 1.3 - Context-aware severity adjustments
 * 1.4 - Cross-tool deduplication
 * 
 * Usage:
 *   node utils/apply-phase1-enhancements.js <resultsPath> [reportsDir] [workspaceDir]
 * 
 * Example:
 *   node utils/apply-phase1-enhancements.js \
 *     reports/owner_repo/audit-123/results.json \
 *     reports/ \
 *     workspace/owner_repo
 */

import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Import all Phase 1 utilities
import { applyBaselineSuppression } from './baseline-suppression.js';
import { generateAutoFixes } from './auto-fix-generator.js';
import { generateAIAutoFixes } from './ai-auto-fix-generator.js';
import { applyContextAwareSeverity } from './context-aware-severity.js';
import { applyCrossToolDeduplication } from './cross-tool-deduplication.js';
import { applyContributorRiskAttribution } from './contributor-risk-attribution.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run all Phase 1 enhancements in sequence
 */
async function applyPhase1Enhancements(resultsPath, reportsDir, workspaceDir) {
  console.log('🚀 Starting Phase 1 "Richer Findings" enhancements...');
  console.log(`   Results: ${resultsPath}`);
  console.log(`   Reports: ${reportsDir || 'auto-detect'}`);
  console.log(`   Workspace: ${workspaceDir || 'none'}`);
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // Verify results file exists
    await readFile(resultsPath);
  } catch (error) {
    throw new Error(`Results file not found: ${resultsPath}`);
  }
  
  // Auto-detect reports directory if not provided
  if (!reportsDir) {
    // Assume results path is reports/{owner_repo}/{auditId}/results.json
    reportsDir = resolve(resultsPath, '../../../');
  }
  
  const results = {};
  
  // 1.1 - Baseline Suppression
  console.log('📊 1.1 - Applying baseline suppression...');
  try {
    await applyBaselineSuppression(resultsPath, reportsDir);
    results.baselineSuppression = { success: true };
    console.log('✅ Baseline suppression applied');
  } catch (error) {
    console.error('❌ Baseline suppression failed:', error.message);
    results.baselineSuppression = { success: false, error: error.message };
  }
  console.log('');
  
  // 1.2a - Basic Auto-fix Generation
  console.log('🔧 1.2a - Generating basic auto-fix suggestions...');
  try {
    const basicFixableCount = await generateAutoFixes(resultsPath, workspaceDir);
    results.autoFixGeneration = { success: true, basicFixableCount };
    console.log('✅ Basic auto-fix suggestions generated');
  } catch (error) {
    console.error('❌ Basic auto-fix generation failed:', error.message);
    results.autoFixGeneration = { success: false, error: error.message };
  }
  console.log('');

  // 1.2b - Agent-Driven Auto-fix Context Preparation
  console.log('🤖 1.2b - Preparing findings for agent-driven auto-fix suggestions...');
  try {
    console.log('🧠 Using agent LLM context instead of external API calls');
    
    const aiEnhancedCount = await generateAIAutoFixes(resultsPath, workspaceDir);
    results.aiAutoFixGeneration = { success: true, aiEnhancedCount };
    console.log('✅ AI-enhanced auto-fix suggestions generated');
  } catch (error) {
    console.error('❌ AI auto-fix generation failed:', error.message);
    results.aiAutoFixGeneration = { success: false, error: error.message };
  }
  console.log('');
  
  // 1.3 - Context-aware Severity
  console.log('🎯 1.3 - Applying context-aware severity...');
  try {
    const adjustedCount = await applyContextAwareSeverity(resultsPath);
    results.contextAwareSeverity = { success: true, adjustedCount };
    console.log('✅ Context-aware severity applied');
  } catch (error) {
    console.error('❌ Context-aware severity failed:', error.message);
    results.contextAwareSeverity = { success: false, error: error.message };
  }
  console.log('');
  
  // 1.4 - Cross-tool Deduplication
  console.log('🔗 1.4 - Applying cross-tool deduplication...');
  try {
    const reductionCount = await applyCrossToolDeduplication(resultsPath);
    results.crossToolDeduplication = { success: true, reductionCount };
    console.log('✅ Cross-tool deduplication applied');
  } catch (error) {
    console.error('❌ Cross-tool deduplication failed:', error.message);
    results.crossToolDeduplication = { success: false, error: error.message };
  }
  console.log('');
  
  // 2.4 - Contributor Risk Attribution (Phase 2)
  if (workspaceDir) {
    console.log('👥 2.4 - Applying contributor risk attribution...');
    try {
      const attributedCount = await applyContributorRiskAttribution(resultsPath, workspaceDir);
      results.contributorRiskAttribution = { success: true, attributedCount };
      console.log('✅ Contributor risk attribution applied');
    } catch (error) {
      console.error('❌ Contributor risk attribution failed:', error.message);
      results.contributorRiskAttribution = { success: false, error: error.message };
    }
    console.log('');
  } else {
    console.log('👥 2.4 - Skipping contributor risk attribution (no workspace provided)');
    results.contributorRiskAttribution = { success: false, error: 'No workspace directory provided' };
    console.log('');
  }
  
  const duration = Date.now() - startTime;
  const successCount = Object.values(results).filter(r => r.success).length;
  
  console.log('🎉 Phase 1 + 2.4 enhancements complete!');
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Success: ${successCount}/6 enhancements applied`);
  
  if (successCount < 4) { // Allow AI auto-fix to fail gracefully
    console.log('⚠️  Some enhancements failed - check logs above');
    if (successCount < 3) { // Only exit if critical enhancements fail
      process.exit(1);
    }
  }
  
  return results;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath, reportsDir, workspaceDir] = process.argv.slice(2);
  
  if (!resultsPath) {
    console.error('Usage: node apply-phase1-enhancements.js <resultsPath> [reportsDir] [workspaceDir]');
    console.error('');
    console.error('Examples:');
    console.error('  node utils/apply-phase1-enhancements.js reports/owner_repo/audit-123/results.json');
    console.error('  node utils/apply-phase1-enhancements.js reports/owner_repo/audit-123/results.json reports/ workspace/owner_repo');
    process.exit(1);
  }
  
  try {
    await applyPhase1Enhancements(resultsPath, reportsDir, workspaceDir);
  } catch (error) {
    console.error('❌ Phase 1 enhancements failed:', error.message);
    process.exit(1);
  }
}

export { applyPhase1Enhancements };