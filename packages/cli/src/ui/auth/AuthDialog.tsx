/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType } from '@damie-code/damie-code-core';
import { Box, Text } from 'ink';
import {
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
  setDeepSeekApiKey,
  setAnthropicApiKey,
  setOpenRouterApiKey,
  setOllamaBaseUrl,
  setOllamaModel,
  validateAuthMethod,
} from '../../config/auth.js';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { OpenAIKeyPrompt } from '../components/OpenAIKeyPrompt.js';
import { ProviderApiKeyPrompt } from './ProviderApiKeyPrompt.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { PROVIDERS, getProviderInfo } from '../../setup/types.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showOpenAIKeyPrompt, setShowOpenAIKeyPrompt] = useState(false);
  const [showProviderKeyPrompt, setShowProviderKeyPrompt] = useState<{
    isOpen: boolean;
    provider: AuthType | null;
  }>({ isOpen: false, provider: null });
  
  // Generate items dynamically from PROVIDERS array
  const items = PROVIDERS.map((provider) => ({
    key: provider.authType,
    label: provider.name,
    value: provider.authType,
    description: provider.description,
    requiresApiKey: provider.requiresApiKey,
  }));

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      if (settings.merged.security?.auth?.selectedType) {
        return item.value === settings.merged.security?.auth?.selectedType;
      }

      const defaultAuthType = parseDefaultAuthType(
        process.env['QWEN_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value === defaultAuthType;
      }

      if (process.env['GEMINI_API_KEY']) {
        return item.value === AuthType.USE_GEMINI;
      }

      return item.value === AuthType.LOGIN_WITH_GOOGLE;
    }),
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    const error = validateAuthMethod(authMethod);
    if (error) {
      // Handle OpenAI separately (legacy support)
      if (
        authMethod === AuthType.USE_OPENAI &&
        !process.env['OPENAI_API_KEY']
      ) {
        setShowOpenAIKeyPrompt(true);
        setErrorMessage(null);
      } 
      // Handle other providers that require API keys
      else if (error.includes('API_KEY') || error.includes('API key')) {
        const providerInfo = getProviderInfo(authMethod);
        if (providerInfo) {
          setShowProviderKeyPrompt({ isOpen: true, provider: authMethod });
          setErrorMessage(null);
        } else {
          setErrorMessage(error);
        }
      } else {
        setErrorMessage(error);
      }
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
  };

  const handleOpenAIKeySubmit = (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    setOpenAIApiKey(apiKey);
    setOpenAIBaseUrl(baseUrl);
    setOpenAIModel(model);
    setShowOpenAIKeyPrompt(false);
    onSelect(AuthType.USE_OPENAI, SettingScope.User);
  };

  const handleOpenAIKeyCancel = () => {
    setShowOpenAIKeyPrompt(false);
    setErrorMessage('OpenAI API key is required to use OpenAI authentication.');
  };

  const handleProviderKeySubmit = (
    apiKey?: string,
    baseUrl?: string,
    model?: string,
  ) => {
    const provider = showProviderKeyPrompt.provider;
    if (!provider) return;

    // Set environment variables based on provider
    switch (provider) {
      case AuthType.USE_DEEPSEEK:
        if (apiKey) setDeepSeekApiKey(apiKey);
        break;
      case AuthType.USE_ANTHROPIC:
        if (apiKey) setAnthropicApiKey(apiKey);
        break;
      case AuthType.USE_OPENROUTER:
        if (apiKey) setOpenRouterApiKey(apiKey);
        break;
      case AuthType.USE_OLLAMA:
        if (baseUrl) setOllamaBaseUrl(baseUrl);
        if (model) setOllamaModel(model);
        break;
      case AuthType.USE_OPENAI:
        if (apiKey) setOpenAIApiKey(apiKey);
        if (baseUrl) setOpenAIBaseUrl(baseUrl);
        if (model) setOpenAIModel(model);
        break;
    }

    setShowProviderKeyPrompt({ isOpen: false, provider: null });
    onSelect(provider, SettingScope.User);
  };

  const handleProviderKeyCancel = () => {
    const provider = showProviderKeyPrompt.provider;
    const providerInfo = provider ? getProviderInfo(provider) : null;
    setShowProviderKeyPrompt({ isOpen: false, provider: null });
    setErrorMessage(
      providerInfo?.requiresApiKey
        ? `${providerInfo.name} API key is required.`
        : 'Authentication cancelled.',
    );
  };

  useKeypress(
    (key) => {
      if (showOpenAIKeyPrompt || showProviderKeyPrompt.isOpen) {
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C again to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (showOpenAIKeyPrompt) {
    return (
      <OpenAIKeyPrompt
        onSubmit={handleOpenAIKeySubmit}
        onCancel={handleOpenAIKeyCancel}
      />
    );
  }

  if (showProviderKeyPrompt.isOpen && showProviderKeyPrompt.provider) {
    const providerInfo = getProviderInfo(showProviderKeyPrompt.provider);
    if (providerInfo) {
      return (
        <ProviderApiKeyPrompt
          provider={providerInfo}
          onSubmit={handleProviderKeySubmit}
          onCancel={handleProviderKeyCancel}
        />
      );
    }
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>(Use Enter to Set Auth)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for Damie Code</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://github.com/QwenLM/Qwen3-Coder/blob/main/README.md'}
        </Text>
      </Box>
    </Box>
  );
}
