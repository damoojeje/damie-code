/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export interface UseProfileSelectorReturn {
  isProfileSelectorOpen: boolean;
  openProfileSelector: () => void;
  closeProfileSelector: () => void;
}

export function useProfileSelector(): UseProfileSelectorReturn {
  const [isProfileSelectorOpen, setIsProfileSelectorOpen] = useState(false);

  const openProfileSelector = useCallback(() => {
    setIsProfileSelectorOpen(true);
  }, []);

  const closeProfileSelector = useCallback(() => {
    setIsProfileSelectorOpen(false);
  }, []);

  return {
    isProfileSelectorOpen,
    openProfileSelector,
    closeProfileSelector,
  };
}
