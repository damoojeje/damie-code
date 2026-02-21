/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { SkillService, SkillListItem } from '../../services/skillService.js';
import { SkillType } from '@damie-code/damie-code-core';

interface SkillsDialogProps {
  skillService: SkillService;
  onExit: () => void;
}

export function SkillsDialog({ skillService, onExit }: SkillsDialogProps): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const skillList = await skillService.listSkills();
      setSkills(skillList);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
      setLoading(false);
    }
  };

  const toggleSkillEnabled = async (index: number) => {
    const skill = skills[index];
    try {
      setActionMessage(`Toggling ${skill.name}...`);
      
      if (skill.enabled) {
        await skillService.disableSkill(skill.name);
      } else {
        await skillService.enableSkill(skill.name);
      }
      
      // Reload skills to get updated state
      await loadSkills();
      setActionMessage(`${skill.name} ${skill.enabled ? 'disabled' : 'enabled'}`);
      
      // Clear message after 2 seconds
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to toggle ${skill.name}`);
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      } else if (key.name === 'up' || key.name === 'k') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : skills.length - 1));
      } else if (key.name === 'down' || key.name === 'j') {
        setActiveIndex((prev) => (prev < skills.length - 1 ? prev + 1 : 0));
      } else if (key.name === 'space' || key.name === 'return') {
        if (skills.length > 0) {
          toggleSkillEnabled(activeIndex);
        }
      } else if (key.name === 'i') {
        // Install skill (placeholder)
        setActionMessage('Skill installation: Use /skills install <name> command');
        setTimeout(() => setActionMessage(null), 3000);
      } else if (key.name === 'r') {
        // Refresh
        loadSkills();
        setActionMessage('Skills refreshed');
        setTimeout(() => setActionMessage(null), 2000);
      }
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        minWidth={70}
      >
        <Text color={theme.text.secondary}>Loading skills...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.status.error}
        flexDirection="column"
        padding={1}
        minWidth={70}
      >
        <Text color={theme.status.error}>Error: {error}</Text>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Press Esc to exit, 'r' to retry</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      minWidth={70}
    >
      <Text bold color={theme.status.success}>
        Skills Manager
      </Text>

      <Box marginTop={1} flexDirection="column">
        {skills.length === 0 ? (
          <Box>
            <Text color={theme.text.secondary}>No skills installed.</Text>
          </Box>
        ) : (
          skills.map((skill, index) => {
            const isActive = index === activeIndex;
            return (
              <Box key={skill.name} flexDirection="row" alignItems="center">
                <Box width={3}>
                  <Text
                    color={
                      isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {isActive ? '●' : ' '}
                  </Text>
                </Box>
                <Box width={2}>
                  <Text
                    color={
                      skill.enabled ? theme.status.success : theme.text.secondary
                    }
                  >
                    {skill.enabled ? '✅' : '❌'}
                  </Text>
                </Box>
                <Box width={2}>
                  <Text color={theme.text.secondary}>
                    {skill.type === SkillType.BUNDLED ? '📦' : '🔧'}
                  </Text>
                </Box>
                <Box width={25}>
                  <Text
                    color={isActive ? theme.status.success : theme.text.primary}
                  >
                    {skill.name}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={theme.text.secondary}>v{skill.version}</Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color={theme.text.secondary}>{skill.description}</Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          Press ↑↓ to navigate, Space/Enter to toggle, 'i' to install, 'r' to refresh, Esc to exit
        </Text>
        {actionMessage && (
          <Box marginTop={1}>
            <Text color={theme.status.success}>{actionMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Total: {skills.length} skills | Enabled: {skills.filter((s) => s.enabled).length}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
