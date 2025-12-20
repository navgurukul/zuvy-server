import { CPP_RUNTIME } from './cppRuntime';
import { CppInputMode } from './cppInputModes';

export async function generateCppTemplate(
  functionName: string,
  parameters: Array<{ parameterName: string; parameterType: string }>,
  returnType = 'void',
  options?: {
    inputMode?: CppInputMode;
    multipleTests?: boolean;
    interactive?: boolean;
  },
) {
  try {
    const inputMode: CppInputMode =
      options?.inputMode ||
      (parameters.some((p) =>
        [
          'map',
          'object',
          'jsonType',
          'arrayOfObj',
          'arrayOfnum',
          'arrayOfStr',
          'arrayOfarrayOfnum',
          'arrayOfarrayOfStr',
          'linkedList',
          'binaryTree',
          'mapStrInt',
          'mapIntInt',
          'graph',
          'weightedGraph',
        ].includes(p.parameterType),
      )
        ? 'HYBRID'
        : 'SIMPLE');

    const multipleTests = options?.multipleTests ?? false;
    const interactive = options?.interactive ?? false;

    /* runtime inclusion rule */
    const needsRuntime =
      inputMode === 'HYBRID' ||
      returnType === 'jsonType' ||
      parameters.some((p) =>
        ['jsonType', 'object', 'map', 'arrayOfObj'].includes(p.parameterType),
      );

    /* ---------- type mapping ---------- */
    const cppType = (t: string) => {
      switch (t) {
        case 'int':
          return 'long long';
        case 'float':
        case 'double':
          return 'double';
        case 'bool':
          return 'bool';
        case 'char':
          return 'char';
        case 'str':
          return 'string';
        case 'arrayOfnum':
          return 'vector<double>';
        case 'arrayOfStr':
          return 'vector<string>';
        case 'arrayOfarrayOfnum':
          return 'vector<vector<double>>';
        case 'arrayOfarrayOfStr':
          return 'vector<vector<string>>';
        case 'linkedList':
          return 'ListNode*';
        case 'binaryTree':
          return 'TreeNode*';
        case 'mapStrInt':
          return 'map<string, long long>';
        case 'mapIntInt':
          return 'unordered_map<long long, long long>';
        case 'graph':
          return 'vector<vector<int>>';
        case 'weightedGraph':
          return 'vector<vector<pair<int,int>>>';
        case 'jsonType':
          return 'Variant';
        default:
          return 'string';
      }
    };

    const paramList = parameters
      .map((p) => `const ${cppType(p.parameterType)}& ${p.parameterName}`)
      .join(', ');

    const returnCppType = returnType === 'void' ? 'void' : cppType(returnType);

    /* ---------- SIMPLE input ---------- */
    const simpleInput = parameters
      .map((p, index) => {
        // STRING WITH SPACES
        if (p.parameterType === 'str') {
          return `
  string ${p.parameterName};
  ${index === 0 ? '' : "cin.ignore(numeric_limits<streamsize>::max(), '\\n');"}
  getline(cin, ${p.parameterName});
`;
        }

        if (p.parameterType === 'arrayOfnum') {
          return `
  int ${p.parameterName}_n;
  cin >> ${p.parameterName}_n;
  vector<double> ${p.parameterName}(${p.parameterName}_n);
  for (int i = 0; i < ${p.parameterName}_n; ++i) cin >> ${p.parameterName}[i];
`;
        }

        if (p.parameterType === 'arrayOfStr') {
          return `
  int ${p.parameterName}_n;
  cin >> ${p.parameterName}_n;
  vector<string> ${p.parameterName}(${p.parameterName}_n);
  for (int i = 0; i < ${p.parameterName}_n; ++i) cin >> ${p.parameterName}[i];
`;
        }

        if (p.parameterType === 'bool') {
          return `
  string ${p.parameterName}_str;
  cin >> ${p.parameterName}_str;
  bool ${p.parameterName} =
    (${p.parameterName}_str == "true" || ${p.parameterName}_str == "1");
`;
        }

        // OTHER TYPES
        return `
  ${cppType(p.parameterType)} ${p.parameterName};
  cin >> ${p.parameterName};
`;
      })
      .join('\n');

    /* ---------- HYBRID input ---------- */
    const hybridInput = `
  vector<string> lines;
  string line;
  while (getline(cin, line)) lines.push_back(line);
  int idx = 0;
${parameters
  .map(
    (p) => `
  Variant v_${p.parameterName} =
    parseJavaStrictFormat(idx < (int)lines.size() ? lines[idx++] : "");
`,
  )
  .join('')}
`;

    /* ---------- HYBRID conversions ---------- */
    const hybridConversions = parameters
      .map((p) => {
        const name = p.parameterName;

        switch (p.parameterType) {
          case 'int':
            return `
  long long ${name} = 0;
  if (v_${name}.t == Variant::INT)
    ${name} = v_${name}.i;
`;

          case 'bool':
            return `
  bool ${name} = false;
  if (v_${name}.t == Variant::BOOL)
    ${name} = v_${name}.b;
`;

          case 'str':
            return `
  string ${name};
  if (v_${name}.t == Variant::STR)
    ${name} = v_${name}.s;
`;

          case 'arrayOfnum':
            return `
  vector<double> ${name};
  if (v_${name}.t == Variant::ARR) {
    for (auto &el : v_${name}.a) {
      if (el.t == Variant::INT) {
        ${name}.push_back((double)el.i);
      } else if (el.t == Variant::DBL) {
        ${name}.push_back(el.d);
      } else {
        cerr << "Type error: expected numeric value in array '${name}'" << endl;
        return 0;
      }
    }
  }
`;

          case 'arrayOfStr':
            return `
  vector<string> ${name};
  if (v_${name}.t == Variant::ARR) {
    for (auto &el : v_${name}.a) {
      if (el.t != Variant::STR) {
        cerr << "Type error: expected STR in array '${name}'" << endl;
        return 0;
      }
      ${name}.push_back(el.s);
    }
  }
`;

          case 'arrayOfarrayOfnum':
            return `
  vector<vector<double>> ${name};
  if (v_${name}.t == Variant::ARR) {
    for (auto &row : v_${name}.a) {
      if (row.t != Variant::ARR) {
        cerr << "Type error: expected array in '${name}'" << endl;
        return 0;
      }
      vector<double> temp;
      for (auto &el : row.a) {
        if (el.t == Variant::INT) {
          temp.push_back((double)el.i);
        } else if (el.t == Variant::DBL) {
          temp.push_back(el.d);
        } else {
          cerr << "Type error: expected numeric value in nested array '${name}'" << endl;
          return 0;
        }
      }
      ${name}.push_back(temp);
    }
  }
`;

          case 'arrayOfarrayOfStr':
            return `
  vector<vector<string>> ${name};
  if (v_${name}.t == Variant::ARR) {
    for (auto &row : v_${name}.a) {
      if (row.t != Variant::ARR) {
        cerr << "Type error: expected array in '${name}'" << endl;
        return 0;
      }
      vector<string> temp;
      for (auto &el : row.a) {
        if (el.t != Variant::STR) {
          cerr << "Type error: expected STR in nested array '${name}'" << endl;
          return 0;
        }
        temp.push_back(el.s);
      }
      ${name}.push_back(temp);
    }
  }
`;

          case 'linkedList':
            return `
  ListNode* ${name} = buildLinkedList(v_${name});
`;

          case 'binaryTree':
            return `
  TreeNode* ${name} = buildBinaryTree(v_${name});
`;

          case 'mapStrInt':
            return `
  map<string, long long> ${name} = buildMapStrInt(v_${name});
`;

          case 'mapIntInt':
            return `
  unordered_map<long long, long long> ${name} = buildMapIntInt(v_${name});
`;

          case 'graph':
            return `
  vector<vector<int>> ${name} = buildGraph(v_${name});
`;

          case 'weightedGraph':
            return `
  vector<vector<pair<int,int>>> ${name} = buildWeightedGraph(v_${name});
`;

          case 'jsonType':
            return `
  Variant ${name} = v_${name};
`;

          default:
            return `
  // Unsupported type: ${p.parameterType}
`;
        }
      })
      .join('\n');

    /* ---------- OUTPUT handling ---------- */
    const outputHandling = (() => {
      if (returnType === 'bool') {
        return `cout << (result ? "true" : "false");`;
      }
      if (returnType === 'float' || returnType === 'double') {
        return `
        std::ostringstream oss;
        oss << std::setprecision(15) << result;
        std::string out = oss.str();

        // trim trailing zeros
        if (out.find('.') != std::string::npos) {
        while (!out.empty() && out.back() == '0') out.pop_back();
        if (!out.empty() && out.back() == '.') out.push_back('0');
        }

        cout << out;
        `;
      }

      if (returnType === 'arrayOfnum' || returnType === 'arrayOfStr') {
        return `printVector(result);`;
      }

      if (returnType === 'jsonType') {
        return `printVariant(result);`;
      }
      return `cout << result;`;
    })();

    /* ---------- main body ---------- */
    const mainBody = interactive
      ? `
  // INTERACTIVE MODE
  ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});
`
      : `
${inputMode === 'HYBRID' ? hybridInput : simpleInput}

${inputMode === 'HYBRID' ? hybridConversions : ''}

  auto result = ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});
  ${outputHandling}
`;

    /* ---------- final template ---------- */
    const template = `
#include <bits/stdc++.h>
using namespace std;

/* ============================================================
 *  SCROLL DOWN TO FIND THE USER FUNCTION 
 *
 *  You only need to write code inside the function marked as:
 *      // ==================== USER CODE START ====================
 *
 *  Do NOT modify any other part of this file.
 *
 * ============================================================ */


#ifndef ONLINE_JUDGE
#define DEBUG
#endif

#ifdef DEBUG
#define dbg(x) cerr << #x << " = " << x << endl
#else
#define dbg(x)
#endif

template <typename T>
void printVector(const vector<T>& v) {
  cout << "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i) cout << ",";
    cout << v[i];
  }
  cout << "]";
}

// ===== Float vector printer (DO NOT REMOVE) =====
template <>
void printVector<double>(const vector<double>& v) {
  cout << "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i) cout << ",";

    std::ostringstream oss;
    oss << std::setprecision(15) << v[i];
    string out = oss.str();

    // trim trailing zeros
    if (out.find('.') != string::npos) {
      while (!out.empty() && out.back() == '0') out.pop_back();
      if (!out.empty() && out.back() == '.') out.push_back('0');
    }

    cout << out;
  }
  cout << "]";
}


${needsRuntime ? CPP_RUNTIME : ''}

/* =====================================================================
 *   WRITE YOUR SOLUTION INSIDE THE FUNCTION BODY BELOW 
 *
 *  DO NOT change the function name or parameters
 *  DO NOT write code outside this function
 *  ONLY replace the code between USER CODE START and USER CODE END
 *
 * ===================================================================== */
${returnCppType} ${functionName}(${paramList}) {

  // ==================== USER CODE START ====================
  // Write your solution logic here
  
  ${returnType === 'void' ? '' : 'return {};'}
  
  // ===================== USER CODE END =====================
}
/* ================= END OF USER FUNCTION =================== */


int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  ${multipleTests ? 'int T; cin >> T; while (T--) {' : ''}
  ${mainBody}
  ${multipleTests ? '}' : ''}

  return 0;
}
`;

    return [null, template];
  } catch (e) {
    return [e, null];
  }
}
