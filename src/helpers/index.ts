
export  const typeMappings = {
  java: {
      int: 'int',
      float: 'float',
      double: 'double',
      str: 'String',
      bool: 'boolean',
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
      bool: 'bool',
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
      bool: 'bool',
      arrayOfnum: 'int[]', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'char**', // This is an example; it can be modified based on the arrayOfStr type
      returnType: 'int', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
  },
  cpp: {
      int: 'int',
      float: 'float',
      double: 'double',
      bool: 'bool',
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
      bool: 'boolean',
      arrayOfnum: 'number[]', // This is an example; it can be modified based on the arrayOfnum type
      arrayOfStr: 'string[]', // This is an example; it can be modified based on the arrayOfStr type
      returnType: 'number', // Default return type, modify as needed
      defaultReturnValue: '0', // Default return value, modify as needed
  }
};

export async function generateTemplates(functionName, parameters) {
  // Normalize the function name
  functionName = functionName.replace(/ /g, '_').toLowerCase();
  const templates = {};

  // Generate Python template
  templates['python'] = {
    id: 71,
    name: 'Python',
    template: Buffer.from(`
from typing import List, Dict

def ${functionName}(${parameters.map(p => `_${p.parameterName}_: ${typeMappings['python'][p.parameterType]}`).join(', ')}):
  # Add your code here
  return

# Example usage
${parameters.map(p => `_${p.parameterName}_ = ${p.parameterType === 'array' ? 'list(map(int, input().split()))' : `${typeMappings['python'][p.parameterType]}(input())`}`).join('\n')}
result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')})
print(result)
    `).toString('base64')
  };

  // Generate C template
  templates['c'] = {
    id: 50,
    name: 'C',
    template: Buffer.from(`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Function to ${functionName}
${parameters.map(p => `${typeMappings['c'][p.parameterType]} _${p.parameterName}_;`).join('\n')}
${typeMappings['c']['returnType']} ${functionName}(${parameters.map(p => `${typeMappings['c'][p.parameterType]} _${p.parameterName}_`).join(', ')}) {
  // Add your code here
  return ${typeMappings['c']['defaultReturnValue']}; // Replace with actual return value
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
  printf("%d\\n", result); // Adjust format specifier as needed

  return 0;
}
    `).toString('base64')
  };

  // Generate C++ template
  templates['cpp'] = {
    id: 54,
    name: 'C++',
    template: Buffer.from(`
#include <iostream>
#include <vector>
#include <sstream>

using namespace std;

// Function to ${functionName}
${typeMappings['cpp']['returnType']} ${functionName}(${parameters.map(p => `${typeMappings['cpp'][p.parameterType]} _${p.parameterName}_`).join(', ')}) {
  // Add your code here
  return ${typeMappings['cpp']['defaultReturnValue']}; // Replace with actual return value
}

int main() {
  // Input data
  ${parameters.map(p => `int _${p.parameterName}_;\ncin >> _${p.parameterName}_;`).join('\n')}

  // Call function and print result
  ${typeMappings['cpp']['returnType']} result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  cout << result << endl;

  return 0;
}
    `).toString('base64')
  };

  // Generate Java template
  templates['java'] = {
    id: 62,
    name: 'Java',
    template: Buffer.from(`
import java.util.Scanner;

public class Main {

  // Function to ${functionName}
  public static ${typeMappings['java']['returnType']} ${functionName}(${parameters.map(p => `${typeMappings['java'][p.parameterType]} _${p.parameterName}_`).join(', ')}) {
      // Add your code here
      return ${typeMappings['java']['defaultReturnValue']}; // Replace with actual return value
  }

  public static void main(String[] args) {
      Scanner scanner = new Scanner(System.in);

      // Input data
      ${parameters.map(p => `${typeMappings['java'][p.parameterType]} _${p.parameterName}_ = scanner.next${typeMappings['java']['inputType'](p.parameterType)}();`).join('\n')}

      // Call function and print result
      ${typeMappings['java']['returnType']} result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
      System.out.println(result);
  }
}
    `).toString('base64')
  };

  // Generate JavaScript (Node.js) template
  templates['javascript'] = {
    id: 63,
    name: 'JavaScript',
    template: Buffer.from(`
//Please ensure that this parameter can only be a string.
function ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')}) {
  // Add your code here
  return ${typeMappings['javascript']['defaultReturnValue']}; // Replace with actual return value
}

// Example usage
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const inputs = [];
rl.on('line', (line) => {
  inputs.push(line);
});

rl.on('close', () => {
  const ${parameters.map(p => `_${p.parameterName}_ = ${p.parameterType === 'array' ? 'inputs.shift().split(" ").map(Number)' : 'inputs.shift()'}`).join(',\n    ')}
  
  const result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  console.log(result);
});
    `).toString('base64')
  };

  return templates;
}


// Common status codes
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