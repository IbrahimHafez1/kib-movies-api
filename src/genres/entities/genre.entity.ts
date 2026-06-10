import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('genres')
export class Genre {
  /** TMDB genre id, reused as primary key so syncs are idempotent. */
  @PrimaryColumn()
  id: number;

  @Column({ unique: true })
  name: string;
}
