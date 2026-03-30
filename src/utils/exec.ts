/**
 * VANTA Core — Exec Utility
 * 
 * Promisified child_process.exec for tool execution
 */

import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  options?: ExecOptions & { timeout?: number }
): Promise<ExecResult> {
  const { timeout, ...execOptions } = options || {};
  
  try {
    const result = await execAsync(command, {
      ...execOptions,
      timeout: timeout || 30000, // 30s default
    });
    
    return { 
      stdout: typeof result.stdout === 'string' ? result.stdout : result.stdout.toString(),
      stderr: typeof result.stderr === 'string' ? result.stderr : result.stderr.toString()
    };
  } catch (error: any) {
    // Include stdout/stderr even on failure
    return {
      stdout: error.stdout ? (typeof error.stdout === 'string' ? error.stdout : error.stdout.toString()) : '',
      stderr: error.stderr ? (typeof error.stderr === 'string' ? error.stderr : error.stderr.toString()) : error.message,
    };
  }
}
