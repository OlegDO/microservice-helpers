import RemoteConfig from '@services/remote-config';

export interface IFirebaseSdkParams {
  hasConfigMs?: boolean;
  credential?: Record<string, any>;
}

export interface IServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

/**
 * Firebase singletone
 */
class FirebaseSdk {
  /**
   * @private
   */
  private static hasInit = false;

  /**
   * @private
   */
  private static hasConfigMs: boolean;

  /**
   * Firebase Admin import
   * @private
   */
  private static firebaseAdmin: any;

  /**
   * @private
   */
  private static credential?: IFirebaseSdkParams['credential'];

  /**
   * Init service
   */
  public static init(
    firebaseAdmin: any,
    { hasConfigMs = true, credential = {} }: IFirebaseSdkParams = {},
    shouldReset = false,
  ): void {
    this.firebaseAdmin = firebaseAdmin;
    this.hasConfigMs = hasConfigMs;
    this.credential = credential;

    if (shouldReset) {
      this.hasInit = false;
    }
  }

  /**
   * Get firebase sdk
   */
  public static async get(): Promise<any> {
    if (!this.hasInit) {
      const config = this.hasConfigMs
        ? await RemoteConfig.get<{ credential?: IServiceAccount }>('firebase', {
            isThrowNotExist: true,
            isCommon: true,
          })
        : {};

      const credentials = config?.credential ?? (this.credential as IServiceAccount);

      this.firebaseAdmin.initializeApp({
        credential: this.firebaseAdmin.credential.cert(credentials),
      });

      this.hasInit = true;
    }

    return this.firebaseAdmin;
  }
}

export default FirebaseSdk;
