/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Main setup wizard
export { runSetupWizard, shouldSkipSetup } from './setupWizard.js';

// First-run detection
export {
  isFirstRun,
  getDamieConfigDir,
  getDamieConfigPath,
  configDirExists,
  ensureConfigDir,
  DAMIE_CONFIG_DIR,
  DAMIE_CONFIG_FILE,
} from './firstRunDetector.js';

// Types
export type { ProviderInfo, SetupConfig, SetupResult } from './types.js';
export { PROVIDERS, getProviderInfo } from './types.js';

// Components (for Ink UI)
export { ProviderPrompt, selectProviderInteractive } from './providerPrompt.js';
export { ApiKeyPrompt, getApiKeyInteractive } from './apiKeyPrompt.js';
export { SetupComplete, showSetupCompleteConsole } from './setupComplete.js';

// Validation
export { validateApiKey, validateOllama, type ValidationResult } from './apiValidator.js';

// Config management
export { writeConfig, readConfig } from './configWriter.js';
