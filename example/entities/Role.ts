import { Column, Entity, Index } from 'typeorm';

@Index('id', ['id'], { unique: true })
@Entity('role', { schema: 'fot_database' })
export class Role {
  @Column('varchar', { primary: true, name: 'id', length: 10 })
  id: string;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('varchar', { name: 'app', length: 255 })
  app: string;

  @Column('tinyint', { name: 'is_default' })
  isDefault: number;

  @Column('tinyint', { name: 'is_del', default: () => "'0'" })
  isDel: number;

  @Column('timestamp', { name: 'created_at' })
  createdAt: Date;

  @Column('timestamp', { name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  constructor(init?: Partial<Role>) {
    Object.assign(this, init);
  }
}
