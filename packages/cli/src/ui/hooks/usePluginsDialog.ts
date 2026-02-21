/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export interface UsePluginsDialogReturn {
  isPluginsDialogOpen: boolean;
  openPluginsDialog: () => void;
  closePluginsDialog: () => void;
}

export function usePluginsDialog(): UsePluginsDialogReturn {
  const [isPluginsDialogOpen, setIsPluginsDialogOpen] = useState(false);

  const openPluginsDialog = useCallback(() => {
    setIsPluginsDialogOpen(true);
  }, []);

  const closePluginsDialog = useCallback(() => {
    setIsPluginsDialogOpen(false);
  }, []);

  return {
    isPluginsDialogOpen,
    openPluginsDialog,
    closePluginsDialog,
  };
}
