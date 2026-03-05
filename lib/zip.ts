// Server-side ZIP extraction using jszip
// Returns array of {path, content (base64)} ready for GitHub

import JSZip from "jszip";
import { ALLOWED_EXTENSIONS, validateExtension } from "./github";

export interface ExtractedFile {
  path: string;
  content: string; // base64
}

export async function extractZip(base64Zip: string): Promise<ExtractedFile[]> {
  const buffer = Buffer.from(base64Zip, "base64");
  const zip = await JSZip.loadAsync(buffer);

  const files: ExtractedFile[] = [];
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    // Skip macOS metadata files
    if (relativePath.startsWith("__MACOSX/") || relativePath.startsWith(".")) return;

    // Validate extension
    if (!validateExtension(relativePath)) {
      console.warn(`Skipping disallowed file: ${relativePath}`);
      return;
    }

    // Normalize path: strip leading folder if all files share one root folder
    promises.push(
      zipEntry.async("base64").then((content) => {
        files.push({ path: relativePath, content });
      })
    );
  });

  await Promise.all(promises);

  if (!files.length) {
    throw new Error("El ZIP no contiene archivos válidos");
  }

  // Detect and strip common root folder (e.g. "dashboard-v1/index.html" → "index.html")
  const normalized = stripCommonRoot(files);

  // Must have index.html
  const hasIndex = normalized.some(
    (f) => f.path === "index.html" || f.path.toLowerCase() === "index.html"
  );
  if (!hasIndex) {
    throw new Error("El ZIP debe contener un archivo index.html en la raíz");
  }

  return normalized;
}

function stripCommonRoot(files: ExtractedFile[]): ExtractedFile[] {
  if (!files.length) return files;

  const parts = files[0].path.split("/");
  if (parts.length < 2) return files; // already at root

  const potentialRoot = parts[0];
  const allShareRoot = files.every((f) => f.path.startsWith(potentialRoot + "/"));

  if (allShareRoot) {
    return files.map((f) => ({
      ...f,
      path: f.path.slice(potentialRoot.length + 1),
    }));
  }

  return files;
}
