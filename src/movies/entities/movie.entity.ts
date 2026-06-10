import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Genre } from '../../genres/entities/genre.entity';

@Entity('movies')
export class Movie {
  /** TMDB movie id, reused as primary key so syncs are idempotent. */
  @PrimaryColumn()
  id: number;

  @Index()
  @Column()
  title: string;

  @Column({ name: 'original_title', nullable: true, type: 'varchar' })
  originalTitle: string | null;

  @Column({ type: 'text', nullable: true })
  overview: string | null;

  @Index()
  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string | null;

  @Column({ name: 'poster_path', nullable: true, type: 'varchar' })
  posterPath: string | null;

  @Column({ name: 'backdrop_path', nullable: true, type: 'varchar' })
  backdropPath: string | null;

  @Column({ name: 'original_language', nullable: true, type: 'varchar' })
  originalLanguage: string | null;

  @Index()
  @Column({ type: 'float', default: 0 })
  popularity: number;

  @Column({ name: 'tmdb_vote_average', type: 'float', default: 0 })
  tmdbVoteAverage: number;

  @Column({ name: 'tmdb_vote_count', type: 'int', default: 0 })
  tmdbVoteCount: number;

  @ManyToMany(() => Genre)
  @JoinTable({
    name: 'movie_genres',
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: Genre[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
