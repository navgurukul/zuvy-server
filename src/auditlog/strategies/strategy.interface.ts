export interface IAuditStrategy<T = any> { execute(dto: T): Promise<void>; }
