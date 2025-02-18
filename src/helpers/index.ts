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
    jsonType: 'Object',
    object: 'Object',
    returnType: 'Object',
    input: (parameterType) => {
      const mapping = {
        int: 'Integer.parseInt(scanner.nextLine().trim())',
        float: 'Float.parseFloat(scanner.nextLine().trim())',
        double: 'Double.parseDouble(scanner.nextLine().trim())',
        str: 'scanner.nextLine().trim()',
        bool: 'Boolean.parseBoolean(scanner.nextLine().trim())',
        arrayOfnum: `Arrays.stream(scanner.nextLine()
              .replaceAll("\\\\[|\\\\]|\\\\s", "")
              .split(","))
              .mapToInt(Integer::parseInt)
              .toArray()`,
        arrayOfStr: `scanner.nextLine()
              .replaceAll("\\\\[|\\\\]|\\\\s", "")
              .split(",")`,
        object: 'scanner.nextLine().trim()'
      };
      return mapping[parameterType] || 'scanner.nextLine().trim()';
    },
    defaultReturnValue: {
      int: '0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      bool: 'false',
      arrayOfnum: 'new int[0]',
      arrayOfStr: 'new String[0]',
      object: 'null',
      void: '',
    },
  },
  c: {
    int: 'int',
    float: 'float',
    double: 'double',
    str: 'char*',
    bool: 'int',
    arrayOfnum: 'int*',
    arrayOfStr: 'char**',
    jsonType: 'void',
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
    jsonType: 'void',
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
        'bool': 'bool(input())',
        'arrayOfnum': 'json.loads(input())',
        'arrayOfStr': 'json.loads(input())',
        'jsonType': 'json.loads(input())',
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
        int: 'Number',
        float: 'Number',
        double: 'Number',
        str: 'String',
        bool: 'Boolean',
        any: 'Object',
      };
      return mapping[type] || 'String';
    },
    input: (parameterType) => {
      const mapping = {
        int: 'Number(input)',
        float: 'Number(input)',
        double: 'Number(input)',
        str: 'input',
        bool: 'Boolean(input)',
        arrayOfnum: 'JSON.parse(input)',
        arrayOfStr: 'JSON.parse(input)',
        jsonType: 'JSON.parse(input)',
        object: 'JSON.parse(input)',
      };
      return mapping[parameterType] || 'input';
    },
  },
};




