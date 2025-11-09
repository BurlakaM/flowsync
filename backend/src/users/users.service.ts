import {Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma.service';
import {UserDto} from './user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) {}

    // Створення користувача
    async createUser(dto : UserDto) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const role_id = dto.role_id || 1;
        return this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                role: {
                    connect: {
                        id: role_id
                    }
                }
            },
        });

    }

    findUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email: email },
        });
    }
    findUserById(id: number) {
        return this.prisma.user.findUnique({
            where: { id: id },
        })
    }
}
