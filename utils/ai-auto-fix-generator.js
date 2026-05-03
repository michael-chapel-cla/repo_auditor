#!/usr/bin/env node

/**
 * Agent-Driven Auto-fix Suggestions Generator (Phase 1.2 Enhanced)
 * 
 * Prepares findings with rich context for the agent (Claude, Codex, Copilot) to generate
 * sophisticated auto-fix suggestions during their audit runs. Instead of making external
 * API calls, this utility structures the data so agents can use their own LLM capabilities.
 * 
 * Features:
 * - Gathers surrounding code context
 * - Analyzes project patterns and conventions
 * - Provides context data for agent analysis
 * - Enables agent-driven intelligent auto-fixes
 * - Supports cross-file dependency analysis
 * 
 * Usage:
 *   node utils/ai-auto-fix-generator.js <resultsPath> <workspaceDir>
 * 
 * Example:
 *   node utils/ai-auto-fix-generator.js \
 *     reports/owner_repo/audit-123/results.json \
 *     workspace/owner_repo
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname, extname, relative } from 'path';

/**
 * Simple recursive file discovery (replaces glob dependency)
 */
async function getProjectFiles(dir, files = [], basePath = '') {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
  const allowedExts = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.go', '.java'];
  
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = basePath ? join(basePath, entry) : entry;
      
      try {
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          if (!skipDirs.includes(entry) && !entry.startsWith('.')) {
            await getProjectFiles(fullPath, files, relativePath);
          }
        } else if (stats.isFile() && allowedExts.includes(extname(entry))) {
          files.push(relativePath);
        }
      } catch {
        // Skip entries we can't access
      }
    }
  } catch {
    // Skip directories we can't read
  }
  
  return files;
}

/**
 * Gather codebase context around a finding
 */
async function gatherCodeContext(finding, workspaceDir) {
  const context = {
    targetFile: null,
    surroundingCode: null,
    projectStructure: null,
    relatedFiles: [],
    projectPatterns: null
  };

  try {
    // Read the target file
    if (finding.file) {
      const filePath = join(workspaceDir, finding.file);
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Get surrounding code context (±10 lines)
      const lineNum = finding.line || 1;
      const start = Math.max(0, lineNum - 11);
      const end = Math.min(lines.length, lineNum + 10);
      
      context.targetFile = {
        path: finding.file,
        content: content,
        surroundingLines: lines.slice(start, end),
        lineNumber: lineNum,
        language: getFileLanguage(finding.file)
      };
    }

    // Analyze project structure
    context.projectStructure = await analyzeProjectStructure(workspaceDir);
    
    // Find related files based on imports/dependencies
    if (finding.file) {
      context.relatedFiles = await findRelatedFiles(finding.file, workspaceDir);
    }

    // Detect project patterns and conventions
    context.projectPatterns = await detectProjectPatterns(workspaceDir);

  } catch (error) {
    console.log(`Warning: Could not gather full context for ${finding.file}: ${error.message}`);
  }

  return context;
}

/**
 * Analyze project structure to understand architecture
 */
