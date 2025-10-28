import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

// Types based on the schema
export interface KnowledgeEntry {
  name: string;
  description: string;
  content: string;
}

export interface KnowledgeMeta {
  name: string;
  version: string;
  domain?: string;
}

export interface Knowledge {
  meta: KnowledgeMeta;
  entries: KnowledgeEntry[];
  filename?: string; // Not part of the file structure, but useful for UI
}

export interface KnowledgeListItem {
  meta: KnowledgeMeta;
  filename: string;
  entryCount: number;
}

interface KnowledgeStore {
  // State
  knowledge: KnowledgeListItem[];
  currentKnowledge: Knowledge | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadKnowledge: () => Promise<void>;
  loadKnowledgeFile: (filename: string) => Promise<Knowledge>;
  saveKnowledge: (filename: string, knowledge: Knowledge) => Promise<void>;
  createKnowledge: (knowledge: Knowledge) => Promise<string>;
  deleteKnowledge: (filename: string) => Promise<void>;
  clearError: () => void;
  initializeKnowledge: () => Promise<void>;
}

const generateFilename = (knowledge: Knowledge): string => {
  return knowledge.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    + '.json';
};

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  // Initial state
  knowledge: [],
  currentKnowledge: null,
  isLoading: false,
  error: null,

  // Load all knowledge (list view)
  loadKnowledge: async () => {
    try {
      set({ isLoading: true, error: null });

      const knowledgeData = await invoke<any[]>('list_knowledge');

      const knowledge: KnowledgeListItem[] = knowledgeData.map((knowledgeData, index) => {
        // Generate a filename if not available (fallback)
        const filename = `knowledge-${index}.json`;

        return {
          meta: knowledgeData.meta,
          filename: filename,
          entryCount: knowledgeData.entries?.length || 0,
        };
      });

      set({ knowledge, isLoading: false });
    } catch (error) {
      console.error('Failed to load knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },

  // Load a specific knowledge file
  loadKnowledgeFile: async (filename: string) => {
    try {
      set({ isLoading: true, error: null });

      const knowledgeData = await invoke<Knowledge>('load_knowledge', { filename });
      knowledgeData.filename = filename;

      set({ currentKnowledge: knowledgeData, isLoading: false });
      return knowledgeData;
    } catch (error) {
      console.error('Failed to load knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Save a knowledge file (create or update)
  saveKnowledge: async (filename: string, knowledge: Knowledge) => {
    try {
      set({ isLoading: true, error: null });

      await invoke('save_knowledge', {
        filename,
        knowledgeData: knowledge
      });

      // Update current knowledge if it's the one being saved
      const { currentKnowledge } = get();
      if (currentKnowledge?.filename === filename) {
        set({
          currentKnowledge: { ...knowledge, filename },
          isLoading: false
        });
      } else {
        set({ isLoading: false });
      }

      // Reload the knowledge list
      get().loadKnowledge();
    } catch (error) {
      console.error('Failed to save knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Create a new knowledge file
  createKnowledge: async (knowledge: Knowledge) => {
    try {
      set({ isLoading: true, error: null });

      const filename = generateFilename(knowledge);

      await invoke('save_knowledge', {
        filename,
        knowledgeData: knowledge
      });

      set({ isLoading: false });

      // Reload the knowledge list
      get().loadKnowledge();

      return filename;
    } catch (error) {
      console.error('Failed to create knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Delete a knowledge file
  deleteKnowledge: async (filename: string) => {
    try {
      set({ isLoading: true, error: null });

      await invoke('delete_knowledge', { filename });

      // Clear current knowledge if it's the one being deleted
      const { currentKnowledge } = get();
      if (currentKnowledge?.filename === filename) {
        set({ currentKnowledge: null });
      }

      set({ isLoading: false });

      // Reload the knowledge list
      get().loadKnowledge();
    } catch (error) {
      console.error('Failed to delete knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Initialize knowledge directory and create default knowledge if needed
  initializeKnowledge: async () => {
    try {
      set({ isLoading: true, error: null });

      await invoke('create_knowledge_directory');

      // Load knowledge after initialization
      get().loadKnowledge();
    } catch (error) {
      console.error('Failed to initialize knowledge:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },
}));