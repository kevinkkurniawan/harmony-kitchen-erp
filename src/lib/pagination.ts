import { NextResponse } from 'next/server';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  isAll: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function getPaginationParams(
  reqUrl: string | Request | URL,
  defaultLimit = 50,
  maxLimit = 1000
): PaginationParams {
  const url =
    typeof reqUrl === 'string'
      ? new URL(reqUrl, 'http://localhost')
      : reqUrl instanceof Request
        ? new URL(reqUrl.url)
        : reqUrl;

  const searchParams = url.searchParams;
  const isAll = searchParams.get('all') === 'true';

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') || '', 10);

  const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = !isNaN(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, maxLimit)
    : isAll
      ? maxLimit
      : defaultLimit;

  const skip = isAll ? 0 : (page - 1) * limit;

  return {
    page: isAll ? 1 : page,
    limit,
    skip,
    isAll,
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
  extra: Record<string, any> = {}
) {
  const totalPages = params.isAll ? 1 : Math.ceil(total / params.limit) || 1;
  const page = params.isAll ? 1 : params.page;

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    ...extra,
  });
}
