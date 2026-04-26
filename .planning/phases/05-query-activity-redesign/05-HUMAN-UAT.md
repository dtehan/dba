---
status: approved
phase: 05-query-activity-redesign
source: [05-VERIFICATION.md]
started: 2026-04-26T22:00:00Z
updated: 2026-04-26T22:00:00Z
---

## Current Test

[all tests approved by user during execution checkpoint]

## Tests

### 1. Verify data table renders 7 columns with dense rows and correct data
expected: Table shows #, Username, CPU Time, I/O Count, Elapsed, Start Time, SQL columns populated with real query data
result: approved

### 2. Click CPU Time column header twice, then click I/O Count header
expected: First click: orange up-arrow on CPU Time, data re-fetches sorted ASC. Second click: down-arrow, re-fetches DESC. Third click: CPU arrow goes neutral, I/O Count gets orange arrow
result: approved

### 3. Click each of the 5 time range preset buttons in sequence
expected: Active button shows orange border/text, data re-fetches with server-side WHERE clause, Today active by default
result: approved

### 4. Click SQL text in any table row, then close the panel and reopen on another row
expected: Slide-out panel opens from right at ~40% width, selected row highlighted, full SQL syntax highlighted, metadata header with 5 fields, copy button
result: approved

### 5. With panel open, click Explain Plan button
expected: Loading spinner, then EXPLAIN output in panel. Problematic SQL shows red error box inline
result: approved

### 6. With panel open, click Analyze button
expected: Navigates to chat, starts query-performance subagent with full SQL
result: approved

### 7. Open panel on a row, then click a sort column header
expected: Panel closes automatically, data re-fetches with new sort
result: approved

### 8. Verify no auto-refresh — only manual Refresh triggers re-fetch
expected: Idle for 2+ min shows no refresh; Refresh button triggers one fetch
result: approved

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
