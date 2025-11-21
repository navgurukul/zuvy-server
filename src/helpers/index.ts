export const complairDateTyeps = [
  'int',
  'long',
  'short',
  'byte',
  'float',
  'double',
  'str',
  'char',
  'bool',
  'arrayOfnum',
  'arrayOfStr',
  'arrayOfChar',
  'arrayOfObj',
  'object',
  'map',
  'jsonType',
];

export const typeMappings = {
  java: {
    int: 'int',
    long: 'long',
    short: 'short',
    byte: 'byte',
    float: 'float',
    double: 'double',
    str: 'String',
    char: 'char',
    bool: 'boolean',
    arrayOfnum: 'int[]',
    arrayOfStr: 'String[]',
    arrayOfChar: 'char[]',
    arrayOfObj: 'Object[]',
    jsonType: 'Object', // Generic type for JSON-like structures
    object: 'Object',
    map: 'Map<String,Object>',
    void: 'void',
    input: (parameterType) => {
      const mapping = {
        int: 'Integer.parseInt(scanner.nextLine().trim())',
        long: 'Long.parseLong(scanner.nextLine().trim())',
        short: 'Short.parseShort(scanner.nextLine().trim())',
        byte: 'Byte.parseByte(scanner.nextLine().trim())',
        float: 'Float.parseFloat(scanner.nextLine().trim())',
        double: 'Double.parseDouble(scanner.nextLine().trim())',
        str: 'scanner.nextLine().trim()',
        char: `(() -> { String _tmp = scanner.nextLine().trim(); return _tmp.isEmpty()? '\\0' : _tmp.charAt(0); })()`,
        bool: 'Boolean.parseBoolean(scanner.nextLine().trim())',
        arrayOfnum: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        arrayOfStr: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        arrayOfChar: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        arrayOfObj: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        object: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        map: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        jsonType: 'parseJavaStrictFormat(scanner.nextLine().trim())', // Handle JSON-like input
      };
      return mapping[parameterType] || 'scanner.nextLine().trim()';
    },
    defaultReturnValue: {
      int: '0',
      long: '0L',
      short: '(short)0',
      byte: '(byte)0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      char: "'\\0'",
      bool: 'false',
      arrayOfnum: 'new int[0]',
      arrayOfChar: 'new char[0]',
      arrayOfStr: 'new String[0]',
      arrayOfObj: 'new Object[0]',
      object: 'null',
      map: 'null',
      jsonType: 'null', // Default for JSON-like structures
      void: '',
    },
  },
  python: {
    int: 'int',
    long: 'int',
    short: 'int',
    byte: 'int',
    float: 'float',
    str: 'str',
    char: 'str',
    bool: 'bool',
    arrayOfnum: 'List[int]',
    arrayOfStr: 'List[str]',
    arrayOfChar: 'List[str]',
    arrayOfObj: 'List[Any]',
    map: 'Dict[str, Any]',
    jsonType: 'Any',
    returnType: 'Any',
    input: (parameterType) => {
      const mapping = {
        int: 'int(input())',
        long: 'int(input())',
        short: 'int(input())',
        byte: 'int(input())',
        float: 'float(input())',
        str: 'input()',
        char: 'input()',
        bool: 'bool(input())',
        arrayOfnum: 'json.loads(input())',
        arrayOfStr: 'json.loads(input())',
        arrayOfChar: 'json.loads(input())',
        arrayOfObj: 'json.loads(input())',
        map: 'json.loads(input())',
        jsonType: 'json.loads(input())',
      };
      return mapping[parameterType] || 'input()';
    },
  },
  javascript: {
    int: 'number',
    long: 'number',
    short: 'number',
    byte: 'number',
    float: 'number',
    double: 'number',
    str: 'string',
    char: 'string',
    bool: 'boolean',
    arrayOfnum: 'number[]',
    arrayOfStr: 'string[]',
    arrayOfChar: 'string[]',
    arrayOfObj: 'any[]',
    jsonType: 'any',
    map: 'any',
    returnType: 'any',
    defaultReturnValue: 'null',
    object: 'object',
    inputType: (type) => {
      const mapping = {
        int: 'Number',
        float: 'Number',
        double: 'Number',
        str: 'String',
        char: 'String',
        bool: 'Boolean',
        any: 'Object',
      };
      return mapping[type] || 'String';
    },
    input: (parameterType) => {
      const mapping = {
        int: 'Number(input)',
        long: 'Number(input)',
        short: 'Number(input)',
        byte: 'Number(input)',
        float: 'Number(input)',
        double: 'Number(input)',
        str: 'input',
        char: 'input',
        bool: 'Boolean(input)',
        arrayOfnum: 'JSON.parse(input)',
        arrayOfStr: 'JSON.parse(input)',
        arrayOfChar: 'JSON.parse(input)',
        arrayOfObj: 'JSON.parse(input)',
        jsonType: 'JSON.parse(input)',
        object: 'JSON.parse(input)',
        map: 'JSON.parse(input)',
      };
      return mapping[parameterType] || 'input';
    },
  },
  c: {
    int: 'int',
    long: 'long',
    float: 'float',
    double: 'double',
    str: 'char*',
    char: 'char',
    bool: 'int',
    byte: 'unsigned char',
    arrayOfnum: 'int*',
    arrayOfStr: 'char**',
    arrayOfChar: 'char*',
    jsonType: 'void',
    defaultReturnValue: {
      int: '0',
      long: '0L',
      float: '0.0f',
      double: '0.0',
      str: 'NULL',
      char: "'\\0'",
      bool: '0',
      arrayOfnum: 'NULL',
      arrayOfStr: 'NULL',
      arrayOfChar: 'NULL',
      void: '',
    },
  },
  cpp: {
    int: 'int',
    long: 'long',
    float: 'float',
    double: 'double',
    str: 'std::string',
    char: 'char',
    bool: 'bool',
    arrayOfnum: 'std::vector<int>',
    arrayOfStr: 'std::vector<std::string>',
    arrayOfChar: 'std::vector<char>',
    arrayOfObj: 'std::vector<std::string>',
    jsonType: 'std::string',
    object: 'std::string',
    returnType: 'void',
    input: (parameterType, paramName) => {
      const mapping = {
        int: `[]() { return std::stoi(input${paramName}); }()`,
        long: `[]() { return std::stol(input${paramName}); }()`,
        float: `[]() { return std::stof(input${paramName}); }()`,
        double: `[]() { return std::stod(input${paramName}); }()`,
        str: `input${paramName}`,
        char: `[]() { return input${paramName}.empty() ? '\\0' : input${paramName}[0]; }()`,
        bool: `[]() { return input${paramName} == "true"; }()`,
        arrayOfnum: `[&input${paramName}]() {
            std::vector<int> arr;
            std::string token;
            std::istringstream stream(input${paramName});
            while (std::getline(stream, token, ',')) {
                arr.push_back(std::stoi(token));
            }
            return arr;
        }()`,
        arrayOfStr: `[&input${paramName}]() {
            std::vector<std::string> arr;
            std::string token;
            std::istringstream stream(input${paramName});
            while (std::getline(stream, token, ',')) {
                arr.push_back(token);
            }
            return arr;
        }()`,
        arrayOfChar: `[&input${paramName}]() {
            std::vector<char> arr;
            std::string token;
            std::istringstream stream(input${paramName});
            while (std::getline(stream, token, ',')) {
                arr.push_back(token.empty() ? '\\0' : token[0]);
            }
            return arr;
        }()`,
        object: `input${paramName}`,
      };
      return mapping[parameterType] || `input${paramName}`;
    },
    defaultReturnValue: {
      int: '0',
      long: '0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      char: "'\\0'",
      bool: 'false',
      arrayOfnum: '{}',
      arrayOfStr: '{}',
      arrayOfChar: '{}',
      jsonType: '""',
      object: '""',
      void: '',
    },
  },
};

