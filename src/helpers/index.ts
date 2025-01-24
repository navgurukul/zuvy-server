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
  c: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'char*',
    bool: 'int',
    arrayOfnum: 'int*',
    arrayOfStr: 'char**',
    void: 'void',
    defaultReturnValue: {
      int: '0',
      float: '0.0f',
      double: '0.0',
      str: 'NULL',
      bool: '0',
      arrayOfnum: 'NULL',
      arrayOfStr: 'NULL',
      void: '',
    },
  },
  cpp: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'std::string',
    bool: 'bool',
    arrayOfnum: 'std::vector<int>',
    arrayOfStr: 'std::vector<std::string>',
    void: 'void',
    defaultReturnValue: {
      int: '0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      bool: 'false',
      arrayOfnum: '{}',
      arrayOfStr: '{}',
      void: '',
    },
  },
  java: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'String',
    bool: 'boolean',
    arrayOfnum: 'int[]',
    arrayOfStr: 'String[]',
    void: 'void',
    defaultReturnValue: {
      int: '0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      bool: 'false',
      arrayOfnum: 'new int[0]',
      arrayOfStr: 'new String[0]',
      void: '',
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


export async function generateTemplates(functionName, parameters, returnType) {
  try {
    functionName = functionName.replace(/ /g, '_').toLowerCase();
    let [errorCtemplate, cTemplate] = await generateCTemplates(functionName, parameters, returnType);
    if (errorCtemplate) {
      return [errorCtemplate, null];
    }
    console.log({ cTemplate });
    let [errorCppTemplate, cppTemplate] = generateCppTemplates(functionName, parameters, returnType);
    if (errorCppTemplate) {
      return [errorCppTemplate, null];
    }
    let [errorJavaTemplate, javaTemplate] = await generateJavaTemplates(functionName, parameters, returnType);
    if (errorJavaTemplate) {
      return [errorJavaTemplate, null];
    }
    const templates = {};
    // Generate C template
    templates['c'] = {
      id: 104,
      name: 'C',
      template: cTemplate,
    }

    // Generate C++ template
    templates['cpp'] = {
      id: 105,
      name: 'C++',
      template: cppTemplate,
    };


    // Generate Java template
    templates['java'] = {
      id: 96,
      name: 'Java',
      template: 'java Template is not available',
    };

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


// // generate java template for the given function name and parameters
// async function generateJavaTemplates(functionName, parameters, returnType) {
//   try {
//     // Get return type and default value
//     const returnTypeMapped = typeMappings['java'][returnType] || typeMappings['java']['returnType'];
//     const defaultReturnValue =
//       typeMappings['java'].defaultReturnValue[returnType] || typeMappings['java'].defaultReturnValue['void'];

//       console.log({returnTypeMapped, defaultReturnValue});
//     // Generate Java template
//     const javaTemplate = `
// import java.util.*;

// public class Solution {

//     // Function to ${functionName}
//     public static ${returnTypeMapped} ${functionName}(${parameters
//       .map((p) => `${typeMappings['java'][p.parameterType]} ${p.parameterName}`)
//       .join(', ')}) {
//         return {defaultReturnValue}; // Return default value
//     }

//     public static void main(String[] args) {
//         Scanner scanner = new Scanner(System.in);

//         // Input data
//         ${parameters
//           .map((p) => {
//             if (p.parameterType === 'arrayOfnum') {
//               return `
//         List<Integer> list = new ArrayList<>();
//         while (scanner.hasNextInt()) {
//             list.add(scanner.nextInt());
//         }
//         int[] ${p.parameterName} = list.stream().mapToInt(i -> i).toArray();`;
//             } else if (p.parameterType === 'str') {
//               return `
//         String ${p.parameterName} = scanner.nextLine();`;
//             } else {
//               return `
//         ${typeMappings['java'][p.parameterType]} ${p.parameterName} = scanner.next${
//                 p.parameterType === 'float' ? 'Float' : p.parameterType.charAt(0).toUpperCase() + p.parameterType.slice(1)
//               }();`;
//             }
//           })
//           .join('\n')}

//         // Call function and print result
//         ${returnTypeMapped} result = ${functionName}(${parameters.map((p) => `${p.parameterName}`).join(', ')});
//         if (result != ${defaultReturnValue}) {
//             System.out.println(result);
//         }

//         scanner.close();
//     }
// }
// `;
//     return [null, javaTemplate]
//   } catch (error) {
//     console.error('Error generating template:', error);
//     return [error, null];
//   }
// }

// generate c template for the given function name and parameters
async function generateCTemplates(functionName, parameters, returnType) {
  try {
    // Map return type and default value
    const returnTypeMapped = typeMappings['c'][returnType] || typeMappings['c']['returnType'];
    const defaultReturnValue =
      typeMappings['c'].defaultReturnValue[returnType] || typeMappings['c'].defaultReturnValue['void'];
    // Generate function parameters for the template
    const parameterList = parameters
      .map((p) => `${typeMappings['c'][p.parameterType]} ${p.parameterName}`)
      .join(', ');
    // Generate logic template
    const logicTemplate = `
    // Add logic here based on problem requirements
    return ${defaultReturnValue}; // Return default value
    `;

    // Generate input-handling code based on parameter types
    const inputHandling = parameters
      .map((p) => {
        if (p.parameterType === 'arrayOfnum') {
          return `
    int ${p.parameterName}[100]; // Limit array size
    int ${p.parameterName}_size = 0;
    while (${p.parameterName}_size < 100 && scanf("%d", &${p.parameterName}[${p.parameterName}_size]) == 1) {
        ${p.parameterName}_size++;
    }`;
        } else if (p.parameterType === 'str') {
          return `
    char ${p.parameterName}[100];
    scanf("%s", ${p.parameterName});`;
        } else {
          return `
    ${typeMappings['c'][p.parameterType]} ${p.parameterName};
    scanf("%d", &${p.parameterName});`;
        }
      })
      .join('\n');

    // Generate the C template
    const cTemplate = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Function to ${functionName}
${returnTypeMapped} ${functionName}(${parameterList}) {
    ${logicTemplate}
}

int main() {
    // Input handling
    ${inputHandling}

    // Call the function
    ${returnTypeMapped} result = ${functionName}(${parameters
        .map((p) => p.parameterName)
        .join(', ')});

    // Output result
    printf("${returnType === 'int' ? '%d' : returnType === 'float' ? '%f' : '%s'}", result);

    return 0;
}`;
    return [null, cTemplate]
  } catch (error) {
    console.error('Error generating template:', error);
    return [error, null];
  }
}

// generate c++ template for the given function name and parameters
function generateCppTemplates(functionName, parameters, returnType) {
  try {
    // Get return type and default value
    const returnTypeMapped = typeMappings['cpp'][returnType] || typeMappings['cpp']['returnType'];
    const defaultReturnValue =
      typeMappings['cpp'].defaultReturnValue[returnType] || typeMappings['cpp'].defaultReturnValue['void'];

    // Generate C++ template
    const cppTemplate = `
#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <limits>

using namespace std;

// Function to ${functionName}
${returnTypeMapped} ${functionName}(${parameters
        .map((p) => `${typeMappings['cpp'][p.parameterType]} ${p.parameterName}`)
        .join(', ')}) {
    
    return ${defaultReturnValue}; // Return default value
}

int main() {
    // Input data
    ${parameters
        .map((p) => {
          if (p.parameterType === 'arrayOfnum') {
            return `
    vector<int> ${p.parameterName};
    int temp;
    while (cin >> temp) {
        ${p.parameterName}.push_back(temp);
    }
    cin.clear(); // Clear error state
    cin.ignore(numeric_limits<streamsize>::max(), '\\n');`;
          } else if (p.parameterType === 'str') {
            return `
    string ${p.parameterName};
    getline(cin, ${p.parameterName});`;
          } else {
            return `
    ${typeMappings['cpp'][p.parameterType]} ${p.parameterName};
    cin >> ${p.parameterName};
    cin.ignore(); // Clear buffer for next input`;
          }
        })
        .join('\n')}

    // Call function and print result
    ${returnTypeMapped} result = ${functionName}(${parameters.map((p) => `${p.parameterName}`).join(', ')});
    if (result != ${defaultReturnValue}) {
        cout << result << endl;
    }

    return 0;
}
`;

    return [null, cppTemplate]
  } catch (error) {
    return [error, null];
  }
}

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
