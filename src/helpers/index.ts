export const complairDateTyeps = [
  'int',
  'float',
  'double',
  'str',
  'bool',
  'arrayOfnum',
  'arrayOfStr',
  'object',
  "jsonType"
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
    jsonType: 'Object', // Generic type for JSON-like structures
    object: 'Object',
    void: 'void',
    input: (parameterType) => {
      
      const mapping = {
        int: 'Integer.parseInt(scanner.nextLine().trim())',
        float: 'Float.parseFloat(scanner.nextLine().trim())',
        double: 'Double.parseDouble(scanner.nextLine().trim())',
        str: 'scanner.nextLine().trim()',
        bool: 'Boolean.parseBoolean(scanner.nextLine().trim())',
        arrayOfnum: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        arrayOfStr: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        object: 'parseJavaStrictFormat(scanner.nextLine().trim())',
        jsonType: 'parseJavaStrictFormat(scanner.nextLine().trim())', // Handle JSON-like input
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
      jsonType: 'null', // Default for JSON-like structures
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
    jsonType: 'std::string',
    object: 'std::string',
    returnType: 'void',
    input: (parameterType, paramName) => {
      const mapping = {
        int: `[]() { return std::stoi(input${paramName}); }()`,
        float: `[]() { return std::stof(input${paramName}); }()`,
        double: `[]() { return std::stod(input${paramName}); }()`,
        str: `input${paramName}`,
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
        object: `input${paramName}`
      };
      return mapping[parameterType] || `input${paramName}`;
    },
    defaultReturnValue: {
      int: '0',
      float: '0.0f',
      double: '0.0',
      str: '""',
      bool: 'false',
      arrayOfnum: '{}',
      arrayOfStr: '{}',
      jsonType: '""',
      object: '""',
      void: ''
    }
  }
};




export async function generateTemplates(functionName, parameters, returnType) {
  try {
    functionName = functionName.replace(/ /g, '_').toLowerCase();
/**
 * Generate JavaScript function template
 */
const generateJavaScriptTemplate = (functionName, parameters, returnType) => {
  // Map parameter names
  const parameterMappings = parameters.map(p => p.parameterName).join(', ');

  // Helper function for consistent output formatting
  const formatOutput = `
// Helper function to format output consistently
function formatOutput(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj.toString().toLowerCase();
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => formatOutput(item)).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return '{' + entries.map(function(entry) {
      return '"' + entry[0] + '":' + formatOutput(entry[1]);
    }).join(',') + '}';
  }
  if (typeof obj === 'string') return '"' + obj + '"';
  return obj.toString();
}`;

  return [null, `
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

${formatOutput}

// Function definition
// Note: The console.log statement at the end is required for the code to work.
// Do not remove it as it's used to output the result to the system.
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
      (p, index) => {
        if (p.parameterType === 'bool') {
          return `const _${p.parameterName}_ = ${typeMappings.javascript.input(p.parameterType).replace('input', `inputLines[${index}]`).toLowerCase()} === 'true';`;
        }
        return `const _${p.parameterName}_ = ${typeMappings.javascript.input(p.parameterType).replace('input', `inputLines[${index}]`)};`;
      }
  ).join('\n  ')}
  const result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')});
  console.log(formatOutput(result));
  });
  `];
};
    let [errorCtemplate, cTemplate] = await generateCTemplates(functionName, parameters, returnType);
    if (errorCtemplate) {
      return [errorCtemplate, null];
    }
    let [errorCppTemplate, cppTemplate] = await generateCppTemplate(functionName, parameters, returnType);
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

    const parameterList = parameters
      .map(p => `${typeMappings.java[p.parameterType] || 'Object'} ${p.parameterName}`)
      .join(', ');

    const inputHandling = parameters
      .map(p => {
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
        } else if (javaType === 'Object') { // Handle jsonType
          return `
        Object ${p.parameterName} = parseJavaStrictFormat(scanner.nextLine().trim());`;
        } else if (javaType === 'boolean') {
          return `
        boolean ${p.parameterName} = Boolean.parseBoolean(scanner.nextLine().trim().toLowerCase());`;
        } else {
          return `${javaType} ${p.parameterName} = ${typeMappings.java.input(p.parameterType)};`;
        }
      })
      .join('\n');

    // Consistent output formatting with no spaces
    const returnLogs = 'System.out.println(formatArrayNoSpaces(returnData));';

    // Construct the Java template as a string
    const template = `
import java.util.Scanner;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

// Note: The System.out.println statement at the end is required for the code to work.
// Do not remove it as it's used to output the result to the system.
public class Main {
  // Function with specified return type and parameters
  public static ${returnTypeMapped} ${functionName}(${parameterList}) {
      // Write your code here
      return ${defaultReturn};
  }

  public static void main(String[] args) {
      Scanner scanner = new Scanner(System.in);

      // Input parsing
      ${inputHandling}

      // Call function correctly
      ${returnTypeMapped} returnData = ${functionName}(${parameters.map(p => p.parameterName).join(', ')});

      // Result formatting with no spaces between array elements
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
    } else if (data instanceof String[]) {
      String[] arr = (String[]) data;
      StringBuilder sb = new StringBuilder();
      sb.append("[");
      for (int i = 0; i < arr.length; i++) {
          sb.append("\\"").append(arr[i]).append("\\"");
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
    } else if (data instanceof Boolean) {
      return ((Boolean) data).toString().toLowerCase();
    }
    return String.valueOf(data);
  }

  // Updated parser with colon handling and support for simple arrays
  public static Object parseJavaStrictFormat(String input) {
    input = input.trim();
    if (input.startsWith("[") && input.endsWith("]")) {
      String content = input.substring(1, input.length() - 1).trim();
      if (content.isEmpty()) return new Object[0];
      if (!content.startsWith("{")) { // Handle simple arrays
        String[] parts = splitTopLevel(content);
        Object[] result = new Object[parts.length];
        for (int i = 0; i < parts.length; i++) {
          result[i] = parseValue(parts[i].trim());
        }
        return result;
      } else { // Handle array of maps
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
    if ((value.startsWith("\\"") && value.endsWith("\\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.substring(1, value.length() - 1);
    } else if (value.equalsIgnoreCase("true")) {
      return true;
    } else if (value.equalsIgnoreCase("false")) {
      return false;
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
    console.error("Error generating Java template:", error);
    return [error];
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
        } else if (p.parameterType === 'bool') {
          return `
    char bool_str[10];
    scanf("%s", bool_str);
    // Convert to lowercase for consistent boolean handling
    for(int i = 0; bool_str[i]; i++) {
        bool_str[i] = tolower(bool_str[i]);
    }
    int ${p.parameterName} = (strcmp(bool_str, "true") == 0);`;
        } else {
          return `
    ${typeMappings['c'][p.parameterType]} ${p.parameterName};
    scanf("%d", &${p.parameterName});`;
        }
      })
      .join('\n');

    // Helper function for consistent output formatting
    const formatOutput = `
// Helper function to format output consistently
void formatOutput(const void* data, int type) {
    if (type == 0) { // int
        printf("%d", *(const int*)data);
    } else if (type == 1) { // float
        printf("%f", *(const float*)data);
    } else if (type == 2) { // char* (string)
        printf("%s", (const char*)data);
    } else if (type == 3) { // bool
        printf("%s", *(const int*)data ? "true" : "false");
    } else if (type == 4) { // int array
        const int* arr = (const int*)data;
        int size = arr[0]; // First element is size
        printf("[");
        for (int i = 1; i <= size; i++) {
            printf("%d", arr[i]);
            if (i < size) printf(",");
        }
        printf("]");
    } else if (type == 5) { // char* array (string array)
        const char** arr = (const char**)data;
        int size = (int)(size_t)arr[0]; // First element is size
        printf("[");
        for (int i = 1; i <= size; i++) {
            printf("\\"%s\\"", arr[i]);
            if (i < size) printf(",");
        }
        printf("]");
    }
}`;

    // Generate the C template
    const cTemplate = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

${formatOutput}

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
    // Note: The printf statement at the end is required for the code to work.
    // Do not remove it as it's used to output the result to the system.
    ${returnType === 'int' ? 'printf("%d", result);' : 
      returnType === 'float' ? 'printf("%f", result);' : 
      returnType === 'str' ? 'printf("%s", result);' : 
      returnType === 'bool' ? 'printf("%s", result ? "true" : "false");' : 
      returnType === 'arrayOfnum' ? 'printf("[%d", result[1]); for(int i = 2; i <= result[0]; i++) printf(",%d", result[i]); printf("]");' : 
      returnType === 'arrayOfStr' ? 'printf("[\\"%s\\"", (const char**)result[1]); for(int i = 2; i <= (int)(size_t)result[0]; i++) printf(",\\"%s\\"", (const char**)result[i]); printf("]");' : 
      'printf("%s", result);'}

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
    const parameterMappings = parameters
        .map(p => {
            const type = typeMappings.python[p.parameterType] || 'Any';
            return `${p.parameterName}: ${type}`;
        })
        .join(', ');

    const inputHandling = parameters
        .map(p => {
            const inputLogic = typeMappings.python.input(p.parameterType);
            // Handle boolean input consistently
            if (p.parameterType === 'bool') {
                return `_${p.parameterName}_ = str(${inputLogic}).lower() == 'true'`;
            }
            return `_${p.parameterName}_ = ${inputLogic}`;
        })
        .join('\n');

    // Helper function for consistent output formatting
    const formatOutput = `
def format_output(obj):
    if isinstance(obj, bool):
        return str(obj).lower()
    if isinstance(obj, (list, tuple)):
        return '[' + ','.join(format_output(item) for item in obj) + ']'
    if isinstance(obj, dict):
        return '{' + ','.join(f'"{k}":{format_output(v)}' for k, v in obj.items()) + '}'
    return str(obj)`;

    return [null, `
import sys
import json
from typing import List, Dict, Any

${formatOutput}

# Note: The print statement at the end is required for the code to work.
# Do not remove it as it's used to output the result to the system.
def ${functionName}(${parameterMappings}) -> ${typeMappings.python[returnType]}:
    # Add your code here
    return

# Example usage
${inputHandling}
result = ${functionName}(${parameters.map(p => `_${p.parameterName}_`).join(', ')})
${ !["arrayOfnum","arrayOfStr", "jsonType","object"].includes(returnType)? 'print(format_output(result))' : 'print(format_output(result))'}`];
  } catch (error) {
    console.error('Error generating template:', error);
    return [error, null];
  }
}

// generate c++ template for the given function name and parameters
async function generateCppTemplate(functionName, parameters, returnType = 'void') {
  try {
    const returnTypeMapped = typeMappings.cpp[returnType] || 'void';
    const defaultReturn = typeMappings.cpp.defaultReturnValue[returnType] || '';

    const parameterList = parameters.map(p => 
      `${typeMappings.cpp[p.parameterType]} ${p.parameterName}`
    ).join(', ');

    const inputHandling = parameters.map(p => {
      const inputVar = `input${p.parameterName}`;
      if (p.parameterType === 'bool') {
        return `
    std::string ${inputVar};
    std::getline(std::cin, ${inputVar});
    // Convert to lowercase for consistent boolean handling
    std::transform(${inputVar}.begin(), ${inputVar}.end(), ${inputVar}.begin(), ::tolower);
    ${typeMappings.cpp[p.parameterType]} ${p.parameterName} = ${inputVar} == "true";`;
      } else {
        return `
    std::string ${inputVar};
    std::getline(std::cin, ${inputVar});
    ${typeMappings.cpp[p.parameterType]} ${p.parameterName} = ${typeMappings.cpp.input(p.parameterType, p.parameterName)};`;
      }
    }).join('\n');

    // Helper function for consistent output formatting
    const formatOutput = `
// Helper function to format output consistently
std::string formatOutput(const auto& obj) {
    if constexpr (std::is_same_v<decltype(obj), bool>) {
        return obj ? "true" : "false";
    }
    else if constexpr (std::is_same_v<decltype(obj), std::vector<int>>) {
        std::string result = "[";
        for (size_t i = 0; i < obj.size(); ++i) {
            result += std::to_string(obj[i]);
            if (i < obj.size() - 1) result += ",";
        }
        result += "]";
        return result;
    }
    else if constexpr (std::is_same_v<decltype(obj), std::vector<std::string>>) {
        std::string result = "[";
        for (size_t i = 0; i < obj.size(); ++i) {
            result += "\\"" + obj[i] + "\\"";
            if (i < obj.size() - 1) result += ",";
        }
        result += "]";
        return result;
    }
    else if constexpr (std::is_same_v<decltype(obj), std::string>) {
        return obj;
    }
    else {
        return std::to_string(obj);
    }
}`;

    const template = `#include <iostream>
#include <vector>
#include <sstream>
#include <string>
#include <algorithm>
#include <type_traits>

${formatOutput}

${returnTypeMapped} ${functionName}(${parameterList}) {
    // Add your logic here
    return ${defaultReturn};
}

int main() {
${inputHandling}

    auto result = ${functionName}(${parameters.map(p => p.parameterName).join(', ')});
    
    // Note: The cout statement at the end is required for the code to work.
    // Do not remove it as it's used to output the result to the system.
    std::cout << formatOutput(result);
    
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