export async function generateTemplates(functionName, parameters, returnType) {
  try {
    functionName = functionName.replace(/ /g, '_').toLowerCase();
    /**
     * Generate JavaScript function template
     */
    const generateJavaScriptTemplate = (
      functionName,
      parameters,
      returnType,
    ) => {
      // Map parameter names
      const parameterMappings = parameters
        .map((p) => p.parameterName)
        .join(', ');

      return [
        null,
        `
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function definition
function ${functionName}(${parameterMappings}) {
  // Before submitting the code, please remove the console.log statement from this function.
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
      (p, index) =>
        `const _${p.parameterName}_ = ${typeMappings.javascript.input(p.parameterType).replace('input', `inputLines[${index}]`)};`,
    )
    .join('\n  ')}
  const result = ${functionName}(${parameters.map((p) => `_${p.parameterName}_`).join(', ')});
  ${!['arrayOfnum', 'arrayOfStr', 'jsonType', 'object'].includes(returnType) ? 'console.log(result);' : 'console.log(JSON.stringify(result));'}
  });
  `,
      ];
    };
    let [errorCtemplate, cTemplate] = await generateCTemplates(
      functionName,
      parameters,
      returnType,
    );
    if (errorCtemplate) {
      return [errorCtemplate, null];
    }
    let [errorCppTemplate, cppTemplate] = await generateCppTemplate(
      functionName,
      parameters,
      returnType,
    );
    if (errorCppTemplate) {
      return [errorCppTemplate, null];
    }
    let [errorJavaTemplate, javaTemplate] = await generateJavaTemplate(
      functionName,
      parameters,
      returnType,
    );
    if (errorJavaTemplate) {
      return [errorJavaTemplate, null];
    }
    // python template generator
    let [errorPythonTemplate, pythonTemplate] = await generatePythonTemplate(
      functionName,
      parameters,
      returnType,
    );
    if (errorPythonTemplate) {
      return [errorPythonTemplate, null];
    }
    // javascript template generator
    let [errorJavascriptTemplate, javascriptTemplate] =
      await generateJavaScriptTemplate(functionName, parameters, returnType);
    if (errorJavascriptTemplate) {
      return [errorJavascriptTemplate, null];
    }

    const templates = {};
    // Generate C template
    templates['c'] = {
      id: 104,
      name: 'C',
      template: cTemplate,
    };

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
}

async function generateJavaTemplate(
  functionName,
  parameters,
  returnType = 'object',
) {
  try {
    const returnTypeMapped = typeMappings.java[returnType] || 'Object';
    const defaultReturn =
      typeMappings.java.defaultReturnValue[returnType] || 'null';

    const parameterList = parameters
      .map(
        (p) =>
          `${typeMappings.java[p.parameterType] || 'Object'} ${p.parameterName}`,
      )
      .join(', ');

    const inputHandling = parameters
      .map((p) => {
        const javaType = typeMappings.java[p.parameterType] || 'Object';
        if (javaType === 'int[]') {
          return `
        Object parsed_${p.parameterName} = parseJavaStrictFormat(scanner.nextLine().trim());
        int[] ${p.parameterName} = new int[0];
        if (parsed_${p.parameterName} instanceof Object[]) {
            Object[] arrObj = (Object[]) parsed_${p.parameterName};
            ${p.parameterName} = new int[arrObj.length];
            for (int i = 0; i < arrObj.length; i++) {
                ${p.parameterName}[i] = Integer.parseInt(arrObj[i].toString());
            }
        }`;
        } else if (javaType === 'String[]') {
          return `
        Object parsed_${p.parameterName} = parseJavaStrictFormat(scanner.nextLine().trim());
        String[] ${p.parameterName} = new String[0];
        if (parsed_${p.parameterName} instanceof Object[]) {
            Object[] arrObj = (Object[]) parsed_${p.parameterName};
            ${p.parameterName} = new String[arrObj.length];
            for (int i = 0; i < arrObj.length; i++) {
                ${p.parameterName}[i] = arrObj[i].toString();
            }
        }`;
        } else if (javaType === 'Object[]') {
          return `
        Object parsed_${p.parameterName} = parseJavaStrictFormat(scanner.nextLine().trim());
        Object[] ${p.parameterName} = new Object[0];
        if (parsed_${p.parameterName} instanceof Object[]) {
            ${p.parameterName} = (Object[]) parsed_${p.parameterName};
        }`;
        } else if (javaType === 'Object') {
          // Handle jsonType
          return `
        Object ${p.parameterName} = parseJavaStrictFormat(scanner.nextLine().trim());`;
        } else {
          return `${javaType} ${p.parameterName} = ${typeMappings.java.input(p.parameterType)};`;
        }
      })
      .join('\n');

    const returnLogs = [
      'arrayOfnum',
      'arrayOfStr',
      'arrayOfObj',
      'object',
      'jsonType',
    ].includes(returnType)
      ? 'System.out.println(formatArrayNoSpaces(returnData));'
      : 'System.out.println(returnData);';

    const template = `
import java.util.Scanner;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.PriorityQueue;
import java.util.Comparator;

public class Main {
  // Function with specified return type and parameters
  public static ${returnTypeMapped} ${functionName}(${parameterList}) {
    // Note: Please remove the System.out.println statements from this function before submitting the code.
    // Write your code here
      return ${defaultReturn};
  }

  public static void main(String[] args) {
      Scanner scanner = new Scanner(System.in);

      // Input parsing
      ${inputHandling}

      // Call function correctly
      ${returnTypeMapped} returnData = ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});

      // Result formatting
      ${returnLogs}
      scanner.close();
  }

  // ############## don't change the code below ##############
  // Strict formatting for arrays and objects with no spaces between elements
  public static String formatArrayNoSpaces(Object data) {
    if (data instanceof int[]) {
      int[] arr = (int[]) data;
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < arr.length; i++) {
          sb.append(arr[i]);
          if (i != arr.length - 1) {
              sb.append(",");
          }
      }
      sb.append("]");
      return sb.toString();
    } else if (data instanceof char[]) {
      // Special handling for char arrays without quotes (Issue #1 fix)
      char[] arr = (char[]) data;
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < arr.length; i++) {
          sb.append(arr[i]);
          if (i != arr.length - 1) {
              sb.append(",");
          }
      }
      sb.append("]");
      return sb.toString();
    } else if (data instanceof String[]) {
      String[] arr = (String[]) data;
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < arr.length; i++) {
          // Check if string is a single character - output without quotes
          if (arr[i] != null && arr[i].length() == 1) {
              sb.append(arr[i]);
          } else {
              sb.append("\\"").append(arr[i]).append("\\"");
          }
          if (i != arr.length - 1) {
              sb.append(",");
          }
      }
      sb.append("]");
      return sb.toString();
    } else if (data instanceof Object[]) {
      Object[] arr = (Object[]) data;
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < arr.length; i++) {
          sb.append(formatArrayNoSpaces(arr[i]));
          if (i != arr.length - 1) {
              sb.append(",");
          }
      }
      sb.append("]");
      return sb.toString();
    } else if (data instanceof Map) {
      Map<?, ?> map = (Map<?, ?>) data;
      StringBuilder sb = new StringBuilder();
      sb.append("{");
      int count = 0;
      for (Map.Entry<?, ?> entry : map.entrySet()) {
          if (count > 0) sb.append(",");
          sb.append("\\"").append(entry.getKey()).append("\\":");
          sb.append(formatArrayNoSpaces(entry.getValue()));
          count++;
      }
      sb.append("}");
      return sb.toString();
    }
    return String.valueOf(data);
  }

  // Updated parser with colon handling and support for simple arrays
  public static Object parseJavaStrictFormat(String input) {
    input = input.trim();
    if (input.startsWith("[") && input.endsWith("]")) {
      String content = input.substring(1, input.length() - 1).trim();
      if (content.isEmpty()) return new Object[0];
      if (!content.startsWith("{")) {
        String[] parts = splitTopLevel(content);
        Object[] result = new Object[parts.length];
        for (int i = 0; i < parts.length; i++) {
          result[i] = parseValue(parts[i].trim());
        }
        return result;
      } else {
        String[] parts = splitTopLevel(content);
        @SuppressWarnings("unchecked")
        Map<String, Object>[] result = new Map[parts.length];
        for (int i = 0; i < parts.length; i++) {
          String part = parts[i].trim();
          if (part.startsWith("{") && part.endsWith("}")) {
            part = part.substring(1, part.length() - 1).trim();
          }
          result[i] = parseMap(part);
        }
        return result;
      }
    }
    if (input.startsWith("{") && input.endsWith("}")) {
      return parseMap(input.substring(1, input.length() - 1).trim());
    }
    return parseValue(input);
  }

  // New map parser with colon support
  private static Map<String, Object> parseMap(String input) {
    Map<String, Object> map = new HashMap<>();
    if (input.isEmpty()) return map;
    String[] pairs = splitTopLevel(input);
    for (String pair : pairs) {
      String[] keyValue = pair.split(":", 2);
      if (keyValue.length != 2) continue;
      String key = keyValue[0].trim().replaceAll("^['\\"]|['\\"]$", "");
      String value = keyValue[1].trim();
      map.put(key, parseValue(value));
    }
    return map;
  }

  // Helper method to split top-level elements
  private static String[] splitTopLevel(String input) {
    List<String> parts = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    int bracketCount = 0;
    for (char c : input.toCharArray()) {
      if (c == '[' || c == '{') bracketCount++;
      else if (c == ']' || c == '}') bracketCount--;
      else if (c == ',' && bracketCount == 0) {
        parts.add(current.toString().trim());
        current.setLength(0);
        continue;
      }
      current.append(c);
    }
    if (current.length() > 0) {
      parts.add(current.toString().trim());
    }
    return parts.toArray(new String[0]);
  }

  // Helper method to parse values
  private static Object parseValue(String value) {
    value = value.trim();
    
    // Handle null values explicitly (Issue #3 fix - null handling in tree nodes)
    // Handle both "null" string and empty values (e.g., [0,1,,2] where ,, represents null)
    if (value.isEmpty() || value.equalsIgnoreCase("null")) {
      return null;
    }
    
    if ((value.startsWith("\\"") && value.endsWith("\\"")) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.substring(1, value.length() - 1);
    } else {
      try {
        return Integer.parseInt(value);
      } catch (NumberFormatException e) {
        return value;
      }
    }
  }
}
`;

    return [null, template];
  } catch (error) {
    console.error('Error generating Java template:', error);
    return [error];
  }
}

// generate c template for the given function name and parameters
async function generateCTemplates(functionName, parameters, returnType) {
  try {
    // Map return type and default value
    const returnTypeMapped =
      typeMappings['c'][returnType] || typeMappings['c']['returnType'];
    const defaultReturnValue =
      typeMappings['c'].defaultReturnValue[returnType] ||
      typeMappings['c'].defaultReturnValue['void'];
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
    return [null, cTemplate];
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
      .map((p) => {
        const type = typeMappings.python[p.parameterType] || 'Any';
        return `${p.parameterName}: ${type}`;
      })
      .join(', ');

    // Generate input handling code for each parameter
    const inputHandling = parameters
      .map((p) => {
        const inputLogic = typeMappings.python.input(p.parameterType);
        return `_${p.parameterName}_ = ${inputLogic}`;
      })
      .join('\n');

    // Return the complete Python template as a string
    return [
      null,
      `
import sys
import json
from typing import List, Dict, Any

def ${functionName}(${parameterMappings}) -> ${typeMappings.python[returnType]}:
    # Before submitting the code, please remove the print statement from this function.
    # Add your code here
    return

# Example usage
${inputHandling}
result = ${functionName}(${parameters.map((p) => `_${p.parameterName}_`).join(', ')})
${!['arrayOfnum', 'arrayOfStr', 'jsonType', 'object'].includes(returnType) ? 'print(result);' : 'print(json.dumps(result, separators=(",", ":")));'}`,
    ];
  } catch (error) {
    console.error('Error generating template:', error);
    return [error, null];
  }
}

// generate c++ template for the given function name and parameters
async function generateCppTemplateOld(
  functionName,
  parameters,
  returnType = 'void',
) {
  try {
    const returnTypeMapped = typeMappings.cpp[returnType] || 'void';
    const defaultReturn = typeMappings.cpp.defaultReturnValue[returnType] || '';

    const parameterList = parameters
      .map((p) => `${typeMappings.cpp[p.parameterType]} ${p.parameterName}`)
      .join(', ');

    const inputHandling = parameters
      .map((p) => {
        const inputVar = `input${p.parameterName}`;
        return `
    std::string ${inputVar};
    std::getline(std::cin, ${inputVar});
    ${typeMappings.cpp[p.parameterType]} ${p.parameterName} = ${typeMappings.cpp.input(p.parameterType, p.parameterName)};`;
      })
      .join('\n');

    const debugPrints = parameters
      .map((p) => {
        if (p.parameterType === 'arrayOfnum') {
          return `    std::cout << "Debug ${p.parameterName}: ";
    for (int num : ${p.parameterName}) { std::cout << num << " "; }
    std::cout << "\\n";`;
        } else if (p.parameterType === 'arrayOfStr') {
          return `    std::cout << "Debug ${p.parameterName}: ";
    for (const auto& word : ${p.parameterName}) { std::cout << word << " "; }
    std::cout << "\\n";`;
        }
        return `    std::cout << "Debug ${p.parameterName}: " << ${p.parameterName} << "\\n";`;
      })
      .join('\n');

    const template = `#include <iostream>
#include <vector>
#include <sstream>
#include <string>
#include <type_traits>
#include <map>

// Generic vector printer
template<typename T>
void printVector(const std::vector<T>& v) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        std::cout << v[i] << (i < v.size()-1 ? "," : "");
    }
    std::cout << "]";
}

// Specialization for vector<string> to handle single-char strings without quotes
void printVector(const std::vector<std::string>& v) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (!v[i].empty() && v[i].size() == 1) std::cout << v[i];
        else std::cout << "\"" << v[i] << "\"";
        if (i < v.size()-1) std::cout << ",";
    }
    std::cout << "]";
}

// Specialization for vector<char> to print characters without quotes
void printVector(const std::vector<char>& v) {
    std::cout << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        std::cout << v[i] << (i < v.size()-1 ? "," : "");
    }
    std::cout << "]";
}

// Generic result printer with overloads for common containers
template<typename T>
void printResult(const T& val) { std::cout << val; }

void printResult(const std::vector<int>& v) { printVector(v); }
void printResult(const std::vector<long>& v) { printVector(v); }
void printResult(const std::vector<std::string>& v) { printVector(v); }
void printResult(const std::vector<char>& v) { printVector(v); }
void printResult(const std::string& s) { std::cout << s; }
void printResult(char c) { std::cout << c; }

// Simple map<string,string> printer (used when parse yields simple string values)
void printResult(const std::map<std::string, std::string>& m) {
    std::cout << "{";
    size_t cnt = 0;
    for (auto &kv : m) {
        if (cnt++) std::cout << ",";
        std::cout << "\"" << kv.first << "\":";
        // print string value (quotes if length > 1)
        if (!kv.second.empty() && kv.second.size() == 1) std::cout << kv.second;
        else std::cout << "\"" << kv.second << "\"";
    }
    std::cout << "}";
}

${returnTypeMapped} ${functionName}(${parameterList}) {
${debugPrints}
    
    // Add your logic here
    // Example starter code:
    int sum = 0;
    for (int num : numbers) sum += num;
    
    std::string concatenated;
    for (const auto& word : words) concatenated += word + " ";
    
    return ${defaultReturn};
}

int main() {${inputHandling}

    ${
      returnTypeMapped === 'void'
        ? `${functionName}(${parameters.map((p) => p.parameterName).join(', ')});`
        : `auto result = ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});
    // Unified output handling
    printResult(result);`
    }
    
    return 0;
}`;
    return [null, template];
  } catch (error) {
    return [error, null];
  }
}

