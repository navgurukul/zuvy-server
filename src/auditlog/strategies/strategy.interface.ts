// `executor`: the caller's transaction, to write the audit entry atomically
// with the change it records. Without it the strategy uses its own.
export interface IAuditStrategy<T = any> {
  execute(dto: T, executor?: any): Promise<void>;
}
