import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Movie } from '../../movies/entities/movie.entity';
import { User } from '../../users/entities/user.entity';

@Entity('watchlist_items')
@Unique(['userId', 'movieId'])
export class WatchlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Lookups by user are covered by the leading column of the unique index.
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'movie_id' })
  movieId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
