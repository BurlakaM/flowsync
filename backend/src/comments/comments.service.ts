import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from "../prisma.service";
import {CommentsDto} from "./comments.dto";

@Injectable()
export class CommentsService {
    constructor(private readonly prismaService: PrismaService) {
    }

    async create(userId: number, dto: CommentsDto) {
        // A user may comment only on tasks they can see: own, assigned to them, or in their project.
        const task = await this.prismaService.task.findFirst({
            where: {
                id: dto.task_id,
                OR: [
                    {user_id: userId},
                    {project: {user_id: userId}},
                    {task_assignment: {some: {user_id: userId}}},
                ],
            },
            select: {id: true},
        });
        if (!task) throw new NotFoundException('Task not found');

        return this.prismaService.comment.create({
            data: {
                text: dto.text,
                user: {
                    connect: {
                        id: userId
                    }
                },
                task: {
                    connect: {
                        id: task.id
                    }
                }
            }
        })
    }
}
