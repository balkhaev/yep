export function escapeSql(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "");
}
