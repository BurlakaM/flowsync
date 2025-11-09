import {Injectable} from '@nestjs/common';
import {PrismaService} from "../prisma.service";
import {CommentsDto} from "./comments.dto";

@Injectable()
export class CommentsService {
    constructor(private readonly prismaService: PrismaService) {
    }
    create(dto: CommentsDto) {
        return this.prismaService.comment.create({
            data: {
                text: dto.text,
                user: {
                    connect: {
                        id: dto.user_id
                    }
                },
                task: {
                    connect: {
                        id: dto.task_id
                    }
                }
            }
        })
    }
}
