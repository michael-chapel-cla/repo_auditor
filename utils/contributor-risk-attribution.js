#!/usr/bin/env node

/**
 * Contributor Risk Attribution (Phase 2.4)
 * 
 * Analyzes git blame for each finding to determine which contributor introduced
 * the flagged line. This provides insights into code quality patterns and helps
 * teams understand risk distribution (informational, not punitive).
 * 
 * Features:
 * - Git blame analysis for each finding
 * - Risk scoring by contributor and severity
 * - Temporal analysis of risk introduction
 * - Bot detection and filtering
 * - Risk attribution charts data
 * 
 * Usage:
 *   node utils/contributor-risk-attribution.js <resultsPath> <workspaceDir>
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

/**
 * Severity scoring for risk calculation
 */
const SEVERITY_SCORES = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
  info: 1
};

/**
 * Get git blame information for a specific file and line
 */
async function getGitBlame(workspaceDir, filePath, lineNumber) {
  try {
    // Use git blame to get the author and commit info for the specific line
    const blameCmd = `git -C "${workspaceDir}" blame -L ${lineNumber},${lineNumber} --porcelain "${filePath}" 2>/dev/null`;
    const blameOutput = execSync(blameCmd, { encoding: 'utf8' });
    
    if (!blameOutput.trim()) {
      return null;
    }
    
    const lines = blameOutput.split('\n');
    const commitHash = lines[0].split(' ')[0];
    
    // Parse porcelain format for author info
    const authorLine = lines.find(line => line.startsWith('author '));
    const authorEmailLine = lines.find(line => line.startsWith('author-mail '));
    const authorTimeLine = lines.find(line => line.startsWith('author-time '));
    
    if (!authorLine || !authorEmailLine || !authorTimeLine) {
      return null;
    }
    
    const authorName = authorLine.replace('author ', '');
    const authorEmail = authorEmailLine.replace('author-mail <', '').replace('>', '');
    const authorTime = parseInt(authorTimeLine.replace('author-time ', ''));
    
    // Get commit summary
    const summaryLine = lines.find(line => line.startsWith('summary '));
    const commitSummary = summaryLine ? summaryLine.replace('summary ', '') : '';
    
    return {
      commitHash: commitHash.substring(0, 8),
      authorName,
      authorEmail,
      authorTime,
      authorDate: new Date(authorTime * 1000).toISOString(),
      commitSummary,
      isBot: authorEmail.includes('[bot]') || authorEmail.includes('noreply') || authorName.includes('[bot]')
    };
  } catch (error) {
    console.warn(`⚠️  Failed to get git blame for ${filePath}:${lineNumber}:`, error.message);
    return null;
  }
}

/**
 * Analyze risk attribution for all findings
 */
