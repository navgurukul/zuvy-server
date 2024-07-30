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
  c: { int: 'int', float: 'float', str: 'char*', bool: 'bool', array: 'int*', object: 'void*', long: 'long', double: 'double', char: 'char' },
  cpp: { int: 'int', float: 'float', str: 'std::string', bool: 'bool', array: 'std::vector<int>', object: 'Result', long: 'long', double: 'double', char: 'char' },
  java: { int: 'int', float: 'float', str: 'String', bool: 'boolean', array: 'int[]', object: 'Result', long: 'long', double: 'double', char: 'char' },
  python: { int: 'int', float: 'float', str: 'str', bool: 'bool', array: 'List[int]', object: 'dict', long: 'int', double: 'float', char: 'str' },
  javascript: { int: 'number', float: 'number', str: 'string', bool: 'boolean', array: 'number[]', object: 'object', long: 'number', double: 'number', char: 'string' }
};