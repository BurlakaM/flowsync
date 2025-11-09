import {Injectable} from '@nestjs/common';
import {task} from "@prisma/client";
import {PrismaService} from "../prisma.service";
import {TasksDto} from "./tasks.dto";
import {UserService} from "../users/users.service";

@Injectable()
export class TasksService {
    constructor(private readonly prismaService: PrismaService, private readonly userService: UserService) {}
    getTasks(user: any) {
        return this.prismaService.task.findMany({
            where: {
                user_id: user.sub
            }
        });
    }

    create(dto: TasksDto) {
        return this.prismaService.task.create({
            data: {
                name: dto.name,
                description: dto.description,
                user: {
                    connect: {
                        id: dto.user_id
                    }
                },
                project: {
                    connect: {
                        id: dto.project_id
                    }
                }
            }
        })
    }
}
