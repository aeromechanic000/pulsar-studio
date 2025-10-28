/**
 * Knowledge management for pulsar-agent-turbo.
 *
 * Manages knowledge entries from JSON files with support for local screening and optional
 * online retrieval from web search or custom APIs.
 */

import { readFile, access } from 'fs/promises';
import axios, { AxiosInstance } from 'axios';
import {
  KnowledgeEntry,
  KnowledgeFile,
  ScreeningConfig,
  OnlineConfig
} from '../types/index.js';

/**
 * Manages knowledge entries from JSON files with local and online retrieval support.
 */
export class Knowledge {
  private paths: string[];
  private screening: ScreeningConfig;
  private online?: OnlineConfig;
  private knowledge: Map<string, KnowledgeFile> = new Map();
  private httpClient: AxiosInstance;

  constructor(paths: string[], screening: ScreeningConfig, online?: OnlineConfig) {
    /** Initialize Knowledge with file paths, screening configuration, and optional online config.

    Args:
        paths: List of paths to JSON knowledge files
        screening: Screening configuration for selecting relevant entries
        online: Optional configuration for online knowledge retrieval
    */
    this.paths = paths;
    this.screening = screening;
    this.online = online;

    this.httpClient = axios.create({
      timeout: (online?.timeout || 30) * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.loadKnowledge();
  }

  private async loadKnowledge(): Promise<void> {
    /** Load all knowledge files from the specified paths. */
    for (const path of this.paths) {
      try {
        // Check if file exists
        await access(path);

        const fileContent = await readFile(path, 'utf-8');
        const data = JSON.parse(fileContent);

        // Validate knowledge file structure
        if (!this.isValidKnowledgeFile(data)) {
          console.warn(`Warning: Invalid knowledge file structure in ${path}`);
          continue;
        }

        // Parse entries
        const entries: KnowledgeEntry[] = [];
        for (const entryData of data.entries) {
          if (!this.isValidKnowledgeEntry(entryData)) {
            continue;
          }

          const entry: KnowledgeEntry = {
            name: entryData.name,
            description: entryData.description,
            content: entryData.content
          };
          entries.push(entry);
        }

        const knowledgeFile: KnowledgeFile = {
          meta: data.meta,
          entries
        };

        this.knowledge.set(path, knowledgeFile);

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, skip silently
          continue;
        }
        console.warn(`Warning: Failed to load knowledge file ${path}: ${error.message}`);
      }
    }
  }

  private isValidKnowledgeFile(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'meta' in data &&
      'entries' in data &&
      Array.isArray(data.entries)
    );
  }