// New generateCppTemplate: safer signatures, const-ref containers, string-safe returns
export async function generateCppTemplate(
  functionName: string,
  parameters: Array<{ parameterName: string; parameterType: string }>,
  returnType = 'void',
) {
  try {
    const hasTypeMappings =
      typeof typeMappings !== 'undefined' && !!typeMappings.cpp;

    // Helper: safe signature for a param
    function cppParamSignatureFor(paramType: string, paramName: string) {
      const t = paramType;
      switch (t) {
        case 'int':
        case 'long':
          return `long long ${paramName}`;
        case 'float':
        case 'double':
          return `double ${paramName}`;
        case 'char':
          return `char ${paramName}`;
        case 'bool':
          return `bool ${paramName}`;
        case 'string':
          return `std::string ${paramName}`;
        case 'arrayOfnum':
          return `const std::vector<long long>& ${paramName}`;
        case 'arrayOfDouble':
          return `const std::vector<double>& ${paramName}`;
        case 'arrayOfStr':
          return `const std::vector<std::string>& ${paramName}`;
        case 'nestedArrayOfnum':
        case 'arrayOfArray':
        case 'matrix':
          return `const std::vector<std::vector<long long>>& ${paramName}`;
        case 'pair':
          return `const std::pair<long long,long long>& ${paramName}`;
        case 'edgeList':
        case 'graph':
        case 'tree':
          return `const std::vector<std::vector<int>>& ${paramName}`;
        case 'map':
        case 'object':
        case 'jsonType':
          return `const std::map<std::string, Variant>& ${paramName}`;
        default:
          // fallback to mapping if present
          if (
            hasTypeMappings &&
            typeMappings.cpp &&
            typeMappings.cpp[paramType]
          ) {
            const mapped = typeMappings.cpp[paramType];
            // use const-ref for containers
            if (mapped.includes('vector') || mapped.includes('map')) {
              return `const ${mapped}& ${paramName}`;
            }
            return `${mapped} ${paramName}`;
          }
          return `std::string ${paramName}`;
      }
    }

    // Determine a safe return type for the signature. Prefer scalar mappings,
    // but default to std::string for complex/array returns to keep printing simple.
    let returnTypeMapped: string;
    if (hasTypeMappings && typeMappings.cpp && typeMappings.cpp[returnType]) {
      const rt = typeMappings.cpp[returnType];
      if (
        rt.includes('vector') ||
        rt.includes('map') ||
        rt.includes('Variant') ||
        rt.includes('std::vector')
      ) {
        returnTypeMapped = 'std::string';
      } else {
        returnTypeMapped = rt;
      }
    } else {
      returnTypeMapped = returnType === 'void' ? 'void' : 'std::string';
    }

    // Build the signature using helper
    const paramSigParts = parameters.map((p) =>
      cppParamSignatureFor(p.parameterType, p.parameterName),
    );
    const funcSignature = `${returnTypeMapped} ${functionName}(${paramSigParts.join(', ')})`;

    // Input readers: raw_<name>
    const inputReaders = parameters
      .map((p) => {
        const name = p.parameterName;
        return `  // parameter: ${name}
  string raw_${name};
  if (lineIndex < (int)allLines.size()) {
    raw_${name} = allLines[lineIndex++];
  } else {
    if (tokenPos < (int)tokens.size()) raw_${name} = tokens[tokenPos++]; else raw_${name} = "";
  }
  raw_${name} = trim(raw_${name});`;
      })
      .join('\n\n');

    // Conversion lines: create typed variables that match the signature helper types
    const conversionLines = parameters
      .map((p) => {
        const name = p.parameterName;
        const t = p.parameterType;
        if (t === 'int' || t === 'long') {
          return `  long long ${name} = 0;
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isInt()) ${name} = v.asInt();
    else if (v.isDouble()) ${name} = (long long)v.asDouble();
    else if (!raw_${name}.empty()) try { ${name} = stoll(raw_${name}); } catch(...) {}
  }`;
        } else if (t === 'float' || t === 'double') {
          return `  double ${name} = 0.0;
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isDouble()) ${name} = v.asDouble();
    else if (v.isInt()) ${name} = (double)v.asInt();
    else if (!raw_${name}.empty()) try { ${name} = stod(raw_${name}); } catch(...) {}
  }`;
        } else if (t === 'char') {
          return `  char ${name} = '\\0';
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isString() && !v.asString().empty()) ${name} = v.asString()[0];
    else if (!raw_${name}.empty()) ${name} = raw_${name}[0];
  }`;
        } else if (t === 'bool') {
          return `  bool ${name} = false;
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isBool()) ${name} = v.asBool();
    else if (v.isInt()) ${name} = v.asInt() != 0;
    else { string low = raw_${name}; transform(low.begin(), low.end(), low.begin(), ::tolower); if (low=="true" || low=="1") ${name}=true; }
  }`;
        } else if (t === 'string') {
          return `  string ${name} = "";
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isString()) ${name} = v.asString();
    else if (v.isInt()) ${name} = to_string(v.asInt());
    else if (v.isDouble()) ${name} = to_string(v.asDouble());
    else ${name} = raw_${name};
  }`;
        } else if (t === 'arrayOfnum') {
          return `  vector<long long> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) {
      for (const Variant &vv : v.asArray()) {
        if (vv.isInt()) ${name}.push_back(vv.asInt());
        else if (vv.isDouble()) ${name}.push_back((long long)vv.asDouble());
      }
    } else if (!raw_${name}.empty()) {
      auto parts = splitOnDelimiters(raw_${name});
      for (auto &s : parts) try { ${name}.push_back(stoll(s)); } catch(...) {}
    }
  }`;
        } else if (t === 'arrayOfDouble') {
          return `  vector<double> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) {
      for (const Variant &vv : v.asArray()) {
        if (vv.isDouble()) ${name}.push_back(vv.asDouble());
        else if (vv.isInt()) ${name}.push_back((double)vv.asInt());
      }
    } else if (!raw_${name}.empty()) {
      auto parts = splitOnDelimiters(raw_${name});
      for (auto &s : parts) try { ${name}.push_back(stod(s)); } catch(...) {}
    }
  }`;
        } else if (t === 'arrayOfStr') {
          return `  vector<string> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) {
      for (const Variant &vv : v.asArray()) {
        if (vv.isString()) ${name}.push_back(vv.asString());
        else if (vv.isInt()) ${name}.push_back(to_string(vv.asInt()));
      }
    } else if (!raw_${name}.empty()) {
      ${name} = splitOnDelimiters(raw_${name});
    }
  }`;
        } else if (
          t === 'nestedArrayOfnum' ||
          t === 'arrayOfArray' ||
          t === 'matrix'
        ) {
          return `  vector<vector<long long>> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) {
      for (const Variant &row : v.asArray()) {
        if (row.isArray()) {
          vector<long long> r;
          for (const Variant &vv : row.asArray()) {
            if (vv.isInt()) r.push_back(vv.asInt());
            else if (vv.isDouble()) r.push_back((long long)vv.asDouble());
          }
          ${name}.push_back(r);
        }
      }
    } else {
      auto rows = splitBySemicolon(raw_${name});
      for (auto &r : rows) {
        auto parts = splitOnDelimiters(r);
        vector<long long> rr; for (auto &s : parts) try { rr.push_back(stoll(s)); } catch(...) {}
        if (!rr.empty()) ${name}.push_back(rr);
      }
    }
  }`;
        } else if (t === 'pair') {
          return `  pair<long long,long long> ${name} = {0,0};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) { auto arr = v.asArray(); if (arr.size()>=2) { long long a = arr[0].isInt()?arr[0].asInt():0; long long b = arr[1].isInt()?arr[1].asInt():0; ${name}={a,b}; } }
    else { auto parts = splitOnDelimiters(raw_${name}); if (parts.size()>=2) try{ ${name}.first = stoll(parts[0]); ${name}.second = stoll(parts[1]); } catch(...){} }
  }`;
        } else if (t === 'edgeList' || t === 'graph' || t === 'tree') {
          return `  vector<vector<int>> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isArray()) {
      for (const Variant &elem : v.asArray()) if (elem.isArray()) { auto arr = elem.asArray(); if (arr.size()>=2 && arr[0].isInt() && arr[1].isInt()) ${name}.push_back({(int)arr[0].asInt(),(int)arr[1].asInt()}); }
    } else { auto parts = splitOnDelimiters(raw_${name}); vector<int> nums; for (auto &s: parts) try { nums.push_back((int)stoll(s)); } catch(...){} for (size_t i=0;i+1<nums.size(); i+=2) ${name}.push_back({nums[i], nums[i+1]}); }
  }`;
        } else if (t === 'map' || t === 'jsonType' || t === 'object') {
          return `  map<string, Variant> ${name};
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isMap()) ${name} = v.asMap();
  }`;
        } else {
          // fallback string
          return `  string ${name} = "";
  {
    Variant v = parseJavaStrictFormat(raw_${name});
    if (v.isString()) ${name} = v.asString();
    else if (v.isInt()) ${name} = to_string(v.asInt());
    else if (v.isDouble()) ${name} = to_string(v.asDouble());
    else ${name} = raw_${name};
  }`;
        }
      })
      .join('\n\n');

    // Build final template using single-line markers
    const template = `#include <bits/stdc++.h>
using namespace std;

/* ----- Begin shared parser / Variant / serializer code ----- */
/* Variant, parse, and serialization helpers (same as earlier template)
   (Forward declarations included) */

struct Variant {
  enum T {NUL, INT, DBL, STR, ARR, MAP, BOOL} t;
  long long i; double d; string s; vector<Variant> a; map<string,Variant> m; bool b;
  Variant(): t(NUL), i(0), d(0.0), s(\"\"), a(), m(), b(false) {}
  static Variant makeInt(long long v){ Variant x; x.t=INT; x.i=v; return x; }
  static Variant makeDouble(double v){ Variant x; x.t=DBL; x.d=v; return x; }
  static Variant makeStr(const string &v){ Variant x; x.t=STR; x.s=v; return x; }
  static Variant makeArr(const vector<Variant>&v){ Variant x; x.t=ARR; x.a=v; return x; }
  static Variant makeMap(const map<string,Variant>&m_){ Variant x; x.t=MAP; x.m=m_; return x; }
  static Variant makeBool(bool vv){ Variant x; x.t=BOOL; x.b=vv; return x; }
  bool isNull() const { return t==NUL; }
  bool isInt() const { return t==INT; }
  bool isDouble() const { return t==DBL; }
  bool isString() const { return t==STR; }
  bool isArray() const { return t==ARR; }
  bool isMap() const { return t==MAP; }
  bool isBool() const { return t==BOOL; }
  long long asInt() const { return i; }
  double asDouble() const { return d; }
  string asString() const { return s; }
  const vector<Variant>& asArray() const { return a; }
  const map<string,Variant>& asMap() const { return m; }
  bool asBool() const { return b; }
};

static inline string trim(const string &s) {
  size_t a = s.find_first_not_of(\" \\t\\r\\n\");
  if (a==string::npos) return \"\";
  size_t b = s.find_last_not_of(\" \\t\\r\\n\");
  return s.substr(a, b - a + 1);
}

static vector<string> splitTopLevel(const string &input) {
  vector<string> parts; string cur; int level=0;
  for (size_t i=0;i<input.size();++i) {
    char c = input[i];
    if (c=='[' || c=='{') { level++; cur.push_back(c); }
    else if (c==']' || c=='}') { level--; cur.push_back(c); }
    else if (c==',' && level==0) { if(!cur.empty()) { parts.push_back(trim(cur)); cur.clear(); } }
    else cur.push_back(c);
  }
  if (!cur.empty()) parts.push_back(trim(cur));
  return parts;
}

static vector<string> splitOnDelimiters(const string &s) {
  vector<string> out; string cur;
  for (size_t i=0;i<s.size();++i) {
    char c = s[i];
    if (isspace((unsigned char)c) || c==',') {
      if (!cur.empty()) { out.push_back(cur); cur.clear(); }
    } else cur.push_back(c);
  }
  if (!cur.empty()) out.push_back(cur);
  return out;
}

static vector<string> splitBySemicolon(const string &s) {
  vector<string> out; string cur;
  for (size_t i=0;i<s.size();++i) {
    char c = s[i];
    if (c==';') { out.push_back(trim(cur)); cur.clear(); }
    else cur.push_back(c);
  }
  if (!cur.empty()) out.push_back(trim(cur));
  return out;
}

static string unquote(const string &s) {
  if (s.size()>=2 && ((s.front()=='\"' && s.back()=='\"') || (s.front()=='\\'' && s.back()=='\\''))) return s.substr(1,s.size()-2);
  return s;
}

static Variant parseValue(const string &raw) {
  string v = trim(raw);
  if (v.empty() || v == \"null\") return Variant();
  if (v.size()>=2 && ((v.front()=='\"' && v.back()=='\"') || (v.front()== '\\'' && v.back()== '\\''))) {
    return Variant::makeStr(unquote(v));
  }
  string low=v; transform(low.begin(), low.end(), low.begin(), ::tolower);
  if (low==\"true\") return Variant::makeBool(true);
  if (low==\"false\") return Variant::makeBool(false);
  bool isNum=true; int dots=0;
  for (char c : v) { if (!( (c>='0' && c<='9') || c=='-' || c=='+' || c=='.' || c=='e' || c=='E')) { isNum=false; break; } if (c=='.') dots++; }
  if (isNum && dots==0) { try { long long x = stoll(v); return Variant::makeInt(x); } catch(...) {} }
  if (isNum) { try { double x = stod(v); return Variant::makeDouble(x); } catch(...) {} }
  return Variant::makeStr(v);
}

// forward decl for parseMap used by parseArray
static Variant parseMap(const string &s);

static Variant parseArray(const string &s) {
  string inner = s;
  if (!inner.empty() && inner.front()=='[' && inner.back()==']') inner = inner.substr(1, inner.size()-2);
  vector<string> parts = splitTopLevel(inner);
  vector<Variant> out;
  for (auto &p : parts) {
    string t = trim(p);
    if (t.empty()) { out.push_back(Variant()); continue; }
    if (t.front()=='[') out.push_back(parseArray(t));
    else if (t.front()=='{') { Variant m = parseMap(t); out.push_back(m); }
    else out.push_back(parseValue(t));
  }
  return Variant::makeArr(out);
}

static Variant parseMap(const string &s) {
  string inner = s;
  if (!inner.empty() && inner.front()=='{' && inner.back()=='}') inner = inner.substr(1, inner.size()-2);
  vector<string> parts = splitTopLevel(inner);
  map<string,Variant> mp;
  for (auto &p : parts) {
    size_t col = p.find(':');
    if (col==string::npos) continue;
    string key = trim(p.substr(0,col));
    string val = trim(p.substr(col+1));
    string k = unquote(key);
    if (!val.empty() && val.front()=='[') mp[k] = parseArray(val);
    else if (!val.empty() && val.front()=='{') mp[k] = parseMap(val);
    else mp[k] = parseValue(val);
  }
  return Variant::makeMap(mp);
}

static Variant parseJavaStrictFormat(const string &inputRaw) {
  string s = trim(inputRaw);
  if (s.empty()) return Variant();
  if (s.front()=='[' && s.back()==']') return parseArray(s);
  if (s.front()=='{' && s.back()=='}') return parseMap(s);
  vector<string> parts = splitOnDelimiters(s);
  if (parts.size() > 1) {
    vector<Variant> arr;
    for (auto &t : parts) arr.push_back(parseValue(t));
    return Variant::makeArr(arr);
  }
  return parseValue(s);
}

static string formatVariant(const Variant &v);
static string formatStringForOutput(const string &s) {
  if ((int)s.size() == 1) return s;
  return string(\"\\\"\") + s + string(\"\\\"\");
}
static string formatArrayNoSpaces(const Variant &v) {
  if (v.isArray()) {
    string out = \"[\";
    const auto &arr = v.asArray();
    for (size_t i=0;i<arr.size();++i) { if (i) out += \",\"; out += formatVariant(arr[i]); }
    out += \"]\"; return out;
  } else if (v.isMap()) {
    string out = \"{\"; const auto &mp = v.asMap(); size_t cnt=0;
    for (const auto &kv : mp) { if (cnt++) out += \",\"; out += '\"' + kv.first + '\"' + \":\" + formatVariant(kv.second); }
    out += \"}\"; return out;
  } else return formatVariant(v);
}
static string formatVariant(const Variant &v) {
  if (v.isNull()) return string(\"null\");
  if (v.isInt()) return to_string(v.asInt());
  if (v.isDouble()) { ostringstream oss; oss<<v.asDouble(); return oss.str(); }
  if (v.isBool()) return v.asBool() ? string(\"true\") : string(\"false\");
  if (v.isString()) return formatStringForOutput(v.asString());
  if (v.isArray() || v.isMap()) return formatArrayNoSpaces(v);
  return string(\"null\");
}
static vector<string> readAllStdinLines() { vector<string> lines; string line; while (getline(cin, line)) lines.push_back(trim(line)); return lines; }
static vector<string> tokenizeAll(const vector<string>& lines) { vector<string> out; for (auto &ln : lines) { auto parts = splitOnDelimiters(ln); for (auto &p : parts) if (!p.empty()) out.push_back(p); } return out; }

/* ----- End shared code ----- */

/* ===== USER FUNCTION: ONLY EDIT THE BODY BETWEEN THE MARKERS =====
   The frontend should extract the section between
   "// USER CODE START" and "// USER CODE END" and present
   it to the user in the editor. When the user submits their code,
   inject their body back into the full template before sending to judge.
*/

${funcSignature} {
  // USER CODE START
  // Implement function logic here.
  // The user should only edit code inside this block.
  //
  // Example:
  //   long long sum = 0;
  //   for (int i = 1; i <= n; ++i) sum += i;
  //   return sum;
  //
  // USER CODE END
}

/* ===== End user-editable function ===== */

/* ---------- main: parse inputs, call user function and print ---------- */
int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  vector<string> allLines = readAllStdinLines();
  vector<string> tokens = tokenizeAll(allLines);
  int lineIndex = 0, tokenPos = 0;

${inputReaders}

// conversions
${conversionLines}

// call function and print result
${
  returnTypeMapped === 'void'
    ? `${functionName}(${parameters.map((p) => p.parameterName).join(', ')});`
    : `auto result = ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});\n  // print result for common return types\n  ${
        returnTypeMapped === 'std::string' || returnTypeMapped === 'string'
          ? `cout << result;`
          : returnTypeMapped === 'long long' ||
              returnTypeMapped === 'int' ||
              returnTypeMapped === 'double' ||
              returnTypeMapped === 'float'
            ? `cout << result;`
            : `// Fallback: attempt to print with serializer if user returns Variant\n  cout << result;`
      }`
}

  return 0;
}
`;

    // Inject the computed pieces into the template string
    const finalSource = template
      .replace('${funcSignature}', funcSignature)
      .replace('${inputReaders}', inputReaders)
      .replace('${conversionLines}', conversionLines)
      .replace(
        /\$\{parameters\.map\(p=>p\.parameterName\)\.join\(', '\)\}/g,
        parameters.map((p) => p.parameterName).join(', '),
      )
      .replace(/\$\{functionName\}/g, functionName)
      .replace(/\$\{returnTypeMapped\}/g, returnTypeMapped)
      .replace(
        /\$\{parameters\.map\(p=>p\.parameterName\)\.join\(', '\)\}/g,
        parameters.map((p) => p.parameterName).join(', '),
      );

    return [null, finalSource];
  } catch (error) {
    console.error('generateCppTemplate error:', error);
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

export const permissions = {
  CREATE: 'create',
  READ: 'view',
  EDIT: 'edit',
  DELETE: 'delete',
};
