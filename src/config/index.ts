export const ConfigIndex = {
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port:5432,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
};

export  const typeMappings = {
  java: {
      int: 'int',
      float: 'float',
      double: 'double',
      str: 'String',
      arrayOfnum: 'int[]', // This is an example; it can be modified based on the array type
      arrayOfStr: 'String[]', // This is an example; it can be modified based on the array type
      returnType: 'int', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
      inputType: (parameterType) => {
          switch(parameterType) {
              case 'int': return 'Int';
              case 'float': return 'Float';
              case 'double': return 'Double';
              case 'str': return 'Line'; // For reading a whole line of string input
              default: return 'Int'; // Default input type, modify as needed
          }
      }
  },
  python: {
      int: 'int',
      float: 'float',
      str: 'str',
      arrayOfnum: 'List[int]', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'List[str]', // This is an example; it can be modified based on the arrayOfStr type
      input: (parameterType) => {
          switch(parameterType) {
              case 'int': return 'int(input())';
              case 'float': return 'float(input())';
              case 'str': return 'input()';
              default: return 'int(input())'; // Default input type, modify as needed
          }
      }
  },
  c: {
      int: 'int',
      float: 'float',
      double: 'double',
      str: 'char*',
      arrayOfnum: 'int[]', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'char**', // This is an example; it can be modified based on the arrayOfStr type
      returnType: 'int', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
  },
  cpp: {
      int: 'int',
      float: 'float',
      double: 'double',
      str: 'string',
      arrayOfnum: 'vector<int>', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'vector<string>', // This is an example; it can be modified based on the arrayOfStr type
      returnType: 'int', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
  },
  javascript: {
      int: 'number',
      float: 'number',
      double: 'number',
      str: 'string',
      arrayOfnum: 'number[]', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'string[]', // This is an example; it can be modified based on the arrayOfStr type
      returnType: 'number', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
  }
};
