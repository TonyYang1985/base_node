import { Expose } from 'class-transformer';

@Expose()
export class UserVo {
  id: string;

  @Expose()
  email: string;

  @Expose()
  password: string;

  @Expose()
  userName: string;

  @Expose()
  createdAt: Date;

  @Expose()
  app: string;

  @Expose()
  timezone: string;

  @Expose()
  isLocked: number;

  @Expose()
  mobileCountryCode: string;

  @Expose()
  mobileCallingCountryCode: string;

  @Expose()
  mobileNumber: string;

  @Expose()
  avatar: string;

  @Expose()
  lastSignIn: Date;
}
