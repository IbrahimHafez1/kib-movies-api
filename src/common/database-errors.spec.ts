import { QueryFailedError } from 'typeorm';
import { isForeignKeyViolation, isUniqueViolation } from './database-errors';

const queryError = (code: string): QueryFailedError =>
  new QueryFailedError('INSERT ...', [], { code } as never);

describe('database error helpers', () => {
  it('detects unique constraint violations', () => {
    expect(isUniqueViolation(queryError('23505'))).toBe(true);
    expect(isUniqueViolation(queryError('23503'))).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('detects foreign key violations', () => {
    expect(isForeignKeyViolation(queryError('23503'))).toBe(true);
    expect(isForeignKeyViolation(queryError('23505'))).toBe(false);
    expect(isForeignKeyViolation('not-an-error')).toBe(false);
  });
});
