/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export interface UseSkillsDialogReturn {
  isSkillsDialogOpen: boolean;
  openSkillsDialog: () => void;
  closeSkillsDialog: () => void;
}

export function useSkillsDialog(): UseSkillsDialogReturn {
  const [isSkillsDialogOpen, setIsSkillsDialogOpen] = useState(false);

  const openSkillsDialog = useCallback(() => {
    setIsSkillsDialogOpen(true);
  }, []);

  const closeSkillsDialog = useCallback(() => {
    setIsSkillsDialogOpen(false);
  }, []);

  return {
    isSkillsDialogOpen,
    openSkillsDialog,
    closeSkillsDialog,
  };
}
