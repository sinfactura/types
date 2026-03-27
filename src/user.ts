declare global {
  interface User {
    storeId: string;
    userId: string;
    createdAt: number;
    fullName: string;
    phone: string;
    email: string;
    password?: string;
    roles: string;
    photoURL: string;
    disabled: boolean;
    search: string;
    accessToken: string;
    // ROLES
    roleSeller?: boolean;
    roleProducts?: boolean;
    roleCustomers?: boolean;
    roleAfip?: boolean;
    // NOTIFICATIONS2
    notifications?: UserNotifications;
    permissions?: UserPermissions;
  }

  type UserNotifications = {
    orders?: boolean;
    mercadopago?: boolean;
    dollarOficial?: boolean;
    dollarInformal?: boolean;
    dollarBna?: boolean;
    printer?: boolean;
  };

  type UserPermissions = {
    currency?: boolean;
    customers?: boolean;
    products?: boolean;
    seller?: boolean;
    accountant?: boolean;
    payments?: boolean;
    cash?: boolean;
    packOrder?: boolean;
  };

  interface UserGoogle extends User {
    displayName: string;
  }

  interface AuthUser extends User {
    refreshToken: string;
  }
}

export {};
