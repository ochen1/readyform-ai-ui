# Page-by-Page Parallel Enhancement Architecture

## Overview

This document describes the architecture for processing large PDF forms (7+ pages, 150+ fields) by analyzing them page-by-page in parallel while maintaining full document context for Gemini AI.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Concurrency | ALL pages parallel | Maximize speed, Gemini handles it |
| Caching | Page-level | Granular re-processing, faster cache hits |
| Retry Policy | 1 retry per page | Balance reliability vs. speed |
| Warning Threshold | >4 pages | Alert user to expected processing time |
| Progress Persistence | None | No backend available |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PDF Upload Flow                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌───────────────────────────────────────────┐ │
│  │  User drops  │───>│  pdfParser.ts                              │ │
│  │  PDF file    │    │  - Extract fields with PAGE NUMBERS        │ │
│  │              │    │  - Render ALL pages as images              │ │
│  └──────────────┘    │  - Group fields by page                    │ │
│                      └───────────────────────────────────────────┘ │
│                                    │                                 │
│                                    v                                 │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  FormContext.tsx                                               │ │
│  │  1. dispatch(LOAD_PDF) - show basic fields immediately         │ │
│  │  2. Check page count - show warning if >4 pages                │ │
│  │  3. dispatch(START_ENHANCEMENT) with page info                 │ │
│  │  4. Call pageByPageEnhancer.enhanceAllPages()                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                    │                                 │
│                                    v                                 │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  pageByPageEnhancer.ts - PARALLEL PROCESSING                   │ │
│  │                                                                 │ │
│  │  For EACH page (all in parallel via Promise.all):              │ │
│  │                                                                 │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │ Page 1  │ │ Page 2  │ │ Page 3  │ │ Page 4  │ │ Page N  │ │ │
│  │  │ ○→●→✓  │ │ ○→●→✓  │ │ ○→●→✓  │ │ ○→●→✓  │ │ ○→●→✓  │ │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │ │
│  │       │           │           │           │           │       │ │
│  │       v           v           v           v           v       │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  Each page calls: analyzeFormPageWithGemini()            │ │ │
│  │  │  - Sends FULL PDF for context                            │ │ │
│  │  │  - Specifies target page number                          │ │ │
│  │  │  - Lists field IDs on that page                          │ │ │
│  │  │  - Gets back: fields[], sections[] for that page only    │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  On completion: mergePageResults()                             │ │
│  │  - Combine all page results                                    │ │
│  │  - Deduplicate sections                                        │ │
│  │  - Order fields by page, then original order                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                    │                                 │
│                                    v                                 │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  dispatch(COMPLETE_ENHANCEMENT)                                │ │
│  │  - Enhanced fields with full metadata                          │ │
│  │  - Sections identified across all pages                        │ │
│  │  - Ready for voice assistant                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. PDF Parser Output (Enhanced)

```typescript
interface ParsedPDF {
  fields: FormField[];           // Now includes pageNumber
  fieldsByPage: Map<number, FormField[]>;  // NEW: Grouped by page
  metadata: FormMetadata;
  writeContext: PDFWriteContext;
  pdfBytes: Uint8Array;
  pageImages: string[];          // ALL pages rendered
  pageCount: number;             // NEW: Total page count
}

interface FormField {
  // ...existing fields...
  pageNumber: number;            // NEW: Which page this field is on (1-indexed)
}
```

### 2. Page Enhancement Request

```typescript
// What we send to Gemini for each page
interface PageEnhancementRequest {
  pdfBytes: Uint8Array;          // Full PDF for context
  targetPage: number;            // Which page to analyze (1-indexed)
  fieldIdsOnPage: string[];      // Only these fields should be in output
  allPageImages: string[];       // All page images for visual context
}
```

### 3. Page Enhancement Response

```typescript
// What Gemini returns for each page
interface PageEnhancementResponse {
  pageNumber: number;
  fields: EnhancedField[];       // Only fields for this page
  sections: FormSection[];       // Sections that appear on this page
  pageTitle?: string;            // Optional page-specific title
}
```

### 4. Processing State

```typescript
interface PageProcessingStatus {
  pageNumber: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  fieldCount: number;
  error?: string;
  retryCount: number;
}

interface EnhancementProgress {
  totalPages: number;
  completedPages: number;
  errorPages: number;
  pageStatuses: PageProcessingStatus[];
  startTime: number;
}
```

## Gemini API Prompt Changes

The prompt needs to be modified to:
1. Understand it's receiving the FULL PDF for context
2. Know it should ONLY output fields for a specific page
3. List the exact field IDs expected in the output

### Updated Prompt Structure

```
# Form Field Analysis for Voice Assistant - PAGE SPECIFIC

You are analyzing a PDF form. You have access to the ENTIRE document for context, 
but you should ONLY output analysis for the fields on PAGE {pageNumber}.

## Your Task

Analyze the entire PDF to understand the form's structure and purpose, but ONLY 
return JSON for the following fields which appear on page {pageNumber}:

{fieldIdList}

## IMPORTANT

- Use context from OTHER pages to understand field purposes
- Look at section headers that may span multiple pages
- But ONLY include the listed fields in your output
- If a section starts on a previous page and continues here, include it

## Field Names on Page {pageNumber}

- "Field ID 1"
- "Field ID 2"
...

[Rest of existing prompt for field types, output format, etc.]
```

## Caching Strategy

### Page-Level Cache Keys

```typescript
// Cache key format
const cacheKey = `form-enhance-page:${pdfHash}:page${pageNumber}`;

// Example
"form-enhance-page:a1b2c3d4:page1"
"form-enhance-page:a1b2c3d4:page2"
```

### Cache Structure

