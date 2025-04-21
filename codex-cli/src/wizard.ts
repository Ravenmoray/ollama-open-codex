import inquirer from "inquirer";
import fetch from "node-fetch";
import { saveConfig, CONFIG_FILEPATH } from "./utils/config.js";
import fs from "fs";

const OLLAMA_DEFAULT_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

async function checkOllamaServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(url + "/api/tags");
    return res.ok;
  } catch {
    return false;
  }
}

async function getOllamaModels(url: string): Promise<string[]> {
  try {
    const res = await fetch(url + "/api/tags");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => m.name);
  } catch {
    return [];
  }
}

export async function runFirstTimeWizard() {
  console.log("\nNo configuration found. Starting setup wizard...\n");
  let ollamaUrl = OLLAMA_DEFAULT_URL;
  // Step 1: Check Ollama server
  let serverOk = await checkOllamaServer(ollamaUrl);
  if (!serverOk) {
    const { customUrl } = await inquirer.prompt([
      {
        type: "input",
        name: "customUrl",
        message: `Ollama server not found at ${ollamaUrl}. Enter Ollama server URL or press enter for default:`,
        default: OLLAMA_DEFAULT_URL,
      },
    ]);
    ollamaUrl = customUrl;
    serverOk = await checkOllamaServer(ollamaUrl);
    if (!serverOk) {
      console.error(`❌ Could not connect to Ollama server at ${ollamaUrl}. Exiting setup.`);
      process.exit(1);
    }
  }
  console.log(`✔ Ollama server detected at ${ollamaUrl}`);

  // Step 2: List models
  const models = await getOllamaModels(ollamaUrl);
  if (!models.length) {
    console.error("❌ No local models found in Ollama. Please pull a model with 'ollama pull <model>' and re-run setup.");
    process.exit(1);
  }
  console.log(`✔ Found ${models.length} local model(s): ${models.join(", ")}`);

  // Step 3: Choose model
  const { selectedModel } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedModel",
      message: "Select a model to use by default:",
      choices: models,
      default: models[0],
    },
  ]);

  // Step 4: Save config
  const config = {
    model: selectedModel,
    provider: "ollama",
    baseURL: ollamaUrl + "/v1",
    instructions: "", // required by AppConfig
  };
  saveConfig(config);
  console.log("✔ Configuration saved!");
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILEPATH);
}
