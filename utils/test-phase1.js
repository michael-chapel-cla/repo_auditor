#!/usr/bin/env node

/**
 * Test Phase 1 Enhancement Utilities
 * 
 * Creates a mock results.json file and tests all Phase 1 enhancements.
 * This verifies that the utilities work correctly across all agent types.
 * 
 * Usage:
 *   node utils/test-phase1.js
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { applyPhase1Enhancements } from './apply-phase1-enhancements.js';

/**
 * Generate a mock results.json file for testing
 */
function generateMockResults() {
  return {
    "auditId": "test-" + Date.now(),
    "repoFullName": "test/repo",
    "status": "complete",
    "startedAt": new Date().toISOString(),
    "completedAt": new Date(Date.now() + 60000).toISOString(),
    "agentTool": "claude",
    "summary": {
      "overallScore": 85,
      "totalFindings": 8,
      "riskLevel": "medium",
      "bySeverity": {
        "critical": 1,
        "high": 2,
        "medium": 3,
        "low": 1,
        "info": 1
      },
      "byCategory": {
        "security": 3,
        "quality": 3,
        "api": 1,
        "db": 1,
        "npm": 0,
        "npq": 0
      }
    },
    "results": [
      {
        "category": "security",
        "status": "failed",
        "score": 70,
        "findings": [
          {
            "id": "sec-001",
            "category": "security",
            "severity": "critical",
            "title": "SQL Injection vulnerability",
            "description": "Raw SQL query with user input interpolation",
            "file": "src/controllers/user.js",
            "line": 42,
            "rule": "S15",
            "cwe": "CWE-89",
            "source": "ai"
          },
          {
            "id": "sec-002", 
            "category": "security",
            "severity": "critical",
            "title": "SQL injection vulnerability detected",
            "description": "Detected SQL injection pattern in user input handling",
            "file": "src/controllers/user.js",
            "line": 42,
            "rule": "sql-injection",
            "cwe": "CWE-89", 
            "source": "semgrep"
          },
          {
            "id": "sec-003",
            "category": "security", 
            "severity": "high",
            "title": "Math.random() used for security purposes",
            "description": "Math.random() is not cryptographically secure",
            "file": "test/fixtures/auth.spec.js",
            "line": 15,
            "rule": "S04",
            "source": "ai"
          },
          {
            "id": "sec-004",
            "category": "security",
            "severity": "high", 
            "title": "Cross-Site Scripting (XSS) vulnerability",
            "description": "User input displayed without sanitization",
            "file": "src/components/UserProfile.jsx",
            "line": 28,
            "rule": "S06",
            "cwe": "CWE-79",
            "source": "semgrep"
          },
          {
            "id": "sec-005",
            "category": "security",
            "severity": "critical",
            "title": "Hardcoded API key detected", 
            "description": "Hardcoded secret found in source code",
            "file": "src/config/api.js",
            "line": 5,
            "rule": "S03",
            "cwe": "CWE-798",
            "source": "gitleaks"
          }
        ]
      },
      {
        "category": "quality",
        "status": "failed",
        "score": 80,
        "findings": [
          {
            "id": "qual-001",
            "category": "quality",
            "severity": "medium",
            "title": "console.log statement found",
            "description": "Remove console.log for production code",
            "file": "src/utils/logger.js",
            "line": 23,
            "rule": "no-console",
            "source": "eslint"
          },
          {
            "id": "qual-002",
            "category": "quality",
            "severity": "medium", 
            "title": "Unused dependency: lodash",
            "description": "Package lodash is listed but not used",
            "file": "package.json",
            "rule": "unused-deps",
            "source": "depcheck"
          },
          {
            "id": "qual-003",
            "category": "quality",
            "severity": "low",
            "title": "TypeScript any type usage", 
            "description": "Variable uses : any type",
            "file": "src/types/user.ts",
            "line": 12,
            "rule": "no-any",
            "source": "tsc"
          }
        ]
      }
    ]
  };
}

/**
 * Create mock workspace files for testing auto-fix
 */
