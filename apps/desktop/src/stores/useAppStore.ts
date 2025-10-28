import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/tauri';
import i18n from '../i18n/i18n';
import {
  Thread,
  UIState,
  AppConfig,
  LLMProvider,
  GuideFile,
  KnowledgeFile,
  ActionSpec,
  CreateThreadRequest,
  AgentAskRequest,
  ThreadConfig
} from '../types';

interface AppStore extends UIState {
  // State
  threads: Thread[];
  config: AppConfig;
  guides: GuideFile[];
  knowledge: KnowledgeFile[];
  actions: ActionSpec[];
  is_loading: boolean;
  error?: string;
  llm_configs: LLMProvider[];
  showThreadModal: boolean;
  status_message?: string;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'zh';

  // Actions
  setCurrentPage: (page: UIState['current_page']) => void;
  setSelectedThreadId: (threadId?: string) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  setShowThreadModal: (show: boolean) => void;
  setStatusMessage: (message?: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'en' | 'zh') => void;

  // Thread management
  createThread: (request: CreateThreadRequest & { config: ThreadConfig }) => Promise<Thread>;
  loadThreads: () => Promise<void>;
  selectThread: (threadId: string) => void;

  // Agent operations
  agentAsk: (request: AgentAskRequest) => Promise<string>;
  getAgentReport: (runId: string) => Promise<any>;
  submitFeedback: (actionRunId: string, feedback: any) => Promise<void>;

  // Configuration
  loadConfig: () => Promise<void>;
  updateConfig: (config: AppConfig) => Promise<void>;

  // Resources
  loadGuides: () => Promise<void>;
  loadKnowledge: () => Promise<void>;
  loadActions: () => Promise<void>;
}

// Modal state moved to global store - cache cleared
export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Initial state
      current_page: 'working',
      threads: [],
      config: {
        llm_providers: [],
        data_root: '',
      },
      llm_configs: [],
      guides: [],
      knowledge: [],
      actions: [],
      is_loading: false,
      sidebar_collapsed: false,
      showThreadModal: false,
      status_message: undefined,
      theme: 'light',
      language: 'en',

      // UI Actions
      setCurrentPage: (page) => set({ current_page: page }),
      setSelectedThreadId: (threadId) => set({ selected_thread_id: threadId }),
      toggleSidebar: () => set((state) => ({ sidebar_collapsed: !state.sidebar_collapsed })),
      setLoading: (loading) => set({ is_loading: loading }),
      setError: (error) => set({ error }),
      setShowThreadModal: (show) => set({ showThreadModal: show }),
      setStatusMessage: (message) => set({ status_message: message }),
      setTheme: (theme) => {
        set({ theme });
        // Apply theme class to document root
        const root = document.documentElement;
        root.className = root.className.replace(/theme-\w+/g, '');
        root.classList.add(`theme-${theme}`);

        // Save to localStorage for persistence
        localStorage.setItem('pulsar-studio-theme', theme);
      },
      setLanguage: (language) => {
        set({ language });
        // Update i18n instance
        i18n.changeLanguage(language);
        // Save to localStorage for persistence
        localStorage.setItem('pulsar-studio-language', language);
      },

      // Thread management
      createThread: async (request) => {
        try {
          set({ is_loading: true, error: undefined });
          const thread = await invoke<Thread>('create_thread', { request });
          set((state) => ({
            threads: [...state.threads, thread],
            is_loading: false,
            selected_thread_id: thread.id,
          }));
          return thread;
        } catch (error) {
          set({ error: String(error), is_loading: false });
          throw error;
        }
      },

      loadThreads: async () => {
        try {
          set({ is_loading: true, error: undefined });
          // TODO: Implement loadThreads in Rust backend
          // const threads = await invoke<Thread[]>('list_threads');
          set({
            is_loading: false,
            // threads
          });
        } catch (error) {
          set({ error: String(error), is_loading: false });
        }
      },

      selectThread: (threadId) => {
        set({ selected_thread_id: threadId });
      },

      // Agent operations
      agentAsk: async (request) => {
        try {
          set({ is_loading: true, error: undefined });
          const runId = await invoke<string>('agent_ask', { request });

          // Update thread with new run
          set((state) => ({
            threads: state.threads.map(thread =>
              thread.id === request.thread_id
                ? {
                    ...thread,
                    agent_state: {
                      run_id: runId,
                      execution_mode: request.execution_mode,
                      last_activity: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                  }
                : thread
            ),
            is_loading: false,
          }));

          return runId;
        } catch (error) {
          set({ error: String(error), is_loading: false });
          throw error;
        }
      },

      getAgentReport: async (runId) => {
        try {
          return await invoke('get_agent_report', { runId });
        } catch (error) {
          set({ error: String(error) });
          throw error;
        }
      },

      submitFeedback: async (actionRunId, feedback) => {
        try {
          await invoke('submit_feedback', { actionRunId, feedback });
        } catch (error) {
          set({ error: String(error) });
          throw error;
        }
      },

      // Configuration
      loadConfig: async () => {
        try {
          const config = await invoke<AppConfig>('get_config');
          set({
            config,
            llm_configs: config.llm_providers
          });
        } catch (error) {
          set({ error: String(error) });
        }
      },

      updateConfig: async (config) => {
        try {
          await invoke('update_config', { config });
          set({ config });
        } catch (error) {
          set({ error: String(error) });
          throw error;
        }
      },

      // Resources
      loadGuides: async () => {
        try {
          const guides = await invoke<GuideFile[]>('list_guides');
          set({ guides });
        } catch (error) {
          set({ error: String(error) });
        }
      },

      loadKnowledge: async () => {
        try {
          const knowledge = await invoke<KnowledgeFile[]>('list_knowledge');
          set({ knowledge });
        } catch (error) {
          set({ error: String(error) });
        }
      },

      loadActions: async () => {
        try {
          const actions = await invoke<ActionSpec[]>('list_actions');
          set({ actions });
        } catch (error) {
          set({ error: String(error) });
        }
      },
    }),
    {
      name: 'app-store',
    }
  )
);