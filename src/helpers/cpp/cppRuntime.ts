export const CPP_RUNTIME = `
/* ----- Begin shared runtime (DO NOT EDIT) ----- */
struct Variant {
  enum T {NUL, INT, DBL, STR, ARR, MAP, BOOL} t;
  long long i; double d; bool b;
  string s;
  vector<Variant> a;
  map<string,Variant> m;
  Variant():t(NUL),i(0),d(0),b(false){}
};
/* helpers: trim, splitTopLevel, parseJavaStrictFormat, formatVariant */
/* ----- End shared runtime ----- */
`;
