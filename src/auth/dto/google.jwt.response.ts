export default class GoogleJwtResponseDto {
  email: string;
  sub: string;
  iat: string;
  exp: string;

  public static parseJwt(token: string): GoogleJwtResponseDto {
    const parsedJwt = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );
    const response = new GoogleJwtResponseDto();

    response.email = parsedJwt.email;
    response.exp = parsedJwt.exp;
    response.iat = parsedJwt.iat;
    response.sub = parsedJwt.sub;
  }

  public getEmail(): string {
    return this.email;
  }
}
