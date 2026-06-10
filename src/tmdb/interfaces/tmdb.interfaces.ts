export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}

export interface TmdbMovieBase {
  id: number;
  title: string;
  original_title: string | null;
  overview: string | null;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string | null;
  popularity: number;
  vote_average: number;
  vote_count: number;
}

/** List payloads (e.g. /movie/popular) reference genres by id only. */
export interface TmdbMovie extends TmdbMovieBase {
  genre_ids: number[];
}

/** Detail payloads (/movie/{id}) embed full genre objects. */
export interface TmdbMovieDetails extends TmdbMovieBase {
  genres: TmdbGenre[];
}

/** Entry in the /movie/changes feed. */
export interface TmdbChangedMovie {
  id: number;
  adult: boolean | null;
}

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
