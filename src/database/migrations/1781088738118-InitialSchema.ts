import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1781088738118 implements MigrationInterface {
  name = 'InitialSchema1781088738118';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() for uuid primary keys; pg_trgm for fast ILIKE title search.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "refresh_token_hash" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "genres" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_f105f8230a83b86a346427de94d" UNIQUE ("name"), CONSTRAINT "PK_80ecd718f0f00dde5d77a9be842" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "movies" ("id" integer NOT NULL, "title" character varying NOT NULL, "original_title" character varying, "overview" text, "release_date" date, "poster_path" character varying, "backdrop_path" character varying, "original_language" character varying, "popularity" double precision NOT NULL DEFAULT '0', "tmdb_vote_average" double precision NOT NULL DEFAULT '0', "tmdb_vote_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c5b2c134e871bfd1c2fe7cc3705" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_5aa0bbd146c0082d3fc5a0ad5d" ON "movies" ("title") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_e41916f63afa790be81b9c55bf" ON "movies" ("release_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48d8ba656012a2c2b94fa05f88" ON "movies" ("popularity") `,
    );
    // Trigram index so title search (ILIKE '%term%') stays fast as the table grows.
    await queryRunner.query(
      `CREATE INDEX "IDX_movies_title_trgm" ON "movies" USING gin ("title" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "movie_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a6a48319d1810e2600cfad7b8ce" UNIQUE ("user_id", "movie_id"), CONSTRAINT "PK_0a02323c5cc02e094871f24062b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "movie_id" integer NOT NULL, "value" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_969fcc2afb64c8a81f487f60afa" UNIQUE ("user_id", "movie_id"), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45c7bafa4e537191add4eeed5b" ON "ratings" ("movie_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "movie_genres" ("movie_id" integer NOT NULL, "genre_id" integer NOT NULL, CONSTRAINT "PK_ec45eae1bc95d1461ad55713ffc" PRIMARY KEY ("movie_id", "genre_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae967ce58ef99e9ff3933ccea4" ON "movie_genres" ("movie_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bbbc12542564f7ff56e36f5bbf" ON "movie_genres" ("genre_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" ADD CONSTRAINT "FK_0072d2b5c5969c239be193df141" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" ADD CONSTRAINT "FK_bb77ae7f1e392503380f11198dc" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "FK_f49ef8d0914a14decddbb170f2f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ADD CONSTRAINT "FK_45c7bafa4e537191add4eeed5b3" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movie_genres" ADD CONSTRAINT "FK_ae967ce58ef99e9ff3933ccea48" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "movie_genres" ADD CONSTRAINT "FK_bbbc12542564f7ff56e36f5bbf6" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movie_genres" DROP CONSTRAINT "FK_bbbc12542564f7ff56e36f5bbf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movie_genres" DROP CONSTRAINT "FK_ae967ce58ef99e9ff3933ccea48"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "FK_45c7bafa4e537191add4eeed5b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "FK_f49ef8d0914a14decddbb170f2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" DROP CONSTRAINT "FK_bb77ae7f1e392503380f11198dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_items" DROP CONSTRAINT "FK_0072d2b5c5969c239be193df141"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_bbbc12542564f7ff56e36f5bbf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ae967ce58ef99e9ff3933ccea4"`);
    await queryRunner.query(`DROP TABLE "movie_genres"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_45c7bafa4e537191add4eeed5b"`);
    await queryRunner.query(`DROP TABLE "ratings"`);
    await queryRunner.query(`DROP TABLE "watchlist_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_movies_title_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_48d8ba656012a2c2b94fa05f88"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e41916f63afa790be81b9c55bf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5aa0bbd146c0082d3fc5a0ad5d"`);
    await queryRunner.query(`DROP TABLE "movies"`);
    await queryRunner.query(`DROP TABLE "genres"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
