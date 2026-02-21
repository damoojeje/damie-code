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
import type { ProfileService, ProfileListItem } from '../../services/profileService.js';

interface ProfileSelectorProps {
  profileService: ProfileService;
  onExit: () => void;
}

export function ProfileSelector({ profileService, onExit }: ProfileSelectorProps): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [autoSelectionEnabled, setAutoSelectionEnabled] = useState(true);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const profileList = await profileService.listProfiles();
      setProfiles(profileList);
      setAutoSelectionEnabled(profileService.isAutoSelectionEnabled());
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
      setLoading(false);
    }
  };

  const selectProfile = async (index: number) => {
    const profile = profiles[index];
    try {
      setActionMessage(`Selecting ${profile.name}...`);
      
      await profileService.setActiveProfile(profile.name);
      
      // Reload profiles to get updated state
      await loadProfiles();
      setActionMessage(`Active profile: ${profile.name}`);
      
      // Clear message after 2 seconds
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to select ${profile.name}`);
    }
  };

  const toggleAutoSelection = async () => {
    try {
      if (autoSelectionEnabled) {
        await profileService.disableAutoSelection();
        setAutoSelectionEnabled(false);
        setActionMessage('Auto-selection disabled');
      } else {
        await profileService.enableAutoSelection();
        setAutoSelectionEnabled(true);
        setActionMessage('Auto-selection enabled');
      }
      
      // Clear message after 2 seconds
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle auto-selection');
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      } else if (key.name === 'up' || key.name === 'k') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : profiles.length - 1));
      } else if (key.name === 'down' || key.name === 'j') {
        setActiveIndex((prev) => (prev < profiles.length - 1 ? prev + 1 : 0));
      } else if (key.name === 'space' || key.name === 'return') {
        if (profiles.length > 0) {
          selectProfile(activeIndex);
        }
      } else if (key.name === 'a') {
        // Toggle auto-selection
        toggleAutoSelection();
      } else if (key.name === 'c') {
        // Create custom profile (placeholder)
        setActionMessage('Create profile: Use /profile create <name> command');
        setTimeout(() => setActionMessage(null), 3000);
      } else if (key.name === 'r') {
        // Refresh
        loadProfiles();
        setActionMessage('Profiles refreshed');
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
        <Text color={theme.text.secondary}>Loading profiles...</Text>
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
        Profile Selector
      </Text>

      <Box marginTop={1} flexDirection="column">
        {profiles.length === 0 ? (
          <Box>
            <Text color={theme.text.secondary}>No profiles available.</Text>
          </Box>
        ) : (
          profiles.map((profile, index) => {
            const isActive = index === activeIndex;
            return (
              <Box key={profile.name} flexDirection="row" alignItems="center">
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
                      profile.isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {profile.isActive ? '✅' : '  '}
                  </Text>
                </Box>
                <Box width={2}>
                  {profile.isCustom && (
                    <Text color={theme.text.secondary}>🔧</Text>
                  )}
                </Box>
                <Box width={20}>
                  <Text
                    color={isActive ? theme.status.success : theme.text.primary}
                  >
                    {profile.name}
                  </Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color={theme.text.secondary}>{profile.description}</Text>
                </Box>
                <Box width={10}>
                  <Text color={theme.text.secondary}>
                    Temp: {profile.temperature.toFixed(1)}
                  </Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          Press ↑↓ to navigate, Space/Enter to select, 'a' to toggle auto, 'c' to create, 'r' to refresh, Esc to exit
        </Text>
        {actionMessage && (
          <Box marginTop={1}>
            <Text color={theme.status.success}>{actionMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Auto-Selection: {autoSelectionEnabled ? '✅ Enabled' : '❌ Disabled'} | 
            Total: {profiles.length} profiles | 
            Active: {profiles.find((p) => p.isActive)?.name || 'None'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
