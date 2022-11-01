import { Column, Entity } from 'typeorm';

@Entity('user', { schema: 'fot_database' })
export class User {
  @Column('varchar', { primary: true, name: 'id', length: 10 })
  id: string;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'password', nullable: true, length: 255 })
  password: string | null;

  @Column('varchar', { name: 'user_name', length: 255 })
  userName: string;

  @Column('timestamp', {
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column('varchar', { name: 'app', length: 255 })
  app: string;

  @Column('varchar', { name: 'timezone', length: 255 })
  timezone: string;

  @Column('tinyint', { name: 'is_locked' })
  isLocked: number;

  @Column('varchar', {
    name: 'mobile_country_code',
    nullable: true,
    length: 16,
  })
  mobileCountryCode: string | null;

  @Column('varchar', {
    name: 'mobile_calling_country_code',
    nullable: true,
    length: 16,
  })
  mobileCallingCountryCode: string | null;

  @Column('varchar', { name: 'mobile_number', nullable: true, length: 255 })
  mobileNumber: string | null;

  @Column('tinyint', { name: 'is_del', default: () => "'0'" })
  isDel: number;

  @Column('varchar', { name: 'avatar', nullable: true, length: 2048 })
  avatar: string | null;

  @Column('timestamp', { name: 'last_sign_in', nullable: true })
  lastSignIn: Date | null;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}
