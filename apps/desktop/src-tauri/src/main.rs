// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{State, Manager};

pub use commands::*;

// Application state
#[derive(Debug)]
pub struct AppState {
    pub config: Mutex<AppConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub llm_providers: Vec<LLMProvider>,
    pub data_root: PathBuf,
    pub theme: String,
    pub language: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            llm_providers: vec![
                LLMProvider {
                    name: "GPT-4".to_string(),
                    provider: "openai_compatible".to_string(),
                    base_url: "https://api.openai.com/v1".to_string(),
                    model: "gpt-4".to_string(),
                    api_key: None,
                    temperature: 0.7,
                    max_tokens: Some(4000),
                    think: false,
                    alias: "gpt-4".to_string(),
                },
                LLMProvider {
                    name: "Local Ollama".to_string(),
                    provider: "ollama".to_string(),
                    base_url: "http://localhost:11434".to_string(),
                    model: "llama3.2:3b".to_string(),
                    api_key: None,
                    temperature: 0.5,
                    max_tokens: Some(2000),
                    think: true,
                    alias: "local-llama".to_string(),
                }
            ],
            data_root: home.join(".pulsar-studio"),
            theme: "light".to_string(),
            language: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMProvider {
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub temperature: f64,
    pub max_tokens: Option<u32>,
    pub think: bool,
    pub alias: String,
}

// Thread and Agent structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub name: String,
    pub working_dir: String,
    pub created_at: String,
    pub updated_at: String,
    pub agent_state: Option<AgentState>,
    pub config: Option<ThreadConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadConfig {
    pub planner_llm_alias: String,
    pub decider_llm_alias: String,
    pub selected_knowledge: Vec<String>,
    pub selected_guides: Vec<String>,
    pub selected_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub run_id: Option<String>,
    pub execution_mode: String,
    pub current_plan: Option<serde_json::Value>,
    pub last_activity: String,
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(AppConfig::default()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::initialize_data_directory,
            commands::validate_directory_permissions,
            commands::create_thread,
            commands::agent_ask,
            commands::get_agent_report,
            commands::submit_feedback,
            commands::get_all_llm_providers,
            commands::add_llm_provider,
            commands::update_llm_provider,
            commands::delete_llm_provider,
            commands::test_llm_provider,
            commands::export_providers,
            commands::import_providers,
            commands::save_config_to_file_public,
            commands::load_config_from_file,
            commands::list_guides,
            commands::load_guide,
            commands::save_guide,
            commands::delete_guide,
            commands::create_guides_directory,
            commands::list_knowledge,
            commands::load_knowledge,
            commands::save_knowledge,
            commands::delete_knowledge,
            commands::create_knowledge_directory,
            commands::list_actions,
            commands::import_action_directory,
            commands::validate_action_directory,
            commands::delete_action,
            commands::update_action_status,
            commands::get_action_status,
            commands::set_theme,
            commands::set_language,
            commands::get_theme,
            commands::get_language
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}