import React from 'react';
import {
  ChevronRight,
  SendHorizontal,
  FileCheck,
  Loader2,
  CheckCircle,
  ShieldAlert,
  Hourglass,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import type { CommandStatusInfo } from '../types';

/**
 * Get icon and style information based on command status
 */
export const getCommandStatusInfo = (
  commandName: string, 
  commandStatus: Map<string, { status: string }>
): CommandStatusInfo => {
  const command = commandStatus.get(commandName);
  
  if (!command) {
    return {
      icon: <ChevronRight className="h-4 w-4" />,
      color: 'text-zinc-400',
      label: ''
    };
  }
  
  switch (command.status) {
    case 'sending':
      return {
        icon: <SendHorizontal className="h-4 w-4 animate-pulse" />,
        color: 'text-yellow-500',
        label: 'Sending'
      };
    case 'accepted':
      return {
        icon: <FileCheck className="h-4 w-4" />,
        color: 'text-blue-500',
        label: 'Accepted'
      };
    case 'running':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        color: 'text-green-500',
        label: 'Running'
      };
    case 'completed':
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-emerald-500',
        label: 'Completed'
      };
    case 'failed':
      return {
        icon: <ShieldAlert className="h-4 w-4" />,
        color: 'text-red-500',
        label: 'Failed'
      };
    case 'timeout':
      return {
        icon: <Hourglass className="h-4 w-4" />,
        color: 'text-orange-500',
        label: 'Timeout'
      };
    case 'no-response':
      return {
        icon: <RefreshCw className="h-4 w-4" />,
        color: 'text-purple-500',
        label: 'No Response'
      };
    default:
      return {
        icon: <ChevronRight className="h-4 w-4" />,
        color: 'text-zinc-400',
        label: ''
      };
  }
};

/**
 * Check if a command is in progress (and should be disabled)
 */
export const isCommandInProgress = (
  commandName: string, 
  commandStatus: Map<string, { status: string }>
): boolean => {
  const command = commandStatus.get(commandName);
  return command ? ['sending', 'accepted', 'running'].includes(command.status) : false;
};

/**
 * Get the appropriate label for a command's empty state 
 */
export const getEmptyStateLabel = (
  commandName: string, 
  commandStatus: Map<string, { status: string }>
): React.ReactNode => {
  return commandStatus.has(commandName) ? 
    <span className="text-xs opacity-80">{getCommandStatusInfo(commandName, commandStatus).label}</span> : 
    <MoreHorizontal className="h-3 w-3 opacity-40" />;
}; 