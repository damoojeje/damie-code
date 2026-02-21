/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { PROVIDERS } from '../../setup/types.js';
import type { Settings } from '../../config/settings.js';
import {
  getNestedValue,
} from '../../utils/settingsUtils.js';

interface ProviderConfigDialogProps {
  settings: Settings;
  onSave: (provider: string, config: { apiKey?: string; baseUrl?: string; model?: string; timeout?: number }) => void;
  onExit: () => void;
}

type ConfigField = 'apiKey' | 'baseUrl' | 'model' | 'timeout';

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export function ProviderConfigDialog({
  settings,
  onSave,
  onExit,
}: ProviderConfigDialogProps): React.JSX.Element {
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [editingField, setEditingField] = useState<ConfigField | null>(null);
  const [editBuffer, setEditBuffer] = useState('');

  const selectedProvider = PROVIDERS[selectedProviderIndex];

  const getProviderConfig = (): ProviderConfig => {
    const providerKey = selectedProvider.authType.replace('USE_', '').toLowerCase();
    const path = `security.providers.${providerKey}`;
    const config = getNestedValue(settings, path.split('.')) as ProviderConfig | undefined;
    return config || {};
  };

  const config = getProviderConfig();

  const handleSave = (newConfig: ProviderConfig) => {
    const providerKey = selectedProvider.authType.replace('USE_', '').toLowerCase();
    onSave(providerKey, newConfig);
  };

  useKeypress(
    (key) => {
      if (editingField) {
        if (key.name === 'escape') {
          setEditingField(null);
          setEditBuffer('');
        } else if (key.name === 'return') {
          const newConfig: ProviderConfig = { ...config };
          
          if (editingField === 'timeout') {
            newConfig[editingField] = Number(editBuffer) || 30000;
          } else {
            newConfig[editingField] = editBuffer || undefined;
          }
          
          handleSave(newConfig);
          setEditingField(null);
          setEditBuffer('');
        } else if (key.name === 'backspace') {
          setEditBuffer((prev) => prev.slice(0, -1));
        } else if (key.sequence && !key.ctrl && !key.meta && !key.name) {
          setEditBuffer((prev) => prev + key.sequence);
        }
        return;
      }

      if (key.name === 'up') {
        setSelectedProviderIndex((prev) => 
          prev > 0 ? prev - 1 : PROVIDERS.length - 1
        );
      } else if (key.name === 'down') {
        setSelectedProviderIndex((prev) => 
          prev < PROVIDERS.length - 1 ? prev + 1 : 0
        );
      } else if (key.name === 'return' || key.name === 'space') {
        const providerKey = selectedProvider.authType.replace('USE_', '').toLowerCase();
        const fields: ConfigField[] = [];
        if (selectedProvider.requiresApiKey) fields.push('apiKey');
        if (['openrouter', 'ollama', 'openai', 'deepseek'].includes(providerKey)) {
          fields.push('baseUrl');
        }
        if (['ollama', 'openai'].includes(providerKey)) {
          fields.push('model');
        }
        if (['deepseek', 'anthropic'].includes(providerKey)) {
          fields.push('timeout');
        }
        
        if (fields.length > 0) {
          setEditingField(fields[0]);
          const fieldValue = config[fields[0]];
          setEditBuffer(fieldValue !== undefined ? String(fieldValue) : '');
        }
      } else if (key.name === 'escape') {
        onExit();
      }
    },
    { isActive: true },
  );

  const providerKey = selectedProvider.authType.replace('USE_', '').toLowerCase();
  
  const fields: Array<{ key: ConfigField; label: string; value: string }> = [];
  
  if (selectedProvider.requiresApiKey) {
    fields.push({ 
      key: 'apiKey', 
      label: 'API Key', 
      value: config.apiKey ? '***' + String(config.apiKey).slice(-4) : '(not set)' 
    });
  }
  
  if (['openrouter', 'ollama', 'openai', 'deepseek'].includes(providerKey)) {
    fields.push({ 
      key: 'baseUrl', 
      label: 'Base URL', 
      value: (config.baseUrl as string | undefined) || '(default)' 
    });
  }
  
  if (['ollama', 'openai'].includes(providerKey)) {
    fields.push({ 
      key: 'model', 
      label: 'Model', 
      value: (config.model as string | undefined) || '(default)' 
    });
  }
  
  if (['deepseek', 'anthropic'].includes(providerKey)) {
    fields.push({ 
      key: 'timeout', 
      label: 'Timeout (ms)', 
      value: config.timeout !== undefined ? String(config.timeout) : '(default)' 
    });
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.status.success}>
        Provider Configuration
      </Text>
      
      <Box marginTop={1} flexDirection="row">
        <Box width={20}>
          <Text color={theme.text.secondary}>Provider:</Text>
        </Box>
        <Box>
          <Text color={theme.text.primary}>{selectedProvider.name}</Text>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>{selectedProvider.description}</Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        {fields.map((field, index) => (
          <Box key={field.key} marginTop={index > 0 ? 1 : 0} flexDirection="row">
            <Box width={20}>
              <Text color={theme.text.secondary}>{field.label}:</Text>
            </Box>
            <Box>
              {editingField === field.key ? (
                <Text color={theme.status.success}>
                  {editBuffer}
                  <Text inverse>{' '}</Text>
                </Text>
              ) : (
                <Text color={theme.text.primary}>{String(field.value)}</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Press Enter to edit, Esc to go back, ↑↓ to change provider
        </Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.text.secondary}>Available Providers:</Text>
        {PROVIDERS.map((provider, index) => (
          <Text 
            key={provider.authType}
            color={index === selectedProviderIndex ? theme.status.success : theme.text.secondary}
          >
            {index === selectedProviderIndex ? '● ' : '  '}
            {provider.name}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
