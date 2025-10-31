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
              // Use (char)34 to append a double-quote character to avoid escaping issues
              sb.append((char)34).append(arr[i]).append((char)34);
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
          // Use (char)34 for quoting keys to avoid escape-mangling in the template string
          sb.append((char)34).append(entry.getKey()).append((char)34).append(":");
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
    
    if ((value.startsWith("\\"") && value.endsWith("\\")) ||
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
async function generateCppTemplate(
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
