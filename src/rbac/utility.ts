export interface Item {
  id: number;
  name: string;
  description: string | null;
}

export function convertToPascalCaseWithSpaces(items: Item[]): Item[] {
  return items.map(item => {
    const processedName = convertNameToPascalWithSpaces(item.name);
    
    return {
      ...item,
      name: processedName
    };
  });
}


function convertNameToPascalWithSpaces(name: string): string {
  // If the name already contains spaces, maintain them and just capitalize each word
  if (name.includes(' ')) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // If no spaces, then it's camelCase or PascalCase - split by capital letters
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPS = 'ops',
  INSTRUCTOR = 'instructor',
}

// utils/resource-keys.ts (single source of truth)
export const ResourceKeys = ['Course','User','Bootcamp','Mcq','Codingquestions'] as const;
export type ResourceKey = typeof ResourceKeys[number];

// utils/resources.ts
export const ResourceList = {
  course: {
    read: "viewCourse",
    create: "createCourse",
    edit: "editCourse",
    delete: "deleteCourse",
  },
  content: {
    read: "viewContent",
    create: "createContent",
    edit: "editContent",
    delete: "deleteContent",
  },
  user: {
    read: "viewUser",
    create: "createUser",
    edit: "editUser",
    delete: "deleteUser",
  },
  batch: {
    read: "viewBatch",
    create: "createBatch",
    edit: "editBatch",
    delete: "deleteBatch",
  },
  rolesandpermissions: {
    read: "viewRolesAndPermissions",
    create: "createRolesAndPermissions",
    edit: "editRolesAndPermissions",
    delete: "deleteRolesAndPermissions"
  }
} as const;
