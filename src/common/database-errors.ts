import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

interface PostgresDriverError {
  code?: string;
}

function driverErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }
  return (error.driverError as PostgresDriverError)?.code;
}

/**
 * Existence pre-checks cannot prevent races between concurrent requests;
 * these helpers let services translate constraint violations raised by the
 * database (the real arbiter) into proper HTTP errors instead of 500s.
 */
export function isUniqueViolation(error: unknown): boolean {
  return driverErrorCode(error) === PG_UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return driverErrorCode(error) === PG_FOREIGN_KEY_VIOLATION;
}
