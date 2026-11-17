import { PartialType } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

/**
 * Every field is optional; `assigneeIds` and `tagIds`, when sent, replace the current sets.
 * `version` is not optional: it is the version the client based its change on (from the last response).
 * If someone saved the task in the meantime the answer is 409 instead of a silent overwrite.
 */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsInt()
  @Min(1)
  version!: number;
}
