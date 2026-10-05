import { Alert, Linking } from 'react-native';
import { currentT } from '../labels/LabelsContext';

/**
 * Opens a configured link in the system handler. Opened without a capability
 * check; on failure shows a generic alert. The URL is never logged or shown.
 */
export async function openLink(url: string, failureTitle: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(failureTitle, currentT('mob.errors.try_later'));
  }
}
