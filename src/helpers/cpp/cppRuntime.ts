export const CPP_RUNTIME = `
/* ----- Begin shared runtime (DO NOT EDIT) ----- */
#include <bits/stdc++.h>
using namespace std;

static inline string trim(const string &s) {
  size_t a = s.find_first_not_of(" \\t\\r\\n");
  if (a == string::npos) return "";
  size_t b = s.find_last_not_of(" \\t\\r\\n");
  return s.substr(a, b - a + 1);
}

static vector<string> splitTopLevel(const string &input) {
  vector<string> parts;
  string cur;
  int level = 0;
  for (char c : input) {
    if (c == '[' || c == '{') level++;
    if (c == ']' || c == '}') level--;
    if (c == ',' && level == 0) {
      parts.push_back(trim(cur));
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  if (!cur.empty()) parts.push_back(trim(cur));
  return parts;
}

struct Variant {
  enum T {NUL, INT, DBL, STR, ARR, MAP, BOOL} t;
  long long i; double d; bool b;
  string s;
  vector<Variant> a;
  map<string,Variant> m;
  Variant():t(NUL),i(0),d(0),b(false){}
};


static Variant parseJavaStrictFormat(const string &raw) {
  string x = trim(raw);
  if (x.empty() || x == "null") return Variant();

  if (x == "true" || x == "false") {
    Variant v; v.t = Variant::BOOL; v.b = (x == "true"); return v;
  }

  // Array
  if (x.front() == '[' && x.back() == ']') {
    Variant v; v.t = Variant::ARR;
    string inner = x.substr(1, x.size() - 2);
    for (auto &p : splitTopLevel(inner)) {
      v.a.push_back(parseJavaStrictFormat(p));
    }
    return v;
  }

  // Integer
  bool isNum = true;
  for (char c : x) if (!isdigit(c) && c != '-') isNum = false;
  if (isNum) {
    Variant v; v.t = Variant::INT; v.i = stoll(x); return v;
  }

  // String
  Variant v; v.t = Variant::STR; v.s = x;
  return v;
}

static void printVariant(const Variant &v) {
  if (v.t == Variant::NUL) cout << "null";
  else if (v.t == Variant::INT) cout << v.i;
  else if (v.t == Variant::BOOL) cout << (v.b ? "true" : "false");
  else if (v.t == Variant::STR) cout << v.s;
  else if (v.t == Variant::ARR) {
    cout << "[";
    for (size_t i = 0; i < v.a.size(); ++i) {
      if (i) cout << ",";
      printVariant(v.a[i]);
    }
    cout << "]";
  }
}

/* ----- End shared runtime ----- */
`;
