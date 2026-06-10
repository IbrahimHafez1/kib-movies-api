import { PaginatedResponseDto } from './paginated-response.dto';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('defaults to the first page of 20 items', () => {
    const query = new PaginationQueryDto();

    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);
  });

  it('computes the offset from page and limit', () => {
    const query = Object.assign(new PaginationQueryDto(), { page: 4, limit: 10 });

    expect(query.offset).toBe(30);
  });
});

describe('PaginatedResponseDto', () => {
  it('computes pagination metadata', () => {
    const result = PaginatedResponseDto.of(['a', 'b'], 45, 2, 20);

    expect(result.data).toEqual(['a', 'b']);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  it('flags the last page', () => {
    const result = PaginatedResponseDto.of([], 45, 3, 20);

    expect(result.meta.hasNextPage).toBe(false);
  });

  it('handles empty result sets', () => {
    const result = PaginatedResponseDto.of([], 0, 1, 20);

    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
  });
});
