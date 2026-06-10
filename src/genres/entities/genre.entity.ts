import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('genres')
export class Genre {
  /** TMDB genre id, reused as primary key so syncs are idempotent. */
  @ApiProperty({ description: 'TMDB genre id', example: 28 })
  @PrimaryColumn()
  id: number;

  @ApiProperty({ example: 'Action' })
  @Column({ unique: true })
  name: string;
}
