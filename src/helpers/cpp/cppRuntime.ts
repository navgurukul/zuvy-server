export const CPP_RUNTIME = String.raw`
/* ----- Begin shared runtime (DO NOT EDIT) ----- */

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

static Variant parseJavaStrictFormat(const string &raw);

static Variant parseObject(const string& input) {
  Variant v;
  v.t = Variant::MAP;

  string inner = trim(input.substr(1, input.size() - 2));
  if (inner.empty()) return v;

  for (auto& part : splitTopLevel(inner)) {
    size_t colon = part.find(':');
    if (colon == string::npos) continue;

    string key = trim(part.substr(0, colon));
    string val = trim(part.substr(colon + 1));

    // remove quotes from key
    if (!key.empty() && key.front() == '"' && key.back() == '"') {
      key = key.substr(1, key.size() - 2);
    }

    // ATOMIC insertion
    v.m[key] = parseJavaStrictFormat(val);
  }

  return v;
}

static Variant parseJavaStrictFormat(const string &raw) {
  string x = trim(raw);
  if (x.empty() || x == "null") return Variant();

  if (x == "true" || x == "false") {
    Variant v; v.t = Variant::BOOL; v.b = (x == "true"); return v;
  }

  // Object
  if (x.front() == '{' && x.back() == '}') {
    return parseObject(x);
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
  if (v.t == Variant::NUL) {
    cout << "null";
  }
  else if (v.t == Variant::INT) {
    cout << v.i;
  }
  else if (v.t == Variant::BOOL) {
    cout << (v.b ? "true" : "false");
  }
  else if (v.t == Variant::STR) {
    cout << v.s;
  }
  else if (v.t == Variant::ARR) {
    cout << "[";
    for (size_t i = 0; i < v.a.size(); ++i) {
      if (i) cout << ",";
      printVariant(v.a[i]);
    }
    cout << "]";
  }
  else if (v.t == Variant::MAP) {
    cout << "{";
    bool first = true;
    for (const auto &kv : v.m) {
      if (!first) cout << ",";
      first = false;
      cout << "\"" << kv.first << "\":";
      printVariant(kv.second);
    }
    cout << "}";
  }
}


/* ===== Linked List ===== */
struct ListNode {
  int val;
  ListNode* next;
  ListNode(int x) : val(x), next(nullptr) {}
};

static ListNode* buildLinkedList(const Variant& v) {
  if (v.t != Variant::ARR) return nullptr;
  ListNode dummy(0);
  ListNode* cur = &dummy;
  for (auto &el : v.a) {
    if (el.t != Variant::INT) return nullptr;
    cur->next = new ListNode(el.i);
    cur = cur->next;
  }
  return dummy.next;
}

/* ===== Binary Tree ===== */
struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

static TreeNode* buildBinaryTree(const Variant& v) {
  if (v.t != Variant::ARR || v.a.empty()) return nullptr;

  vector<TreeNode*> nodes;
  for (auto &el : v.a) {
    if (el.t == Variant::INT) {
      nodes.push_back(new TreeNode(el.i));
    } else {
      nodes.push_back(nullptr);
    }
  }

  int pos = 1;
  for (int i = 0; i < (int)nodes.size(); i++) {
    if (!nodes[i]) continue;
    if (pos < (int)nodes.size()) nodes[i]->left = nodes[pos++];
    if (pos < (int)nodes.size()) nodes[i]->right = nodes[pos++];
  }

  return nodes[0];
}

/* ===== Map Builders ===== */

static map<string, long long> buildMapStrInt(const Variant& v) {
  map<string, long long> res;
  if (v.t != Variant::MAP) return res;
  for (auto &kv : v.m) {
    if (kv.second.t != Variant::INT) continue;
    res[kv.first] = kv.second.i;
  }
  return res;
}

static unordered_map<long long, long long> buildMapIntInt(const Variant& v) {
  unordered_map<long long, long long> res;
  if (v.t != Variant::ARR) return res;

  for (auto &pair : v.a) {
    if (pair.t != Variant::ARR || pair.a.size() != 2) continue;
    if (pair.a[0].t != Variant::INT || pair.a[1].t != Variant::INT) continue;
    res[pair.a[0].i] = pair.a[1].i;
  }
  return res;
}

/* ===== Graph Builders ===== */

static vector<vector<int>> buildGraph(const Variant& v) {
  vector<vector<int>> graph;
  if (v.t != Variant::ARR) return graph;

  int maxNode = 0;
  for (auto &e : v.a) {
    if (e.t == Variant::ARR && e.a.size() >= 2) {
      maxNode = max(maxNode, (int)max(e.a[0].i, e.a[1].i));
    }
  }

  graph.assign(maxNode + 1, {});

  for (auto &e : v.a) {
    if (e.t != Variant::ARR || e.a.size() < 2) continue;
    int u = e.a[0].i;
    int v2 = e.a[1].i;
    graph[u].push_back(v2);
    // undirected graphs can add reverse edge in user code
  }

  return graph;
}

static vector<vector<pair<int,int>>> buildWeightedGraph(const Variant& v) {
  vector<vector<pair<int,int>>> graph;
  if (v.t != Variant::ARR) return graph;

  int maxNode = 0;
  for (auto &e : v.a) {
    if (e.t == Variant::ARR && e.a.size() == 3) {
      maxNode = max(maxNode, (int)max(e.a[0].i, e.a[1].i));
    }
  }

  graph.assign(maxNode + 1, {});

  for (auto &e : v.a) {
    if (e.t != Variant::ARR || e.a.size() != 3) continue;
    int u = e.a[0].i;
    int v2 = e.a[1].i;
    int w = e.a[2].i;
    graph[u].push_back({v2, w});
  }

  return graph;
}


/* ----- End shared runtime ----- */
`;
