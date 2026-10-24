/**
 * File handling for the committee's workbooks (te-a3, AD-T12): download the points template or the scoring workbook
 * and hand it to the system, and pick the filled .xlsx from the Files app for upload.
 *
 * Libraries (see the te-a3 report): `@react-native-documents/picker` (pick, and save on Android) and
 * `react-native-blob-util` (write the downloaded bytes to the cache folder, open the iOS share sheet, delete a copy).
 * The bytes come through the shared `apiClient`, so the access token, its refresh and the correlation id work as for
 * every other call. File contents are never logged. No size limit is set here: the server refuses a file that is too
 * large (`FILE_TOO_LARGE`). A picked file is not kept: the copy the picker made is deleted after the upload.
 */
import { Platform } from 'react-native';
import { errorCodes, isErrorWithCode, pick, saveDocuments, types } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { apiClient } from '../api/client';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 of a byte array (React Native has no `Buffer`). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64[Math.floor(a / 4)] + BASE64[(a % 4) * 16 + Math.floor(b / 16)];
    out += i + 1 < bytes.length ? BASE64[(b % 16) * 4 + Math.floor(c / 64)] : '=';
    out += i + 2 < bytes.length ? BASE64[c % 64] : '=';
  }
  return out;
}

/** What the picker handed back for the filled workbook. */
export interface PickedWorkbook {
  uri: string;
  name: string;
  size: number | null;
}

/** Opens the Files app for one .xlsx. `null` when the person cancels. The picker's own copy is the one uploaded. */
export async function pickWorkbook(): Promise<PickedWorkbook | null> {
  try {
    const [file] = await pick({ type: [types.xlsx], mode: 'import', allowMultiSelection: false });
    if (!file || file.error) {
      return null;
    }
    return { uri: file.uri, name: file.name ?? 'workbook.xlsx', size: file.size ?? null };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw error;
  }
}

/** Deletes the copy the picker made (a `file://` path on iOS; an Android `content://` source is not ours to delete). */
export async function discardPicked(uri: string): Promise<void> {
  if (!uri.startsWith('file://')) {
    return;
  }
  try {
    await ReactNativeBlobUtil.fs.unlink(uri.replace('file://', ''));
  } catch {
    // already gone
  }
}

/**
 * `GET path` as a workbook, written to the app's cache folder and handed to the system: the iOS share sheet (Save to
 * Files, open in Excel or Sheets), or the Android save dialog. Resolves when the system sheet was opened.
 */
export async function downloadAndShare(path: string, fileName: string, correlationId: string): Promise<void> {
  const { data } = await apiClient.get<ArrayBuffer>(path, { responseType: 'arraybuffer', correlationId });
  const target = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  await ReactNativeBlobUtil.fs.writeFile(target, bytesToBase64(new Uint8Array(data)), 'base64');
  if (Platform.OS === 'ios') {
    ReactNativeBlobUtil.ios.presentOptionsMenu(target);
    return;
  }
  await saveDocuments({ sourceUris: [`file://${target}`], mimeType: XLSX_MIME, fileName, copy: true });
}
