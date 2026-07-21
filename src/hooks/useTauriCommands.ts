import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export async function pickFolder(title?: string): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: title ?? 'Select Video Folder',
  });
  
  return selected as string | null;
}

export async function pickVideoFile(title?: string): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: title ?? 'Select Local Video',
    filters: [
      {
        name: 'Video files',
        extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'],
      },
    ],
  });

  return selected as string | null;
}

export function getVideoSrc(filePath: string): string {
  return convertFileSrc(filePath);
}

export async function openFileLocation(filePath: string): Promise<void> {
  await invoke('open_file_location', { filePath });
}

export async function openFileExternally(filePath: string): Promise<void> {
  await invoke('open_file_externally', { filePath });
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  return await invoke('check_file_exists', { filePath });
}
