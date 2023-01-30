import { RequiredOnlyProps } from '@lomray/client-helpers/interfaces/required-props';
import { ICommonConstants } from '@helpers/get-constants';
import { IFirebaseConfig } from '@interfaces/firebase-config';
import RemoteConfig from '../services/remote-config';

/**
 * Get Firebase config
 */
const firebase = async ({
  FIREBASE,
}: RequiredOnlyProps<ICommonConstants, 'FIREBASE'>): Promise<IFirebaseConfig> => {
  const conf = FIREBASE.IS_FROM_CONFIG_MS
    ? await RemoteConfig.get<IFirebaseConfig>('firebase', {
        isThrowNotExist: true,
        isCommon: true,
      })
    : {};
  const defaultConfig: IFirebaseConfig = { credential: FIREBASE.CREDENTIAL };

  return { ...defaultConfig, ...(conf ?? {}) };
};

export default firebase;
