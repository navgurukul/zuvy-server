export const complairDateTyeps = [
  'int',
  'float',
  'double',
  'str',
  'bool',
  'arrayOfnum',
  'arrayOfStr',
  'object',
  'jsonType',
];

export const typeMappings = {
  java: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'String',
    bool: 'boolean',
    arrayOfnum: 'int[]',
    arrayOfStr: 'String[]',
    returnType: 'Object',
    defaultReturnValue: 'null',
    jsonType: 'Object',
    inputType: (parameterType) => {
      const mapping = {
        'int': 'Int',
        'float': 'Float',
        'double': 'Double',
        'str': 'Line',
      };
      return mapping[parameterType] || 'Object';
    },
  },
  python: {
    int: 'int',
    float: 'float',
    str: 'str',
    bool: 'bool',
    arrayOfnum: 'List[int]',
    arrayOfStr: 'List[str]',
    jsonType: 'Any',
    returnType: 'Any',
    input: (parameterType) => {
      const mapping = {
        'int': 'int(input())',
        'float': 'float(input())',
        'str': 'input()',
      };
      return mapping[parameterType] || 'input()';
    },
  },
  c: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'char*',
    bool: 'bool',
    arrayOfnum: 'int[]',
    arrayOfStr: 'char**',
    jsonType: 'void*',
    returnType: 'void*',
    defaultReturnValue: 'NULL',
  },
  cpp: {
    int: 'int',
    float: 'float',
    double: 'double',
    bool: 'bool',
    str: 'string',
    arrayOfnum: 'vector<int>',
    arrayOfStr: 'vector<string>',
    jsonType: 'auto',
    returnType: 'auto',
    defaultReturnValue: '{}',
  },
  javascript: {
    int: 'number',
    float: 'number',
    double: 'number',
    str: 'string',
    bool: 'boolean',
    arrayOfnum: 'number[]',
    arrayOfStr: 'string[]',
    jsonType: 'any',
    returnType: 'any',
    defaultReturnValue: 'null',
    object: 'object',
    inputType: (type) => {
      const mapping = {
        'int': 'Number',
        'float': 'Number',
        'double': 'Number',
        'str': 'String',
        'bool': 'Boolean',
        'any': 'Object',
      };
      return mapping[type] || 'String';
    },
  },
};

const generateParameterMappings = (parameters, language) => {
  return parameters.map((p) => {
    const paramType = typeMappings[language][p.parameterType] || 'Object';
    if (language == 'python' || language == 'javascript') {
      return `${p.parameterName}`;
    }
    return `${paramType} _${p.parameterName}_`;
  }).join(', ');
};

export async function generateTemplates(functionName, parameters) {
  try {
    functionName = functionName.replace(/ /g, '_').toLowerCase();
    const templates = {};

    // Generate Python template
    templates['python'] = {
      id: 100,
      name: 'Python',
      template: `
from typing import List, Dict

def ${functionName}(${generateParameterMappings(parameters, 'python')}):
  # Add your code here
  return

# Example usage
${parameters.map(p => `_${p.parameterName}_ = ${typeMappings['python'][p.parameterType]}(input())`).join('\n')}
result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')})
print(result)
      `
    };

    // Generate C template
    templates['c'] = {
      id: 104,
      name: 'C',
      template: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Function to ${functionName}
${parameters.map(p => `${typeMappings['c'][p.parameterType]} _${p.parameterName}_;`).join('\n')}
${typeMappings['c']['returnType']} ${functionName}(${generateParameterMappings(parameters, 'c')}) {
  // Add your code here
  return ${typeMappings['c']['defaultReturnValue']};
}

int main() {
  // Input data
  ${parameters.map(p => {
      if (p.parameterType === 'array') {
          return `${typeMappings['c'][p.elementType]} _${p.parameterName}_[100]; // Adjust size as needed\nint _${p.parameterName}_size = 0;\nwhile (scanf("%d", &_${p.parameterName}_[_${p.parameterName}_size]) == 1) { _${p.parameterName}_size++; }`;
      } else {
          return `scanf("%${typeMappings['c'][p.parameterType]}", &_${p.parameterName}_);`;
      }
  }).join('\n')}

  // Call function and print result
  ${typeMappings['c']['returnType']} result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  printf("%d\\n", result);

  return 0;
}
      `
    };

    // Generate C++ template
    templates['cpp'] = {
      id: 105,
      name: 'C++',
      template: `
#include <iostream>
#include <vector>
#include <sstream>

using namespace std;

${typeMappings['cpp']['returnType']} ${functionName}(${generateParameterMappings(parameters, 'cpp')}) {
  // Add your code here
  return ${typeMappings['cpp']['defaultReturnValue']};
}

int main() {
  // Input data
  ${parameters.map(p => `cin >> _${p.parameterName}_;`).join('\n')}

  // Call function and print result
  ${typeMappings['cpp']['returnType']} result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  cout << result << endl;

  return 0;
}
      `
    };

    // Generate Java template
    templates['java'] = {
      id: 96,
      name: 'Java',
      template: `
import java.util.Scanner;

public class Main {

  public static ${typeMappings['java']['returnType']} ${functionName}(${generateParameterMappings(parameters, 'java')}) {
      // Add your code here
      return ${typeMappings['java']['defaultReturnValue']};
  }

  public static void main(String[] args) {
      Scanner scanner = new Scanner(System.in);

      ${parameters.map(p => `_${p.parameterName}_ = scanner.next${typeMappings['java']['inputType'](p.parameterType)}();`).join('\n')}

      ${typeMappings['java']['returnType']} result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
      System.out.println(result);
  }
}
      `
    };

    // Generate JavaScript (Node.js) template
    templates['javascript'] = {
      id: 102,
      name: 'JavaScript',
      template: `
function ${functionName}(${generateParameterMappings(parameters, 'javascript')}) {
  // Add your code here
  return ${typeMappings['javascript']['defaultReturnValue']};
}

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const inputs = [];
rl.on('line', (line) => { inputs.push(line); });

rl.on('close', () => {
  ${parameters.map(p => {
    const inputType = typeMappings['javascript']['inputType'](p.parameterType);
    if (inputType.startsWith('Array')) {
      return `const _${p.parameterName}_ = inputs.shift().split(",").map(${inputType.slice(6, -1)});`;
    } else if (p.parameterType === 'object') {
      return `const _${p.parameterName}_ = JSON.parse(inputs.shift());`;
    } else {
      return `const _${p.parameterName}_ = ${inputType}(inputs.shift());`;
    }
  }).join('\n  ')}

  let result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  if (Array.isArray(result)) {
    result = JSON.stringify(result);
    console.log(result.slice(1, -1));
  } else {
    console.log(result);
  }
});`
    };
    for (const language in templates) {
      const template = templates[language];
      template.template = Buffer.from(template.template).toString('base64');
    }
    return [null, templates];
  } catch (error) {
    console.error(error);
    return [error, null];
  }
};

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};
