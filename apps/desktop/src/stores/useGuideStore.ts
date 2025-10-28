import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

// Types based on the schema
export interface GuideEntry {
  name: string;
  description: string;
  plan: string[];
}

export interface GuideMeta {
  name: string;
  version: string;
  domain?: string;
}

export interface Guide {
  meta: GuideMeta;
  entries: GuideEntry[];
  filename?: string; // Not part of the file structure, but useful for UI
}

export interface GuideListItem {
  meta: GuideMeta;
  filename: string;
  entryCount: number;
}

interface GuideStore {
  // State
  guides: GuideListItem[];
  currentGuide: Guide | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadGuides: () => Promise<void>;
  loadGuide: (filename: string) => Promise<Guide>;
  saveGuide: (filename: string, guide: Guide) => Promise<void>;
  createGuide: (guide: Guide) => Promise<string>;
  deleteGuide: (filename: string) => Promise<void>;
  clearError: () => void;
  initializeGuides: () => Promise<void>;
}

const generateFilename = (guide: Guide): string => {
  return guide.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    + '.json';
};

export const useGuideStore = create<GuideStore>((set, get) => ({
  // Initial state
  guides: [],
  currentGuide: null,
  isLoading: false,
  error: null,

  // Load all guides (list view)
  loadGuides: async () => {
    try {
      set({ isLoading: true, error: null });

      const guidesData = await invoke<any[]>('list_guides');

      const guides: GuideListItem[] = guidesData.map((guideData, index) => {
        // Generate a filename if not available (fallback)
        const filename = `guide-${index}.json`;

        return {
          meta: guideData.meta,
          filename: filename,
          entryCount: guideData.entries?.length || 0,
        };
      });

      set({ guides, isLoading: false });
    } catch (error) {
      console.error('Failed to load guides:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },

  // Load a specific guide
  loadGuide: async (filename: string) => {
    try {
      set({ isLoading: true, error: null });

      const guideData = await invoke<Guide>('load_guide', { filename });
      guideData.filename = filename;

      set({ currentGuide: guideData, isLoading: false });
      return guideData;
    } catch (error) {
      console.error('Failed to load guide:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Save a guide (create or update)
  saveGuide: async (filename: string, guide: Guide) => {
    try {
      set({ isLoading: true, error: null });

      await invoke('save_guide', {
        filename,
        guideData: guide
      });

      // Update current guide if it's the one being saved
      const { currentGuide } = get();
      if (currentGuide?.filename === filename) {
        set({
          currentGuide: { ...guide, filename },
          isLoading: false
        });
      } else {
        set({ isLoading: false });
      }

      // Reload the guides list
      get().loadGuides();
    } catch (error) {
      console.error('Failed to save guide:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Create a new guide
  createGuide: async (guide: Guide) => {
    try {
      set({ isLoading: true, error: null });

      const filename = generateFilename(guide);

      await invoke('save_guide', {
        filename,
        guideData: guide
      });

      set({ isLoading: false });

      // Reload the guides list
      get().loadGuides();

      return filename;
    } catch (error) {
      console.error('Failed to create guide:', error);
      set({
        error: error as string,
        isLoading: false
      });
      throw error;
    }
  },

  // Delete a guide
  deleteGuide: async (filename: string) => {
    try {
      set({ isLoading: true, error: null });

      await invoke('delete_guide', { filename });

      // Clear current guide if it's the one being deleted
      const { currentGuide } = get();
      if (currentGuide?.filename === filename) {
        set({ currentGuide: null });
      }

      set({ isLoading: false });

      // Reload the guides list
      get().loadGuides();
    } catch (error) {
      console.error('Failed to delete guide:', error);
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

  // Initialize guides directory and create default guide if needed
  initializeGuides: async () => {
    try {
      set({ isLoading: true, error: null });

      await invoke('create_guides_directory');

      // Load guides after initialization
      get().loadGuides();
    } catch (error) {
      console.error('Failed to initialize guides:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },
}));