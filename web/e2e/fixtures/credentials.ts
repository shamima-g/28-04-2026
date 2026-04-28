export type SeededUser = {
  email: string;
  password: string;
  role: 'admin' | 'viewer';
};

export const adminUser: SeededUser = {
  email: 'alice.admin@betterbond.example',
  password: 'Admin123!', // scan-secrets-ignore - documented POC seed credential (matches auth.config.ts)
  role: 'admin',
};

export const viewerUser: SeededUser = {
  email: 'vera.viewer@agency.example',
  password: 'Viewer123!', // scan-secrets-ignore - documented POC seed credential (matches auth.config.ts)
  role: 'viewer',
};

export const seededUsers = [adminUser, viewerUser] as const;
