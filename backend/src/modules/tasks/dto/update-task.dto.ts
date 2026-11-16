import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';

/** Every field is optional; `assigneeIds` and `tagIds`, when sent, replace the current sets. */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
