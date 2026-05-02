#!/usr/bin/env node

/**
 * Context-aware Severity Adjuster (Phase 1.3)
 * 
 * Adjusts finding severity based on file context and patterns.
 * Suppresses known-safe patterns to reduce false positives:
 * 
 * - Math.random() in test files → info (not security risk)
 * - console.log in development/debug files → low (not production)
 * - Hardcoded credentials in test fixtures → info (not real secrets)
 * - Missing error handling in example code → low (not production)
 * - SQL injection in migration files → medium (controlled context)
 * - Path traversal in test utilities → low (test-only usage)
 * 
 * Usage:
 *   node utils/context-aware-severity.js <resultsPath>
 * 
 * Example:
 *   node utils/context-aware-severity.js reports/owner_repo/audit-123/results.json
 */

import { readFile, writeFile } from 'fs/promises';

/**
 * File path patterns that indicate safe contexts
 */
const SAFE_CONTEXT_PATTERNS = {
  test: [
    /\.(test|spec)\.(js|ts|jsx|tsx)$/,
    /__tests__\//,
    /\/tests?\//,
    /\/test\//,
    /\.(test|spec)$/,
    /\/fixtures?\//,
    /\/mocks?\//,
    /\/stubs?\//,
    /jest\.config\./,
    /vitest\.config\./,
    /cypress\//,
    /playwright\//
  ],
  
  development: [
    /\.dev\./,
    /\.development\./,
    /\/dev\//,
    /\/development\//,
    /\/scripts?\//,
    /\/tools?\//,
    /\/build\//,
    /\/config\//,
    /webpack\.config\./,
    /vite\.config\./,
    /rollup\.config\./,
    /babel\.config\./,
    /eslint\.config\./
  ],
  
  documentation: [
    /\.md$/,
    /\.mdx$/,
    /\/docs?\//,
    /\/documentation\//,
    /README/i,
    /CHANGELOG/i,
    /LICENSE/i,
    /\/examples?\//,
    /\/samples?\//,
    /\/demo\//
  ],
  
  infrastructure: [
    /\.ya?ml$/,
    /Dockerfile/,
    /docker-compose\./,
    /\.github\//,
    /\.gitlab\//,
    /\.circleci\//,
    /\.travis\./,
    /Jenkinsfile/,
    /terraform\//,
    /\.terraform\//
  ],
  
  migration: [
    /\/migrations?\//,
    /\/migrate\//,
    /\.migration\./,
    /\/seeds?\//,
    /\/seeders?\//
  ]
};

/**
 * Context-specific severity adjustment rules
 */
const SEVERITY_RULES = [
  {
    name: 'Math.random in tests',
    condition: (finding, context) => 
      context.isTest && 
      (finding.title?.includes('Math.random') || finding.description?.includes('Math.random')),
    adjustSeverity: 'info',
    reason: 'Math.random() is acceptable in test files for non-cryptographic purposes'
  },
  
  {
    name: 'console.log in development files',
    condition: (finding, context) => 
      (context.isDevelopment || context.isTest) && 
      (finding.title?.includes('console.log') || finding.description?.includes('console')),
    adjustSeverity: 'low',
    reason: 'Console statements are acceptable in development and test files'
  },
  
  {
    name: 'Hardcoded credentials in test fixtures',
    condition: (finding, context) => 
      context.isTest && 
      (finding.title?.toLowerCase().includes('credential') || 
       finding.title?.toLowerCase().includes('secret') ||
       finding.title?.toLowerCase().includes('password')),
    adjustSeverity: 'info',
    reason: 'Hardcoded test credentials in fixtures are not real security risks'
  },
  
  {
    name: 'Missing error handling in examples',
    condition: (finding, context) => 
      context.isDocumentation && 
      finding.title?.toLowerCase().includes('error'),
    adjustSeverity: 'low',
    reason: 'Error handling omissions in example code are for clarity'
  },
  
  {
    name: 'SQL patterns in migrations',
    condition: (finding, context) => 
      context.isMigration && 
      (finding.title?.toLowerCase().includes('sql') || finding.cwe === 'CWE-89'),
    adjustSeverity: 'medium',
    reason: 'SQL patterns in migrations are typically controlled and reviewed'
  },
  
  {
    name: 'Path traversal in test utilities',
    condition: (finding, context) => 
      context.isTest && 
      (finding.cwe === 'CWE-22' || finding.title?.toLowerCase().includes('path')),
    adjustSeverity: 'low',
    reason: 'Path operations in tests typically use controlled inputs'
  },
  
  {
    name: 'Network requests in development',
    condition: (finding, context) => 
      (context.isDevelopment || context.isInfrastructure) && 
      (finding.cwe === 'CWE-918' || finding.title?.toLowerCase().includes('http')),
    adjustSeverity: 'medium',
    reason: 'HTTP requests in development/config files have controlled scope'
  },
  
  {
    name: 'Type assertions in test files',
    condition: (finding, context) => 
      context.isTest && 
      (finding.title?.includes(': any') || finding.title?.includes('as any')),
    adjustSeverity: 'info',
    reason: 'Type assertions are acceptable in test files for mocking'
  }
];