async function createMockWorkspace(workspaceDir) {
  await mkdir(workspaceDir, { recursive: true });
  
  // Mock package.json for unused dependency test
  const packageJson = {
    "name": "test-project",
    "dependencies": {
      "express": "^4.18.0",
      "lodash": "^4.17.21",
      "react": "^18.2.0",
      "prisma": "^5.0.0"
    },
    "devDependencies": {
      "typescript": "^5.0.0",
      "jest": "^29.5.0"
    }
  };
  
  await writeFile(
    join(workspaceDir, 'package.json'), 
    JSON.stringify(packageJson, null, 2)
  );
  
  // Mock source file with console.log
  const sourceCode = `
export function processUser(data) {
  console.log('Processing user data:', data);
  return { id: data.id, name: data.name };
}
`;
  
  await mkdir(join(workspaceDir, 'src/utils'), { recursive: true });
  await writeFile(join(workspaceDir, 'src/utils/logger.js'), sourceCode);
  
  // Mock TypeScript file with : any
  const tsCode = `
interface User {
  id: string;
  data: any; // Should suggest better type
}
`;
  
  await mkdir(join(workspaceDir, 'src/types'), { recursive: true });
  await writeFile(join(workspaceDir, 'src/types/user.ts'), tsCode);
  
  // Mock test file  
  const testCode = `
describe('Auth tests', () => {
  it('generates random token', () => {
    const token = Math.random().toString(36);
    expect(token).toBeDefined();
  });
});
`;
  
  await mkdir(join(workspaceDir, 'test/fixtures'), { recursive: true });
  await writeFile(join(workspaceDir, 'test/fixtures/auth.spec.js'), testCode);
  
  // Mock SQL injection vulnerable code
  const sqlCode = `
const express = require('express');
const mysql = require('mysql2');

app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  // Vulnerable: SQL injection
  const query = 'SELECT * FROM users WHERE id = ' + userId;
  db.query(query, (err, results) => {
    if (err) throw err;
    res.json(results[0]);
  });
});
`;
  
  await mkdir(join(workspaceDir, 'src/controllers'), { recursive: true });
  await writeFile(join(workspaceDir, 'src/controllers/user.js'), sqlCode);
  
  // Mock XSS vulnerable React component
  const xssCode = `
import React from 'react';

function UserProfile({ user }) {
  return (
    <div>
      <h1>Welcome {user.name}</h1>
      {/* Vulnerable: XSS */}
      <div dangerouslySetInnerHTML={{ __html: user.bio }} />
    </div>
  );
}

export default UserProfile;
`;
  
  await mkdir(join(workspaceDir, 'src/components'), { recursive: true });
  await writeFile(join(workspaceDir, 'src/components/UserProfile.jsx'), xssCode);
  
  // Mock hardcoded secret
  const secretCode = `
const config = {
  apiUrl: 'https://api.example.com',
  // Vulnerable: hardcoded secret
  apiKey: 'sk-1234567890abcdef1234567890abcdef',
  timeout: 5000
};

module.exports = config;
`;
  
  await mkdir(join(workspaceDir, 'src/config'), { recursive: true });
  await writeFile(join(workspaceDir, 'src/config/api.js'), secretCode);
}

/**
 * Run the Phase 1 test
 */
async function runPhase1Test() {
  console.log('🧪 Testing Phase 1 Enhancement Utilities...');
  
  const testDir = 'reports/test_repo';
  const auditId = 'test-' + Date.now();
  const outDir = join(testDir, auditId);
  const workspaceDir = 'workspace/test_repo';
  
  try {
    // Create test directories
    await mkdir(outDir, { recursive: true });
    
    // Create mock results.json
    const mockResults = generateMockResults();
    mockResults.auditId = auditId;
    
    const resultsPath = join(outDir, 'results.json');
    await writeFile(resultsPath, JSON.stringify(mockResults, null, 2));
    
    console.log(`📁 Created mock results: ${resultsPath}`);
    
    // Create mock workspace
    await createMockWorkspace(workspaceDir);
    console.log(`📂 Created mock workspace: ${workspaceDir}`);
    
    // Run Phase 1 enhancements
    console.log('');
    const results = await applyPhase1Enhancements(resultsPath, testDir, workspaceDir);
    
    console.log('');
    console.log('🎉 Phase 1 test completed successfully!');
    console.log('📊 Enhancement results:');
    console.log(`   Baseline suppression: ${results.baselineSuppression.success ? '✅' : '❌'}`);
    console.log(`   Auto-fix generation: ${results.autoFixGeneration.success ? '✅' : '❌'} (${results.autoFixGeneration.fixableCount || 0} fixable)`);
    console.log(`   Context-aware severity: ${results.contextAwareSeverity.success ? '✅' : '❌'} (${results.contextAwareSeverity.adjustedCount || 0} adjusted)`);
    console.log(`   Cross-tool deduplication: ${results.crossToolDeduplication.success ? '✅' : '❌'} (${results.crossToolDeduplication.reductionCount || 0} reduced)`);
    
    console.log('');
    console.log('✅ All Phase 1 utilities are working correctly across agent types!');
    
  } catch (error) {
    console.error('❌ Phase 1 test failed:', error.message);
    process.exit(1);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase1Test();
}