/**
 * Guide management for pulsar-agent-turbo.
 *
 * Manages planning guides from JSON files with support for different screening strategies
 * (keyword, vector, hybrid) to retrieve relevant guide entries.
 */

import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  GuideEntry,
  GuideFile,
  ScreeningConfig
} from '../types/index.js';

/**
 * Manages planning guides from JSON files with screening support.
 */
export class Guide {
  private paths: string[];
  private screening: ScreeningConfig;
  private guides: Map<string, GuideFile> = new Map();

  constructor(paths: string[], screening: ScreeningConfig) {
    /** Initialize Guide with file paths and screening configuration.

    Args:
        paths: List of paths to JSON guide files
        screening: Screening configuration for selecting relevant entries
    */
    this.paths = paths;
    this.screening = screening;
    this.loadGuides();
  }

  private async loadGuides(): Promise<void> {
    /** Load all guide files from the specified paths. */
    for (const path of this.paths) {
      try {
        // Check if file exists
        await access(path);

        const fileContent = await readFile(path, 'utf-8');
        const data = JSON.parse(fileContent);

        // Validate guide file structure
        if (!this.isValidGuideFile(data)) {
          console.warn(`Warning: Invalid guide file structure in ${path}`);
          continue;
        }

        // Parse entries
        const entries: GuideEntry[] = [];
        for (const entryData of data.entries) {
          if (!this.isValidGuideEntry(entryData)) {
            continue;
          }

          const entry: GuideEntry = {
            name: entryData.name,
            description: entryData.description,
            plan: Array.isArray(entryData.plan) ? entryData.plan : [String(entryData.plan)]
          };
          entries.push(entry);
        }

        const guideFile: GuideFile = {
          meta: data.meta,
          entries
        };

        this.guides.set(path, guideFile);

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, skip silently
          continue;
        }
        console.warn(`Warning: Failed to load guide file ${path}: ${error.message}`);
      }
    }
  }

  private isValidGuideFile(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'meta' in data &&
      'entries' in data &&
      Array.isArray(data.entries)
    );
  }

  private isValidGuideEntry(entry: any): boolean {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'name' in entry &&
      'description' in entry &&
      'plan' in entry
    );
  }

  async select(query: string, k?: number): Promise<GuideEntry[]> {
    /** Return top-k relevant entries for a query using the configured screening strategy.

    Args:
        query: Query string to match against guide entries
        k: Number of entries to return (overrides screening.k if provided)

    Returns:
        List of relevant guide entries
    */
    const resultsK = k ?? this.screening.k;

    // Collect all entries from all loaded guides
    const allEntries: Array<[GuideEntry, string]> = [];
    for (const [guidePath, guideFile] of this.guides.entries()) {
      for (const entry of guideFile.entries) {
        allEntries.push([entry, guidePath]);
      }
    }

    if (allEntries.length === 0) {
      return [];
    }

    // Apply screening strategy
    let scoredEntries: Array<[GuideEntry, number]>;
    if (this.screening.strategy === 'keyword') {
      scoredEntries = this.keywordScreening(query, allEntries);
    } else if (this.screening.strategy === 'vector') {
      scoredEntries = await this.vectorScreening(query, allEntries);
    } else if (this.screening.strategy === 'hybrid') {
      scoredEntries = await this.hybridScreening(query, allEntries);
    } else {
      // Default to keyword screening for unknown strategies
      scoredEntries = this.keywordScreening(query, allEntries);
    }

    // Sort by score (descending) and return top-k
    scoredEntries.sort((a, b) => b[1] - a[1]);
    return scoredEntries.slice(0, resultsK).map(([entry]) => entry);
  }

  private keywordScreening(query: string, entries: Array<[GuideEntry, string]>): Array<[GuideEntry, number]> {
    /** Keyword-based screening using TF-IDF/BM25-like scoring. */
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));

    const scoredEntries: Array<[GuideEntry, number]> = [];
    for (const [entry, _] of entries) {
      // Combine name, description, and plan for scoring
      const text = `${entry.name} ${entry.description} ${entry.plan.join(' ')}`.toLowerCase();
      const textTerms = new Set(text.split(/\s+/));

      // Simple scoring: count matching terms
      const matchCount = [...queryTerms].filter(term => textTerms.has(term)).length;
      if (matchCount > 0) {
        // Normalize by text length for basic TF-IDF-like behavior
        const score = textTerms.size > 0 ? matchCount / textTerms.size : 0;
        scoredEntries.push([entry, score]);
      }
    }

    return scoredEntries;
  }

  private async vectorScreening(query: string, entries: Array<[GuideEntry, string]>): Promise<Array<[GuideEntry, number]>> {
    /** Vector-based screening using embeddings (placeholder implementation). */
    // TODO: Implement actual vector screening with embeddings
    // For now, fall back to keyword screening
    console.warn('Warning: Vector screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, entries);
  }

  private async hybridScreening(query: string, entries: Array<[GuideEntry, string]>): Promise<Array<[GuideEntry, number]>> {
    /** Hybrid screening combining keyword and vector approaches. */
    // TODO: Implement proper hybrid screening
    // For now, fall back to keyword screening
    console.warn('Warning: Hybrid screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, entries);
  }

  getAllEntries(): GuideEntry[] {
    /** Get all guide entries without screening. */
    const allEntries: GuideEntry[] = [];
    for (const guideFile of this.guides.values()) {
      allEntries.push(...guideFile.entries);
    }
    return allEntries;
  }

  getGuideInfo(): Record<string, any> {
    /** Get information about loaded guides. */
    const info: Record<string, any> = {
      loadedFiles: Array.from(this.guides.keys()),
      totalEntries: Array.from(this.guides.values()).reduce((sum, guide) => sum + guide.entries.length, 0),
      screeningStrategy: this.screening.strategy,
      screeningK: this.screening.k
    };

    // Add metadata from each guide
    for (const [path, guideFile] of this.guides.entries()) {
      const fileName = path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || path;
      info[`meta_${fileName}`] = guideFile.meta;
    }

    return info;
  }

  async reloadGuides(): Promise<void> {
    /** Reload all guide files from disk. */
    this.guides.clear();
    await this.loadGuides();
  }

  async addGuidePath(path: string): Promise<void> {
    /** Add a new guide file path and load it. */
    if (!this.paths.includes(path)) {
      this.paths.push(path);

      // Load the new guide file
      try {
        await access(path);
        const fileContent = await readFile(path, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!this.isValidGuideFile(data)) {
          console.warn(`Warning: Invalid guide file structure in ${path}`);
          return;
        }

        const entries: GuideEntry[] = [];
        for (const entryData of data.entries) {
          if (!this.isValidGuideEntry(entryData)) {
            continue;
          }

          const entry: GuideEntry = {
            name: entryData.name,
            description: entryData.description,
            plan: Array.isArray(entryData.plan) ? entryData.plan : [String(entryData.plan)]
          };
          entries.push(entry);
        }

        const guideFile: GuideFile = {
          meta: data.meta,
          entries
        };

        this.guides.set(path, guideFile);

      } catch (error: any) {
        console.warn(`Warning: Failed to load guide file ${path}: ${error.message}`);
      }
    }
  }

  searchByName(name: string): GuideEntry[] {
    /** Search for guide entries by name (exact or partial match). */
    const nameLower = name.toLowerCase();
    const matches: GuideEntry[] = [];

    for (const guideFile of this.guides.values()) {
      for (const entry of guideFile.entries) {
        if (entry.name.toLowerCase().includes(nameLower)) {
          matches.push(entry);
        }
      }
    }

    return matches;
  }

  getGuideByDomain(domain: string): GuideEntry[] {
    /** Get guide entries from files with specific domain metadata. */
    const domainEntries: GuideEntry[] = [];

    for (const guideFile of this.guides.values()) {
      if (guideFile.meta.domain === domain) {
        domainEntries.push(...guideFile.entries);
      }
    }

    return domainEntries;
  }
}

export * from '../types/index.js';