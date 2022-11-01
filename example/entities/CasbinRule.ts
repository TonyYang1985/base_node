import { Column, Entity } from 'typeorm';

@Entity('casbin_rule', { schema: 'fot_database' })
export class CasbinRule {
  @Column('varchar', { primary: true, name: 'id', length: 10 })
  id: string;

  @Column('varchar', { name: 'ptype', nullable: true, length: 255 })
  ptype: string | null;

  @Column('varchar', { name: 'v0', nullable: true, length: 255 })
  v0: string | null;

  @Column('varchar', { name: 'v1', nullable: true, length: 255 })
  v1: string | null;

  @Column('varchar', { name: 'v2', nullable: true, length: 255 })
  v2: string | null;

  @Column('varchar', { name: 'v3', nullable: true, length: 255 })
  v3: string | null;

  @Column('varchar', { name: 'v4', nullable: true, length: 255 })
  v4: string | null;

  @Column('varchar', { name: 'v5', nullable: true, length: 255 })
  v5: string | null;

  constructor(init?: Partial<CasbinRule>) {
    Object.assign(this, init);
  }
}
