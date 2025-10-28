import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import WorkingPage from './pages/WorkingPage';
import SettingsPage from './pages/SettingsPage';
import GuidesPage from './pages/GuidesPage';
import KnowledgePage from './pages/KnowledgePage';
import ActionsPage from './pages/ActionsPage';
import { useAppStore } from './stores/useAppStore';
import { useActionStore } from './stores/useActionStore';
import { invoke } from '@tauri-apps/api/tauri';

// App component with data loading
function App() {
  const { loadConfig, loadGuides, loadKnowledge, setTheme, setLanguage } = useAppStore();
  const { loadActions } = useActionStore();

  useEffect(() => {
    // Load all necessary data when app starts
    const initializeApp = async () => {
      try {
        // Initialize data directory with default files if needed
        await invoke('initialize_data_directory');

        // Restore theme from localStorage
        const savedTheme = localStorage.getItem('pulsar-studio-theme') as 'light' | 'dark' | 'system' || 'light';
        setTheme(savedTheme);

        // Restore language from localStorage
        const savedLanguage = localStorage.getItem('pulsar-studio-language') as 'en' | 'zh' || 'en';
        setLanguage(savedLanguage);

        // Load all data
        await Promise.all([
          loadConfig(),
          loadGuides(),
          loadKnowledge(),
          loadActions()
        ]);
      } catch (error) {
        console.error('Failed to initialize app data:', error);
      }
    };

    initializeApp();
  }, [loadConfig, loadGuides, loadKnowledge, loadActions, setTheme, setLanguage]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<WorkingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/actions" element={<ActionsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;