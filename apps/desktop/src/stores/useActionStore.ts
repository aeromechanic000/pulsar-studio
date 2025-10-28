import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';

// Types based on the schema
export interface ActionArgument {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ActionSpec {
  name: string;
  description: string;
  arguments: ActionArgument[];
  timeout_sec: number;
  tags?: string[];
}

export interface ActionStatus {
  status: string; // "healthy", "error", "disabled"
  last_error?: {
    message: string;
    timestamp: string; // ISO8601
    execution_id: string;
  };
  error_count: number;
  last_success?: string; // ISO8601 timestamp
}

export interface Action {
  spec: ActionSpec;
  status: ActionStatus;
  directory_name: string;
}

interface ActionStore {
  // State
  actions: Action[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'healthy' | 'error' | 'disabled';

  // Actions
  loadActions: () => Promise<void>;
  importAction: () => Promise<string | null>;
  deleteAction: (actionName: string) => Promise<void>;
  validateActionDirectory: (path: string) => Promise<{ is_valid: boolean; error?: string; missing_files?: string[] }>;
  updateActionStatus: (actionName: string, status: string, errorMessage?: string, executionId?: string) => Promise<void>;
  getActionStatus: (actionName: string) => Promise<ActionStatus>;
  clearError: () => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: 'all' | 'healthy' | 'error' | 'disabled') => void;
  getAvailableActions: () => Action[]; // Returns only healthy actions for execution
}

export const useActionStore = create<ActionStore>((set, get) => ({
  // Initial state
  actions: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'all',

  // Load all actions
  loadActions: async () => {
    try {
      set({ isLoading: true, error: null });

      const actionsData = await invoke<any[]>('list_actions');

      const actions: Action[] = [];

      for (const actionData of actionsData) {
        // Get directory name from the action data or derive it
        const directoryName = actionData.directory_name || actionData.name;

        // Get action status
        try {
          const status = await invoke<ActionStatus>('get_action_status', {
            actionName: directoryName
          });

          actions.push({
            spec: actionData,
            status,
            directory_name: directoryName,
          });
        } catch (statusError) {
          console.warn(`Failed to load status for action ${directoryName}:`, statusError);

          // Use default status if we can't load it
          actions.push({
            spec: actionData,
            status: {
              status: 'healthy',
              error_count: 0,
              last_success: new Date().toISOString(),
            },
            directory_name: directoryName,
          });
        }
      }

      set({ actions, isLoading: false });
    } catch (error) {
      console.error('Failed to load actions:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },

  // Import action from directory
  importAction: async () => {
    try {
      set({ isLoading: true, error: null });

      // Open directory picker
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Action Directory'
      });

      if (!selected || typeof selected !== 'string') {
        set({ isLoading: false });
        return null;
      }

      // Validate the selected directory
      const validation = await get().validateActionDirectory(selected);
      if (!validation.is_valid) {
        throw new Error(validation.error || 'Invalid action directory');
      }

      // Import the action
      const actionName = await invoke<string>('import_action_directory', {
        sourcePath: selected
      });

      set({ isLoading: false });

      // Reload actions to get the updated list
      get().loadActions();

      return actionName;
    } catch (error) {
      console.error('Failed to import action:', error);
      set({
        error: error as string,
        isLoading: false
      });
      return null;
    }
  },

  // Delete an action
  deleteAction: async (actionName: string) => {
    try {
      set({ isLoading: true, error: null });

      await invoke('delete_action', {
        actionName
      });

      set({ isLoading: false });

      // Reload actions to get the updated list
      get().loadActions();
    } catch (error) {
      console.error('Failed to delete action:', error);
      set({
        error: error as string,
        isLoading: false
      });
    }
  },

  // Validate action directory
  validateActionDirectory: async (path: string) => {
    try {
      const result = await invoke<{ is_valid: boolean; error?: string; missing_files?: string[] }>('validate_action_directory', {
        path
      });
      return result;
    } catch (error) {
      console.error('Failed to validate action directory:', error);
      return {
        is_valid: false,
        error: error as string
      };
    }
  },

  // Update action status
  updateActionStatus: async (actionName: string, status: string, errorMessage?: string, executionId?: string) => {
    try {
      await invoke('update_action_status', {
        actionName,
        status,
        errorMessage,
        executionId
      });

      // Reload actions to get updated status
      get().loadActions();
    } catch (error) {
      console.error('Failed to update action status:', error);
      set({ error: error as string });
    }
  },

  // Get action status
  getActionStatus: async (actionName: string) => {
    try {
      const status = await invoke<ActionStatus>('get_action_status', {
        actionName
      });
      return status;
    } catch (error) {
      console.error('Failed to get action status:', error);
      throw error;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Set search query
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  // Set status filter
  setStatusFilter: (filter: 'all' | 'healthy' | 'error' | 'disabled') => {
    set({ statusFilter: filter });
  },

  // Get available actions (only healthy ones for execution)
  getAvailableActions: () => {
    const { actions, statusFilter } = get();

    // Filter by status - only return healthy actions
    return actions.filter(action => action.status.status === 'healthy');
  },
}));