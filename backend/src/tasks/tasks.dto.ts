import {IsNumber, IsString} from "class-validator";

export class TasksDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsNumber()
    user_id: number;

    @IsNumber()
    project_id: number;
}

export type TasksUpdateDto = Partial<TasksDto>