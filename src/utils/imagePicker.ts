import ImageCropPicker from 'react-native-image-crop-picker';

export interface PickedImage {
  path: string;
  filename: string;
  mime: string;
}

export async function pickImage(
  source: 'camera' | 'library',
  cropTitle: string,
): Promise<PickedImage | null> {
  const cropOptions = {
    mediaType: 'photo' as const,
    cropping: true,
    width: 500,
    height: 500,
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
