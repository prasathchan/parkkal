import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

async function getBackupBucket(): Promise<R2Bucket | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    return (ctx?.env?.BACKUP_BUCKET as R2Bucket) ?? null;
  } catch {
    return null;
  }
}

export async function storeBackup(key: string, data: Uint8Array): Promise<void> {
  const bucket = await getBackupBucket();
  if (bucket) {
    await bucket.put(key, data, { httpMetadata: { contentType: "application/gzip" } });
  } else {
    const localPath = path.join(process.cwd(), "private_backups", key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, data);
  }
}

export async function getBackup(key: string): Promise<Uint8Array | null> {
  const bucket = await getBackupBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }
  try {
    const localPath = path.join(process.cwd(), "private_backups", key);
    return new Uint8Array(await readFile(localPath));
  } catch {
    return null;
  }
}

export async function deleteBackup(key: string): Promise<void> {
  const bucket = await getBackupBucket();
  if (bucket) {
    await bucket.delete(key);
  } else {
    try {
      await unlink(path.join(process.cwd(), "private_backups", key));
    } catch { /* already gone */ }
  }
}
