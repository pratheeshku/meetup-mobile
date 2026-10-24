import ImageCropPicker from 'react-native-image-crop-picker';

export interface PickedImage {
  path: string;
  filename: string;
  mime: string;
}

/** Crop box in pixels. The default is the square avatar crop; a tournament banner is 4:1 (1600 x 400). */
export interface CropSize {
  width: number;
  height: number;
}

export async function pickImage(
  source: 'camera' | 'library',
  cropTitle: string,
  size: CropSize = { width: 500, height: 500 },
): Promise<PickedImage | null> {
  const cropOptions = {
    mediaType: 'photo' as const,
    cropping: true,
    width: size.width,
    height: size.height,
    compressImageQuality: 0.8,
    // iOS only (ignored on Android): HEIC must never reach the backend.
    forceJpg: true,
    cropperToolbarTitle: cropTitle,
    hideBottomControls: false,
    enableRotationGesture: true,
    cropperRotateButtonsHidden: false,
  };

  const image =
    source === 'camera'
      ? await ImageCropPicker.openCamera(cropOptions)
      : await ImageCropPicker.openPicker(cropOptions);

  if (!image || !image.path) {
    return null;
  }

  const filename =
    image.filename || image.path.split('/').pop() || 'logo.jpg';
  const mime = image.mime || 'image/jpeg';

  return {
    path: image.path,
    filename,
    mime,
  };
}

export function isPickerCancelled(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return Boolean(
    err?.code === 'E_PICKER_CANCELLED' ||
      err?.message?.toLowerCase().includes('cancel'),
  );
}
