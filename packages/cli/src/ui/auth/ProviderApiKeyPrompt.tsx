/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { AuthType } from '@damie-code/damie-code-core';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { ProviderInfo } from '../../setup/types.js';

interface ProviderApiKeyPromptProps {
  provider: ProviderInfo;
  onSubmit: (apiKey?: string, baseUrl?: string, model?: string) => void;
  onCancel: () => void;
}

export function ProviderApiKeyPrompt({
  provider,
  onSubmit,
  onCancel,
}: ProviderApiKeyPromptProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [currentField, setCurrentField] = useState<
    'apiKey' | 'baseUrl' | 'model'
  >('apiKey');

  // Determine which fields to show based on provider
  const showApiKey = provider.requiresApiKey;
  const showBaseUrl = provider.authType === AuthType.USE_OPENROUTER || 
                      provider.authType === AuthType.USE_DEEPSEEK ||
                      provider.authType === AuthType.USE_OPENAI ||
                      provider.authType === AuthType.USE_OLLAMA;
  const showModel = provider.authType === AuthType.USE_OLLAMA ||
                    provider.authType === AuthType.USE_OPENAI;

  // Get default values
  const getDefaultBaseUrl = () => {
    if (provider.authType === AuthType.USE_OLLAMA) {
      return 'http://localhost:11434';
    }
    if (provider.authType === AuthType.USE_OPENROUTER) {
      return 'https://openrouter.ai/api/v1';
    }
    return '';
  };

  const getDefaultModel = () => {
    if (provider.authType === AuthType.USE_OLLAMA) {
      return 'llama3.1';
    }
    if (provider.authType === AuthType.USE_OPENAI) {
      return 'gpt-4';
    }
    return '';
  };

  useKeypress(
    (key) => {
      // Handle escape
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      // Handle Enter key
      if (key.name === 'return') {
        if (currentField === 'apiKey' && showApiKey) {
          // Allow empty API key to navigate to next field
          setCurrentField('baseUrl');
          return;
        } else if (currentField === 'baseUrl' && showBaseUrl) {
          setCurrentField('model');
          return;
        } else if (currentField === 'model' && showModel) {
          // Submit only if API key is provided when required
          if (!showApiKey || apiKey.trim()) {
            onSubmit(
              apiKey.trim() || undefined,
              baseUrl.trim() || getDefaultBaseUrl() || undefined,
              model.trim() || getDefaultModel() || undefined,
            );
          } else {
            setCurrentField('apiKey');
          }
        } else if (!showBaseUrl && !showModel && showApiKey) {
          // If only API key is needed, submit on Enter
          if (apiKey.trim()) {
            onSubmit(apiKey.trim());
          }
        }
        return;
      }

      // Handle Tab key for field navigation
      if (key.name === 'tab') {
        if (currentField === 'apiKey' && showApiKey) {
          setCurrentField(showBaseUrl ? 'baseUrl' : 'model');
        } else if (currentField === 'baseUrl' && showBaseUrl) {
          setCurrentField(showModel ? 'model' : 'apiKey');
        } else if (currentField === 'model' && showModel) {
          setCurrentField('apiKey');
        }
        return;
      }

      // Handle arrow keys for field navigation
      if (key.name === 'up') {
        if (currentField === 'baseUrl' && showBaseUrl) {
          setCurrentField('apiKey');
        } else if (currentField === 'model' && showModel) {
          setCurrentField(showBaseUrl ? 'baseUrl' : 'apiKey');
        }
        return;
      }

      if (key.name === 'down') {
        if (currentField === 'apiKey' && showApiKey) {
          setCurrentField(showBaseUrl ? 'baseUrl' : 'model');
        } else if (currentField === 'baseUrl' && showBaseUrl) {
          setCurrentField(showModel ? 'model' : 'apiKey');
        }
        return;
      }

      // Handle backspace/delete
      if (key.name === 'backspace' || key.name === 'delete') {
        if (currentField === 'apiKey' && showApiKey) {
          setApiKey((prev) => prev.slice(0, -1));
        } else if (currentField === 'baseUrl' && showBaseUrl) {
          setBaseUrl((prev) => prev.slice(0, -1));
        } else if (currentField === 'model' && showModel) {
          setModel((prev) => prev.slice(0, -1));
        }
        return;
      }

      // Handle paste mode
      if (key.paste && key.sequence) {
        let cleanInput = key.sequence
          .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
          .replace(/\[200~/g, '')
          .replace(/\[201~/g, '')
          .replace(/^\[|~$/g, '')
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'apiKey' && showApiKey) {
            setApiKey((prev) => prev + cleanInput);
          } else if (currentField === 'baseUrl' && showBaseUrl) {
            setBaseUrl((prev) => prev + cleanInput);
          } else if (currentField === 'model' && showModel) {
            setModel((prev) => prev + cleanInput);
          }
        }
        return;
      }

      // Handle regular character input
      if (key.sequence && !key.ctrl && !key.meta && !key.name) {
        const cleanInput = key.sequence
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'apiKey' && showApiKey) {
            setApiKey((prev) => prev + cleanInput);
          } else if (currentField === 'baseUrl' && showBaseUrl) {
            setBaseUrl((prev) => prev + cleanInput);
          } else if (currentField === 'model' && showModel) {
            setModel((prev) => prev + cleanInput);
          }
        }
      }
    },
    { isActive: true },
  );

  const getFieldLabel = (field: 'apiKey' | 'baseUrl' | 'model') => {
    switch (field) {
      case 'apiKey':
        return provider.envVar 
          ? provider.envVar.replace('_API_KEY', '').replace('_', ' ') + ' API Key:'
          : 'API Key:';
      case 'baseUrl':
        return 'Base URL:';
      case 'model':
        return 'Model:';
    }
  };

  const getCurrentValue = (field: 'apiKey' | 'baseUrl' | 'model') => {
    switch (field) {
      case 'apiKey':
        return apiKey;
      case 'baseUrl':
        return baseUrl;
      case 'model':
        return model;
    }
  };

  const fields: Array<'apiKey' | 'baseUrl' | 'model'> = [];
  if (showApiKey) fields.push('apiKey');
  if (showBaseUrl) fields.push('baseUrl');
  if (showModel) fields.push('model');

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        {provider.name} Configuration
      </Text>
      <Box marginTop={1}>
        <Text>
          Please enter your {provider.name} configuration.{' '}
          {provider.docsUrl && (
            <Text>
              Get started at{' '}
              <Text color={Colors.AccentBlue}>{provider.docsUrl}</Text>
            </Text>
          )}
        </Text>
      </Box>
      {provider.apiKeyHint && showApiKey && (
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            API Key format: {provider.apiKeyHint}
          </Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {fields.map((field, index) => (
          <Box key={field} marginTop={index > 0 ? 1 : 0} flexDirection="row">
            <Box width={20}>
              <Text
                color={
                  currentField === field ? Colors.AccentBlue : Colors.Gray
                }
              >
                {getFieldLabel(field)}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text>
                {currentField === field ? '> ' : '  '}
                {getCurrentValue(field) || ' '}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
