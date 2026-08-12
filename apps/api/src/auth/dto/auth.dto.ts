import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
