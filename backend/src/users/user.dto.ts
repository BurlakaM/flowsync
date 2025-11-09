import {IsString, IsEmail, MinLength, IsNumber} from 'class-validator';

export class UserDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsNumber()
    role_id: number;

    @IsString()
    @MinLength(8)
    password: string;
}
