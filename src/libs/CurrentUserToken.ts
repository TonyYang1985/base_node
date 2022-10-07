export type CurrentUserToken = {
  uid: string;
  jwtid: string;
  app: string;
  iat?: number;
  exp?: number;
};
