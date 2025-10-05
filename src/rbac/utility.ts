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
export const ResourceKeys = [
  'Course',
  'User',
  'Bootcamp',
  'Mcq',
  'Codingquestion', 
  'Module', 
  'Question', 
  'Batch', 
  'Student',
  'Submission',
  'Setting',
  'Chapter',
  'RolesAndPermission'
] as const;
export type ResourceKey = typeof ResourceKeys[number];

// utils/resources.ts
export const ResourceList = {
  course: {
    read: "viewCourse",
    create: "createCourse",
    edit: "editCourse",
    delete: "deleteCourse",
    publish: "publishCourse"
  },
  question: {
    read: "viewQuestion",
    create: "createQuestion",
    edit: "editQuestion",
    delete: "deleteQuestion",
    download: "downloadQuestion"
  },
  user: {
    read: "viewUser",
    create: "createUser",
    edit: "editUser",
    delete: "deleteUser",
    assign: "assignUser"
  },
  batch: {
    read: "viewBatch",
    create: "createBatch",
    edit: "editBatch",
    delete: "deleteBatch",
  },
  rolesandpermission: {
    read: "viewRolesAndPermission",
    create: "createRolesAndPermission",
    edit: "editRolesAndPermission",
    delete: "deleteRolesAndPermission",
    assign: "assignRolesAndPermission"
  },
  module: {
    read: "viewModule",
    create: "createModule",
    edit: "editModule",
    delete: "deleteModule",
    lock: "lockModule",
  },
  student: {
    read: "viewStudent",
    create: "createStudent",
    edit: "editStudent",
    delete: "deleteStudent"
  },
  submission: {
    read: "viewSubmission",
    create: "createSubmission",
    edit: "editSubmission",
    delete: "deleteSubmission",
    re_attempt: "reattemptSubmission"
  },
  setting: {
    read: "viewSetting",
    create: "createSetting",
    edit: "editSetting",
    delete: "deleteSetting"
  },
  chapter: {
    read: "viewChapter",
    create: "createChapter",
    edit: "editChapter",
    delete: "deleteChapter"
  }
} as const;
