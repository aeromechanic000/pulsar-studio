use crate::{AppState, AppConfig, LLMProvider, Thread, AgentState, ThreadConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::fs;
use tauri::{State, Manager};
use tokio::process::{Command as TokioCommand};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateThreadRequest {
    pub name: String,
    pub working_dir: PathBuf,
    pub planner_llm_alias: String,
    pub decider_llm_alias: String,
    pub selected_knowledge: Vec<String>,
    pub selected_guides: Vec<String>,
    pub selected_actions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryPermissionResult {
    pub path: String,
    pub exists: bool,
    pub readable: bool,
    pub writable: bool,
    pub is_directory: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentAskRequest {
    pub thread_id: String,
    pub text: String,
    pub files: Vec<String>,
    pub execution_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeAgentRequest {
    pub action: String,
    pub thread_id: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeAgentResponse {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

// Initialize data directory structure
fn init_data_dir(data_root: &PathBuf) -> Result<(), String> {
    let dirs = ["guides", "knowledge", "actions", "saves", "logs"];
    for dir in &dirs {
        let dir_path = data_root.join(dir);
        if !dir_path.exists() {
            fs::create_dir_all(&dir_path)
                .map_err(|e| format!("Failed to create directory {}: {}", dir, e))?;
        }
    }
    Ok(())
}

// Initialize default data if directory doesn't exist
fn init_default_data(data_root: &PathBuf) -> Result<(), String> {
    // Create directories first
    init_data_dir(data_root)?;

    // Create config.json if it doesn't exist
    let config_path = data_root.join("config.json");
    if !config_path.exists() {
        let default_config = serde_json::json!({
            "llm_providers": [
                {
                    "name": "GPT-4",
                    "provider": "openai_compatible",
                    "base_url": "https://api.openai.com/v1",
                    "model": "gpt-4",
                    "api_key": null,
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "think": false,
                    "alias": "gpt-4"
                },
                {
                    "name": "Local Ollama",
                    "provider": "ollama",
                    "base_url": "http://localhost:11434",
                    "model": "llama3.2:3b",
                    "api_key": null,
                    "temperature": 0.5,
                    "max_tokens": 2000,
                    "think": true,
                    "alias": "local-llama"
                }
            ],
            "data_root": data_root.to_string_lossy()
        });

        let content = serde_json::to_string_pretty(&default_config)
            .map_err(|e| format!("Failed to serialize default config: {}", e))?;
        fs::write(&config_path, content)
            .map_err(|e| format!("Failed to write default config: {}", e))?;
        println!("Created default config at: {:?}", config_path);
    }

    // Create default guide if it doesn't exist
    let guide_path = data_root.join("guides/software-development.json");
    if !guide_path.exists() {
        let default_guide = serde_json::json!({
            "meta": {
                "name": "Software Development Guide",
                "version": "1.0.0",
                "domain": "development"
            },
            "entries": [
                {
                    "name": "Project Setup",
                    "description": "Initial project configuration and setup",
                    "plan": [
                        "Create project structure",
                        "Configure development environment",
                        "Set up version control",
                        "Install dependencies"
                    ]
                },
                {
                    "name": "Feature Development",
                    "description": "Develop new features incrementally",
                    "plan": [
                        "Analyze requirements",
                        "Design solution approach",
                        "Implement core functionality",
                        "Write tests",
                        "Review and refactor"
                    ]
                }
            ]
        });

        let content = serde_json::to_string_pretty(&default_guide)
            .map_err(|e| format!("Failed to serialize default guide: {}", e))?;
        fs::write(&guide_path, content)
            .map_err(|e| format!("Failed to write default guide: {}", e))?;
        println!("Created default guide at: {:?}", guide_path);
    }

    // Create default knowledge if it doesn't exist
    let knowledge_path = data_root.join("knowledge/software-development.json");
    if !knowledge_path.exists() {
        let default_knowledge = serde_json::json!({
            "meta": {
                "name": "Software Development Knowledge",
                "version": "1.0.0",
                "domain": "development"
            },
            "entries": [
                {
                    "name": "React Best Practices",
                    "description": "Essential practices for React development",
                    "content": "Use functional components with hooks, follow component composition patterns, implement proper error handling, use React.memo for performance optimization, follow proper state management patterns."
                },
                {
                    "name": "TypeScript Guidelines",
                    "description": "TypeScript development standards and conventions",
                    "content": "Use strict type checking, prefer interfaces over types for object shapes, use generics for reusable code, avoid 'any' type, implement proper error boundaries, use type guards for runtime type checking."
                },
                {
                    "name": "Git Workflow",
                    "description": "Version control best practices and workflows",
                    "content": "Use feature branches for new development, write clear commit messages, use pull requests for code review, maintain clean commit history, resolve conflicts properly, use semantic versioning."
                }
            ]
        });

        let content = serde_json::to_string_pretty(&default_knowledge)
            .map_err(|e| format!("Failed to serialize default knowledge: {}", e))?;
        fs::write(&knowledge_path, content)
            .map_err(|e| format!("Failed to write default knowledge: {}", e))?;
        println!("Created default knowledge at: {:?}", knowledge_path);
    }

    println!("Default data initialized in: {:?}", data_root);
    Ok(())
}


// Node.js agent integration
async fn call_node_agent(request: NodeAgentRequest) -> Result<NodeAgentResponse, String> {
    // For now, we'll return a mock response
    // In a real implementation, this would spawn a Node.js process or use NAPI-RS
    match request.action.as_str() {
        "create_agent" => Ok(NodeAgentResponse {
            success: true,
            data: Some(serde_json::json!({
                "agent_id": request.thread_id
            })),
            error: None,
        }),
        "ask_agent" => {
            let run_id = uuid::Uuid::new_v4().to_string();
            Ok(NodeAgentResponse {
                success: true,
                data: Some(serde_json::json!({
                    "run_id": run_id,
                    "status": "started"
                })),
                error: None,
            })
        },
        "get_report" => Ok(NodeAgentResponse {
            success: true,
            data: Some(serde_json::json!({
                "run_id": request.data.get("run_id").unwrap_or(&serde_json::Value::Null),
                "status": "completed",
                "summary": "Mock agent response - Node.js integration needed"
            })),
            error: None,
        }),
        _ => Err(format!("Unknown action: {}", request.action)),
    }
}

// Tauri commands
#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<AppConfig, String> {
    let config = state.config.lock().unwrap().clone();
    Ok(config)
}

#[tauri::command]
pub async fn initialize_data_directory(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    init_default_data(data_root)?;
    Ok(format!("Data directory initialized: {:?}", data_root))
}

#[tauri::command]
pub async fn validate_directory_permissions(
    path: String,
) -> Result<DirectoryPermissionResult, String> {
    use std::path::Path;

    let path_obj = Path::new(&path);

    let result = DirectoryPermissionResult {
        path: path.clone(),
        exists: path_obj.exists(),
        readable: false,
        writable: false,
        is_directory: path_obj.is_dir(),
        error: None,
    };

    if !path_obj.exists() {
        return Ok(DirectoryPermissionResult {
            error: Some("Directory does not exist".to_string()),
            ..result
        });
    }

    if !path_obj.is_dir() {
        return Ok(DirectoryPermissionResult {
            error: Some("Path is not a directory".to_string()),
            ..result
        });
    }

    // Check read permissions
    let readable = match std::fs::read_dir(&path) {
        Ok(_) => true,
        Err(e) => {
            return Ok(DirectoryPermissionResult {
                error: Some(format!("Cannot read directory: {}", e)),
                ..result
            });
        }
    };

    // Check write permissions by trying to create a temporary file
    let writable = match std::fs::write(path_obj.join(".pulsar_test"), "") {
        Ok(_) => {
            // Clean up the test file
            let _ = std::fs::remove_file(path_obj.join(".pulsar_test"));
            true
        }
        Err(e) => {
            return Ok(DirectoryPermissionResult {
                error: Some(format!("Cannot write to directory: {}", e)),
                readable,
                ..result
            });
        }
    };

    Ok(DirectoryPermissionResult {
        readable,
        writable,
        ..result
    })
}

#[tauri::command]
pub async fn create_thread(
    request: CreateThreadRequest,
    state: State<'_, AppState>,
    _app_handle: tauri::AppHandle,
) -> Result<Thread, String> {
    let thread_id = uuid::Uuid::new_v4().to_string();

    // Initialize data directory and default data
    let data_root = &state.config.lock().unwrap().data_root;
    init_default_data(data_root)?;

    // Save thread to file
    let created_at = chrono::Utc::now().to_rfc3339();
    let saves_dir = data_root.join("saves");
    let thread_file = saves_dir.join(format!("{}.json", thread_id));
    let config_data = serde_json::json!({
        "plannerLlmAlias": request.planner_llm_alias,
        "deciderLlmAlias": request.decider_llm_alias,
        "selectedKnowledge": request.selected_knowledge,
        "selectedGuides": request.selected_guides,
        "selectedActions": request.selected_actions
    });

    let thread_data = serde_json::json!({
        "id": thread_id,
        "name": request.name,
        "working_dir": request.working_dir,
        "created_at": created_at,
        "updated_at": created_at,
        "agent_state": null,
        "config": config_data
    });

    fs::write(&thread_file, serde_json::to_string_pretty(&thread_data).unwrap())
        .map_err(|e| format!("Failed to save thread: {}", e))?;
    let thread = Thread {
        id: thread_id,
        name: request.name,
        working_dir: request.working_dir.to_string_lossy().to_string(),
        created_at: created_at.clone(),
        updated_at: created_at,
        agent_state: None,
        config: Some(ThreadConfig {
            planner_llm_alias: request.planner_llm_alias,
            decider_llm_alias: request.decider_llm_alias,
            selected_knowledge: request.selected_knowledge,
            selected_guides: request.selected_guides,
            selected_actions: request.selected_actions,
        }),
    };

    Ok(thread)
}

#[tauri::command]
pub async fn agent_ask(
    request: AgentAskRequest,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Call Node.js agent
    let node_request = NodeAgentRequest {
        action: "ask_agent".to_string(),
        thread_id: request.thread_id.clone(),
        data: serde_json::json!({
            "text": request.text,
            "files": request.files,
            "execution_mode": request.execution_mode
        }),
    };

    let response = call_node_agent(node_request).await?;

    if response.success {
        if let Some(data) = response.data {
            if let Some(run_id) = data.get("run_id").and_then(|v| v.as_str()) {
                return Ok(run_id.to_string());
            }
        }
        Err("Invalid response from agent".to_string())
    } else {
        Err(response.error.unwrap_or_else(|| "Unknown error".to_string()))
    }
}

#[tauri::command]
pub async fn get_agent_report(
    run_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let node_request = NodeAgentRequest {
        action: "get_report".to_string(),
        thread_id: "".to_string(), // Not used for this operation
        data: serde_json::json!({
            "run_id": run_id
        }),
    };

    let response = call_node_agent(node_request).await?;

    if response.success {
        response.data.ok_or_else(|| "No data returned".to_string())
    } else {
        Err(response.error.unwrap_or_else(|| "Unknown error".to_string()))
    }
}

#[tauri::command]
pub async fn submit_feedback(
    action_run_id: String,
    feedback: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // TODO: Implement feedback submission
    println!("Feedback submitted for action {}: {}", action_run_id, feedback);
    Ok(())
}


#[tauri::command]
pub async fn get_all_llm_providers(
    state: State<'_, AppState>,
) -> Result<Vec<LLMProvider>, String> {
    let config = state.config.lock().unwrap();
    Ok(config.llm_providers.clone())
}

#[tauri::command]
pub async fn add_llm_provider(
    provider: LLMProvider,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();

    // Check if alias already exists
    if config.llm_providers.iter().any(|p| p.alias == provider.alias) {
        return Err(format!("Provider with alias '{}' already exists", provider.alias));
    }

    config.llm_providers.push(provider);

    // Save to file
    save_config_to_file(&config)?;
    Ok(())
}

#[tauri::command]
pub async fn update_llm_provider(
    id: String,
    provider: LLMProvider,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();

    // Find and update provider by alias (using alias as ID for simplicity)
    if let Some(index) = config.llm_providers.iter().position(|p| p.alias == id) {
        config.llm_providers[index] = provider;
        save_config_to_file(&config)?;
        Ok(())
    } else {
        Err(format!("Provider with alias '{}' not found", id))
    }
}

#[tauri::command]
pub async fn delete_llm_provider(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();

    let initial_len = config.llm_providers.len();
    config.llm_providers.retain(|p| p.alias != id);

    if config.llm_providers.len() < initial_len {
        save_config_to_file(&config)?;
        Ok(())
    } else {
        Err(format!("Provider with alias '{}' not found", id))
    }
}


#[tauri::command]
pub async fn save_config_to_file_public(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let config = state.config.lock().unwrap();
    save_config_to_file(&config)
}

#[tauri::command]
pub async fn load_config_from_file(
    state: State<'_, AppState>,
) -> Result<Vec<LLMProvider>, String> {
    let config = state.config.lock().unwrap();
    let config_path = config.data_root.join("configs.json");

    if !config_path.exists() {
        // Create default config file if it doesn't exist
        save_config_to_file(&*config)?;
        return Ok(config.llm_providers.clone());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let loaded_config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    // Update state config and return providers
    let providers = loaded_config.llm_providers.clone();
    {
        let mut state_config = state.config.lock().unwrap();
        state_config.llm_providers = loaded_config.llm_providers;
    }

    Ok(providers)
}

// Helper function to save config to file
fn save_config_to_file(config: &AppConfig) -> Result<(), String> {
    let config_path = config.data_root.join("configs.json");

    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    println!("Config saved to: {:?}", config_path);
    Ok(())
}

#[tauri::command]
pub async fn list_guides(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let guides_dir = data_root.join("guides");

    if !guides_dir.exists() {
        return Ok(vec![]);
    }

    let mut guides = Vec::new();

    for entry in fs::read_dir(guides_dir).map_err(|e| format!("Failed to read guides directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read guide file: {}", e))?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse guide JSON: {}", e))?;

            guides.push(json);
        }
    }

    Ok(guides)
}

#[tauri::command]
pub async fn load_guide(
    filename: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let guides_dir = data_root.join("guides");
    let guide_path = guides_dir.join(&filename);

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    if !guide_path.exists() {
        return Err(format!("Guide file '{}' not found", filename));
    }

    let content = fs::read_to_string(&guide_path)
        .map_err(|e| format!("Failed to read guide file: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse guide JSON: {}", e))?;

    Ok(json)
}

#[tauri::command]
pub async fn save_guide(
    filename: String,
    guide_data: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let guides_dir = data_root.join("guides");

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    // Ensure filename ends with .json
    let filename = if filename.ends_with(".json") {
        filename
    } else {
        format!("{}.json", filename)
    };

    // Ensure guides directory exists
    fs::create_dir_all(&guides_dir)
        .map_err(|e| format!("Failed to create guides directory: {}", e))?;

    let guide_path = guides_dir.join(&filename);

    // Validate guide structure
    validate_guide_structure(&guide_data)?;

    let content = serde_json::to_string_pretty(&guide_data)
        .map_err(|e| format!("Failed to serialize guide data: {}", e))?;

    fs::write(&guide_path, content)
        .map_err(|e| format!("Failed to write guide file: {}", e))?;

    println!("Guide saved to: {:?}", guide_path);
    Ok(())
}

#[tauri::command]
pub async fn delete_guide(
    filename: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let guides_dir = data_root.join("guides");
    let guide_path = guides_dir.join(&filename);

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    if !guide_path.exists() {
        return Err(format!("Guide file '{}' not found", filename));
    }

    fs::remove_file(&guide_path)
        .map_err(|e| format!("Failed to delete guide file: {}", e))?;

    println!("Guide deleted: {:?}", guide_path);
    Ok(())
}

#[tauri::command]
pub async fn create_guides_directory(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let guides_dir = data_root.join("guides");

    fs::create_dir_all(&guides_dir)
        .map_err(|e| format!("Failed to create guides directory: {}", e))?;

    // Create a default guide if directory is empty
    let default_guide = serde_json::json!({
        "meta": {
            "name": "Software Development Guide",
            "version": "1.0.0",
            "domain": "development"
        },
        "entries": [
            {
                "name": "Project Setup",
                "description": "Initial project configuration and setup",
                "plan": [
                    "Create project structure",
                    "Configure development environment",
                    "Set up version control",
                    "Install dependencies"
                ]
            },
            {
                "name": "Feature Development",
                "description": "Develop new features incrementally",
                "plan": [
                    "Analyze requirements",
                    "Design solution approach",
                    "Implement core functionality",
                    "Write tests",
                    "Review and refactor"
                ]
            }
        ]
    });

    let default_path = guides_dir.join("software-development.json");

    if !default_path.exists() {
        let content = serde_json::to_string_pretty(&default_guide)
            .map_err(|e| format!("Failed to serialize default guide: {}", e))?;

        fs::write(&default_path, content)
            .map_err(|e| format!("Failed to write default guide: {}", e))?;

        println!("Default guide created at: {:?}", default_path);
    }

    Ok(())
}

// Helper function to validate guide structure
fn validate_guide_structure(guide: &serde_json::Value) -> Result<(), String> {
    // Check for required meta section
    let meta = guide.get("meta").ok_or("Missing 'meta' section")?;

    // Check required meta fields
    if !meta.get("name").and_then(|v| v.as_str()).is_some() {
        return Err("Missing or invalid 'meta.name' field".to_string());
    }

    if !meta.get("version").and_then(|v| v.as_str()).is_some() {
        return Err("Missing or invalid 'meta.version' field".to_string());
    }

    // Check for entries array
    let entries = guide.get("entries").and_then(|v| v.as_array())
        .ok_or("Missing or invalid 'entries' array")?;

    if entries.is_empty() {
        return Err("Entries array cannot be empty".to_string());
    }

    // Validate each entry
    for (index, entry) in entries.iter().enumerate() {
        let entry_path = format!("entries[{}]", index);

        if !entry.get("name").and_then(|v| v.as_str()).is_some() {
            return Err(format!("Missing or invalid '{}.name' field", entry_path));
        }

        if !entry.get("description").and_then(|v| v.as_str()).is_some() {
            return Err(format!("Missing or invalid '{}.description' field", entry_path));
        }

        let plan = entry.get("plan").and_then(|v| v.as_array())
            .ok_or(format!("Missing or invalid '{}.plan' array", entry_path))?;

        if plan.is_empty() {
            return Err(format!("'{}' plan array cannot be empty", entry_path));
        }

        // Check that each plan step is a string
        for (step_index, step) in plan.iter().enumerate() {
            if !step.as_str().is_some() {
                return Err(format!("'{}.plan[{}]' must be a string", entry_path, step_index));
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn list_knowledge(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let knowledge_dir = data_root.join("knowledge");

    if !knowledge_dir.exists() {
        return Ok(vec![]);
    }

    let mut knowledge_entries = Vec::new();

    for entry in fs::read_dir(knowledge_dir).map_err(|e| format!("Failed to read knowledge directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read knowledge file: {}", e))?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse knowledge JSON: {}", e))?;

            knowledge_entries.push(json);
        }
    }

    Ok(knowledge_entries)
}

#[tauri::command]
pub async fn list_actions(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let actions_dir = data_root.join("actions");

    if !actions_dir.exists() {
        return Ok(vec![]);
    }

    let mut actions = Vec::new();

    for entry in fs::read_dir(actions_dir).map_err(|e| format!("Failed to read actions directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let meta_file = path.join("meta.json");
            if meta_file.exists() {
                let content = fs::read_to_string(&meta_file)
                    .map_err(|e| format!("Failed to read action meta file: {}", e))?;
                let mut json: serde_json::Value = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse action meta JSON: {}", e))?;

                // Add directory_name to the action data
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    let json_obj = json.as_object_mut().unwrap();
                    json_obj.insert("directory_name".to_string(), serde_json::Value::String(dir_name.to_string()));
                }

                actions.push(json);
            }
        }
    }

    Ok(actions)
}

#[tauri::command]
pub async fn test_llm_provider(
    provider: LLMProvider,
) -> Result<serde_json::Value, String> {
    // For now, return a mock test response
    // In a real implementation, this would make an actual API call to test the provider
    println!("Testing provider: {} ({})", provider.name, provider.alias);

    // Simulate a basic test
    let test_result = serde_json::json!({
        "success": true,
        "provider": provider.name,
        "alias": provider.alias,
        "model": provider.model,
        "base_url": provider.base_url,
        "response_time_ms": 150,
        "test_message": "Connection test successful",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    Ok(test_result)
}

#[tauri::command]
pub async fn export_providers(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    let export_data = serde_json::json!({
        "version": "1.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "providers": config.llm_providers
    });

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize providers: {}", e))
}

#[tauri::command]
pub async fn import_providers(
    providers_json: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let import_data: serde_json::Value = serde_json::from_str(&providers_json)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let providers = import_data.get("providers")
        .and_then(|p| p.as_array())
        .ok_or("Invalid format: missing providers array")?;

    let mut config = state.config.lock().unwrap();
    let mut imported_count = 0;

    for provider_value in providers {
        if let Ok(provider) = serde_json::from_value::<LLMProvider>(provider_value.clone()) {
            // Check if alias already exists
            if !config.llm_providers.iter().any(|p| p.alias == provider.alias) {
                config.llm_providers.push(provider);
                imported_count += 1;
            }
        }
    }

    if imported_count > 0 {
        save_config_to_file(&*config)?;
    }

    Ok(imported_count)
}

// Knowledge Management Commands
#[tauri::command]
pub async fn load_knowledge(
    filename: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let knowledge_dir = data_root.join("knowledge");
    let knowledge_path = knowledge_dir.join(&filename);

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    if !knowledge_path.exists() {
        return Err(format!("Knowledge file '{}' not found", filename));
    }

    let content = fs::read_to_string(&knowledge_path)
        .map_err(|e| format!("Failed to read knowledge file: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse knowledge JSON: {}", e))?;

    Ok(json)
}

#[tauri::command]
pub async fn save_knowledge(
    filename: String,
    knowledge_data: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let knowledge_dir = data_root.join("knowledge");

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    // Ensure filename ends with .json
    let filename = if filename.ends_with(".json") {
        filename
    } else {
        format!("{}.json", filename)
    };

    // Ensure knowledge directory exists
    fs::create_dir_all(&knowledge_dir)
        .map_err(|e| format!("Failed to create knowledge directory: {}", e))?;

    let knowledge_path = knowledge_dir.join(&filename);

    // Validate knowledge structure
    validate_knowledge_structure(&knowledge_data)?;

    let content = serde_json::to_string_pretty(&knowledge_data)
        .map_err(|e| format!("Failed to serialize knowledge data: {}", e))?;

    fs::write(&knowledge_path, content)
        .map_err(|e| format!("Failed to write knowledge file: {}", e))?;

    println!("Knowledge saved to: {:?}", knowledge_path);
    Ok(())
}

#[tauri::command]
pub async fn delete_knowledge(
    filename: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let knowledge_dir = data_root.join("knowledge");
    let knowledge_path = knowledge_dir.join(&filename);

    // Validate filename to prevent directory traversal
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }

    if !knowledge_path.exists() {
        return Err(format!("Knowledge file '{}' not found", filename));
    }

    fs::remove_file(&knowledge_path)
        .map_err(|e| format!("Failed to delete knowledge file: {}", e))?;

    println!("Knowledge deleted: {:?}", knowledge_path);
    Ok(())
}

#[tauri::command]
pub async fn create_knowledge_directory(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let knowledge_dir = data_root.join("knowledge");

    fs::create_dir_all(&knowledge_dir)
        .map_err(|e| format!("Failed to create knowledge directory: {}", e))?;

    // Create a default knowledge entry if directory is empty
    let default_knowledge = serde_json::json!({
        "meta": {
            "name": "Software Development Knowledge",
            "version": "1.0.0",
            "domain": "development"
        },
        "entries": [
            {
                "name": "React Best Practices",
                "description": "Essential practices for React development",
                "content": "Use functional components with hooks, follow component composition patterns, implement proper error handling, use React.memo for performance optimization, follow proper state management patterns."
            },
            {
                "name": "TypeScript Guidelines",
                "description": "TypeScript development standards and conventions",
                "content": "Use strict type checking, prefer interfaces over types for object shapes, use generics for reusable code, avoid 'any' type, implement proper error boundaries, use type guards for runtime type checking."
            },
            {
                "name": "Git Workflow",
                "description": "Version control best practices and workflows",
                "content": "Use feature branches for new development, write clear commit messages, use pull requests for code review, maintain clean commit history, resolve conflicts properly, use semantic versioning."
            }
        ]
    });

    let default_path = knowledge_dir.join("software-development.json");

    if !default_path.exists() {
        let content = serde_json::to_string_pretty(&default_knowledge)
            .map_err(|e| format!("Failed to serialize default knowledge: {}", e))?;

        fs::write(&default_path, content)
            .map_err(|e| format!("Failed to write default knowledge: {}", e))?;

        println!("Default knowledge created at: {:?}", default_path);
    }

    Ok(())
}

// Helper function to validate knowledge structure
fn validate_knowledge_structure(knowledge: &serde_json::Value) -> Result<(), String> {
    // Check for required meta section
    let meta = knowledge.get("meta").ok_or("Missing 'meta' section")?;

    // Check required meta fields
    if !meta.get("name").and_then(|v| v.as_str()).is_some() {
        return Err("Missing or invalid 'meta.name' field".to_string());
    }

    if !meta.get("version").and_then(|v| v.as_str()).is_some() {
        return Err("Missing or invalid 'meta.version' field".to_string());
    }

    // Check for entries array
    let entries = knowledge.get("entries").and_then(|v| v.as_array())
        .ok_or("Missing or invalid 'entries' array")?;

    if entries.is_empty() {
        return Err("Entries array cannot be empty".to_string());
    }

    // Validate each entry
    for (index, entry) in entries.iter().enumerate() {
        let entry_path = format!("entries[{}]", index);

        if !entry.get("name").and_then(|v| v.as_str()).is_some() {
            return Err(format!("Missing or invalid '{}.name' field", entry_path));
        }

        if !entry.get("description").and_then(|v| v.as_str()).is_some() {
            return Err(format!("Missing or invalid '{}.description' field", entry_path));
        }

        if !entry.get("content").and_then(|v| v.as_str()).is_some() {
            return Err(format!("Missing or invalid '{}.content' field", entry_path));
        }
    }

    Ok(())
}

// Action Management Commands

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionStatus {
    pub status: String, // "healthy", "error", "disabled"
    pub last_error: Option<ActionError>,
    pub error_count: u32,
    pub last_success: Option<String>, // ISO8601 timestamp
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionError {
    pub message: String,
    pub timestamp: String, // ISO8601
    pub execution_id: String,
}

#[tauri::command]
pub async fn import_action_directory(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let actions_dir = data_root.join("actions");

    // Ensure actions directory exists
    fs::create_dir_all(&actions_dir)
        .map_err(|e| format!("Failed to create actions directory: {}", e))?;

    // Validate the source directory
    let validation_result = validate_action_directory_internal(&source_path)?;
    if !validation_result.is_valid {
        return Err(format!("Invalid action directory: {}", validation_result.error.unwrap_or_else(|| "Unknown error".to_string())));
    }

    // Get action name from meta.json
    let meta_path = PathBuf::from(&source_path).join("meta.json");
    let meta_content = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read meta.json: {}", e))?;
    let meta: serde_json::Value = serde_json::from_str(&meta_content)
        .map_err(|e| format!("Failed to parse meta.json: {}", e))?;

    let action_name = meta.get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing action name in meta.json")?;

    // Create target directory
    let target_dir = actions_dir.join(action_name);
    if target_dir.exists() {
        return Err(format!("Action '{}' already exists", action_name));
    }

    // Copy directory recursively
    copy_directory(&source_path, target_dir.to_str().ok_or("Invalid target path")?)?;

    // Initialize action status as healthy
    let status_data = ActionStatus {
        status: "healthy".to_string(),
        last_error: None,
        error_count: 0,
        last_success: Some(chrono::Utc::now().to_rfc3339()),
    };

    let status_path = target_dir.join("status.json");
    let status_content = serde_json::to_string_pretty(&status_data)
        .map_err(|e| format!("Failed to serialize action status: {}", e))?;

    fs::write(&status_path, status_content)
        .map_err(|e| format!("Failed to write action status: {}", e))?;

    println!("Action imported: {:?} -> {:?}", source_path, target_dir);
    Ok(action_name.to_string())
}

#[tauri::command]
pub async fn validate_action_directory(
    path: String,
) -> Result<serde_json::Value, String> {
    let result = validate_action_directory_internal(&path)?;

    let json_result = serde_json::json!({
        "is_valid": result.is_valid,
        "error": result.error,
        "missing_files": result.missing_files
    });

    Ok(json_result)
}

struct ValidationResult {
    is_valid: bool,
    error: Option<String>,
    missing_files: Vec<String>,
}

fn validate_action_directory_internal(path: &str) -> Result<ValidationResult, String> {
    let path_buf = PathBuf::from(path);

    if !path_buf.exists() || !path_buf.is_dir() {
        return Ok(ValidationResult {
            is_valid: false,
            error: Some("Directory does not exist".to_string()),
            missing_files: vec![],
        });
    }

    let mut missing_files = Vec::new();

    // Check for required files
    let required_files = ["meta.json", "perform.js"];
    for file in &required_files {
        if !path_buf.join(file).exists() {
            missing_files.push(file.to_string());
        }
    }

    if !missing_files.is_empty() {
        return Ok(ValidationResult {
            is_valid: false,
            error: Some(format!("Missing required files: {}", missing_files.join(", "))),
            missing_files,
        });
    }

    // Validate meta.json structure
    let meta_path = path_buf.join("meta.json");
    let meta_content = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read meta.json: {}", e))?;

    let meta: serde_json::Value = serde_json::from_str(&meta_content)
        .map_err(|e| format!("Failed to parse meta.json: {}", e))?;

    // Validate required meta fields
    let validation_error = validate_action_meta_structure(&meta);
    if let Some(error) = validation_error {
        return Ok(ValidationResult {
            is_valid: false,
            error: Some(error),
            missing_files: vec![],
        });
    }

    Ok(ValidationResult {
        is_valid: true,
        error: None,
        missing_files: vec![],
    })
}

fn validate_action_meta_structure(meta: &serde_json::Value) -> Option<String> {
    // Check required fields
    if !meta.get("name").and_then(|v| v.as_str()).is_some() {
        return Some("Missing or invalid 'name' field".to_string());
    }

    if !meta.get("description").and_then(|v| v.as_str()).is_some() {
        return Some("Missing or invalid 'description' field".to_string());
    }

    if !meta.get("arguments").and_then(|v| v.as_array()).is_some() {
        return Some("Missing or invalid 'arguments' array".to_string());
    }

    if !meta.get("timeout_sec").and_then(|v| v.as_u64()).is_some() {
        return Some("Missing or invalid 'timeout_sec' field".to_string());
    }

    // Validate arguments structure
    if let Some(arguments) = meta.get("arguments").and_then(|v| v.as_array()) {
        for (index, arg) in arguments.iter().enumerate() {
            let arg_path = format!("arguments[{}]", index);

            if !arg.get("name").and_then(|v| v.as_str()).is_some() {
                return Some(format!("Missing or invalid '{}.name' field", arg_path));
            }

            if !arg.get("type").and_then(|v| v.as_str()).is_some() {
                return Some(format!("Missing or invalid '{}.type' field", arg_path));
            }

            if !arg.get("description").and_then(|v| v.as_str()).is_some() {
                return Some(format!("Missing or invalid '{}.description' field", arg_path));
            }

            if !arg.get("required").and_then(|v| v.as_bool()).is_some() {
                return Some(format!("Missing or invalid '{}.required' field", arg_path));
            }
        }
    }

    None
}

fn copy_directory(source: &str, target: &str) -> Result<(), String> {
    let source_path = PathBuf::from(source);
    let target_path = PathBuf::from(target);

    fs::create_dir_all(&target_path)
        .map_err(|e| format!("Failed to create target directory: {}", e))?;

    for entry in fs::read_dir(&source_path)
        .map_err(|e| format!("Failed to read source directory: {}", e))?
    {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let source_file = entry.path();
        let target_file = target_path.join(entry.file_name());

        if source_file.is_dir() {
            copy_directory(source_file.to_str().unwrap(), target_file.to_str().unwrap())?;
        } else {
            fs::copy(&source_file, &target_file)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_action(
    action_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let actions_dir = data_root.join("actions");
    let action_dir = actions_dir.join(&action_name);

    // Validate action name to prevent directory traversal
    if action_name.contains("..") || action_name.contains("/") || action_name.contains("\\") {
        return Err("Invalid action name".to_string());
    }

    if !action_dir.exists() {
        return Err(format!("Action '{}' not found", action_name));
    }

    // Remove directory recursively
    fs::remove_dir_all(&action_dir)
        .map_err(|e| format!("Failed to delete action directory: {}", e))?;

    println!("Action deleted: {:?}", action_dir);
    Ok(())
}

#[tauri::command]
pub async fn update_action_status(
    action_name: String,
    status: String,
    error_message: Option<String>,
    execution_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let actions_dir = data_root.join("actions");
    let action_dir = actions_dir.join(&action_name);
    let status_path = action_dir.join("status.json");

    // Validate action name
    if action_name.contains("..") || action_name.contains("/") || action_name.contains("\\") {
        return Err("Invalid action name".to_string());
    }

    // Load existing status or create new one
    let mut current_status: ActionStatus = if status_path.exists() {
        let content = fs::read_to_string(&status_path)
            .map_err(|e| format!("Failed to read action status: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse action status: {}", e))?
    } else {
        ActionStatus {
            status: "healthy".to_string(),
            last_error: None,
            error_count: 0,
            last_success: None,
        }
    };

    // Update status
    current_status.status = status.clone();

    if status == "error" {
        current_status.error_count += 1;
        if let (Some(msg), Some(exec_id)) = (error_message, execution_id) {
            current_status.last_error = Some(ActionError {
                message: msg,
                timestamp: chrono::Utc::now().to_rfc3339(),
                execution_id: exec_id,
            });
        }
    } else if status == "healthy" {
        current_status.last_success = Some(chrono::Utc::now().to_rfc3339());
    }

    // Save updated status
    let content = serde_json::to_string_pretty(&current_status)
        .map_err(|e| format!("Failed to serialize action status: {}", e))?;

    fs::write(&status_path, content)
        .map_err(|e| format!("Failed to write action status: {}", e))?;

    println!("Action status updated: {} -> {}", action_name, status);
    Ok(())
}

#[tauri::command]
pub async fn get_action_status(
    action_name: String,
    state: State<'_, AppState>,
) -> Result<ActionStatus, String> {
    let data_root = &state.config.lock().unwrap().data_root;
    let actions_dir = data_root.join("actions");
    let action_dir = actions_dir.join(&action_name);
    let status_path = action_dir.join("status.json");

    // Validate action name
    if action_name.contains("..") || action_name.contains("/") || action_name.contains("\\") {
        return Err("Invalid action name".to_string());
    }

    if !status_path.exists() {
        // Return default healthy status if no status file exists
        return Ok(ActionStatus {
            status: "healthy".to_string(),
            last_error: None,
            error_count: 0,
            last_success: Some(chrono::Utc::now().to_rfc3339()),
        });
    }

    let content = fs::read_to_string(&status_path)
        .map_err(|e| format!("Failed to read action status: {}", e))?;

    let status: ActionStatus = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse action status: {}", e))?;

    Ok(status)
}

#[tauri::command]
pub async fn set_theme(
    theme: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();

    // Validate theme value
    if !["light", "dark", "system"].contains(&theme.as_str()) {
        return Err(format!("Invalid theme '{}'. Must be 'light', 'dark', or 'system'", theme));
    }

    config.theme = theme.clone();

    // Save to file
    save_config_to_file(&config)?;
    Ok(())
}

#[tauri::command]
pub async fn set_language(
    language: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();

    // Validate language value
    if !["en", "zh"].contains(&language.as_str()) {
        return Err(format!("Invalid language '{}'. Must be 'en' or 'zh'", language));
    }

    config.language = language.clone();

    // Save to file
    save_config_to_file(&config)?;
    Ok(())
}

#[tauri::command]
pub async fn get_theme(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    Ok(config.theme.clone())
}

#[tauri::command]
pub async fn get_language(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    Ok(config.language.clone())
}