  private isValidKnowledgeEntry(entry: any): boolean {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'name' in entry &&
      'description' in entry &&
      'content' in entry
    );
  }

  async select(query: string, k?: number): Promise<KnowledgeEntry[]> {
    /** Return top-k relevant entries from local knowledge for a query.

    Args:
        query: Query string to match against knowledge entries
        k: Number of entries to return (overrides screening.k if provided)

    Returns:
        List of relevant knowledge entries
    */
    const resultsK = k ?? this.screening.k;

    // Collect all entries from all loaded knowledge files
    const allEntries: Array<[KnowledgeEntry, string]> = [];
    for (const [knowledgePath, knowledgeFile] of this.knowledge.entries()) {
      for (const entry of knowledgeFile.entries) {
        allEntries.push([entry, knowledgePath]);
      }
    }

    if (allEntries.length === 0) {
      return [];
    }

    // Apply screening strategy
    let scoredEntries: Array<[KnowledgeEntry, number]>;
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

  async searchOnline(query: string, k?: number): Promise<KnowledgeEntry[]> {
    /** Optional online retrieval to get knowledge entries from external sources.

    Args:
        query: Query string for online search
        k: Number of entries to return (defaults to online.maxResults)

    Returns:
        List of knowledge entries from online sources, normalized to same entry shape
    */
    if (!this.online) {
      return [];
    }

    const resultsK = k ?? this.online.maxResults;

    try {
      if (this.online.provider === 'web') {
        return await this.webSearch(query, resultsK);
      } else if (this.online.provider === 'custom_api') {
        return await this.customApiSearch(query, resultsK);
      } else {
        console.warn(`Warning: Unknown online provider: ${this.online.provider}`);
        return [];
      }

    } catch (error: any) {
      console.warn(`Warning: Online search failed: ${error.message}`);
      return [];
    }
  }

  private async webSearch(query: string, k: number): Promise<KnowledgeEntry[]> {
    /** Perform web search and convert results to knowledge entries. */
    // This is a placeholder implementation
    // In practice, you'd use a web search API like Google Search API, Bing Search API, etc.
    console.warn('Warning: Web search not implemented - returning empty results');

    // Example of what a web search implementation might look like:
    // 1. Call web search API
    // 2. Convert search results to KnowledgeEntry objects
    // 3. Return the results

    return [];
  }

  private async customApiSearch(query: string, k: number): Promise<KnowledgeEntry[]> {
    /** Perform search using a custom API. */
    if (!this.online?.baseUrl) {
      console.warn('Warning: Custom API search requires baseUrl');
      return [];
    }

    try {
      // Prepare request parameters
      const params = {
        query,
        limit: k,
        index: this.online.index || 'default'
      };

      const headers: Record<string, string> = {};
      if (this.online.apiKey) {
        headers['Authorization'] = `Bearer ${this.online.apiKey}`;
      }

      // Make API request
      const response = await this.httpClient.get(this.online.baseUrl, {
        params,
        headers,
      });

      const data = response.data;

      // Convert API response to KnowledgeEntry objects
      const entries: KnowledgeEntry[] = [];
      if (typeof data === 'object' && data !== null && 'results' in data && Array.isArray(data.results)) {
        for (const result of data.results.slice(0, k)) {
          if (typeof result === 'object' && result !== null) {
            const entry: KnowledgeEntry = {
              name: (result as any).title || 'Untitled',
              description: (result as any).summary || '',
              content: (result as any).content || (result as any).text || ''
            };
            entries.push(entry);
          }
        }
      }

      return entries;

    } catch (error: any) {
      console.warn(`Warning: Custom API search failed: ${error.message}`);
      return [];
    }
  }

  private keywordScreening(query: string, entries: Array<[KnowledgeEntry, string]>): Array<[KnowledgeEntry, number]> {
    /** Keyword-based screening using TF-IDF/BM25-like scoring. */
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));

    const scoredEntries: Array<[KnowledgeEntry, number]> = [];
    for (const [entry, _] of entries) {
      // Combine name, description, and content for scoring
      const text = `${entry.name} ${entry.description} ${entry.content}`.toLowerCase();
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

  private async vectorScreening(query: string, entries: Array<[KnowledgeEntry, string]>): Promise<Array<[KnowledgeEntry, number]>> {
    /** Vector-based screening using embeddings (placeholder implementation). */
    // TODO: Implement actual vector screening with embeddings
    // For now, fall back to keyword screening
    console.warn('Warning: Vector screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, entries);
  }

  private async hybridScreening(query: string, entries: Array<[KnowledgeEntry, string]>): Promise<Array<[KnowledgeEntry, number]>> {
    /** Hybrid screening combining keyword and vector approaches. */
    // TODO: Implement proper hybrid screening
    // For now, fall back to keyword screening
    console.warn('Warning: Hybrid screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, entries);
  }

  getAllEntries(): KnowledgeEntry[] {
    /** Get all knowledge entries without screening. */
    const allEntries: KnowledgeEntry[] = [];
    for (const knowledgeFile of this.knowledge.values()) {
      allEntries.push(...knowledgeFile.entries);
    }
    return allEntries;
  }

  getKnowledgeInfo(): Record<string, any> {
    /** Get information about loaded knowledge and online configuration. */
    const info: Record<string, any> = {
      loadedFiles: Array.from(this.knowledge.keys()),
      totalEntries: Array.from(this.knowledge.values()).reduce((sum, knowledge) => sum + knowledge.entries.length, 0),
      screeningStrategy: this.screening.strategy,
      screeningK: this.screening.k,
      onlineEnabled: this.online !== undefined
    };

    if (this.online) {
      info.onlineProvider = this.online.provider;
      info.onlineMaxResults = this.online.maxResults;
    }

    // Add metadata from each knowledge file
    for (const [path, knowledgeFile] of this.knowledge.entries()) {
      const fileName = path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || path;
      info[`meta_${fileName}`] = knowledgeFile.meta;
    }

    return info;
  }

  async reloadKnowledge(): Promise<void> {
    /** Reload all knowledge files from disk. */
    this.knowledge.clear();
    await this.loadKnowledge();
  }

  async addKnowledgePath(path: string): Promise<void> {
    /** Add a new knowledge file path and load it. */
    if (!this.paths.includes(path)) {
      this.paths.push(path);

      // Load the new knowledge file
      try {
        await access(path);
        const fileContent = await readFile(path, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!this.isValidKnowledgeFile(data)) {
          console.warn(`Warning: Invalid knowledge file structure in ${path}`);
          return;
        }

        const entries: KnowledgeEntry[] = [];
        for (const entryData of data.entries) {
          if (!this.isValidKnowledgeEntry(entryData)) {
            continue;
          }

          const entry: KnowledgeEntry = {
            name: entryData.name,
            description: entryData.description,
            content: entryData.content
          };
          entries.push(entry);
        }

        const knowledgeFile: KnowledgeFile = {
          meta: data.meta,
          entries
        };

        this.knowledge.set(path, knowledgeFile);

      } catch (error: any) {
        console.warn(`Warning: Failed to load knowledge file ${path}: ${error.message}`);
      }
    }
  }

  searchByName(name: string): KnowledgeEntry[] {
    /** Search for knowledge entries by name (exact or partial match). */
    const nameLower = name.toLowerCase();
    const matches: KnowledgeEntry[] = [];

    for (const knowledgeFile of this.knowledge.values()) {
      for (const entry of knowledgeFile.entries) {
        if (entry.name.toLowerCase().includes(nameLower)) {
          matches.push(entry);
        }
      }
    }

    return matches;
  }

  getKnowledgeByDomain(domain: string): KnowledgeEntry[] {
    /** Get knowledge entries from files with specific domain metadata. */
    const domainEntries: KnowledgeEntry[] = [];

    for (const knowledgeFile of this.knowledge.values()) {
      if (knowledgeFile.meta.domain === domain) {
        domainEntries.push(...knowledgeFile.entries);
      }
    }

    return domainEntries;
  }

  close(): void {
    /** Close HTTP client. */
    // Axios doesn't require explicit closing, but we can clear any ongoing requests if needed
  }
}

export * from '../types/index.js';