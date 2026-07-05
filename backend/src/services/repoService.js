import { simpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export async function cloneAndValidateRepo(repoUrl) {
  const tempDir = path.join('/tmp', `analysis-${uuidv4()}`);
  const git = simpleGit({
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  });
  
  console.log(`Cloning ${repoUrl} into ${tempDir}...`);
  
  const clonePromise = git.clone(repoUrl, tempDir, ['--depth', '1']);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('CLONE_TIMEOUT')), 60000)
  );

  try {
    await Promise.race([clonePromise, timeoutPromise]);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('CLONE_TIMEOUT')) {
      throw new Error('CLONE_TIMEOUT');
    }
    throw new Error(`Git clone failed: ${errorMessage}`);
  }

  console.log(`Checking limits for ${tempDir}...`);
  const maxFiles = 5000;
  const maxSizeMB = 200;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  let fileCount = 0;
  let sizeBytes = 0;

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
        const stats = await fs.stat(fullPath);
        sizeBytes += stats.size;
        
        if (fileCount > maxFiles) {
          throw new Error(`Repository file count exceeds limit of ${maxFiles}`);
        }
        if (sizeBytes > maxSizeBytes) {
          throw new Error(`Repository size exceeds limit of ${maxSizeMB}MB`);
        }
      }
    }
  }

  await walk(tempDir);
  const sizeMB = Number((sizeBytes / (1024 * 1024)).toFixed(2));
  
  return { tempDir, fileCount, sizeMB };
}