/**
 * Determine the context of a file based on its path
 */
function determineFileContext(filePath) {
  if (!filePath) return {};
  
  const context = {
    isTest: SAFE_CONTEXT_PATTERNS.test.some(pattern => pattern.test(filePath)),
    isDevelopment: SAFE_CONTEXT_PATTERNS.development.some(pattern => pattern.test(filePath)),
    isDocumentation: SAFE_CONTEXT_PATTERNS.documentation.some(pattern => pattern.test(filePath)),
    isInfrastructure: SAFE_CONTEXT_PATTERNS.infrastructure.some(pattern => pattern.test(filePath)),
    isMigration: SAFE_CONTEXT_PATTERNS.migration.some(pattern => pattern.test(filePath))
  };
  
  return context;
}

/**
 * Apply context-aware severity adjustments
 */
async function applyContextAwareSeverity(resultsPath) {
  console.log(`🎯 Applying context-aware severity adjustments to ${resultsPath}`);
  
  // Read current results
  const data = JSON.parse(await readFile(resultsPath, 'utf8'));
  
  let adjustedCount = 0;
  const adjustments = [];
  
  // Process each finding
  for (const result of data.results) {
    for (const finding of result.findings) {
      if (!finding.file) continue;
      
      const context = determineFileContext(finding.file);
      const originalSeverity = finding.severity;
      
      // Check each severity rule
      for (const rule of SEVERITY_RULES) {
        if (rule.condition(finding, context)) {
          // Apply severity adjustment
          finding.severity = rule.adjustSeverity;
          finding.severityAdjusted = {
            originalSeverity,
            adjustedSeverity: rule.adjustSeverity,
            rule: rule.name,
            reason: rule.reason
          };
          
          adjustedCount++;
          adjustments.push({
            file: finding.file,
            rule: rule.name,
            from: originalSeverity,
            to: rule.adjustSeverity
          });
          
          break; // Apply only the first matching rule
        }
      }
    }
  }
  
  console.log(`✅ Applied ${adjustedCount} context-aware severity adjustments`);
  
  // Update severity counts in summary
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const result of data.results) {
    for (const finding of result.findings) {
      severityCounts[finding.severity]++;
    }
  }
  data.summary.bySeverity = severityCounts;
  
  // Add context-aware summary
  data.summary.contextAwareSeverity = {
    adjustmentsApplied: adjustedCount,
    adjustments: adjustments.slice(0, 10), // Keep first 10 for summary
    totalAdjustments: adjustments.length
  };
  
  // Write updated results back
  await writeFile(resultsPath, JSON.stringify(data, null, 2));
  console.log(`💾 Updated results saved to ${resultsPath}`);
  
  return adjustedCount;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath] = process.argv.slice(2);
  
  if (!resultsPath) {
    console.error('Usage: node context-aware-severity.js <resultsPath>');
    process.exit(1);
  }
  
  try {
    await applyContextAwareSeverity(resultsPath);
  } catch (error) {
    console.error('❌ Error applying context-aware severity:', error.message);
    process.exit(1);
  }
}

export { applyContextAwareSeverity, determineFileContext, SEVERITY_RULES };