async function analyzeProjectStructure(workspaceDir) {
  try {
    const packageJsonPath = join(workspaceDir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    
    // Get file structure (simplified without glob)
    const allFiles = await getProjectFiles(workspaceDir);

    return {
      packageInfo: {
        name: packageJson.name,
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        scripts: packageJson.scripts || {}
      },
      fileStructure: allFiles,
      totalFiles: allFiles.length,
      languages: [...new Set(allFiles.map(f => extname(f).slice(1)))],
      directories: [...new Set(allFiles.map(f => dirname(f)))]
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Find files related to the target file
 */
async function findRelatedFiles(targetFile, workspaceDir) {
  const related = [];
  const targetPath = join(workspaceDir, targetFile);
  
  try {
    const content = await readFile(targetPath, 'utf8');
    
    // Extract import/require patterns
    const importRegex = /(?:import\s+.+\s+from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath && !importPath.startsWith('node:') && !importPath.includes('node_modules')) {
        // Resolve relative imports
        const resolvedPath = importPath.startsWith('.') 
          ? relative(workspaceDir, join(dirname(targetPath), importPath))
          : importPath;
        related.push(resolvedPath);
      }
    }
    
    return related.slice(0, 5); // Limit to 5 related files
  } catch (error) {
    return [];
  }
}

/**
 * Detect common project patterns and conventions
 */
async function detectProjectPatterns(workspaceDir) {
  const patterns = {
    framework: 'unknown',
    testFramework: null,
    linting: false,
    typescript: false,
    conventions: []
  };

  try {
    const packageJson = JSON.parse(await readFile(join(workspaceDir, 'package.json'), 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Detect framework
    if (allDeps.react) patterns.framework = 'react';
    else if (allDeps.vue) patterns.framework = 'vue';
    else if (allDeps.angular) patterns.framework = 'angular';
    else if (allDeps.express) patterns.framework = 'express';
    else if (allDeps.fastify) patterns.framework = 'fastify';
    else if (allDeps.next) patterns.framework = 'next';

    // Detect test framework
    if (allDeps.jest) patterns.testFramework = 'jest';
    else if (allDeps.vitest) patterns.testFramework = 'vitest';
    else if (allDeps.mocha) patterns.testFramework = 'mocha';

    // Detect tools
    patterns.linting = !!(allDeps.eslint || allDeps.tslint);
    patterns.typescript = !!(allDeps.typescript || allDeps['@types/node']);

    // Detect naming conventions by sampling files
    const sampleFiles = (allFiles || []).filter(f => 
      f.startsWith('src/') && 
      /\.(js|ts|jsx|tsx)$/.test(f) && 
      !f.includes('.test.') && 
      !f.includes('.spec.')
    );
    
    const camelCaseFiles = sampleFiles.filter(f => /[a-z][A-Z]/.test(f)).length;
    const kebabCaseFiles = sampleFiles.filter(f => /-/.test(f)).length;
    
    if (camelCaseFiles > kebabCaseFiles) {
      patterns.conventions.push('camelCase filenames');
    } else if (kebabCaseFiles > camelCaseFiles) {
      patterns.conventions.push('kebab-case filenames');
    }

  } catch (error) {
    // Ignore errors, use defaults
  }

  return patterns;
}

/**
 * Get programming language from file extension
 */
function getFileLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.jsx': 'jsx', 
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.vue': 'vue',
    '.php': 'php'
  };
  return langMap[ext] || 'text';
}

/**
 * Generate AI prompt for auto-fix suggestion
 */
function generateAIPrompt(finding, context) {
  const { targetFile, projectStructure, projectPatterns } = context;
  
  return `You are an expert code analysis and auto-fix assistant. Generate a precise auto-fix suggestion for this code issue.

## Finding Details
**Issue:** ${finding.title}
**Description:** ${finding.description}
**Severity:** ${finding.severity}
**Rule:** ${finding.rule}
**CWE:** ${finding.cwe || 'N/A'}

## Code Context
**File:** ${finding.file}${finding.line ? ` (line ${finding.line})` : ''}
**Language:** ${targetFile?.language || 'unknown'}

**Surrounding Code:**
\`\`\`${targetFile?.language || 'text'}
${targetFile?.surroundingLines?.join('\n') || 'Code not available'}
\`\`\`

## Project Context
**Framework:** ${projectPatterns?.framework || 'unknown'}
**TypeScript:** ${projectPatterns?.typescript ? 'Yes' : 'No'}
**Test Framework:** ${projectPatterns?.testFramework || 'None detected'}
**Dependencies:** ${projectStructure?.packageInfo?.dependencies?.slice(0, 10)?.join(', ') || 'None'}

## Fix Request
Generate an auto-fix suggestion with:

1. **Analysis:** Explain the root cause and why it's problematic
2. **Solution:** Provide the exact code fix
3. **Reasoning:** Explain why this fix is appropriate for this project
4. **Alternatives:** Mention other possible approaches if applicable

**Output the fix as a unified diff patch that can be directly applied.**

Format your response as JSON:
{
  "analysis": "Root cause explanation",
  "solution": "Exact fix description", 
  "patch": "Unified diff format patch",
  "reasoning": "Why this fix fits the project",
  "alternatives": "Other possible approaches",
  "confidence": "high|medium|low",
  "complexity": "simple|moderate|complex"
}`;
}

/**
 * Generate contextual suggestions based on project patterns
 */
function generateContextualSuggestions(finding, context) {
  const { projectPatterns } = context;
  const suggestions = [];

  // SQL Injection suggestions
  if (finding.cwe === 'CWE-89' || finding.title.toLowerCase().includes('sql')) {
    if (projectPatterns.framework === 'express' && projectPatterns.dependencies?.includes('prisma')) {
      suggestions.push('Use Prisma client for type-safe database queries');
    } else if (projectPatterns.dependencies?.includes('sequelize')) {
      suggestions.push('Use Sequelize parameterized queries with bound parameters');
    } else if (projectPatterns.dependencies?.includes('knex')) {
      suggestions.push('Use Knex query builder for parameterized queries');
    } else {
      suggestions.push('Replace string concatenation with parameterized queries');
    }
  }

  // XSS suggestions
  if (finding.cwe === 'CWE-79' || finding.title.toLowerCase().includes('xss')) {
    if (projectPatterns.framework === 'react') {
      suggestions.push('Remove dangerouslySetInnerHTML, use React text interpolation');
    } else if (projectPatterns.framework === 'vue') {
      suggestions.push('Use v-text directive instead of v-html for user content');
    } else {
      suggestions.push('Sanitize user input before rendering in HTML');
    }
  }

  // Hardcoded secrets
  if (finding.cwe === 'CWE-798' || finding.title.toLowerCase().includes('hardcoded')) {
    suggestions.push('Move secret to environment variable');
    suggestions.push('Use process.env.VARIABLE_NAME or config management');
  }

  return suggestions;
}

/**
 * Generate agent-friendly prompt for auto-fix analysis
 */
function generateAgentPrompt(finding, context) {
  return {
    task: 'Generate an intelligent auto-fix for this security/quality finding',
    finding: {
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      cwe: finding.cwe,
      file: finding.file,
      line: finding.line
    },
    codeContext: context.codeSnippet,
    projectInfo: {
      framework: context.projectPatterns.framework,
      dependencies: context.projectPatterns.dependencies,
      conventions: context.projectPatterns.conventions
    },
    relatedFiles: context.relatedFiles,
    suggestions: context.suggestions || [],
    instructions: [
      'Analyze the code context and project patterns',
      'Generate a fix that matches the project\'s conventions',
      'Provide the exact code changes as a unified diff',
      'Explain why this fix is appropriate for this codebase',
      'Consider the project\'s dependencies and framework'
    ]
  };
}

/**
 * Prepare finding with rich context for agent-driven auto-fix generation
 * Instead of making API calls, we enrich the finding with context data
 * that agents can use to generate intelligent fixes during audit runs
 */
async function prepareAgentContext(finding, context) {
  // Prepare rich context that agents can analyze
  const agentContext = {
    codeContext: context.codeSnippet,
    projectPatterns: context.projectPatterns,
    relatedFiles: context.relatedFiles,
    targetFile: context.targetFile,
    suggestions: generateContextualSuggestions(finding, context)
  };
  
  // Add agent-friendly prompt guidance
  const agentPrompt = generateAgentPrompt(finding, context);
  
  return {
    agentContext,
    agentPrompt,
    requiresAgentAnalysis: true
  };
}

/**
 * Generate intelligent mock fixes based on patterns and context
 */
async function generateIntelligentMockFix(finding, context) {
  const { targetFile, projectPatterns } = context;
  
  // SQL Injection fixes
  if (finding.cwe === 'CWE-89' || finding.title.toLowerCase().includes('sql')) {
    return generateSQLInjectionFix(finding, context);
  }
  
  // XSS fixes
  if (finding.cwe === 'CWE-79' || finding.title.toLowerCase().includes('xss')) {
    return generateXSSFix(finding, context);
  }
  
  // Hardcoded secrets
  if (finding.title.toLowerCase().includes('secret') || finding.title.toLowerCase().includes('password')) {
    return generateSecretFix(finding, context);
  }
  
  // Console.log with better context
  if (finding.title.toLowerCase().includes('console.log')) {
    return generateConsoleLogFix(finding, context);
  }
  
  // TypeScript any types with better suggestions
  if (finding.title.toLowerCase().includes(': any')) {
    return generateAnyTypeFix(finding, context);
  }
  
  // Error handling improvements
  if (finding.title.toLowerCase().includes('error') && finding.title.toLowerCase().includes('handling')) {
    return generateErrorHandlingFix(finding, context);
  }
  
  // Generic improvement suggestion
  return generateGenericFix(finding, context);
}

/**
 * Generate SQL injection fix with ORM context awareness
 */
function generateSQLInjectionFix(finding, context) {
  const { projectStructure } = context;
  const deps = projectStructure?.packageInfo?.dependencies || [];
  
  let solution, patch;
  
  if (deps.includes('prisma')) {
    solution = 'Replace raw SQL with Prisma ORM query';
    patch = generatePrismaFix(finding, context);
  } else if (deps.includes('sequelize')) {
    solution = 'Replace raw SQL with Sequelize ORM query';
    patch = generateSequelizeFix(finding, context);
  } else if (deps.includes('knex')) {
    solution = 'Replace string concatenation with Knex.js query builder';
    patch = generateKnexFix(finding, context);
  } else {
    solution = 'Use parameterized queries to prevent SQL injection';
    patch = generateParameterizedQueryFix(finding, context);
  }
  
  return {
    analysis: `SQL injection vulnerability detected. User input is being concatenated directly into SQL query string, allowing attackers to manipulate the query structure.`,
    solution,
    patch,
    reasoning: `This fix uses your project's existing database layer (${deps.find(d => ['prisma', 'sequelize', 'knex', 'mysql2', 'pg'].includes(d)) || 'native drivers'}) to ensure parameterized queries.`,
    alternatives: `Consider using an ORM like Prisma or Sequelize for automatic SQL injection protection, or implement input validation and sanitization.`,
    confidence: 'high',
    complexity: 'moderate'
  };
}

/**
 * Generate XSS fix with framework-specific solutions
 */
function generateXSSFix(finding, context) {
  const { projectPatterns } = context;
  
  let solution, patch;
  
  if (projectPatterns?.framework === 'react') {
    solution = 'Use React\'s automatic XSS protection or DOMPurify for HTML';
    patch = generateReactXSSFix(finding, context);
  } else if (projectPatterns?.framework === 'vue') {
    solution = 'Use Vue\'s v-text directive or sanitize HTML with DOMPurify';
    patch = generateVueXSSFix(finding, context);
  } else {
    solution = 'Sanitize user input and use textContent instead of innerHTML';
    patch = generateGenericXSSFix(finding, context);
  }
  
  return {
    analysis: `Cross-Site Scripting (XSS) vulnerability. User input is being inserted into DOM without proper sanitization, allowing script execution.`,
    solution,
    patch,
    reasoning: `This fix leverages ${projectPatterns?.framework || 'standard browser APIs'} built-in XSS protections and follows security best practices.`,
    alternatives: `Consider implementing Content Security Policy (CSP) headers and input validation at the API level.`,
    confidence: 'high',
    complexity: 'simple'
  };
}

/**
 * Generate context-aware console.log fix
 */
function generateConsoleLogFix(finding, context) {
  const { projectStructure, projectPatterns } = context;
  const deps = projectStructure?.packageInfo?.dependencies || [];
  
  let loggerSuggestion = 'console.error';
  let importStatement = '';
  
  if (deps.includes('winston')) {
    loggerSuggestion = 'logger.info';
    importStatement = "const logger = require('winston');\n";
  } else if (deps.includes('pino')) {
    loggerSuggestion = 'logger.info';
    importStatement = "const logger = require('pino')();\n";
  } else if (projectPatterns?.framework === 'next') {
    loggerSuggestion = 'console.error';
  }

  const line = finding.line || 1;
  const patch = `--- a/${finding.file}
+++ b/${finding.file}
@@ -${line - 1},3 +${line - 1},3 @@
-console.log('Processing user data:', data);
+${loggerSuggestion}('Processing user data:', { userId: data?.id, timestamp: new Date().toISOString() });`;

  return {
    analysis: `Console.log statement in production code. These should be replaced with proper logging for production environments.`,
    solution: `Replace console.log with structured logging using ${deps.includes('winston') || deps.includes('pino') ? 'your existing logging library' : 'console.error or a logging library'}`,
    patch,
    reasoning: `${deps.includes('winston') || deps.includes('pino') ? 'Uses your existing logging infrastructure' : 'Uses structured logging with contextual information'} for better debugging and monitoring.`,
    alternatives: `Consider adding log levels, structured logging with correlation IDs, or removing debug statements entirely for production builds.`,
    confidence: 'high',
    complexity: 'simple'
  };
}

/**
 * Generate intelligent TypeScript any type fix
 */
function generateAnyTypeFix(finding, context) {
  const { targetFile } = context;
  const surroundingCode = targetFile?.surroundingLines?.join('\n') || '';
  
  // Analyze context to suggest better types
  let suggestedType = 'unknown';
  let reasoning = 'unknown is safer than any as it requires type checking';
  
  if (surroundingCode.includes('req.body') || surroundingCode.includes('request')) {
    suggestedType = 'Record<string, unknown>';
    reasoning = 'API request bodies are typically key-value objects';
  } else if (surroundingCode.includes('props') || surroundingCode.includes('Props')) {
    suggestedType = 'React.ComponentProps<typeof Component>';
    reasoning = 'React props should use specific prop types';
  } else if (surroundingCode.includes('event') || surroundingCode.includes('Event')) {
    suggestedType = 'Event | React.SyntheticEvent';
    reasoning = 'Event handlers should specify event types';
  } else if (surroundingCode.includes('config') || surroundingCode.includes('options')) {
    suggestedType = 'Record<string, string | number | boolean>';
    reasoning = 'Configuration objects typically contain primitive values';
  }

  const line = finding.line || 1;
  const patch = `--- a/${finding.file}
+++ b/${finding.file}  
@@ -${line},3 +${line},3 @@
-function handleData(data: any) {
+function handleData(data: ${suggestedType}) {`;

  return {
    analysis: `TypeScript 'any' type defeats the purpose of type safety. This disables all type checking for the variable.`,
    solution: `Replace 'any' with '${suggestedType}' for better type safety`,
    patch,
    reasoning,
    alternatives: `Consider creating a specific interface, using generics, or gradual typing with 'unknown' and type guards.`,
    confidence: 'medium',
    complexity: 'simple'
  };
}

// Additional fix generators (simplified for brevity)
function generateSecretFix(finding, context) {
  return {
    analysis: 'Hardcoded secrets pose security risks if source code is exposed.',
    solution: 'Move secrets to environment variables',
    patch: `--- a/${finding.file}\n+++ b/${finding.file}\n@@ -1,1 +1,1 @@\n-const apiKey = 'sk-hardcoded-key';\n+const apiKey = process.env.API_KEY || '';`,
    reasoning: 'Environment variables keep secrets out of source code.',
    alternatives: 'Use a secrets management service like AWS Secrets Manager or HashiCorp Vault.',
    confidence: 'high',
    complexity: 'simple'
  };
}

function generateErrorHandlingFix(finding, context) {
  return {
    analysis: 'Inadequate error handling can lead to application crashes and poor user experience.',
    solution: 'Add comprehensive try-catch with proper error logging',
    patch: `--- a/${finding.file}\n+++ b/${finding.file}\n@@ -1,3 +1,7 @@\n+try {\n   await riskyOperation();\n+} catch (error) {\n+  console.error('Operation failed:', error.message);\n+  throw new Error('Operation failed');\n+}`,
    reasoning: 'Proper error handling prevents crashes and provides better debugging information.',
    alternatives: 'Consider using error boundary patterns or global error handlers.',
    confidence: 'high',
    complexity: 'moderate'
  };
}

function generateGenericFix(finding, context) {
  return {
    analysis: `Issue detected: ${finding.description}`,
    solution: 'Review and address the identified security/quality concern',
    patch: `// Review required: ${finding.title}\n// Please examine ${finding.file}:${finding.line} for ${finding.rule}`,
    reasoning: 'Manual review recommended for complex security issues.',
    alternatives: 'Consult security documentation or team guidelines.',
    confidence: 'low',
    complexity: 'complex'
  };
}

// Simplified patch generators
function generatePrismaFix(finding, context) {
  return `--- a/${finding.file}\n+++ b/${finding.file}\n@@ -1,1 +1,1 @@\n-db.query('SELECT * FROM users WHERE id = ' + userId)\n+await prisma.user.findUnique({ where: { id: userId } })`;
}

function generateKnexFix(finding, context) {
  return `--- a/${finding.file}\n+++ b/${finding.file}\n@@ -1,1 +1,1 @@\n-db.raw('SELECT * FROM users WHERE id = ' + userId)\n+knex('users').where('id', userId).first()`;
}

function generateReactXSSFix(finding, context) {
  return `--- a/${finding.file}\n+++ b/${finding.file}\n@@ -1,1 +1,2 @@\n-element.innerHTML = userInput\n+// Use React's automatic escaping:\n+<div>{userInput}</div>`;
}

// ... Additional generators would be implemented

/**
 * Apply AI-enhanced auto-fix generation to findings
 */
async function generateAIAutoFixes(resultsPath, workspaceDir, agentMode = true) {
  console.log(`🤖 Preparing findings for agent-driven auto-fixes: ${resultsPath}`);
  console.log(`   Workspace: ${workspaceDir}`);
  console.log(`   Mode: Agent-Driven LLM Context`);
  console.log('');
  
  // Read current results
  const data = JSON.parse(await readFile(resultsPath, 'utf8'));
  
  let enhancedCount = 0;
  let totalProcessed = 0;
  
  // Process each finding that doesn't already have an auto-fix
  for (const result of data.results) {
    for (const finding of result.findings) {
      // Skip findings that already have basic auto-fixes, unless we can enhance them
      const needsEnhancement = !finding.autofix || 
        finding.autofix.confidence === 'low' ||
        finding.autofix.complexity === 'simple';
      
      if (needsEnhancement && shouldGenerateAIFix(finding)) {
        totalProcessed++;
        
        try {
          // Gather context for intelligent fixing
          const context = await gatherCodeContext(finding, workspaceDir);
          
          // Prepare context for agent-driven analysis
          const agentData = await prepareAgentContext(finding, context);
          
          if (agentData && agentData.requiresAgentAnalysis) {
            finding.autofix = {
              type: 'agent-context',
              description: 'Requires agent analysis for intelligent auto-fix',
              agentContext: agentData.agentContext,
              agentPrompt: agentData.agentPrompt,
              confidence: 'high',
              complexity: 'agent-driven',
              requiresAgentAnalysis: true
            };
            
            enhancedCount++;
            console.log(`✨ Enhanced fix for: ${finding.title.substring(0, 60)}...`);
          }
        } catch (error) {
          console.log(`⚠️  Failed to generate AI fix for ${finding.title}: ${error.message}`);
        }
      }
    }
  }
  
  console.log(`🎉 AI enhancement complete: ${enhancedCount}/${totalProcessed} findings enhanced`);
  
  // Update summary
  if (!data.summary.autoFixSuggestions) {
    data.summary.autoFixSuggestions = { totalFixable: 0, generated: false };
  }
  data.summary.autoFixSuggestions.aiEnhanced = enhancedCount;
  data.summary.autoFixSuggestions.totalFixable = data.results
    .flatMap(r => r.findings)
    .filter(f => f.autofix).length;
  
  // Write updated results back
  await writeFile(resultsPath, JSON.stringify(data, null, 2));
  console.log(`💾 Enhanced results saved to ${resultsPath}`);
  
  return enhancedCount;
}

/**
 * Determine if a finding should get AI-generated auto-fix
 */
function shouldGenerateAIFix(finding) {
  // Skip info-level findings and findings without enough context
  if (finding.severity === 'info' || !finding.file) {
    return false;
  }
  
  // Focus on security and quality findings that can benefit from context
  const highValueCategories = ['security', 'quality', 'api'];
  const highValueRules = ['sql-injection', 'xss', 'hardcoded-secret', 'error-handling', 'input-validation'];
  
  return highValueCategories.includes(finding.category) ||
         highValueRules.some(rule => finding.rule?.includes(rule) || finding.title.toLowerCase().includes(rule));
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath, workspaceDir, apiKey] = process.argv.slice(2);
  
  if (!resultsPath || !workspaceDir) {
    console.error('Usage: node ai-auto-fix-generator.js <resultsPath> <workspaceDir> [openaiApiKey]');
    console.error('');
    console.error('Examples:');
    console.error('  node utils/ai-auto-fix-generator.js reports/owner_repo/audit-123/results.json workspace/owner_repo');
    console.error('  node utils/ai-auto-fix-generator.js reports/owner_repo/audit-123/results.json workspace/owner_repo sk-...');
    process.exit(1);
  }
  
  try {
    await generateAIAutoFixes(resultsPath, workspaceDir, apiKey);
  } catch (error) {
    console.error('❌ AI auto-fix generation failed:', error.message);
    process.exit(1);
  }
}

export { generateAIAutoFixes };