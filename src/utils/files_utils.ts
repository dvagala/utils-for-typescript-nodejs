import * as path from 'path';
import * as fs from 'fs';

export function deleteDirectorySync(directoryPath: string) {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }
}

export function writeToFileWithAutomaticPathCreation(filePath: string, content: string) {
  createUnderlyingDirectoryIfNotExistis(filePath);

  fs.writeFileSync(filePath, content);
}

export function createUnderlyingDirectoryIfNotExistis(filePath: string) {
  const directoryName = path.dirname(filePath);
  if (!fs.existsSync(directoryName)) {
    fs.mkdirSync(directoryName, { recursive: true });
  }
}

export function parseJsonFile<T>(jsonPath: string): T {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as T;
}

export function parseJsonFileOrNull<T>(jsonPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function tryToParseJsonFile(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function getFileName(fullPath?: string | null): string | null {
  if (fullPath == null) {
    return null;
  } else {
    return path.basename(fullPath);
  }
}
