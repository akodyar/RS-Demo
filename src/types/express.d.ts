import { UserRole, CompanyRole, Permission } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: (UserRole | CompanyRole | string)[];
        companyId?: string;
        organizationId?: string;
        permissions?: Permission[];
      };
    }
  }
}
