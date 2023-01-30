export interface IServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface IFirebaseConfig {
  credential?: IServiceAccount;
}