export async function generateTemplates(functionName, parameters, returnType) {
  try {
    functionName = functionName.replace(/ /g, '_').toLowerCase();
    /**
     * Get parameter mappings for function definition
     */
    const getParameterMappings = (parameters) => {
      return parameters
        .map(p => {
          const type = typeMappings.javascript[p.parameterType] || 'any';
          return `${p.parameterName}: ${type}`;
        })
        .join(', ');
    };

    /**
     * Get input handling logic for parameters
     */
    const getInputHandling = (parameters) => {
      return parameters
        .map(p => {
          const inputLogic = typeMappings.javascript.input(p.parameterType);
          return `const _${p.parameterName}_ = ${inputLogic};`;
        })
        .join('\n');
    };
  
/**
 * Generate JavaScript function template
 */
const generateJavaScriptTemplate = (functionName, parameters, returnType) => {
  // Map parameter names
  const parameterMappings = parameters.map(p => p.parameterName).join(', ');

  return [null, `
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function definition
// Before submitting the code, please remove the console.log statement.
function ${functionName}(${parameterMappings}) {
    // Add your code here
  return ${typeMappings.javascript.defaultReturnValue};
}

// Read all required inputs
const inputLines = [];
rl.on('line', (line) => {
  inputLines.push(line);
  if (inputLines.length === ${parameters.length}) { // Assuming ${parameters.length} inputs needed
  rl.close();
  }
});

rl.on('close', () => {
  // Process inputs
  ${parameters
  .map(
      (p, index) => `const _${p.parameterName}_ = ${typeMappings.javascript.input(p.parameterType).replace('input', `inputLines[${index}]`)};`
  ).join('\n  ')}
  const result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  console.log(JSON.stringify(result));
});
  `];
};
    let [errorCtemplate, cTemplate] = await generateCTemplates(functionName, parameters, returnType);
    if (errorCtemplate) {
      return [errorCtemplate, null];
    }
    let [errorCppTemplate, cppTemplate] = generateCppTemplates(functionName, parameters, returnType);
    if (errorCppTemplate) {
      return [errorCppTemplate, null];
    }
    let [errorJavaTemplate, javaTemplate] = await generateJavaTemplate(functionName, parameters, returnType);
    if (errorJavaTemplate) {
      return [errorJavaTemplate, null];
    }
    // python template generator
    let [errorPythonTemplate, pythonTemplate] = await generatePythonTemplate(functionName, parameters, returnType);
    if (errorPythonTemplate) {
      return [errorPythonTemplate, null];
    }
    // javascript template generator
    let [errorJavascriptTemplate, javascriptTemplate] = await generateJavaScriptTemplate(functionName, parameters, returnType);
    if (errorJavascriptTemplate) {
      return [errorJavascriptTemplate, null];
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
      template: javaTemplate,
    };

    // Generate Python template
    templates['python'] = {
      id: 100,
      name: 'Python',
      template: pythonTemplate,
    };

    // Generate JavaScript (Node.js) template
    templates['javascript'] = {
      id: 102,
      name: 'JavaScript',
      template: javascriptTemplate,
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

async function generateJavaTemplate(functionName, parameters, returnType = 'object') {
  try {
    const returnTypeMapped = typeMappings.java[returnType] || 'Object';
    const defaultReturn = typeMappings.java.defaultReturnValue[returnType] || 'null';

    // Generate parameter list with types
    const parameterList = parameters.map(p => 
      `${typeMappings.java[p.parameterType] || 'Object'} ${p.parameterName}`
    ).join(', ');

    // Generate input handling
    const inputHandling = parameters.map(p => {
      const inputLogic = typeMappings.java.input(p.parameterType);
      return `        ${typeMappings.java[p.parameterType]} ${p.parameterName} = ${inputLogic};`;
    }).join('\n');

    // Generate print statements for debugging
    const debugPrints = parameters.map(p => {
      if (p.parameterType === 'arrayOfnum') {
        return `System.out.println(Arrays.toString(${p.parameterName}));`;
      } else if (p.parameterType === 'arrayOfStr') {
        return `System.out.println(Arrays.toString(${p.parameterName}));`;
      }
      return `System.out.println(${p.parameterName});`;
    }).join('\n        ');

    const template = `
import java.util.*;
import java.util.stream.*;

public class Main {

    public static ${returnTypeMapped} ${functionName}(${parameterList}) {
        // Debug input prints
        ${debugPrints}

        // Add your logic here
        return ${defaultReturn}; // Default return
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        // Input parsing
${inputHandling}

        // Execute function
        Object result = ${functionName}(${parameters.map(p => p.parameterName).join(', ')});

        // Result formatting
        if (result instanceof int[]) {
            System.out.println(Arrays.toString((int[]) result));
        } else if (result instanceof String[]) {
            System.out.println(Arrays.toString((String[]) result));
        } else if (result instanceof Object[]) {
            System.out.println(Arrays.deepToString((Object[]) result));
        } else {
            System.out.println(result);
        }

        scanner.close();
    }
}
    `;
    return [null, template];
  } catch (error) {
    console.error('Error generating template:', error);
    return [error, null];
  }
}



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

// Separate function to generate a Python template
async function generatePythonTemplate(functionName, parameters, returnType) {
  try {
    // Create function parameter mappings with type hints
    const parameterMappings = parameters
        .map(p => {
            const type = typeMappings.python[p.parameterType] || 'Any';
            return `${p.parameterName}: ${type}`;
        })
        .join(', ');

    // Generate input handling code for each parameter
    const inputHandling = parameters
        .map(p => {
            const inputLogic = typeMappings.python.input(p.parameterType);
            return `_${p.parameterName}_ = ${inputLogic}`;
        })
        .join('\n');

    // Return the complete Python template as a string
    return [null, `
import sys
import json
from typing import List, Dict, Any

# Before submitting the code, please remove the print statement.
def ${functionName}(${parameterMappings}) -> ${typeMappings.python[returnType]}:
    # Add your code here
    return

# Example usage
${inputHandling}
result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')})
print(json.dumps(result))
    `];
      
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
