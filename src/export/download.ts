import { zip } from 'fflate';

export type Files = Record<string, Uint8Array>;

/** zips the files, fflate compresses them off the main thread */
export const packFiles = (files: Files): Promise<Uint8Array> =>
  new Promise((resolve, reject) => zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data))));

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  element.remove();
  // give the browser a moment to start the download before releasing the blob
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** a single file is downloaded as is, several files as one zip */
export const downloadFiles = async (files: Files, zipName: string) => {
  const entries = Object.entries(files);
  if (entries.length === 0) return;
  if (entries.length === 1) {
    const [name, data] = entries[0];
    downloadBlob(new Blob([data as BlobPart], { type: 'application/octet-stream' }), name);
  } else downloadBlob(new Blob([(await packFiles(files)) as BlobPart], { type: 'application/zip' }), zipName);
};