```typescript
interface PageCache {
  pdfHash: string;
  pageNumber: number;
  timestamp: number;
  result: PageEnhancementResponse;
}
```

### Cache Benefits

1. **Partial Re-processing**: If page 3 fails, only retry page 3
2. **Incremental Updates**: If PDF is slightly modified, unchanged pages use cache
3. **Faster Development**: Don't re-process entire form during testing

## Error Handling Flow

```
Page Processing:
  ┌─────────────────────┐
  │ Start Processing    │
  │ Page N              │
  └──────────┬──────────┘
             │
             v
  ┌─────────────────────┐
  │ Check Page Cache    │
  └──────────┬──────────┘
             │
    ┌────────┴────────┐
    │ Cache Hit?      │
    └────────┬────────┘
             │
     Yes ────┴──── No
      │            │
      v            v
  ┌───────┐   ┌─────────────────────┐
  │ Use   │   │ Call Gemini API     │
  │ Cache │   └──────────┬──────────┘
  └───┬───┘              │
      │         ┌────────┴────────┐
      │         │ Success?        │
      │         └────────┬────────┘
      │                  │
      │          Yes ────┴──── No
      │           │            │
      │           v            v
      │     ┌───────────┐  ┌─────────────────┐
      │     │ Cache     │  │ Retry Count < 1?│
      │     │ Result    │  └────────┬────────┘
      │     └─────┬─────┘           │
      │           │         Yes ────┴──── No
      │           │          │            │
      │           │          v            v
      │           │     ┌─────────┐  ┌──────────┐
      │           │     │ Retry   │  │ Mark as  │
      │           │     │ Once    │  │ Error    │
      │           │     └────┬────┘  └────┬─────┘
      │           │          │            │
      v           v          v            v
  ┌───────────────────────────────────────────┐
  │ Update Progress: Page N Complete/Error    │
  │ dispatch(UPDATE_PAGE_PROGRESS)            │
  └───────────────────────────────────────────┘
```

## UI Progress Component

### Visual Design

```
┌────────────────────────────────────────────────────┐
│  ⚠️ Large Form Detected                            │
│  This form has 7 pages and will take a moment      │
│  to analyze. You can start filling visible fields  │
│  while we enhance them.                            │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  Analyzing Form Structure...                        │
│                                                     │
│  ████████████████░░░░░░░░░░░░░░░░░░░░  43%        │
│                                                     │
│  ✓ Page 1  (12 fields) ─────────────── Complete   │
│  ✓ Page 2  (18 fields) ─────────────── Complete   │
│  ● Page 3  (24 fields) ─────────────── Processing │
│  ○ Page 4  (15 fields) ─────────────── Pending    │
│  ○ Page 5  (22 fields) ─────────────── Pending    │
│  ○ Page 6  (31 fields) ─────────────── Pending    │
│  ○ Page 7  (8 fields)  ─────────────── Pending    │
│                                                     │
│  3 of 7 pages complete                             │
└────────────────────────────────────────────────────┘
```

### Component Props

```typescript
interface ProcessingProgressProps {
  progress: EnhancementProgress;
  showWarning: boolean;
  pageCount: number;
}
```

## Files to Modify/Create

### New Files

1. **`src/services/pageByPageEnhancer.ts`**
   - `enhanceAllPages()` - Main orchestration function
   - `processPage()` - Single page processing with retry
   - `mergePageResults()` - Combine all page results

2. **`src/components/ProcessingProgress.tsx`**
   - Progress bar with page-level details
   - Warning banner for large forms

### Modified Files

1. **`src/store/types.ts`**
   - Add `pageNumber` to `FormField`
   - Add `PageProcessingStatus` interface
   - Add `EnhancementProgress` interface
   - Add new action types

2. **`src/services/pdfParser.ts`**
   - Track page number during annotation extraction
   - Add `fieldsByPage` grouping
   - Add `pageCount` to output

3. **`src/services/geminiService.ts`**
   - Add `analyzeFormPageWithGemini()` function
   - Update prompt for page-specific analysis

4. **`src/services/enhancementCache.ts`**
   - Add page-level caching functions
   - `getCachedPageEnhancement()`
   - `cachePageEnhancement()`

5. **`src/store/formReducer.ts`**
   - Add `enhancementProgress` to state
   - Handle `UPDATE_PAGE_PROGRESS` action
   - Handle `SET_ENHANCEMENT_PROGRESS` action

6. **`src/store/FormContext.tsx`**
   - Use `pageByPageEnhancer` instead of `fieldEnhancer`
   - Dispatch progress updates
   - Show warning for large forms

7. **`src/components/SimpleForm.tsx`**
   - Render `ProcessingProgress` component
   - Show warning banner when needed

## Implementation Order

1. **Types first** (`types.ts`) - Foundation for everything
2. **PDF Parser** (`pdfParser.ts`) - Get page numbers
3. **Cache Service** (`enhancementCache.ts`) - Page-level caching
4. **Gemini Service** (`geminiService.ts`) - Page-specific API call
5. **Page Enhancer** (`pageByPageEnhancer.ts`) - Orchestration
6. **Reducer** (`formReducer.ts`) - State management
7. **Progress Component** (`ProcessingProgress.tsx`) - UI
8. **Form Context** (`FormContext.tsx`) - Integration
9. **Simple Form** (`SimpleForm.tsx`) - Display

## Success Criteria

- [ ] 7-page form processes in under 30 seconds
- [ ] Progress UI updates in real-time
- [ ] Failed pages show error status without breaking others
- [ ] Cache hits skip API calls correctly
- [ ] Warning appears for forms > 4 pages
- [ ] All fields retain correct page order after merge