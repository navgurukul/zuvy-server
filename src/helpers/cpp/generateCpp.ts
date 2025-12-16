import { CPP_RUNTIME } from './cppRuntime';
import { cppEscape } from './cppUtils';
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
        ['map', 'object', 'jsonType', 'arrayOfObj'].includes(p.parameterType),
      )
        ? 'HYBRID'
        : 'SIMPLE');

    const multipleTests = options?.multipleTests ?? false;
    const interactive = options?.interactive ?? false;

    /* ---------- function signature ---------- */
    const cppType = (t: string) => {
      switch (t) {
        case 'int':
          return 'long long';
        case 'double':
          return 'double';
        case 'bool':
          return 'bool';
        case 'char':
          return 'char';
        case 'str':
          return 'string';
        case 'arrayOfnum':
          return 'vector<long long>';
        case 'arrayOfStr':
          return 'vector<string>';
        default:
          return 'string';
      }
    };

    const paramList = parameters
      .map((p) => `const ${cppType(p.parameterType)}& ${p.parameterName}`)
      .join(', ');

    const returnCppType = returnType === 'void' ? 'void' : cppType(returnType);

    /* ---------- input handling ---------- */
    const simpleInput = parameters
      .map((p) => {
        if (p.parameterType.startsWith('array')) {
          return `
  int ${p.parameterName}_n;
  cin >> ${p.parameterName}_n;
  vector<long long> ${p.parameterName}(${p.parameterName}_n);
  for (int i = 0; i < ${p.parameterName}_n; ++i) cin >> ${p.parameterName}[i];
`;
        }
        return `  ${cppType(p.parameterType)} ${p.parameterName}; cin >> ${p.parameterName};`;
      })
      .join('\n');

    const hybridInput = `
  vector<string> lines;
  string line;
  while (getline(cin, line)) lines.push_back(line);

  int idx = 0;
${parameters
  .map(
    (p) => `
  Variant v_${p.parameterName} = parseJavaStrictFormat(idx < (int)lines.size() ? lines[idx++] : "");
`,
  )
  .join('')}
`;

    /* ---------- main body ---------- */
    const mainBody = interactive
      ? `
  // INTERACTIVE MODE
  ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});
`
      : `
${inputMode === 'HYBRID' ? hybridInput : simpleInput}

  auto result = ${functionName}(${parameters.map((p) => p.parameterName).join(', ')});
  cout << result;
`;

    /* ---------- final template ---------- */
    const template = `
#include <bits/stdc++.h>
using namespace std;

#ifndef ONLINE_JUDGE
#define DEBUG
#endif

#ifdef DEBUG
#define dbg(x) cerr << #x << " = " << x << endl
#else
#define dbg(x)
#endif

${inputMode === 'HYBRID' ? CPP_RUNTIME : ''}

/* ===== USER FUNCTION (EDIT ONLY BODY) ===== */
${returnCppType} ${functionName}(${paramList}) {
  // USER CODE START
  // Write logic here
  ${returnType === 'void' ? '' : 'return {};'}
  // USER CODE END
}
/* ===== END USER FUNCTION ===== */

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