async function analyzeRiskAttribution(resultsPath, workspaceDir) {
  console.log(`🔍 Analyzing contributor risk attribution for ${resultsPath}`);
  console.log(`   Workspace: ${workspaceDir}`);
  console.log('');
  
  // Read current results
  const data = JSON.parse(await readFile(resultsPath, 'utf8'));
  
  const contributorRisks = new Map();
  const riskTimeline = [];
  let totalFindings = 0;
  let analyzedFindings = 0;
  
  // Process each finding
  for (const result of data.results) {
    for (const finding of result.findings) {
      totalFindings++;
      
      // Only analyze findings with specific file/line locations
      if (!finding.file || !finding.line) {
        continue;
      }
      
      console.log(`🔎 Analyzing: ${finding.file}:${finding.line} (${finding.severity})`);
      
      try {
        const blameInfo = await getGitBlame(workspaceDir, finding.file, finding.line);
        
        if (blameInfo) {
          analyzedFindings++;
          
          // Add blame info to finding
          finding.blame = blameInfo;
          
          // Calculate risk score
          const riskScore = SEVERITY_SCORES[finding.severity] || 1;
          
          // Track contributor risk
          const contributorKey = blameInfo.authorEmail;
          if (!contributorRisks.has(contributorKey)) {
            contributorRisks.set(contributorKey, {
              email: blameInfo.authorEmail,
              name: blameInfo.authorName,
              isBot: blameInfo.isBot,
              totalRiskScore: 0,
              findingsCount: 0,
              severityBreakdown: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
              },
              categories: new Set(),
              firstRiskDate: blameInfo.authorDate,
              lastRiskDate: blameInfo.authorDate
            });
          }
          
          const contributor = contributorRisks.get(contributorKey);
          contributor.totalRiskScore += riskScore;
          contributor.findingsCount++;
          contributor.severityBreakdown[finding.severity]++;
          contributor.categories.add(finding.category);
          
          // Update date range
          if (blameInfo.authorDate < contributor.firstRiskDate) {
            contributor.firstRiskDate = blameInfo.authorDate;
          }
          if (blameInfo.authorDate > contributor.lastRiskDate) {
            contributor.lastRiskDate = blameInfo.authorDate;
          }
          
          // Track timeline
          riskTimeline.push({
            date: blameInfo.authorDate,
            contributor: blameInfo.authorEmail,
            severity: finding.severity,
            category: finding.category,
            riskScore
          });
        }
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${finding.file}:${finding.line}:`, error.message);
      }
    }
  }
  
  // Convert sets to arrays and sort
  const contributors = Array.from(contributorRisks.values()).map(contributor => ({
    ...contributor,
    categories: Array.from(contributor.categories),
    averageRiskPerFinding: contributor.findingsCount > 0 ? 
      Math.round((contributor.totalRiskScore / contributor.findingsCount) * 100) / 100 : 0
  })).sort((a, b) => b.totalRiskScore - a.totalRiskScore);
  
  // Generate weekly risk timeline for the last 26 weeks
  const now = new Date();
  const weeks = [];
  for (let i = 25; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const year = weekStart.getFullYear();
    const week = Math.ceil(((weekStart - new Date(year, 0, 1)) / 86400000 + 1) / 7);
    
    const weekRisks = riskTimeline.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= weekStart && itemDate < weekEnd;
    });
    
    weeks.push({
      week: `${year}-W${week.toString().padStart(2, '0')}`,
      weekStart: weekStart.toISOString().split('T')[0],
      totalRisk: weekRisks.reduce((sum, item) => sum + item.riskScore, 0),
      findingsCount: weekRisks.length,
      contributors: [...new Set(weekRisks.map(item => item.contributor))].length
    });
  }
  
  const riskAttribution = {
    repoFullName: data.repoFullName,
    generatedAt: new Date().toISOString(),
    analysis: {
      totalFindings,
      analyzedFindings,
      coveragePercentage: totalFindings > 0 ? Math.round((analyzedFindings / totalFindings) * 100) : 0
    },
    contributors,
    riskTimeline: weeks,
    summary: {
      totalContributors: contributors.length,
      totalRiskScore: contributors.reduce((sum, c) => sum + c.totalRiskScore, 0),
      highestRiskContributor: contributors[0]?.email || null,
      averageRiskPerContributor: contributors.length > 0 ? 
        Math.round((contributors.reduce((sum, c) => sum + c.totalRiskScore, 0) / contributors.length) * 100) / 100 : 0,
      botsDetected: contributors.filter(c => c.isBot).length
    }
  };
  
  // Add risk attribution to the original results
  data.riskAttribution = riskAttribution;
  
  // Write updated results
  await writeFile(resultsPath, JSON.stringify(data, null, 2));
  
  console.log('');
  console.log('📊 Risk attribution analysis complete:');
  console.log(`   Analyzed: ${analyzedFindings}/${totalFindings} findings (${riskAttribution.analysis.coveragePercentage}%)`);
  console.log(`   Contributors: ${riskAttribution.summary.totalContributors}`);
  console.log(`   Total risk score: ${riskAttribution.summary.totalRiskScore}`);
  if (riskAttribution.summary.highestRiskContributor) {
    console.log(`   Highest risk: ${riskAttribution.summary.highestRiskContributor}`);
  }
  console.log('');
  
  return analyzedFindings;
}

/**
 * Apply contributor risk attribution to findings
 */
export async function applyContributorRiskAttribution(resultsPath, workspaceDir) {
  const enhancedCount = await analyzeRiskAttribution(resultsPath, workspaceDir);
  console.log(`💾 Enhanced results saved to ${resultsPath}`);
  return enhancedCount;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [resultsPath, workspaceDir] = process.argv.slice(2);
  
  if (!resultsPath || !workspaceDir) {
    console.error('Usage: node contributor-risk-attribution.js <resultsPath> <workspaceDir>');
    process.exit(1);
  }
  
  applyContributorRiskAttribution(resultsPath, workspaceDir)
    .then(() => console.log('✅ Risk attribution complete'))
    .catch(error => {
      console.error('❌ Risk attribution failed:', error.message);
      process.exit(1);
    });
}