export interface ERPUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff' | 'manager';
  permissions: {
    canViewReports: boolean;
    canManageSuppliers: boolean;
    canManagePromos: boolean;
    canManageInventory: boolean;
    canManageUsers: boolean;
  };
}

export const MOCK_ERP_USERS: ERPUser[] = [
  {
    id: '1',
    username: 'admin',
    name: 'Administrator ERP',
    role: 'admin',
    permissions: {
      canViewReports: true,
      canManageSuppliers: true,
      canManagePromos: true,
      canManageInventory: true,
      canManageUsers: true,
    },
  },
  {
    id: '2',
    username: 'staff1',
    name: 'Budi Staff Gudang',
    role: 'staff',
    permissions: {
      canViewReports: false,
      canManageSuppliers: true,
      canManagePromos: false,
      canManageInventory: true,
      canManageUsers: false,
    },
  },
  {
    id: '3',
    username: 'manager',
    name: 'Manager Operasional',
    role: 'manager',
    permissions: {
      canViewReports: true,
      canManageSuppliers: true,
      canManagePromos: true,
      canManageInventory: true,
      canManageUsers: false,
    },
  },
];
